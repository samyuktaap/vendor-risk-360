"""
test_rbac_and_vendor_isolation.py — Verify CISO vs Vendor separation and endpoint protection.
"""

import unittest
import time
from fastapi.testclient import TestClient
from main import app
from database import init_db, get_db
from services.auth_service import SESSION_COOKIE_NAME

class TestRBACAndVendorIsolation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = TestClient(app)

    def _login_as(self, email: str) -> str:
        exp = int(time.time()) + 3600
        name = email.split("@")[0]
        sub = f"sub_{name}"
        token = f"mock_oidc|{sub}|{email}|{name}|accounts.google.com|test-client-id|{exp}"
        resp = self.client.post("/api/auth/google-login", json={"id_token": token})
        self.assertEqual(resp.status_code, 200, f"Login failed for {email}: {resp.text}")
        return resp.cookies[SESSION_COOKIE_NAME]

    def test_01_ciso_access_enterprise_features(self):
        cookie = self._login_as("ciso@acme-corp.com")
        self.client.cookies.set(SESSION_COOKIE_NAME, cookie)

        # 1. /api/auth/me
        me_resp = self.client.get("/api/auth/me")
        self.assertEqual(me_resp.status_code, 200)
        data = me_resp.json()["user"]
        self.assertEqual(data["account_type"], "ENTERPRISE")
        self.assertEqual(data["role"], "CISO")

        # 2. Enterprise endpoints should succeed
        for endpoint in ["/api/dashboard/metrics", "/api/vendors", "/api/contagion", "/api/feed", "/api/stats", "/api/quota", "/api/alerts"]:
            res = self.client.get(endpoint)
            self.assertEqual(res.status_code, 200, f"CISO denied on enterprise endpoint {endpoint}: {res.text}")

    def test_02_vendor_access_and_enterprise_denial(self):
        cookie = self._login_as("vendor@okta.com")
        self.client.cookies.set(SESSION_COOKIE_NAME, cookie)

        # 1. /api/auth/me
        me_resp = self.client.get("/api/auth/me")
        self.assertEqual(me_resp.status_code, 200)
        data = me_resp.json()["user"]
        self.assertEqual(data["account_type"], "VENDOR")
        self.assertEqual(data["role"], "VENDOR")
        vendor_id = data["vendor_id"]
        self.assertIsNotNone(vendor_id)

        # 2. Attempting to access CISO / Enterprise endpoints MUST return 403 Forbidden
        enterprise_endpoints = [
            "/api/dashboard/metrics",
            "/api/vendors",
            "/api/contagion",
            "/api/feed",
            "/api/stats",
            "/api/quota",
            "/api/alerts"
        ]
        for endpoint in enterprise_endpoints:
            res = self.client.get(endpoint)
            self.assertEqual(res.status_code, 403, f"Vendor NOT blocked on CISO endpoint {endpoint}! Got status {res.status_code}")

    def test_03_cross_vendor_data_access_denial(self):
        # Login as Okta Vendor
        cookie_okta = self._login_as("vendor@okta.com")
        self.client.cookies.set(SESSION_COOKIE_NAME, cookie_okta)

        me_resp = self.client.get("/api/auth/me")
        okta_vendor_id = me_resp.json()["user"]["vendor_id"]

        # Find another vendor ID
        db = get_db()
        cursor = db.cursor()
        cursor.execute("SELECT id FROM vendors WHERE id != ?", (okta_vendor_id,))
        other_vendor = cursor.fetchone()
        db.close()

        if other_vendor:
            other_id = other_vendor["id"]
            # Attempt accessing other vendor's detail
            res_detail = self.client.get(f"/api/vendors/{other_id}")
            self.assertEqual(res_detail.status_code, 403, f"Vendor accessed other vendor data! {res_detail.status_code}")

            # Attempt accessing other vendor's documents
            res_docs = self.client.get(f"/api/vendors/{other_id}/documents")
            self.assertEqual(res_docs.status_code, 403, f"Vendor accessed other vendor documents! {res_docs.status_code}")

            # Attempt accessing other vendor's remediation
            res_rem = self.client.get(f"/api/vendors/{other_id}/remediation")
            self.assertEqual(res_rem.status_code, 403, f"Vendor accessed other vendor remediation! {res_rem.status_code}")

if __name__ == "__main__":
    unittest.main()
