"""
Script to create two isolated test companies with users and vendors for IDOR testing.
This script creates:
- Company A with User A and Vendor A
- Company B with User B and Vendor B
Each user should only be able to access their own company's data.
"""

import sqlite3
import os
from datetime import datetime
from database import init_db

DB_PATH = os.path.join(os.path.dirname(__file__), "vendor_risk.db")

def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=10.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def create_test_companies():
    # Initialize database schema first
    init_db()
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if test companies already exist
    cursor.execute("SELECT id, name FROM companies WHERE name IN ('Test Company A', 'Test Company B')")
    existing = cursor.fetchall()
    
    if len(existing) >= 2:
        print("[TEST SETUP] Test companies already exist. Skipping creation.")
        conn.close()
        return
    
    print("[TEST SETUP] Creating isolated test companies...")
    
    # Create Company A
    cursor.execute("INSERT INTO companies (name, created_at) VALUES (?, ?)", 
                   ("Test Company A", datetime.utcnow().isoformat()))
    company_a_id = cursor.lastrowid
    
    # Create Company B
    cursor.execute("INSERT INTO companies (name, created_at) VALUES (?, ?)", 
                   ("Test Company B", datetime.utcnow().isoformat()))
    company_b_id = cursor.lastrowid
    
    # Create User A for Company A
    cursor.execute("""
        INSERT INTO users (email, name, google_sub, role, company_id, mfa_enabled, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?)
    """, ("usera@testcompany.com", "UserA", "test_sub_a_12345", "ANALYST", company_a_id, datetime.utcnow().isoformat()))
    user_a_id = cursor.lastrowid
    
    # Create User B for Company B
    cursor.execute("""
        INSERT INTO users (email, name, google_sub, role, company_id, mfa_enabled, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?)
    """, ("userb@testcompany.com", "UserB", "test_sub_b_67890", "ANALYST", company_b_id, datetime.utcnow().isoformat()))
    user_b_id = cursor.lastrowid
    
    # Create Vendor A for Company A
    cursor.execute("""
        INSERT INTO vendors (name, domain, sector, risk_tier, risk_score, hibp_score, news_score, 
                            sanctions_score, abuse_score, criticality_tier, data_sensitivity, 
                            contract_value, compliance_certs, last_checked_at, created_at, company_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, ("Vendor A", "vendora.example.com", "Test Sector A", "Low", 25, 0, 0, 0, 0, 
           "Tier 2 - Business Operational", "Public Data", 100000, "SOC2 Type II", 
           datetime.utcnow().isoformat(), datetime.utcnow().isoformat(), company_a_id))
    vendor_a_id = cursor.lastrowid
    
    # Create Vendor B for Company B
    cursor.execute("""
        INSERT INTO vendors (name, domain, sector, risk_tier, risk_score, hibp_score, news_score, 
                            sanctions_score, abuse_score, criticality_tier, data_sensitivity, 
                            contract_value, compliance_certs, last_checked_at, created_at, company_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, ("Vendor B", "vendorb.example.com", "Test Sector B", "Medium", 45, 0, 0, 0, 0, 
           "Tier 2 - Business Operational", "Public Data", 150000, "SOC2 Type II", 
           datetime.utcnow().isoformat(), datetime.utcnow().isoformat(), company_b_id))
    vendor_b_id = cursor.lastrowid
    
    # Create an incident for Vendor A
    cursor.execute("""
        INSERT INTO incidents (vendor_id, title, description, category, severity, status, 
                              score_impact, reported_at)
        VALUES (?, 'Test Incident A', 'Test incident for Vendor A', 'Test', 'LOW', 'OPEN', 4, ?)
    """, (vendor_a_id, datetime.utcnow().isoformat()))
    
    # Create an incident for Vendor B
    cursor.execute("""
        INSERT INTO incidents (vendor_id, title, description, category, severity, status, 
                              score_impact, reported_at)
        VALUES (?, 'Test Incident B', 'Test incident for Vendor B', 'Test', 'MEDIUM', 'OPEN', 8, ?)
    """, (vendor_b_id, datetime.utcnow().isoformat()))
    
    # Create compliance framework for Vendor A
    cursor.execute("""
        INSERT INTO compliance_frameworks (vendor_id, framework_name, framework_type, 
                                          compliance_score, last_assessed_at, next_due_at, status)
        VALUES (?, 'SOC 2 Type II', 'Security', 85, ?, ?, 'ASSESSED')
    """, (vendor_a_id, datetime.utcnow().isoformat(), 
           (datetime.utcnow().replace(year=datetime.utcnow().year + 1)).isoformat()))
    
    # Create compliance framework for Vendor B
    cursor.execute("""
        INSERT INTO compliance_frameworks (vendor_id, framework_name, framework_type, 
                                          compliance_score, last_assessed_at, next_due_at, status)
        VALUES (?, 'ISO 27001', 'Security', 75, ?, ?, 'ASSESSED')
    """, (vendor_b_id, datetime.utcnow().isoformat(), 
           (datetime.utcnow().replace(year=datetime.utcnow().year + 1)).isoformat()))
    
    # Create remediation task for Vendor A
    cursor.execute("""
        INSERT INTO remediation_tasks (vendor_id, title, description, priority, status, 
                                       assigned_to, created_at, source_type)
        VALUES (?, 'Test Remediation A', 'Test remediation for Vendor A', 'MEDIUM', 'OPEN', 
                'usera@testcompany.com', ?, 'MANUAL')
    """, (vendor_a_id, datetime.utcnow().isoformat()))
    
    # Create remediation task for Vendor B
    cursor.execute("""
        INSERT INTO remediation_tasks (vendor_id, title, description, priority, status, 
                                       assigned_to, created_at, source_type)
        VALUES (?, 'Test Remediation B', 'Test remediation for Vendor B', 'HIGH', 'OPEN', 
                'userb@testcompany.com', ?, 'MANUAL')
    """, (vendor_b_id, datetime.utcnow().isoformat()))
    
    conn.commit()
    conn.close()
    
    print(f"[TEST SETUP] Created test infrastructure:")
    print(f"  - Company A (ID: {company_a_id}) with User A (ID: {user_a_id}) and Vendor A (ID: {vendor_a_id})")
    print(f"  - Company B (ID: {company_b_id}) with User B (ID: {user_b_id}) and Vendor B (ID: {vendor_b_id})")
    print(f"[TEST SETUP] Mock Google tokens for testing:")
    print(f"  - User A: mock_oidc|test_sub_a_12345|usera@testcompany.com|UserA|accounts.google.com|{os.getenv('GOOGLE_CLIENT_ID', 'test')}|9999999999")
    print(f"  - User B: mock_oidc|test_sub_b_67890|userb@testcompany.com|UserB|accounts.google.com|{os.getenv('GOOGLE_CLIENT_ID', 'test')}|9999999999")

if __name__ == "__main__":
    create_test_companies()
