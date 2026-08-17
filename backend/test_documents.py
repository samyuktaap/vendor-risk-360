import os
import sys
import unittest
import sqlite3
import tempfile
import json
from pathlib import Path
from unittest import mock
from datetime import datetime, timedelta, UTC

# Ensure backend/ is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from main import app, DOCUMENTS_DIR
from database import get_db, init_db
from tests.test_encryption import _reset_singletons
from fastapi.testclient import TestClient

class TestDocumentsIntegration(unittest.TestCase):

    def setUp(self):
        _reset_singletons()
        self.db_fd, self.db_path = tempfile.mkstemp(prefix="vr360_docs_", suffix=".db")
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
        
        # Add a demo company
        cursor = self.db.cursor()
        now = datetime.now(UTC).isoformat()
        cursor.execute("INSERT INTO companies (name, created_at) VALUES (?, ?)", ("Test Company", now))
        self.company_id = cursor.lastrowid
        self.db.commit()

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

    def _login_as(self, email, role, company_id=None):
        company_id = company_id or self.company_id
        cursor = self.db.cursor()
        now = datetime.now(UTC).isoformat()
        cursor.execute(
            "INSERT INTO users (company_id, email, name, google_sub, role, mfa_enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (company_id, email, email.split("@")[0], f"sub_{email}", role, 1, now)
        )
        user_id = cursor.lastrowid
        self.db.commit()

        session_id = f"sess_{email}"
        expires_at = (datetime.now(UTC) + timedelta(hours=1)).isoformat()
        cursor.execute(
            "INSERT INTO sessions (session_id, user_id, ip_address, user_agent, mfa_verified, created_at, expires_at, last_activity_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (session_id, user_id, "127.0.0.1", "test-client", 1, now, expires_at, now)
        )
        self.db.commit()
        return session_id

    def _create_vendor(self, name="Test Vendor", domain="test.com", company_id=None):
        company_id = company_id or self.company_id
        cursor = self.db.cursor()
        now = datetime.now(UTC).isoformat()
        cursor.execute(
            "INSERT INTO vendors (company_id, name, domain, sector, created_at) VALUES (?, ?, ?, ?, ?)",
            (company_id, name, domain, "Technology", now)
        )
        vendor_id = cursor.lastrowid
        self.db.commit()
        return vendor_id

    def test_upload_and_list_documents(self):
        session_id = self._login_as("admin@test.com", "ADMIN")
        vendor_id = self._create_vendor()
        
        file_content = b"Super secret SOC 2 report content."
        files = {"file": ("soc2.pdf", file_content, "application/pdf")}
        data = {"document_type": "SOC 2"}
        
        # Upload
        res = self.client.post(f"/api/vendors/{vendor_id}/documents", files=files, data=data, cookies={"vr360_session": session_id})
        self.assertEqual(res.status_code, 200, res.text)
        self.assertEqual(res.json()["status"], "success")
        
        doc_id = res.json()["document_id"]
        obj_id = res.json()["object_id"]
        
        # List
        res_list = self.client.get(f"/api/vendors/{vendor_id}/documents", cookies={"vr360_session": session_id})
        self.assertEqual(res_list.status_code, 200)
        docs = res_list.json()["documents"]
        self.assertEqual(len(docs), 1)
        self.assertEqual(docs[0]["original_filename"], "soc2.pdf")
        self.assertEqual(docs[0]["document_type"], "SOC 2")
        
        # Download
        res_dl = self.client.get(f"/api/documents/{doc_id}/download", cookies={"vr360_session": session_id})
        self.assertEqual(res_dl.status_code, 200)
        self.assertEqual(res_dl.content, file_content)

    def test_cross_company_isolation(self):
        # Company A
        session_a = self._login_as("adminA@test.com", "ADMIN", self.company_id)
        vendor_a = self._create_vendor(company_id=self.company_id)
        
        res = self.client.post(
            f"/api/vendors/{vendor_a}/documents", 
            files={"file": ("doc.pdf", b"data", "application/pdf")}, 
            data={"document_type": "SOC 2"}, 
            cookies={"vr360_session": session_a}
        )
        doc_id = res.json()["document_id"]
        
        # Company B
        cursor = self.db.cursor()
        cursor.execute("INSERT INTO companies (name, created_at) VALUES (?, ?)", ("Company B", datetime.now(UTC).isoformat()))
        company_b_id = cursor.lastrowid
        self.db.commit()
        
        session_b = self._login_as("adminB@test.com", "ADMIN", company_id=company_b_id)
        
        # Company B tries to download Company A's document
        res_dl = self.client.get(f"/api/documents/{doc_id}/download", cookies={"vr360_session": session_b})
        self.assertEqual(res_dl.status_code, 404)
        
    def test_invalid_document_type(self):
        session_id = self._login_as("admin@test.com", "ADMIN")
        vendor_id = self._create_vendor()
        
        res = self.client.post(
            f"/api/vendors/{vendor_id}/documents", 
            files={"file": ("doc.pdf", b"data", "application/pdf")}, 
            data={"document_type": "FAKE_TYPE"}, 
            cookies={"vr360_session": session_id}
        )
        self.assertEqual(res.status_code, 400)

if __name__ == '__main__':
    unittest.main()
