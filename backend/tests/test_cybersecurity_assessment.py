"""
test_cybersecurity_assessment.py — Automated test suite for Cybersecurity 360° Assessment module.

Tests:
1. Questions catalog completeness (12 domains)
2. Deterministic 0-100 risk score calculation
3. Assessment creation (DRAFT), draft saving, answer retrieval, and submission
4. Score history persistence
5. Evidence status transitions (MISSING, PRESENT, REVIEWED, REJECTED) & RBAC review rules
6. Multi-tenant company data isolation & IDOR prevention (403/404)
7. Unassessed vendor score 404 response
"""

import os
import sys
import tempfile
import unittest
from unittest import mock
from pathlib import Path
import sqlite3
import json
from datetime import datetime, UTC, timedelta

# Ensure backend/ is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from main import app
import database
from database import get_db, init_db
from services.cybersecurity_scoring import calculate_cybersecurity_score, SCORING_VERSION
from services.cybersecurity_catalog import QUESTIONS_CATALOG, CYBERSECURITY_DOMAINS
from services.auth_service import SESSION_COOKIE_NAME
from tests.test_encryption import _reset_singletons


class TestCybersecurityAssessment(unittest.TestCase):

    def setUp(self):
        _reset_singletons()
        self.db_fd, self.db_path = tempfile.mkstemp(prefix="vr360_cyber_test_", suffix=".db")
        self.db_path_patcher = mock.patch("database.DB_PATH", self.db_path)
        self.db_path_patcher.start()

        init_db()

        self.db = sqlite3.connect(self.db_path, timeout=10.0, check_same_thread=False)
        self.db.row_factory = sqlite3.Row

        # Clear default seeded records
        cursor = self.db.cursor()
        cursor.execute("DELETE FROM cybersecurity_score_history")
        cursor.execute("DELETE FROM cybersecurity_answers")
        cursor.execute("DELETE FROM cybersecurity_assessments")
        cursor.execute("DELETE FROM audit_log")
        cursor.execute("DELETE FROM sessions")
        cursor.execute("DELETE FROM vendors")
        cursor.execute("DELETE FROM users")
        cursor.execute("DELETE FROM companies")
        self.db.commit()

        def _get_test_db():
            conn = sqlite3.connect(self.db_path, timeout=10.0, check_same_thread=False)
            conn.row_factory = sqlite3.Row
            return conn

        self.get_db_patcher = mock.patch("database.get_db", side_effect=_get_test_db)
        self.get_db_patcher.start()

        app.dependency_overrides[get_db] = _get_test_db
        self.client = TestClient(app)

        self._seed_test_data()

    def tearDown(self):
        app.dependency_overrides.clear()
        self.get_db_patcher.stop()
        self.db_path_patcher.stop()
        self.db.close()
        try:
            os.close(self.db_fd)
            os.remove(self.db_path)
        except Exception:
            pass
        _reset_singletons()

    def _seed_test_data(self):
        cursor = self.db.cursor()
        now = datetime.now(UTC).isoformat()
        
        # Company A (id=1)
        cursor.execute("INSERT INTO companies (id, name, created_at) VALUES (1, 'Company Alpha', ?)", (now,))
        cursor.execute("""
            INSERT INTO users (id, company_id, email, name, google_sub, role, mfa_enabled, created_at)
            VALUES (1, 1, 'user_a@alpha.com', 'Alice Alpha', 'sub_user_a', 'CISO', 1, ?)
        """, (now,))
        cursor.execute("""
            INSERT INTO vendors (id, company_id, name, domain, sector, risk_score, risk_tier, created_at)
            VALUES (101, 1, 'Vendor Alpha 1', 'vendor-alpha.com', 'Technology', 25.0, 'SAFE', ?)
        """, (now,))

        # Company B (id=2)
        cursor.execute("INSERT INTO companies (id, name, created_at) VALUES (2, 'Company Beta', ?)", (now,))
        cursor.execute("""
            INSERT INTO users (id, company_id, email, name, google_sub, role, mfa_enabled, created_at)
            VALUES (2, 2, 'user_b@beta.com', 'Bob Beta', 'sub_user_b', 'CISO', 1, ?)
        """, (now,))
        cursor.execute("""
            INSERT INTO vendors (id, company_id, name, domain, sector, risk_score, risk_tier, created_at)
            VALUES (102, 2, 'Vendor Beta 1', 'vendor-beta.com', 'Finance', 65.0, 'WATCH', ?)
        """, (now,))
        self.db.commit()

    def _auth_cookie(self, user_id: int = 1, company_id: int = 1, role: str = "CISO") -> dict:
        cursor = self.db.cursor()
        now = datetime.now(UTC).isoformat()
        
        cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
        if not cursor.fetchone():
            cursor.execute(
                "INSERT INTO users (id, company_id, email, name, google_sub, role, mfa_enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)",
                (user_id, company_id, f"user_{user_id}@test.com", f"User {user_id}", f"sub_user_{user_id}", role, now)
            )
        else:
            cursor.execute("UPDATE users SET role = ?, company_id = ? WHERE id = ?", (role, company_id, user_id))
            
        session_id = f"sess_{user_id}_{company_id}_{role}"
        expires_at = (datetime.now(UTC) + timedelta(hours=1)).isoformat()
        
        cursor.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
        cursor.execute(
            "INSERT INTO sessions (session_id, user_id, ip_address, user_agent, mfa_verified, created_at, expires_at, last_activity_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?)",
            (session_id, user_id, "127.0.0.1", "pytest-client", now, expires_at, now)
        )
        self.db.commit()
        
        return {SESSION_COOKIE_NAME: session_id}

    def test_questions_catalog_completeness(self):
        self.assertEqual(len(CYBERSECURITY_DOMAINS), 12)
        self.assertGreaterEqual(len(QUESTIONS_CATALOG), 16)
        domains_covered = set(q["domain"] for q in QUESTIONS_CATALOG)
        for dom in CYBERSECURITY_DOMAINS:
            self.assertIn(dom["id"], domains_covered)

    def test_deterministic_scoring_engine(self):
        # 1. Perfect answers (YES to all control questions, best MC options, present evidence)
        perfect_answers = []
        for q in QUESTIONS_CATALOG:
            val = "YES" if q["response_type"] == "YES_NO" else (q["options"][0]["value"] if q["options"] else "Text answer ok")
            perfect_answers.append({
                "question_id": q["question_id"],
                "domain": q["domain"],
                "answer_value": val,
                "evidence_status": "PRESENT" if q["evidence_required"] else "MISSING"
            })
            
        score_res = calculate_cybersecurity_score(perfect_answers)
        self.assertEqual(score_res["scoring_version"], SCORING_VERSION)
        self.assertEqual(score_res["cybersecurity_score"], 0.0)
        self.assertEqual(score_res["risk_level"], "SAFE")
        self.assertEqual(len(score_res["domain_scores"]), 12)

        # 2. Worst answers (NO to all control questions, worst MC options)
        worst_answers = []
        for q in QUESTIONS_CATALOG:
            val = "NO" if q["response_type"] == "YES_NO" else (q["options"][-1]["value"] if q["options"] else "")
            worst_answers.append({
                "question_id": q["question_id"],
                "domain": q["domain"],
                "answer_value": val,
                "evidence_status": "REJECTED" if q["evidence_required"] else "MISSING"
            })
            
        worst_res = calculate_cybersecurity_score(worst_answers)
        self.assertEqual(worst_res["cybersecurity_score"], 100.0)
        self.assertEqual(worst_res["risk_level"], "CRITICAL")

    def test_create_and_fetch_cybersecurity_assessment_flow(self):
        cookies = self._auth_cookie(user_id=1, company_id=1)
        
        # 1. Create assessment
        res = self.client.post("/api/vendors/101/cybersecurity-assessments", cookies=cookies)
        self.assertEqual(res.status_code, 200)
        ass = res.json()
        self.assertEqual(ass["vendor_id"], 101)
        self.assertEqual(ass["company_id"], 1)
        self.assertEqual(ass["status"], "DRAFT")
        self.assertIn("questions_catalog", ass)
        self.assertEqual(len(ass["domains"]), 12)
        ass_id = ass["id"]
        
        # 2. Save draft answers
        answers_payload = {
            "answers": [
                {"question_id": "GOV_01", "domain": "SECURITY_GOVERNANCE", "answer_value": "YES", "evidence_document_id": 99},
                {"question_id": "IAM_01", "domain": "IDENTITY_ACCESS_MANAGEMENT", "answer_value": "YES"},
                {"question_id": "DPE_01", "domain": "DATA_PROTECTION_ENCRYPTION", "answer_value": "NO"}
            ]
        }
        put_res = self.client.put(f"/api/cybersecurity-assessments/{ass_id}/answers", json=answers_payload, cookies=cookies)
        self.assertEqual(put_res.status_code, 200)
        updated = put_res.json()
        self.assertEqual(len(updated["answers"]), 3)
        
        gov_ans = next(a for a in updated["answers"] if a["question_id"] == "GOV_01")
        self.assertEqual(gov_ans["evidence_status"], "PRESENT")
        self.assertEqual(gov_ans["evidence_document_id"], 99)

        # 3. Submit assessment
        sub_res = self.client.post(f"/api/cybersecurity-assessments/{ass_id}/submit", cookies=cookies)
        self.assertEqual(sub_res.status_code, 200)
        final = sub_res.json()
        self.assertEqual(final["status"], "SUBMITTED")
        self.assertIsNotNone(final["cybersecurity_score"])
        self.assertIsNotNone(final["submitted_at"])

        # 4. Fetch latest score
        score_res = self.client.get("/api/vendors/101/cybersecurity-score", cookies=cookies)
        self.assertEqual(score_res.status_code, 200)
        score_json = score_res.json()
        self.assertEqual(score_json["cybersecurity_score"], final["cybersecurity_score"])

        # 5. Fetch score history
        hist_res = self.client.get("/api/vendors/101/cybersecurity-history", cookies=cookies)
        self.assertEqual(hist_res.status_code, 200)
        history = hist_res.json()["history"]
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["assessment_id"], ass_id)

    def test_evidence_review_and_rbac(self):
        cookies_ciso = self._auth_cookie(user_id=1, company_id=1, role="CISO")
        cookies_analyst = self._auth_cookie(user_id=3, company_id=1, role="ANALYST")

        # Create & save draft with evidence
        res = self.client.post("/api/vendors/101/cybersecurity-assessments", cookies=cookies_ciso)
        ass_id = res.json()["id"]
        self.client.put(f"/api/cybersecurity-assessments/{ass_id}/answers", json={
            "answers": [{"question_id": "GOV_01", "domain": "SECURITY_GOVERNANCE", "answer_value": "YES", "evidence_document_id": 10}]
        }, cookies=cookies_ciso)

        # Analyst role should be denied review capability (403)
        rev_denied = self.client.put(f"/api/cybersecurity-assessments/{ass_id}/evidence/GOV_01/review", json={"status": "REVIEWED"}, cookies=cookies_analyst)
        self.assertEqual(rev_denied.status_code, 403)

        # CISO role review succeeds
        rev_ok = self.client.put(f"/api/cybersecurity-assessments/{ass_id}/evidence/GOV_01/review", json={"status": "REVIEWED", "notes": "SOC 2 report verified"}, cookies=cookies_ciso)
        self.assertEqual(rev_ok.status_code, 200)
        self.assertEqual(rev_ok.json()["evidence_status"], "REVIEWED")

    def test_company_isolation_and_idor_protection(self):
        cookies_user_a = self._auth_cookie(user_id=1, company_id=1)
        cookies_user_b = self._auth_cookie(user_id=2, company_id=2)

        # User A creates assessment for Vendor A (101)
        res_a = self.client.post("/api/vendors/101/cybersecurity-assessments", cookies=cookies_user_a)
        ass_id_a = res_a.json()["id"]

        # 1. User B tries to view User A's vendor cybersecurity assessments -> 403 Access Denied
        res_b_view_vendor = self.client.get("/api/vendors/101/cybersecurity-assessments", cookies=cookies_user_b)
        self.assertEqual(res_b_view_vendor.status_code, 403)

        # 2. User B tries to view User A's assessment by ID -> 404/403
        res_b_view_ass = self.client.get(f"/api/cybersecurity-assessments/{ass_id_a}", cookies=cookies_user_b)
        self.assertIn(res_b_view_ass.status_code, (403, 404))

        # 3. User B tries to save answers into User A's assessment -> 404/403
        res_b_save = self.client.put(f"/api/cybersecurity-assessments/{ass_id_a}/answers", json={"answers": []}, cookies=cookies_user_b)
        self.assertIn(res_b_save.status_code, (403, 404))

        # 4. User B tries to submit User A's assessment -> 404/403
        res_b_sub = self.client.post(f"/api/cybersecurity-assessments/{ass_id_a}/submit", cookies=cookies_user_b)
        self.assertIn(res_b_sub.status_code, (403, 404))

        # 5. User B tries to access score for Vendor A -> 403
        res_b_score = self.client.get("/api/vendors/101/cybersecurity-score", cookies=cookies_user_b)
        self.assertEqual(res_b_score.status_code, 403)

    def test_unassessed_vendor_score_endpoint_returns_404(self):
        cookies = self._auth_cookie(user_id=1, company_id=1)
        res = self.client.get("/api/vendors/101/cybersecurity-score", cookies=cookies)
        self.assertEqual(res.status_code, 404)
        self.assertIn("No Cybersecurity 360° assessment yet.", res.json()["detail"])

if __name__ == "__main__":
    unittest.main()
