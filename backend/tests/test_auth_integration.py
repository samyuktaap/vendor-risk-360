"""
test_auth_integration.py — Integration tests verifying API protections, role permissions,
and frontend independence from localStorage authentication.
"""

import os
import sys
import unittest
import sqlite3
import tempfile
import time
from pathlib import Path
from unittest import mock
from datetime import datetime, UTC, timedelta
from fastapi.testclient import TestClient

# Ensure backend/ is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from main import app
from database import get_db, init_db
from services.auth_service import create_session, get_session
from tests.test_encryption import _reset_singletons

class TestAuthIntegration(unittest.TestCase):

    def setUp(self):
        _reset_singletons()
        self.db_fd, self.db_path = tempfile.mkstemp(prefix="vr360_integration_", suffix=".db")
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
        
        os.environ["GOOGLE_CLIENT_ID"] = "test-client-id"
        os.environ["AUDIT_HMAC_KEY"] = "test-audit-hmac-key-value-1234"

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

    def _login_as(self, email, role, mfa_verified=True):
        """Helper to create a session in the test DB and return the session ID."""
        cursor = self.db.cursor()
        now = datetime.now(UTC).isoformat()
        cursor.execute(
            "INSERT INTO users (email, name, google_sub, role, mfa_enabled, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (email, email.split("@")[0], f"sub_{email}", role, 1 if mfa_verified else 0, now)
        )
        user_id = cursor.lastrowid
        self.db.commit()

        session_id = f"sess_{email}"
        expires_at = (datetime.now(UTC) + timedelta(hours=1)).isoformat()
        cursor.execute(
            "INSERT INTO sessions (session_id, user_id, ip_address, user_agent, mfa_verified, created_at, expires_at, last_activity_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (session_id, user_id, "127.0.0.1", "test-client", 1 if mfa_verified else 0, now, expires_at, now)
        )
        self.db.commit()
        return session_id

    # 1. Test 401 Unauthorized for Protected Endpoints
    def test_protected_endpoints_return_401_without_session(self):
        protected_endpoints = [
            ("/api/vendors", "GET", None),
            ("/api/vendors", "POST", {"name": "Test", "domain": "test.com", "sector": "Cloud"}),
            ("/api/vendors/1", "GET", None),
            ("/api/vendors/1/refresh", "POST", None),
            ("/api/vendors/1", "DELETE", None),
            ("/api/vendors/1/shap-risk", "GET", None),
            ("/api/contagion", "GET", None),
            ("/api/feed", "GET", None),
            ("/api/quota", "GET", None),
            ("/api/quota/reset", "POST", None),
            ("/api/incidents", "GET", None),
            ("/api/vendors/1/incidents", "GET", None),
            ("/api/vendors/1/incidents", "POST", {"title": "Breach", "severity": "HIGH", "status": "OPEN"}),
            ("/api/incidents", "POST", {"vendor_id": 1, "title": "Breach", "severity": "HIGH", "status": "OPEN"}),
            ("/api/incidents/1", "PATCH", {"status": "RESOLVED"}),
            ("/api/incidents/1", "DELETE", None),
            ("/api/incidents/recalculate-aging", "POST", None),
            ("/api/compliance/frameworks", "GET", None),
            ("/api/vendors/1/compliance", "GET", None),
            ("/api/vendors/1/compliance", "POST", {"framework_name": "SOC2", "framework_type": "Security", "compliance_score": 90}),
            ("/api/compliance/1", "PATCH", {"compliance_score": 95, "gaps_identified": 0, "controls_passed": 10, "controls_total": 10}),
            ("/api/compliance/summary", "GET", None),
            ("/api/vendors/1/remediation", "GET", None),
            ("/api/vendors/1/remediation", "POST", {"title": "Fix", "priority": "HIGH", "source_type": "MANUAL"}),
            ("/api/remediation/1", "PATCH", {"status": "IN_PROGRESS"}),
            ("/api/remediation/summary", "GET", None),
            ("/api/vendors/1/sub-vendors", "GET", None),
            ("/api/vendors/1/sub-vendors", "POST", {"name": "Sub", "domain": "sub.com"}),
            ("/api/sub-vendors/1", "DELETE", None),
        ]

        for path, method, payload in protected_endpoints:
            with self.subTest(path=path, method=method):
                if method == "GET":
                    response = self.client.get(path)
                elif method == "POST":
                    response = self.client.post(path, json=payload)
                elif method == "PATCH":
                    response = self.client.patch(path, json=payload)
                elif method == "DELETE":
                    response = self.client.delete(path)
                self.assertEqual(response.status_code, 401, f"{method} {path} did not return 401")

    # 2. Test 403 Forbidden for Insufficient Roles
    def test_insufficient_roles_receive_403(self):
        # Onboard a vendor in DB first so endpoints have a target
        cursor = self.db.cursor()
        cursor.execute("INSERT INTO vendors (id, name, domain, sector, risk_tier, risk_score, created_at) VALUES (1, 'Acme', 'acme.com', 'IT', 'Safe', 10, '2026-08-16T14:59:00')")
        self.db.commit()

        # Login as ANALYST (has valid session but should be denied on CISO-only actions like delete vendor)
        sess_id = self._login_as("analyst@acme-corp.com", "ANALYST")
        self.client.cookies.set("vr360_session", sess_id)

        # Deleting vendor should fail for ANALYST (403)
        response = self.client.delete("/api/vendors/1")
        self.assertEqual(response.status_code, 403)

        # Deleting incident should fail for ANALYST (403)
        response = self.client.delete("/api/incidents/1")
        self.assertEqual(response.status_code, 403)

        # Resetting quotas should fail for ANALYST (403)
        response = self.client.post("/api/quota/reset")
        self.assertEqual(response.status_code, 403)

    # 3. Test frontend no longer relies on localStorage
    def test_frontend_does_not_use_localstorage_for_user(self):
        frontend_app_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "src" / "App.jsx"
        self.assertTrue(frontend_app_path.exists(), "App.jsx not found at path")
        
        content = frontend_app_path.read_text(encoding="utf-8")
        
        # We must prove we do not read from or write to localStorage for vendor_risk_user
        self.assertNotIn("localStorage.getItem('vendor_risk_user')", content)
        self.assertNotIn("localStorage.setItem('vendor_risk_user'", content)
        self.assertNotIn("localStorage.removeItem('vendor_risk_user')", content)
        self.assertNotIn("ciso@acme-corp.com", content, "Default hardcoded Sarah Jenkins email found in App.jsx")

if __name__ == "__main__":
    unittest.main()
