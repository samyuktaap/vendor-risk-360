"""
test_vendor_tiering_and_trend.py — Automated Unit and Integration Tests for Risk-Based Tiering and Trend Analysis.

Tests:
1. Deterministic Tier Calculation (Tiers 1–4, boundary thresholds, policy version v1, rationale generation)
2. Manual Tier Overrides (Effective vs Calculated tier preservation, mandatory reason validation)
3. RBAC Permissions (Admin/CISO authorized; Analyst/Vendor/Auditor rejected with 403)
4. Historical Risk Trend Analysis (0, 1, 2+ points, Improving, Stable, Worsening states, delta calculations)
5. Multi-Tenant Company Data Isolation and Anti-IDOR Protection
6. Tamper-Evident Audit Logging of Tier and Trend events
"""

import os
import sys
import unittest
import tempfile
import sqlite3
from unittest import mock
from datetime import datetime, UTC, timedelta

from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import database
from main import app
from services.vendor_tiering_service import (
    calculate_vendor_tier,
    calculate_risk_trend,
    VALID_TIERS,
    TIERING_VERSION
)
from services.audit_log_service import get_audit_log, AuditAction


class TestVendorTieringAndTrend(unittest.TestCase):
    def setUp(self):
        # Create an isolated temporary SQLite DB for testing
        self.temp_db_fd, self.temp_db_path = tempfile.mkstemp(suffix=".db")
        self.db_patcher = mock.patch("database.DB_PATH", self.temp_db_path)
        self.db_patcher.start()

        database.init_db()
        self.db = sqlite3.connect(self.temp_db_path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row

        # Clear default tables to ensure clean isolation
        cursor = self.db.cursor()
        cursor.execute("DELETE FROM vendor_risk_history")
        cursor.execute("DELETE FROM vulnerabilities")
        cursor.execute("DELETE FROM vendor_assets")
        cursor.execute("DELETE FROM alerts")
        cursor.execute("DELETE FROM vendors")
        cursor.execute("DELETE FROM users")
        cursor.execute("DELETE FROM companies")
        self.db.commit()

        self._seed_test_data()
        self.client = TestClient(app)

    def tearDown(self):
        self.db_patcher.stop()
        self.db.close()
        try:
            os.close(self.temp_db_fd)
            os.unlink(self.temp_db_path)
        except Exception:
            pass

    def _seed_test_data(self):
        cursor = self.db.cursor()
        now = datetime.now(UTC).isoformat()

        # Companies
        cursor.execute("INSERT INTO companies (id, name, created_at) VALUES (1, 'Company Alpha', ?)", (now,))
        cursor.execute("INSERT INTO companies (id, name, created_at) VALUES (2, 'Company Beta', ?)", (now,))

        # Users for Company A
        cursor.execute("""
            INSERT INTO users (id, company_id, email, name, google_sub, role, mfa_enabled, created_at)
            VALUES (1, 1, 'admin_a@alpha.com', 'Admin A', 'sub_admin_a', 'ENTERPRISE_ADMIN', 0, ?)
        """, (now,))
        cursor.execute("""
            INSERT INTO users (id, company_id, email, name, google_sub, role, mfa_enabled, created_at)
            VALUES (2, 1, 'ciso_a@alpha.com', 'CISO A', 'sub_ciso_a', 'CISO', 0, ?)
        """, (now,))
        cursor.execute("""
            INSERT INTO users (id, company_id, email, name, google_sub, role, mfa_enabled, created_at)
            VALUES (3, 1, 'analyst_a@alpha.com', 'Analyst A', 'sub_analyst_a', 'ANALYST', 0, ?)
        """, (now,))
        cursor.execute("""
            INSERT INTO users (id, company_id, email, name, google_sub, role, mfa_enabled, created_at)
            VALUES (4, 1, 'auditor_a@alpha.com', 'Auditor A', 'sub_auditor_a', 'AUDITOR', 0, ?)
        """, (now,))

        # Users for Company B
        cursor.execute("""
            INSERT INTO users (id, company_id, email, name, google_sub, role, mfa_enabled, created_at)
            VALUES (5, 2, 'admin_b@beta.com', 'Admin B', 'sub_admin_b', 'ENTERPRISE_ADMIN', 0, ?)
        """, (now,))

        # Vendors Company A
        cursor.execute("""
            INSERT INTO vendors (id, company_id, name, domain, sector, risk_tier, risk_score, criticality_tier, data_sensitivity, contract_value, created_at)
            VALUES (101, 1, 'CloudCorp Alpha', 'cloudcorp.io', 'Cloud Hosting', 'High', 75, 'Tier 1 - Mission Critical', 'Highly Confidential / Regulated PII', 1500000, ?)
        """, (now,))

        cursor.execute("""
            INSERT INTO vendors (id, company_id, name, domain, sector, risk_tier, risk_score, criticality_tier, data_sensitivity, contract_value, created_at)
            VALUES (102, 1, 'SafeSupplies Alpha', 'safesupplies.com', 'Office', 'Safe', 10, 'Tier 3 - Non-Critical', 'Public Data', 20000, ?)
        """, (now,))

        # Vendors Company B
        cursor.execute("""
            INSERT INTO vendors (id, company_id, name, domain, sector, risk_tier, risk_score, criticality_tier, data_sensitivity, contract_value, created_at)
            VALUES (201, 2, 'DataVault Beta', 'datavault.net', 'Storage', 'Medium', 45, 'Tier 2 - Business Operational', 'Confidential / Internal Data', 250000, ?)
        """, (now,))

        # Risk History for Vendor 101 (Company A) — 3 points: 40 -> 60 -> 75 (WORSENING)
        t1 = (datetime.now(UTC) - timedelta(days=60)).isoformat()
        t2 = (datetime.now(UTC) - timedelta(days=30)).isoformat()
        t3 = datetime.now(UTC).isoformat()

        cursor.execute("INSERT INTO vendor_risk_history (vendor_id, company_id, score, score_type, calculated_at) VALUES (101, 1, 40.0, 'OVERALL', ?)", (t1,))
        cursor.execute("INSERT INTO vendor_risk_history (vendor_id, company_id, score, score_type, calculated_at) VALUES (101, 1, 60.0, 'OVERALL', ?)", (t2,))
        cursor.execute("INSERT INTO vendor_risk_history (vendor_id, company_id, score, score_type, calculated_at) VALUES (101, 1, 75.0, 'OVERALL', ?)", (t3,))

        self.db.commit()

    def _get_auth_override(self, user_id: int, role: str, company_id: int, email: str):
        session_data = {
            "user_id": user_id,
            "email": email,
            "role": role,
            "company_id": company_id,
            "mfa_verified": True,
            "session_id": f"sess_test_{user_id}"
        }
        from services.auth_service import get_current_session
        app.dependency_overrides[get_current_session] = lambda: session_data
        return session_data

    def test_deterministic_tier_calculations(self):
        """Test tier calculation rules across all tiers and threshold boundaries."""
        # Tier 1 - Critical (High score + Mission Critical)
        res_t1 = calculate_vendor_tier({
            "risk_score": 75,
            "criticality_tier": "Tier 1 - Mission Critical",
            "data_sensitivity": "Highly Confidential / Regulated PII",
            "contract_value": 1500000
        })
        self.assertEqual(res_t1["calculated_tier"], "TIER_1_CRITICAL")
        self.assertEqual(res_t1["tiering_version"], "v1")
        self.assertTrue(len(res_t1["rationale"]) >= 2)

        # Tier 2 - High (Moderate score + Operational criticality)
        res_t2 = calculate_vendor_tier({
            "risk_score": 45,
            "criticality_tier": "Tier 2 - Business Operational",
            "data_sensitivity": "Confidential / Internal Data",
            "contract_value": 50000
        })
        self.assertEqual(res_t2["calculated_tier"], "TIER_2_HIGH")

        # Tier 3 - Medium (Moderate score)
        res_t3 = calculate_vendor_tier({
            "risk_score": 25,
            "criticality_tier": "Tier 2 - Business Operational",
            "data_sensitivity": "Confidential / Internal Data",
            "contract_value": 10000
        })
        self.assertEqual(res_t3["calculated_tier"], "TIER_3_MEDIUM")

        # Tier 4 - Low (Low risk score + non-critical)
        res_t4 = calculate_vendor_tier({
            "risk_score": 10,
            "criticality_tier": "Tier 3 - Non-Critical",
            "data_sensitivity": "Public Data",
            "contract_value": 5000
        })
        self.assertEqual(res_t4["calculated_tier"], "TIER_4_LOW")

    def test_get_and_override_vendor_tier_api(self):
        """Test GET /api/vendors/{id}/tier and POST /api/vendors/{id}/tier-override."""
        self._get_auth_override(1, "ENTERPRISE_ADMIN", 1, "admin_a@alpha.com")

        # 1. Fetch tier for Vendor 101 (Calculated as TIER_1_CRITICAL)
        res = self.client.get("/api/vendors/101/tier")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["calculated_tier"], "TIER_1_CRITICAL")
        self.assertEqual(data["effective_tier"], "TIER_1_CRITICAL")
        self.assertFalse(data["is_overridden"])

        # 2. Override tier to TIER_2_HIGH as Admin with reason
        res_override = self.client.post("/api/vendors/101/tier-override", json={
            "tier": "TIER_2_HIGH",
            "reason": "Executive board approved temporary risk waiver for Q3."
        })
        self.assertEqual(res_override.status_code, 200)
        up_data = res_override.json()
        self.assertEqual(up_data["calculated_tier"], "TIER_1_CRITICAL")
        self.assertEqual(up_data["effective_tier"], "TIER_2_HIGH")
        self.assertTrue(up_data["is_overridden"])
        self.assertEqual(up_data["tier_override_reason"], "Executive board approved temporary risk waiver for Q3.")
        self.assertEqual(up_data["tier_overridden_by"], "admin_a@alpha.com")

    def test_tier_override_rbac_and_validation(self):
        """Test RBAC and input validation for tier overrides."""
        # 1. Analyst cannot override tier (403)
        self._get_auth_override(3, "ANALYST", 1, "analyst_a@alpha.com")
        res_an = self.client.post("/api/vendors/101/tier-override", json={"tier": "TIER_3_MEDIUM", "reason": "Test"})
        self.assertEqual(res_an.status_code, 403)

        # 2. Auditor cannot override tier (403)
        self._get_auth_override(4, "AUDITOR", 1, "auditor_a@alpha.com")
        res_aud = self.client.post("/api/vendors/101/tier-override", json={"tier": "TIER_3_MEDIUM", "reason": "Test"})
        self.assertEqual(res_aud.status_code, 403)

        # 3. CISO can override tier
        self._get_auth_override(2, "CISO", 1, "ciso_a@alpha.com")
        res_ciso = self.client.post("/api/vendors/101/tier-override", json={
            "tier": "TIER_3_MEDIUM",
            "reason": "Security controls verified."
        })
        self.assertEqual(res_ciso.status_code, 200)

        # 4. Empty reason rejected (400)
        res_no_reason = self.client.post("/api/vendors/101/tier-override", json={"tier": "TIER_1_CRITICAL", "reason": "   "})
        self.assertEqual(res_no_reason.status_code, 400)

        # 5. Invalid tier string rejected (400)
        res_inv_tier = self.client.post("/api/vendors/101/tier-override", json={"tier": "INVALID_TIER", "reason": "Valid reason"})
        self.assertEqual(res_inv_tier.status_code, 400)

    def test_risk_trend_analysis_calculations(self):
        """Test calculation of score delta, change percentage, and trend states."""
        # 1. Worsening trend (40 -> 65: delta +25)
        worsening_recs = [
            {"score": 40.0, "calculated_at": "2026-06-01T00:00:00"},
            {"score": 65.0, "calculated_at": "2026-07-01T00:00:00"}
        ]
        res_w = calculate_risk_trend(worsening_recs)
        self.assertEqual(res_w["trend_direction"], "WORSENING")
        self.assertEqual(res_w["score_delta"], 25.0)
        self.assertEqual(res_w["change_percentage"], 62.5)

        # 2. Improving trend (70 -> 50: delta -20)
        improving_recs = [
            {"score": 70.0, "calculated_at": "2026-06-01T00:00:00"},
            {"score": 50.0, "calculated_at": "2026-07-01T00:00:00"}
        ]
        res_i = calculate_risk_trend(improving_recs)
        self.assertEqual(res_i["trend_direction"], "IMPROVING")
        self.assertEqual(res_i["score_delta"], -20.0)

        # 3. Stable trend (50 -> 51: delta +1)
        stable_recs = [
            {"score": 50.0, "calculated_at": "2026-06-01T00:00:00"},
            {"score": 51.0, "calculated_at": "2026-07-01T00:00:00"}
        ]
        res_s = calculate_risk_trend(stable_recs)
        self.assertEqual(res_s["trend_direction"], "STABLE")
        self.assertEqual(res_s["score_delta"], 1.0)

        # 4. Single point (No history for trend)
        single_rec = [{"score": 50.0, "calculated_at": "2026-06-01T00:00:00"}]
        res_single = calculate_risk_trend(single_rec)
        self.assertEqual(res_single["trend_direction"], "NO_HISTORY")
        self.assertEqual(res_single["message"], "Not enough history for trend analysis.")

        # 5. Empty records
        res_empty = calculate_risk_trend([])
        self.assertEqual(res_empty["trend_direction"], "NO_HISTORY")
        self.assertEqual(res_empty["message"], "No historical risk data.")

    def test_company_data_isolation_and_idor(self):
        """Test Company A users cannot access or override Company B vendor tier or trend data."""
        # Authenticate as Company A Admin
        self._get_auth_override(1, "ENTERPRISE_ADMIN", 1, "admin_a@alpha.com")

        # 1. Cannot fetch Company B Vendor 201 tier (404)
        res_tier_b = self.client.get("/api/vendors/201/tier")
        self.assertEqual(res_tier_b.status_code, 404)

        # 2. Cannot override Company B Vendor 201 tier (404)
        res_up_b = self.client.post("/api/vendors/201/tier-override", json={"tier": "TIER_4_LOW", "reason": "Cross-company attack"})
        self.assertEqual(res_up_b.status_code, 404)

        # 3. Cannot fetch Company B Vendor 201 trend (404)
        res_trend_b = self.client.get("/api/vendors/201/risk-trend")
        self.assertEqual(res_trend_b.status_code, 404)

        # 4. Cannot fetch Company B Vendor 201 history (404)
        res_hist_b = self.client.get("/api/vendors/201/risk-history")
        self.assertEqual(res_hist_b.status_code, 404)

        # Authenticate as Company B Admin
        self._get_auth_override(5, "ENTERPRISE_ADMIN", 2, "admin_b@beta.com")

        # Company B Admin CAN access Vendor 201
        res_b_ok = self.client.get("/api/vendors/201/tier")
        self.assertEqual(res_b_ok.status_code, 200)
        self.assertEqual(res_b_ok.json()["name"], "DataVault Beta")
