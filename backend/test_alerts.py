import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta, UTC
import sqlite3
import os
import tempfile
import json

import main
import database
from database import get_db

@pytest.fixture
def test_app():
    # Setup temporary database
    fd, path = tempfile.mkstemp()
    os.close(fd)
    
    # Override DB_PATH to point to test db so ALL get_db() calls use it
    old_db_path = database.DB_PATH
    database.DB_PATH = path
    
    # Initialize DB schema
    database.init_db()
    
    # Seed a demo company and vendors
    conn = database.get_db()
    cursor = conn.cursor()
    
    now = datetime.now(UTC).isoformat()
    cursor.execute("INSERT INTO companies (name, created_at) VALUES (?, ?)", ("Test Company A", now))
    comp_a = cursor.lastrowid
    
    cursor.execute("INSERT INTO companies (name, created_at) VALUES (?, ?)", ("Test Company B", now))
    comp_b = cursor.lastrowid
    
    cursor.execute("""
        INSERT INTO vendors (company_id, name, domain, sector, risk_tier, risk_score, created_at, last_checked_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (comp_a, "Vendor A1", "a1.com", "Tech", "Low", 25, now, now))
    v_a1 = cursor.lastrowid
    
    cursor.execute("""
        INSERT INTO vendors (company_id, name, domain, sector, risk_tier, risk_score, created_at, last_checked_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (comp_b, "Vendor B1", "b1.com", "Tech", "Low", 25, now, now))
    v_b1 = cursor.lastrowid
    
    # Mock admin user for Company A
    cursor.execute("""
        INSERT INTO users (company_id, email, name, google_sub, role, mfa_enabled, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (comp_a, "admin_a@test.com", "Admin A", "sub_a", "ENTERPRISE_ADMIN", 1, now))
    admin_a_id = cursor.lastrowid
    
    future_time = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    cursor.execute("""
        INSERT INTO sessions (session_id, user_id, ip_address, user_agent, mfa_verified, created_at, expires_at, last_activity_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, ("session_a", admin_a_id, "1.1.1.1", "Test", 1, now, future_time, now))
    
    # Mock admin user for Company B
    cursor.execute("""
        INSERT INTO users (company_id, email, name, google_sub, role, mfa_enabled, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (comp_b, "admin_b@test.com", "Admin B", "sub_b", "ENTERPRISE_ADMIN", 1, now))
    admin_b_id = cursor.lastrowid
    
    cursor.execute("""
        INSERT INTO sessions (session_id, user_id, ip_address, user_agent, mfa_verified, created_at, expires_at, last_activity_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, ("session_b", admin_b_id, "2.2.2.2", "Test", 1, now, future_time, now))
    
    conn.commit()
    conn.close()
    
    client = TestClient(main.app)
    
    yield client, comp_a, v_a1, comp_b, v_b1
    
    # Teardown
    database.DB_PATH = old_db_path
    
    # Wait a tiny bit and retry removal to avoid PermissionError on Windows
    # (Sometimes sqlite connection takes a moment to close)
    import time
    for _ in range(3):
        try:
            os.remove(path)
            break
        except PermissionError:
            time.sleep(0.1)


def test_high_risk_vendor_alert_created(test_app):
    client, comp_a, v_a1, _, _ = test_app
    
    # Set cookies for admin A
    client.cookies.set("vr360_session", "session_a")
    
    # Directly use the alert engine
    from services.alert_engine import evaluate_high_risk_vendor
    
    alert_id = evaluate_high_risk_vendor(v_a1, comp_a, 75, "Vendor A1")
    assert alert_id is not None
    
    # Fetch alerts
    response = client.get("/api/alerts")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["alerts"][0]["alert_type"] == "HIGH_RISK_VENDOR"
    assert data["alerts"][0]["vendor_id"] == v_a1


def test_high_risk_vendor_deduplication(test_app):
    client, comp_a, v_a1, _, _ = test_app
    from services.alert_engine import evaluate_high_risk_vendor
    
    alert1 = evaluate_high_risk_vendor(v_a1, comp_a, 75, "Vendor A1")
    assert alert1 is not None
    
    # Call again with same bucket score
    alert2 = evaluate_high_risk_vendor(v_a1, comp_a, 78, "Vendor A1")
    assert alert2 is None  # Deduplicated!
    
    # Call again with different bucket score
    alert3 = evaluate_high_risk_vendor(v_a1, comp_a, 85, "Vendor A1")
    assert alert3 is not None  # New bucket, new alert!


def test_major_risk_change_alert(test_app):
    client, comp_a, v_a1, _, _ = test_app
    from services.alert_engine import evaluate_major_risk_change
    
    # Score jumps from 30 to 55 (delta 25 >= 20)
    alert_id = evaluate_major_risk_change(v_a1, comp_a, 30, 55, "Vendor A1")
    assert alert_id is not None
    
    # Score jumps from 30 to 40 (delta 10 < 20)
    no_alert = evaluate_major_risk_change(v_a1, comp_a, 30, 40, "Vendor A1")
    assert no_alert is None


def test_assessment_overdue_alert(test_app):
    client, comp_a, v_a1, _, _ = test_app
    conn = database.get_db()
    cursor = conn.cursor()
    
    # Insert an overdue assessment (>90 days old, DRAFT)
    old_date = (datetime.now(UTC) - timedelta(days=95)).isoformat()
    cursor.execute("""
        INSERT INTO assessments (vendor_id, status, created_at)
        VALUES (?, ?, ?)
    """, (v_a1, "DRAFT", old_date))
    conn.commit()
    conn.close()
    
    client.cookies.set("vr360_session", "session_a")
    
    # GET /api/alerts triggers lazy run_all_scheduled_checks
    response = client.get("/api/alerts")
    assert response.status_code == 200
    data = response.json()
    assert len(data["alerts"]) == 1
    assert data["alerts"][0]["alert_type"] == "ASSESSMENT_OVERDUE"


def test_certification_expiring_alert(test_app):
    client, comp_a, v_a1, _, _ = test_app
    conn = database.get_db()
    cursor = conn.cursor()
    
    # Cert expiring in 15 days
    expiring_date = (datetime.now(UTC) + timedelta(days=15)).isoformat()
    cursor.execute("""
        INSERT INTO compliance_frameworks (vendor_id, framework_name, framework_type, status, last_assessed_at, next_due_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (v_a1, "SOC 2", "SECURITY", "ASSESSED", "2024-01-01T00:00:00Z", expiring_date))
    conn.commit()
    conn.close()
    
    client.cookies.set("vr360_session", "session_a")
    response = client.get("/api/alerts")
    assert response.status_code == 200
    assert response.json()["alerts"][0]["alert_type"] == "CERTIFICATION_EXPIRING"


def test_certification_expired_alert(test_app):
    client, comp_a, v_a1, _, _ = test_app
    conn = database.get_db()
    cursor = conn.cursor()
    
    # Cert expired 5 days ago
    expired_date = (datetime.now(UTC) - timedelta(days=5)).isoformat()
    cursor.execute("""
        INSERT INTO compliance_frameworks (vendor_id, framework_name, framework_type, status, last_assessed_at, next_due_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (v_a1, "ISO 27001", "SECURITY", "ASSESSED", "2024-01-01T00:00:00Z", expired_date))
    conn.commit()
    conn.close()
    
    client.cookies.set("vr360_session", "session_a")
    response = client.get("/api/alerts")
    assert response.status_code == 200
    assert response.json()["alerts"][0]["alert_type"] == "CERTIFICATION_EXPIRED"


def test_alert_lifecycle_read_then_acknowledge(test_app):
    client, comp_a, v_a1, _, _ = test_app
    from services.alert_engine import evaluate_high_risk_vendor
    
    # Create alert
    alert_id = evaluate_high_risk_vendor(v_a1, comp_a, 90, "Vendor A1")
    client.cookies.set("vr360_session", "session_a")
    
    # Initial count
    resp1 = client.get("/api/alerts/count")
    assert resp1.json()["unread"] == 1
    
    # Mark read
    read_resp = client.post(f"/api/alerts/{alert_id}/read")
    assert read_resp.status_code == 200
    
    # Count should be 0
    resp2 = client.get("/api/alerts/count")
    assert resp2.json()["unread"] == 0
    
    # Mark acknowledged
    ack_resp = client.post(f"/api/alerts/{alert_id}/acknowledge")
    assert ack_resp.status_code == 200
    
    # Check detail
    detail = client.get(f"/api/alerts/{alert_id}")
    assert detail.json()["alert"]["status"] == "ACKNOWLEDGED"


def test_company_isolation(test_app):
    client, comp_a, v_a1, comp_b, v_b1 = test_app
    from services.alert_engine import evaluate_high_risk_vendor
    
    # Create alert for company A
    alert_id = evaluate_high_risk_vendor(v_a1, comp_a, 90, "Vendor A1")
    
    # Login as Company B admin
    client.cookies.set("vr360_session", "session_b")
    
    # List alerts should be empty
    response = client.get("/api/alerts")
    assert response.status_code == 200
    assert response.json()["total"] == 0
    
    # Detail should return 404/403
    detail = client.get(f"/api/alerts/{alert_id}")
    assert detail.status_code == 404
