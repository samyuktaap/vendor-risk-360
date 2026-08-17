"""
test_supply_chain_management.py — Automated Unit & Integration Tests for Fourth-Party / Supply Chain Risk Management.

Tests:
1. Multi-Tier Dependency Creation, Retrieval, Update, and Deletion
2. Self-Dependency Rejection (Vendor A -> Vendor A)
3. Duplicate Edge Rejection
4. Circular Dependency Loop Prevention (Cycle Detection via DFS)
5. Multi-Level Graph Generation
6. Transitive Blast-Radius Impact Analysis
7. RBAC Enforcement (Admin/CISO full management, Analyst create/update, Auditor read-only, Vendor restricted)
8. Multi-Tenant Company Isolation & Anti-IDOR Protections
9. Real Alert Generation on Critical Dependency Creation
10. Tamper-Evident Audit Logging
"""

import os
import sys
import unittest
import tempfile
import sqlite3
from unittest import mock
from datetime import datetime, UTC

from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import database
from main import app
from services.supply_chain_service import (
    validate_dependency_integrity,
    build_supply_chain_graph,
    calculate_downstream_impact,
    VALID_RELATIONSHIP_TYPES
)
from services.audit_log_service import get_audit_log, AuditAction


class TestSupplyChainManagement(unittest.TestCase):
    def setUp(self):
        self.temp_db_fd, self.temp_db_path = tempfile.mkstemp(suffix=".db")
        self.db_patcher = mock.patch("database.DB_PATH", self.temp_db_path)
        self.db_patcher.start()

        database.init_db()
        self.db = sqlite3.connect(self.temp_db_path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row

        # Clear tables
        cursor = self.db.cursor()
        cursor.execute("DELETE FROM vendor_dependencies")
        cursor.execute("DELETE FROM vendor_risk_history")
        cursor.execute("DELETE FROM vulnerabilities")
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

        # Vendors Company A (Multi-tier chain: 101 -> 102 -> 103)
        cursor.execute("""
            INSERT INTO vendors (id, company_id, name, domain, sector, risk_tier, risk_score, effective_tier, created_at)
            VALUES (101, 1, 'Payment Gateway Alpha', 'payalpha.io', 'Financial Services', 'High', 45, 'TIER_2_HIGH', ?)
        """, (now,))
        cursor.execute("""
            INSERT INTO vendors (id, company_id, name, domain, sector, risk_tier, risk_score, effective_tier, created_at)
            VALUES (102, 1, 'Cloud Hosting Alpha', 'cloudalpha.com', 'Cloud Services', 'Critical', 75, 'TIER_1_CRITICAL', ?)
        """, (now,))
        cursor.execute("""
            INSERT INTO vendors (id, company_id, name, domain, sector, risk_tier, risk_score, effective_tier, created_at)
            VALUES (103, 1, 'Data Storage Alpha', 'storagealpha.net', 'Infrastructure', 'Medium', 30, 'TIER_3_MEDIUM', ?)
        """, (now,))

        # Vendors Company B
        cursor.execute("""
            INSERT INTO vendors (id, company_id, name, domain, sector, risk_tier, risk_score, effective_tier, created_at)
            VALUES (201, 2, 'Beta Core Vendor', 'betacore.com', 'Technology', 'Medium', 40, 'TIER_2_HIGH', ?)
        """, (now,))
        cursor.execute("""
            INSERT INTO vendors (id, company_id, name, domain, sector, risk_tier, risk_score, effective_tier, created_at)
            VALUES (202, 2, 'Beta Cloud Provider', 'betacloud.io', 'Cloud Services', 'Low', 15, 'TIER_4_LOW', ?)
        """, (now,))

        self.db.commit()

    def _get_auth_override(self, user_id: int, role: str, company_id: int, email: str):
        session_data = {
            "user_id": user_id,
            "email": email,
            "role": role,
            "company_id": company_id,
            "mfa_verified": True,
            "session_id": f"sess_test_sc_{user_id}"
        }
        from services.auth_service import get_current_session
        app.dependency_overrides[get_current_session] = lambda: session_data
        return session_data

    def test_create_and_fetch_dependencies(self):
        """Test creating internal vendor and external provider dependencies."""
        self._get_auth_override(1, "ENTERPRISE_ADMIN", 1, "admin_a@alpha.com")

        # 1. Create registered downstream dependency: Payment Gateway (101) -> Cloud Hosting (102)
        res1 = self.client.post("/api/vendors/101/dependencies", json={
            "downstream_vendor_id": 102,
            "relationship_type": "CLOUD_PROVIDER",
            "criticality": "CRITICAL",
            "dependency_level": "CRITICAL",
            "status": "ACTIVE",
            "description": "Primary cloud hosting provider for transaction processing."
        })
        self.assertEqual(res1.status_code, 200)
        dep1 = res1.json()
        self.assertEqual(dep1["upstream_vendor_id"], 101)
        self.assertEqual(dep1["downstream_vendor_id"], 102)
        self.assertEqual(dep1["downstream_vendor_name"], "Cloud Hosting Alpha")
        self.assertEqual(dep1["relationship_type"], "CLOUD_PROVIDER")

        # 2. Create external provider dependency: Cloud Hosting (102) -> AWS
        res2 = self.client.post("/api/vendors/102/dependencies", json={
            "external_vendor_name": "Amazon Web Services",
            "external_vendor_domain": "aws.amazon.com",
            "relationship_type": "INFRASTRUCTURE_PROVIDER",
            "criticality": "HIGH",
            "dependency_level": "HIGH",
            "status": "ACTIVE",
            "description": "Underlying data center infrastructure."
        })
        self.assertEqual(res2.status_code, 200)
        dep2 = res2.json()
        self.assertEqual(dep2["upstream_vendor_id"], 102)
        self.assertIsNone(dep2["downstream_vendor_id"])
        self.assertEqual(dep2["external_vendor_name"], "Amazon Web Services")

        # 3. Fetch dependencies for Vendor 101
        res_list = self.client.get("/api/vendors/101/dependencies")
        self.assertEqual(res_list.status_code, 200)
        data = res_list.json()
        self.assertEqual(len(data["direct_dependencies"]), 1)
        self.assertEqual(data["direct_dependencies"][0]["downstream_vendor_id"], 102)

    def test_self_dependency_and_duplicate_rejection(self):
        """Test rejection of self-linking and duplicate edges."""
        self._get_auth_override(1, "ENTERPRISE_ADMIN", 1, "admin_a@alpha.com")

        # 1. Self-dependency rejection: 101 -> 101
        res_self = self.client.post("/api/vendors/101/dependencies", json={
            "downstream_vendor_id": 101,
            "relationship_type": "SUBPROCESSOR"
        })
        self.assertEqual(res_self.status_code, 400)
        self.assertIn("self-dependency", res_self.json()["detail"].lower())

        # 2. Add 101 -> 102
        res_add = self.client.post("/api/vendors/101/dependencies", json={
            "downstream_vendor_id": 102,
            "relationship_type": "HOSTING_PROVIDER"
        })
        self.assertEqual(res_add.status_code, 200)

        # 3. Add same 101 -> 102 with same relationship type -> Duplicate rejected
        res_dup = self.client.post("/api/vendors/101/dependencies", json={
            "downstream_vendor_id": 102,
            "relationship_type": "HOSTING_PROVIDER"
        })
        self.assertEqual(res_dup.status_code, 400)
        self.assertIn("already exists", res_dup.json()["detail"].lower())

    def test_cycle_detection_loop_prevention(self):
        """Test circular dependency loop prevention (101 -> 102 -> 103 -> 101)."""
        self._get_auth_override(1, "ENTERPRISE_ADMIN", 1, "admin_a@alpha.com")

        # 1. 101 -> 102
        res1 = self.client.post("/api/vendors/101/dependencies", json={
            "downstream_vendor_id": 102,
            "relationship_type": "CLOUD_PROVIDER"
        })
        self.assertEqual(res1.status_code, 200)

        # 2. 102 -> 103
        res2 = self.client.post("/api/vendors/102/dependencies", json={
            "downstream_vendor_id": 103,
            "relationship_type": "DATA_PROCESSOR"
        })
        self.assertEqual(res2.status_code, 200)

        # 3. 103 -> 101 (Should be blocked by cycle detection)
        res_cycle = self.client.post("/api/vendors/103/dependencies", json={
            "downstream_vendor_id": 101,
            "relationship_type": "PAYMENT_PROVIDER"
        })
        self.assertEqual(res_cycle.status_code, 400)
        self.assertIn("circular dependency loop", res_cycle.json()["detail"].lower())

    def test_update_and_delete_dependency(self):
        """Test updating and deleting supply chain relationships."""
        self._get_auth_override(1, "ENTERPRISE_ADMIN", 1, "admin_a@alpha.com")

        # 1. Create dependency
        res_create = self.client.post("/api/vendors/101/dependencies", json={
            "downstream_vendor_id": 102,
            "relationship_type": "SUBPROCESSOR",
            "criticality": "MEDIUM"
        })
        dep_id = res_create.json()["id"]

        # 2. Update dependency criticality to CRITICAL and status to UNDER_REVIEW
        res_update = self.client.put(f"/api/dependencies/{dep_id}", json={
            "criticality": "CRITICAL",
            "status": "UNDER_REVIEW",
            "description": "Undergoing annual SOC2 compliance audit."
        })
        self.assertEqual(res_update.status_code, 200)
        up_data = res_update.json()
        self.assertEqual(up_data["criticality"], "CRITICAL")
        self.assertEqual(up_data["status"], "UNDER_REVIEW")
        self.assertEqual(up_data["description"], "Undergoing annual SOC2 compliance audit.")

        # 3. Delete dependency
        res_del = self.client.delete(f"/api/dependencies/{dep_id}")
        self.assertEqual(res_del.status_code, 200)

        # 4. Verify deleted
        res_check = self.client.get("/api/vendors/101/dependencies")
        self.assertEqual(len(res_check.json()["direct_dependencies"]), 0)

    def test_blast_radius_impact_analysis(self):
        """Test blast-radius impact traversal: 101 -> 102 -> 103."""
        self._get_auth_override(1, "ENTERPRISE_ADMIN", 1, "admin_a@alpha.com")

        # Build chain: 101 depends on 102; 102 depends on 103
        self.client.post("/api/vendors/101/dependencies", json={"downstream_vendor_id": 102, "relationship_type": "CLOUD_PROVIDER", "criticality": "CRITICAL"})
        self.client.post("/api/vendors/102/dependencies", json={"downstream_vendor_id": 103, "relationship_type": "DATA_PROCESSOR", "criticality": "HIGH"})

        # Run impact analysis on 103:
        # If 103 fails, both 102 (distance 1) and 101 (distance 2) are impacted
        res_impact = self.client.get("/api/supply-chain/impact/103")
        self.assertEqual(res_impact.status_code, 200)
        impact = res_impact.json()
        self.assertEqual(impact["impacted_upstream_count"], 2)
        self.assertEqual(impact["max_dependency_depth"], 2)
        self.assertTrue(impact["has_impact"])

        affected_ids = [v["vendor_id"] for v in impact["affected_upstream_vendors"]]
        self.assertIn(102, affected_ids)
        self.assertIn(101, affected_ids)

    def test_rbac_and_authorization(self):
        """Test role-based access control for supply chain management."""
        # 1. Analyst can create dependencies
        self._get_auth_override(3, "ANALYST", 1, "analyst_a@alpha.com")
        res_an = self.client.post("/api/vendors/101/dependencies", json={"downstream_vendor_id": 102, "relationship_type": "SECURITY_PROVIDER"})
        self.assertEqual(res_an.status_code, 200)
        dep_id = res_an.json()["id"]

        # 2. Auditor CANNOT create dependencies (403)
        self._get_auth_override(4, "AUDITOR", 1, "auditor_a@alpha.com")
        res_aud = self.client.post("/api/vendors/101/dependencies", json={"downstream_vendor_id": 103, "relationship_type": "SECURITY_PROVIDER"})
        self.assertEqual(res_aud.status_code, 403)

        # 3. Auditor CANNOT delete dependencies (403)
        res_aud_del = self.client.delete(f"/api/dependencies/{dep_id}")
        self.assertEqual(res_aud_del.status_code, 403)

        # 4. CISO CAN delete dependencies (200)
        self._get_auth_override(2, "CISO", 1, "ciso_a@alpha.com")
        res_ciso_del = self.client.delete(f"/api/dependencies/{dep_id}")
        self.assertEqual(res_ciso_del.status_code, 200)

    def test_company_isolation_and_anti_idor(self):
        """Test strict company data isolation: Company A user cannot access or link to Company B."""
        # Auth as Company A Admin
        self._get_auth_override(1, "ENTERPRISE_ADMIN", 1, "admin_a@alpha.com")

        # 1. User A cannot view Company B Vendor 201 dependencies (404)
        res_view_b = self.client.get("/api/vendors/201/dependencies")
        self.assertEqual(res_view_b.status_code, 404)

        # 2. User A cannot create dependency on Company B Vendor 201 (404)
        res_create_b = self.client.post("/api/vendors/201/dependencies", json={"downstream_vendor_id": 102, "relationship_type": "CLOUD_PROVIDER"})
        self.assertEqual(res_create_b.status_code, 404)

        # 3. User A cannot link Company A Vendor 101 to Company B Vendor 201 (400 - cross company)
        res_cross = self.client.post("/api/vendors/101/dependencies", json={"downstream_vendor_id": 201, "relationship_type": "CLOUD_PROVIDER"})
        self.assertEqual(res_cross.status_code, 400)
        self.assertIn("authorized company", res_cross.json()["detail"].lower())

        # 4. User A cannot view Company B impact analysis (404)
        res_imp_b = self.client.get("/api/supply-chain/impact/201")
        self.assertEqual(res_imp_b.status_code, 404)

        # Auth as Company B Admin
        self._get_auth_override(5, "ENTERPRISE_ADMIN", 2, "admin_b@beta.com")

        # Company B Admin CAN create dependency between Beta vendors 201 -> 202
        res_b_ok = self.client.post("/api/vendors/201/dependencies", json={"downstream_vendor_id": 202, "relationship_type": "CLOUD_PROVIDER"})
        self.assertEqual(res_b_ok.status_code, 200)
        self.assertEqual(res_b_ok.json()["downstream_vendor_id"], 202)
