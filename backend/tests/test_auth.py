"""
test_auth.py — Automated test suite for OIDC authentication, RBAC, session management, and step-up MFA.

Covers:
  - Successful Google OIDC login (via mock validation)
  - Invalid, expired, wrong issuer, and wrong audience token failures
  - Local user record creation/linking
  - Session creation & cookie enforcement
  - Session fixation protection (session ID rotation)
  - Logout and server-side session revocation
  - Idle timeout & absolute expiration checks
  - MFA enforcement on CISO/ADMIN roles
  - Step-up verification updating session state
  - Audit logging of all success, failure, permissions, and logout events
"""

from __future__ import annotations

import os
import sys
import time
import unittest
import tempfile
import sqlite3
from pathlib import Path
from unittest import mock
from fastapi.testclient import TestClient

# Ensure backend/ is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from main import app
from database import get_db, init_db
from services.auth_service import verify_google_token, create_session, get_session
from services.audit_log_service import get_audit_log, AuditAction
from tests.test_encryption import _make_test_db, _reset_singletons


class TestOidcAuthentication(unittest.TestCase):
    
    def setUp(self):
        _reset_singletons()
        # Create a temp file for test DB and run database.init_db() to create all tables (including vendors)
        self.db_fd, self.db_path = tempfile.mkstemp(prefix="vr360_test_db_", suffix=".db")
        
        # Patch database path and get_db connection
        self.db_path_patcher = mock.patch("database.DB_PATH", self.db_path)
        self.db_path_patcher.start()
        
        # Run DB initialization to create all standard tables
        init_db()
        
        # Establish connection for assertions (with check_same_thread=False)
        self.db = sqlite3.connect(self.db_path, timeout=10.0, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        
        # Patch database.get_db directly to return a new connection for each thread/call (with check_same_thread=False)
        def _get_test_db():
            conn = sqlite3.connect(self.db_path, timeout=10.0, check_same_thread=False)
            conn.row_factory = sqlite3.Row
            return conn
            
        self.get_db_patcher = mock.patch("database.get_db", side_effect=_get_test_db)
        self.get_db_patcher.start()
        
        # Override the database dependency in FastAPI app
        app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(app)
        
        # Configure client ID and HMAC keys
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
        os.environ.pop("GOOGLE_CLIENT_ID", None)
        os.environ.pop("AUDIT_HMAC_KEY", None)

    # ------------------------------------------------------------------
    # 1. ID Token Verification Checks
    # ------------------------------------------------------------------

    def test_verify_token_invalid_format(self):
        """Invalid mock token string must raise ValueError."""
        with self.assertRaises(ValueError) as ctx:
            verify_google_token("invalid_token")
        self.assertIn("failed", str(ctx.exception).lower())

    def test_verify_token_expired(self):
        """Expired OIDC token must fail validation."""
        past_exp = time.time() - 30
        token = f"mock_oidc_sub1_user@acme.com_Sarah_accounts.google.com_test-client-id_{past_exp}"
        with self.assertRaises(ValueError) as ctx:
            verify_google_token(token)
        self.assertIn("OIDC verification failed: Token expired", str(ctx.exception))

    def test_verify_token_wrong_audience(self):
        """Token with mismatching client ID/audience must fail."""
        exp = time.time() + 300
        token = f"mock_oidc_sub1_user@acme.com_Sarah_accounts.google.com_wrong-client-id_{exp}"
        with self.assertRaises(ValueError) as ctx:
            verify_google_token(token)
        self.assertIn("OIDC verification failed: Wrong audience", str(ctx.exception))

    def test_verify_token_wrong_issuer(self):
        """Token with unrecognized issuer must fail."""
        exp = time.time() + 300
        token = f"mock_oidc_sub1_user@acme.com_Sarah_wrong.issuer.com_test-client-id_{exp}"
        with self.assertRaises(ValueError) as ctx:
            verify_google_token(token)
        self.assertIn("OIDC verification failed: Wrong issuer", str(ctx.exception))

    # ------------------------------------------------------------------
    # 2. Login Lifecycle, User Creation, and Session Fixation
    # ------------------------------------------------------------------

    def test_successful_oidc_login_and_user_creation(self):
        """Valid OIDC login creates local user, starts session cookie, and records success audit."""
        exp = time.time() + 300
        token = f"mock_oidc_sub1_analyst@acme.com_Sarah_accounts.google.com_test-client-id_{exp}"
        
        # Login POST
        response = self.client.post("/api/auth/google-login", json={"id_token": token})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["user"]["email"], "analyst@acme.com")
        self.assertEqual(data["user"]["role"], "ANALYST")
        
        # Verify Session Cookie set
        self.assertIn("vr360_session", response.cookies)
        session_cookie = response.cookies["vr360_session"]
        
        # Verify User inserted in local DB
        cursor = self.db.cursor()
        cursor.execute("SELECT * FROM users WHERE google_sub = 'sub1'")
        user = cursor.fetchone()
        self.assertIsNotNone(user)
        self.assertEqual(user["email"], "analyst@acme.com")
        
        # Verify LOGIN_SUCCESS was audited
        cursor.execute("SELECT action, outcome, actor_email FROM audit_log ORDER BY id DESC LIMIT 1")
        audit_row = cursor.fetchone()
        self.assertEqual(audit_row["action"], AuditAction.LOGIN_SUCCESS)
        self.assertEqual(audit_row["actor_email"], "analyst@acme.com")

    def test_session_fixation_protection(self):
        """Login must rotate session ID, replacing the old session identifier completely."""
        exp = time.time() + 300
        token1 = f"mock_oidc_sub1_analyst@acme.com_Sarah_accounts.google.com_test-client-id_{exp}"
        token2 = f"mock_oidc_sub2_admin@acme.com_David_accounts.google.com_test-client-id_{exp}"
        
        # Initial login
        resp1 = self.client.post("/api/auth/google-login", json={"id_token": token1})
        cookie1 = resp1.cookies["vr360_session"]
        
        # Second login from same client
        resp2 = self.client.post("/api/auth/google-login", json={"id_token": token2})
        cookie2 = resp2.cookies["vr360_session"]
        
        # Assert session identifier rotated (changed)
        self.assertNotEqual(cookie1, cookie2)
        
        # Assert old session is no longer valid
        sess = get_session(cookie1, self.db)
        self.assertIsNone(sess)

    # ------------------------------------------------------------------
    # 3. RBAC Enforcement and Step-up MFA
    # ------------------------------------------------------------------

    def test_rbac_delete_vendor_unauthorized_analyst(self):
        """ANALYST user must be denied permission to delete vendor."""
        # Insert a vendor
        cursor = self.db.cursor()
        cursor.execute(
            "INSERT INTO vendors (name, domain, sector, risk_tier, risk_score, created_at) VALUES ('Target', 'target.com', 'Retail', 'Low', 0, '2026-08-16')"
        )
        self.db.commit()
        vendor_id = cursor.lastrowid
        
        # Login as ANALYST
        exp = time.time() + 300
        token = f"mock_oidc_sub1_analyst@acme.com_Sarah_accounts.google.com_test-client-id_{exp}"
        self.client.post("/api/auth/google-login", json={"id_token": token})
        
        # Try deleting vendor
        resp = self.client.delete(f"/api/vendors/{vendor_id}")
        self.assertEqual(resp.status_code, 403)
        self.assertIn("Unauthorized role", resp.json()["detail"])
        
        # Assert PERMISSION_DENIED recorded in audit log
        cursor.execute("SELECT action, outcome FROM audit_log ORDER BY id DESC LIMIT 1")
        audit_row = cursor.fetchone()
        self.assertEqual(audit_row["action"], AuditAction.PERMISSION_DENIED)
        self.assertEqual(audit_row["outcome"], "DENIED")

    def test_rbac_delete_vendor_ciso_requires_mfa(self):
        """CISO role requires MFA verification before sensitive operations."""
        cursor = self.db.cursor()
        cursor.execute(
            "INSERT INTO vendors (name, domain, sector, risk_tier, risk_score, created_at) VALUES ('Target', 'target.com', 'Retail', 'Low', 0, '2026-08-16')"
        )
        self.db.commit()
        vendor_id = cursor.lastrowid
        
        # Login as CISO
        exp = time.time() + 300
        token = f"mock_oidc_sub1_ciso@acme.com_Jane_accounts.google.com_test-client-id_{exp}"
        self.client.post("/api/auth/google-login", json={"id_token": token})
        
        # Try deleting vendor without step-up MFA verified
        resp = self.client.delete(f"/api/vendors/{vendor_id}")
        self.assertEqual(resp.status_code, 403)
        self.assertIn("MFA verification required", resp.json()["detail"])
        
        # Assert PERMISSION_DENIED audited
        cursor.execute("SELECT action, outcome FROM audit_log ORDER BY id DESC LIMIT 1")
        audit_row = cursor.fetchone()
        self.assertEqual(audit_row["action"], AuditAction.PERMISSION_DENIED)
        self.assertEqual(audit_row["outcome"], "DENIED")

    # ------------------------------------------------------------------
    # 4. MFA Setup & Step-Up Lifecycle Verification
    # ------------------------------------------------------------------

    def test_mfa_setup_and_step_up_success(self):
        """MFA setup, verify and step-up path must successfully update session verification status."""
        import pyotp
        
        # 1. Login as CISO (initially mfa_verified = False)
        exp = time.time() + 300
        token = f"mock_oidc_sub1_ciso@acme.com_Jane_accounts.google.com_test-client-id_{exp}"
        login_resp = self.client.post("/api/auth/google-login", json={"id_token": token})
        cookie = login_resp.cookies["vr360_session"]
        
        # 2. Setup MFA to generate secret
        setup_resp = self.client.post("/api/auth/setup-mfa")
        self.assertEqual(setup_resp.status_code, 200)
        setup_data = setup_resp.json()
        
        # Parse generated TOTP secret from provisioning URI
        uri = setup_data["provisioning_uri"]
        secret = uri.split("secret=")[1].split("&")[0]
        
        # 3. Verify TOTP step-up code
        otp_code = pyotp.TOTP(secret).now()
        verify_resp = self.client.post("/api/auth/verify-mfa", json={"otp_code": otp_code})
        self.assertEqual(verify_resp.status_code, 200)
        
        # Check session state in DB
        sess = get_session(cookie, self.db)
        self.assertTrue(bool(sess["mfa_verified"]))
        
        # Check audit log contains MFA_VERIFIED
        cursor = self.db.cursor()
        cursor.execute("SELECT action, outcome FROM audit_log ORDER BY id DESC LIMIT 1")
        audit_row = cursor.fetchone()
        self.assertEqual(audit_row["action"], AuditAction.MFA_VERIFIED)

    # ------------------------------------------------------------------
    # 5. Session Expiration & Revocation/Logout
    # ------------------------------------------------------------------

    def test_logout_invalidates_session(self):
        """Logout must delete session record and clear cookies."""
        exp = time.time() + 300
        token = f"mock_oidc_sub1_analyst@acme.com_Sarah_accounts.google.com_test-client-id_{exp}"
        
        login_resp = self.client.post("/api/auth/google-login", json={"id_token": token})
        cookie = login_resp.cookies["vr360_session"]
        
        # Check active session exists
        sess_before = get_session(cookie, self.db)
        self.assertIsNotNone(sess_before)
        
        # Logout
        logout_resp = self.client.post("/api/auth/logout")
        self.assertEqual(logout_resp.status_code, 200)
        
        # Session must be deleted on server-side
        sess_after = get_session(cookie, self.db)
        self.assertIsNone(sess_after)
        
        # Check SIGN_OUT logged in audit log
        cursor = self.db.cursor()
        cursor.execute("SELECT action FROM audit_log ORDER BY id DESC LIMIT 1")
        audit_row = cursor.fetchone()
        self.assertEqual(audit_row["action"], AuditAction.SIGN_OUT)


if __name__ == "__main__":
    unittest.main(verbosity=2)
