"""
test_dashboard_isolation.py — Verification tests for /api/dashboard/metrics
Ensures complete multi-tenant company isolation, IDOR/tampering protection,
unauthenticated (401) and unauthorized (403) handling, and clean empty states.
"""

import os
import sys
import unittest
import sqlite3
import tempfile
from pathlib import Path
from unittest import mock
from datetime import datetime, UTC, timedelta
from fastapi.testclient import TestClient

# Ensure backend/ is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from main import app
from database import get_db, init_db
from tests.test_encryption import _reset_singletons

class TestDashboardIsolation(unittest.TestCase):

    def setUp(self):
        _reset_singletons()
        self.db_fd, self.db_path = tempfile.mkstemp(prefix="vr360_dashboard_test_", suffix=".db")
        self.db_path_patcher = mock.patch("database.DB_PATH", self.db_path)
        self.db_path_patcher.start()
        
        init_db()
        
        self.db = sqlite3.connect(self.db_path, timeout=10.0, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        
        def _get_test_db():
            conn = sqlite3.connect(self.db_path, timeout=10.0, check_same_thread=False)
            conn.row_factory = sqlite3.Row
            return conn
            
        self.get_db_patcher = mock.patch("database.get_db", side_effect=_get_test_db)
        self.get_db_patcher.start()
        
        app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(app)

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

    def _create_company(self, name):
        cursor = self.db.cursor()
        now = datetime.now(UTC).isoformat()
        cursor.execute("INSERT INTO companies (name, created_at) VALUES (?, ?)", (name, now))
        self.db.commit()
        return cursor.lastrowid

    def _create_user_and_session(self, email, role, company_id=0):
        cursor = self.db.cursor()
        now = datetime.now(UTC).isoformat()
        cursor.execute(
            "INSERT INTO users (email, name, google_sub, role, company_id, mfa_enabled, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)",
            (email, email.split("@")[0], f"sub_{email}", role, company_id, now)
        )
        user_id = cursor.lastrowid
        self.db.commit()

        session_id = f"sess_{email}"
        expires_at = (datetime.now(UTC) + timedelta(hours=1)).isoformat()
        cursor.execute(
            "INSERT INTO sessions (session_id, user_id, ip_address, user_agent, mfa_verified, created_at, expires_at, last_activity_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?)",
            (session_id, user_id, "127.0.0.1", "test-client", now, expires_at, now)
        )
        self.db.commit()
        return session_id

    def _create_vendor(self, company_id, name, domain, risk_score=20, risk_tier="SAFE"):
        cursor = self.db.cursor()
        now = datetime.now(UTC).isoformat()
        cursor.execute(
            """INSERT INTO vendors (company_id, name, domain, sector, risk_score, risk_tier, created_at)
               VALUES (?, ?, ?, 'Tech', ?, ?, ?)""",
            (company_id, name, domain, risk_score, risk_tier, now)
        )
        vendor_id = cursor.lastrowid
        self.db.commit()
        return vendor_id

    def _create_assessment(self, vendor_id, status="DRAFT"):
        cursor = self.db.cursor()
        now = datetime.now(UTC).isoformat()
        cursor.execute(
            "INSERT INTO assessments (vendor_id, status, created_at) VALUES (?, ?, ?)",
            (vendor_id, status, now)
        )
        self.db.commit()
        return cursor.lastrowid

    def _create_compliance_framework(self, vendor_id, framework_name, next_due_at):
        cursor = self.db.cursor()
        now = datetime.now(UTC).isoformat()
        cursor.execute(
            """INSERT INTO compliance_frameworks (vendor_id, framework_name, framework_type, compliance_score, last_assessed_at, next_due_at, status)
               VALUES (?, ?, 'Security', 80, ?, ?, 'ASSESSED')""",
            (vendor_id, framework_name, now, next_due_at)
        )
        self.db.commit()

    def _create_risk_history(self, assessment_id, vendor_id, total_score, date_str):
        cursor = self.db.cursor()
        cursor.execute(
            """INSERT INTO risk_assessment_scores 
               (assessment_id, vendor_id, total_score, risk_level, cybersecurity_score, compliance_score, financial_stability_score, operational_risk_score, data_privacy_score, scoring_version, calculated_at) 
               VALUES (?, ?, ?, 'HIGH', 85.0, 85.0, 85.0, 85.0, 85.0, '1.0', ?)""",
            (assessment_id, vendor_id, total_score, date_str)
        )
        self.db.commit()

    # Requirement 4: Endpoint returns 401 without authentication
    def test_unauthenticated_returns_401(self):
        res = self.client.get("/api/dashboard/metrics")
        self.assertEqual(res.status_code, 401)

    # Requirement 5: Endpoint returns 403 when user has no company association
    def test_user_without_company_returns_403(self):
        sess_no_comp = self._create_user_and_session("nocomp@test.com", "ANALYST", company_id=0)
        res = self.client.get("/api/dashboard/metrics", cookies={"vr360_session": sess_no_comp})
        self.assertEqual(res.status_code, 403)
        self.assertIn("company association", res.json()["detail"].lower())

    # Requirement 1, 2, 6: Company A & Company B data isolation for metrics, distribution, and trend
    def test_company_data_isolation(self):
        comp_a = self._create_company("Company A")
        comp_b = self._create_company("Company B")

        user_a_sess = self._create_user_and_session("usera@compa.com", "CISO", comp_a)
        user_b_sess = self._create_user_and_session("userb@compb.com", "ANALYST", comp_b)

        # Company A data: 2 vendors (1 high risk, 1 safe), 1 draft assessment, 1 expiring cert
        v_a1 = self._create_vendor(comp_a, "Vendor A1", "va1.com", risk_score=85, risk_tier="CRITICAL")
        v_a2 = self._create_vendor(comp_a, "Vendor A2", "va2.com", risk_score=15, risk_tier="SAFE")
        ass_a1 = self._create_assessment(v_a1, status="DRAFT")
        expiring_date = (datetime.now(UTC) + timedelta(days=10)).isoformat()
        self._create_compliance_framework(v_a1, "SOC2", expiring_date)
        self._create_risk_history(ass_a1, v_a1, 85, "2026-08-01 10:00:00")

        # Company B data: 1 vendor (watch risk), 0 pending assessments, 0 expiring certs
        v_b1 = self._create_vendor(comp_b, "Vendor B1", "vb1.com", risk_score=50, risk_tier="WATCH")
        ass_b1 = self._create_assessment(v_b1, status="SUBMITTED")
        self._create_risk_history(ass_b1, v_b1, 50, "2026-08-01 10:00:00")

        # Fetch Company A Dashboard
        res_a = self.client.get("/api/dashboard/metrics", cookies={"vr360_session": user_a_sess})
        self.assertEqual(res_a.status_code, 200)
        data_a = res_a.json()

        self.assertEqual(data_a["total_vendors"], 2)
        self.assertEqual(data_a["high_risk_vendors"], 1)
        self.assertEqual(data_a["pending_assessments"], 1)
        self.assertEqual(data_a["expiring_certifications"], 1)
        self.assertEqual(data_a["overall_risk_score"], 50) # Avg of (85+15)/2 = 50
        self.assertEqual(data_a["risk_distribution"].get("CRITICAL"), 1)
        self.assertEqual(data_a["risk_distribution"].get("SAFE"), 1)
        self.assertNotIn("WATCH", data_a["risk_distribution"])
        self.assertEqual(len(data_a["risk_trend"]), 1)
        self.assertEqual(data_a["risk_trend"][0]["avg_score"], 85)

        # Fetch Company B Dashboard
        res_b = self.client.get("/api/dashboard/metrics", cookies={"vr360_session": user_b_sess})
        self.assertEqual(res_b.status_code, 200)
        data_b = res_b.json()

        self.assertEqual(data_b["total_vendors"], 1)
        self.assertEqual(data_b["high_risk_vendors"], 0)
        self.assertEqual(data_b["pending_assessments"], 0)
        self.assertEqual(data_b["expiring_certifications"], 0)
        self.assertEqual(data_b["overall_risk_score"], 50)
        self.assertEqual(data_b["risk_distribution"].get("WATCH"), 1)
        self.assertNotIn("CRITICAL", data_b["risk_distribution"])
        self.assertNotIn("SAFE", data_b["risk_distribution"])
        self.assertEqual(len(data_b["risk_trend"]), 1)
        self.assertEqual(data_b["risk_trend"][0]["avg_score"], 50)

    # Requirement 3: User A cannot manipulate parameters/headers to view Company B metrics
    def test_anti_tampering_idor_protection(self):
        comp_a = self._create_company("Company A")
        comp_b = self._create_company("Company B")

        user_a_sess = self._create_user_and_session("usera@compa.com", "CISO", comp_a)

        self._create_vendor(comp_a, "Vendor A1", "va1.com", risk_score=20, risk_tier="SAFE")
        self._create_vendor(comp_b, "Vendor B1", "vb1.com", risk_score=90, risk_tier="CRITICAL")

        # 1. Query parameter manipulation
        res = self.client.get(
            f"/api/dashboard/metrics?company_id={comp_b}&company={comp_b}&user_id=9999",
            cookies={"vr360_session": user_a_sess}
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["total_vendors"], 1)
        self.assertEqual(data["high_risk_vendors"], 0)  # Still Company A!

        # 2. Custom Header manipulation
        res_hdr = self.client.get(
            "/api/dashboard/metrics",
            headers={"X-Company-ID": str(comp_b), "X-User-ID": "9999", "Company-ID": str(comp_b)},
            cookies={"vr360_session": user_a_sess}
        )
        self.assertEqual(res_hdr.status_code, 200)
        data_hdr = res_hdr.json()
        self.assertEqual(data_hdr["total_vendors"], 1)
        self.assertEqual(data_hdr["high_risk_vendors"], 0)  # Still Company A!

    # Requirement 7 & 8: Empty state produces zeros, no hard-coded fake data
    def test_empty_company_returns_zero_state(self):
        comp_empty = self._create_company("Empty Corp")
        user_empty_sess = self._create_user_and_session("user@empty.com", "ANALYST", comp_empty)

        res = self.client.get("/api/dashboard/metrics", cookies={"vr360_session": user_empty_sess})
        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertEqual(data["total_vendors"], 0)
        self.assertEqual(data["high_risk_vendors"], 0)
        self.assertEqual(data["pending_assessments"], 0)
        self.assertEqual(data["expiring_certifications"], 0)
        self.assertEqual(data["overall_risk_score"], 0)
        self.assertEqual(data["risk_distribution"], {})
        self.assertEqual(data["risk_trend"], [])

if __name__ == "__main__":
    unittest.main()
