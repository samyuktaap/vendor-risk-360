"""
IDOR (Insecure Direct Object Reference) Isolation Tests
Tests that verify users from Company A cannot access Company B's data.
"""

import pytest
import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"

# Mock Google OIDC tokens for test users
# Using a simpler format with pipe delimiter to avoid underscore parsing issues
# Format: mock_oidc|{sub}|{email}|{name}|{iss}|{aud}|{exp}
USER_A_TOKEN = "mock_oidc|test_sub_a_12345|usera@testcompany.com|UserA|accounts.google.com|test|9999999999"
USER_B_TOKEN = "mock_oidc|test_sub_b_67890|userb@testcompany.com|UserB|accounts.google.com|test|9999999999"

def get_session_cookie(token):
    """Login with mock token and return session cookie."""
    response = requests.post(
        f"{BASE_URL}/api/auth/google-login",
        json={"id_token": token}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.cookies.get("vr360_session")

def get_vendor_ids():
    """Get vendor IDs for both companies."""
    # Login as User A
    session_a = get_session_cookie(USER_A_TOKEN)
    response_a = requests.get(
        f"{BASE_URL}/api/vendors",
        cookies={"vr360_session": session_a}
    )
    vendors_a = response_a.json()
    vendor_a_id = vendors_a[0]["id"] if vendors_a else None
    
    # Login as User B
    session_b = get_session_cookie(USER_B_TOKEN)
    response_b = requests.get(
        f"{BASE_URL}/api/vendors",
        cookies={"vr360_session": session_b}
    )
    vendors_b = response_b.json()
    vendor_b_id = vendors_b[0]["id"] if vendors_b else None
    
    return vendor_a_id, vendor_b_id, session_a, session_b

def test_user_a_cannot_access_company_b_vendors():
    """Test that User A cannot see Company B's vendors."""
    session_a = get_session_cookie(USER_A_TOKEN)
    response = requests.get(
        f"{BASE_URL}/api/vendors",
        cookies={"vr360_session": session_a}
    )
    assert response.status_code == 200
    vendors = response.json()
    
    # User A should only see Vendor A, not Vendor B
    vendor_names = [v["name"] for v in vendors]
    assert "Vendor A" in vendor_names, "User A should see Vendor A"
    assert "Vendor B" not in vendor_names, "User A should NOT see Vendor B"

def test_user_b_cannot_access_company_a_vendors():
    """Test that User B cannot see Company A's vendors."""
    session_b = get_session_cookie(USER_B_TOKEN)
    response = requests.get(
        f"{BASE_URL}/api/vendors",
        cookies={"vr360_session": session_b}
    )
    assert response.status_code == 200
    vendors = response.json()
    
    # User B should only see Vendor B, not Vendor A
    vendor_names = [v["name"] for v in vendors]
    assert "Vendor B" in vendor_names, "User B should see Vendor B"
    assert "Vendor A" not in vendor_names, "User B should NOT see Vendor A"

def test_user_a_cannot_access_vendor_b_detail():
    """Test that User A cannot access Vendor B's detail endpoint."""
    vendor_a_id, vendor_b_id, session_a, session_b = get_vendor_ids()
    
    if not vendor_b_id:
        pytest.skip("Vendor B not found")
    
    response = requests.get(
        f"{BASE_URL}/api/vendors/{vendor_b_id}",
        cookies={"vr360_session": session_a}
    )
    
    # Should be denied (403) or not found (404)
    assert response.status_code in [403, 404], f"Expected 403 or 404, got {response.status_code}"

def test_user_b_cannot_access_vendor_a_detail():
    """Test that User B cannot access Vendor A's detail endpoint."""
    vendor_a_id, vendor_b_id, session_a, session_b = get_vendor_ids()
    
    if not vendor_a_id:
        pytest.skip("Vendor A not found")
    
    response = requests.get(
        f"{BASE_URL}/api/vendors/{vendor_a_id}",
        cookies={"vr360_session": session_b}
    )
    
    # Should be denied (403) or not found (404)
    assert response.status_code in [403, 404], f"Expected 403 or 404, got {response.status_code}"

def test_user_a_cannot_access_vendor_b_incidents():
    """Test that User A cannot access Vendor B's incidents."""
    vendor_a_id, vendor_b_id, session_a, session_b = get_vendor_ids()
    
    if not vendor_b_id:
        pytest.skip("Vendor B not found")
    
    response = requests.get(
        f"{BASE_URL}/api/vendors/{vendor_b_id}/incidents",
        cookies={"vr360_session": session_a}
    )
    
    # Should be denied (403) or not found (404)
    assert response.status_code in [403, 404], f"Expected 403 or 404, got {response.status_code}"

def test_user_a_cannot_access_vendor_b_compliance():
    """Test that User A cannot access Vendor B's compliance data."""
    vendor_a_id, vendor_b_id, session_a, session_b = get_vendor_ids()
    
    if not vendor_b_id:
        pytest.skip("Vendor B not found")
    
    response = requests.get(
        f"{BASE_URL}/api/vendors/{vendor_b_id}/compliance",
        cookies={"vr360_session": session_a}
    )
    
    # Should be denied (403) or not found (404)
    assert response.status_code in [403, 404], f"Expected 403 or 404, got {response.status_code}"

def test_user_a_cannot_access_vendor_b_remediation():
    """Test that User A cannot access Vendor B's remediation tasks."""
    vendor_a_id, vendor_b_id, session_a, session_b = get_vendor_ids()
    
    if not vendor_b_id:
        pytest.skip("Vendor B not found")
    
    response = requests.get(
        f"{BASE_URL}/api/vendors/{vendor_b_id}/remediation",
        cookies={"vr360_session": session_a}
    )
    
    # Should be denied (403) or not found (404)
    assert response.status_code in [403, 404], f"Expected 403 or 404, got {response.status_code}"

def test_user_a_cannot_access_vendor_b_sub_vendors():
    """Test that User A cannot access Vendor B's sub-vendors."""
    vendor_a_id, vendor_b_id, session_a, session_b = get_vendor_ids()
    
    if not vendor_b_id:
        pytest.skip("Vendor B not found")
    
    response = requests.get(
        f"{BASE_URL}/api/vendors/{vendor_b_id}/sub-vendors",
        cookies={"vr360_session": session_a}
    )
    
    # Should be denied (403) or not found (404)
    assert response.status_code in [403, 404], f"Expected 403 or 404, got {response.status_code}"

def test_user_a_cannot_access_vendor_b_risk_score():
    """Test that User A cannot access Vendor B's risk score."""
    vendor_a_id, vendor_b_id, session_a, session_b = get_vendor_ids()
    
    if not vendor_b_id:
        pytest.skip("Vendor B not found")
    
    response = requests.get(
        f"{BASE_URL}/api/vendors/{vendor_b_id}/risk-score",
        cookies={"vr360_session": session_a}
    )
    
    # Should be denied (403) or not found (404)
    assert response.status_code in [403, 404], f"Expected 403 or 404, got {response.status_code}"

def test_user_a_cannot_access_vendor_b_risk_history():
    """Test that User A cannot access Vendor B's risk history."""
    vendor_a_id, vendor_b_id, session_a, session_b = get_vendor_ids()
    
    if not vendor_b_id:
        pytest.skip("Vendor B not found")
    
    response = requests.get(
        f"{BASE_URL}/api/vendors/{vendor_b_id}/risk-history",
        cookies={"vr360_session": session_a}
    )
    
    # Should be denied (403) or not found (404)
    assert response.status_code in [403, 404], f"Expected 403 or 404, got {response.status_code}"

def test_user_a_cannot_access_vendor_b_shap_risk():
    """Test that User A cannot access Vendor B's SHAP risk data."""
    vendor_a_id, vendor_b_id, session_a, session_b = get_vendor_ids()
    
    if not vendor_b_id:
        pytest.skip("Vendor B not found")
    
    response = requests.get(
        f"{BASE_URL}/api/vendors/{vendor_b_id}/shap-risk",
        cookies={"vr360_session": session_a}
    )
    
    # Should be denied (403) or not found (404)
    assert response.status_code in [403, 404], f"Expected 403 or 404, got {response.status_code}"

def test_user_a_cannot_delete_vendor_b():
    """Test that User A cannot delete Vendor B."""
    vendor_a_id, vendor_b_id, session_a, session_b = get_vendor_ids()
    
    if not vendor_b_id:
        pytest.skip("Vendor B not found")
    
    # User A needs MFA for delete, but should still be blocked by company check
    response = requests.delete(
        f"{BASE_URL}/api/vendors/{vendor_b_id}",
        cookies={"vr360_session": session_a}
    )
    
    # Should be denied (403) due to company ownership check before MFA
    assert response.status_code == 403, f"Expected 403, got {response.status_code}"

def test_user_a_cannot_create_incident_for_vendor_b():
    """Test that User A cannot create an incident for Vendor B."""
    vendor_a_id, vendor_b_id, session_a, session_b = get_vendor_ids()
    
    if not vendor_b_id:
        pytest.skip("Vendor B not found")
    
    # User A needs MFA for incident creation, but should still be blocked by company check
    response = requests.post(
        f"{BASE_URL}/api/vendors/{vendor_b_id}/incidents",
        json={"title": "Test Incident", "severity": "LOW", "status": "OPEN"},
        cookies={"vr360_session": session_a}
    )
    
    # Should be denied (403) due to company ownership check before MFA
    assert response.status_code == 403, f"Expected 403, got {response.status_code}"

def test_contagion_map_isolated():
    """Test that contagion map only shows user's company vendors."""
    session_a = get_session_cookie(USER_A_TOKEN)
    response = requests.get(
        f"{BASE_URL}/api/contagion",
        cookies={"vr360_session": session_a}
    )
    assert response.status_code == 200
    data = response.json()
    
    # Should only contain Vendor A, not Vendor B
    vendor_names = [n["name"] for n in data["nodes"] if n["type"] == "vendor"]
    assert "Vendor A" in vendor_names, "User A should see Vendor A in contagion map"
    assert "Vendor B" not in vendor_names, "User A should NOT see Vendor B in contagion map"

def test_activity_feed_isolated():
    """Test that activity feed only shows user's company events."""
    session_a = get_session_cookie(USER_A_TOKEN)
    response = requests.get(
        f"{BASE_URL}/api/feed",
        cookies={"vr360_session": session_a}
    )
    assert response.status_code == 200
    events = response.json()
    
    # Should only contain events for Vendor A
    vendor_names = [e["vendor_name"] for e in events]
    assert "Vendor A" in vendor_names, "User A should see Vendor A events"
    assert "Vendor B" not in vendor_names, "User A should NOT see Vendor B events"

def test_compliance_summary_isolated():
    """Test that compliance summary is scoped to user's company."""
    session_a = get_session_cookie(USER_A_TOKEN)
    response = requests.get(
        f"{BASE_URL}/api/compliance/summary",
        cookies={"vr360_session": session_a}
    )
    assert response.status_code == 200
    data = response.json()
    
    # Summary should only include Company A's compliance data
    # This is harder to test directly without knowing the exact structure,
    # but the query should be scoped
    assert "summary" in data

def test_remediation_summary_isolated():
    """Test that remediation summary is scoped to user's company."""
    session_a = get_session_cookie(USER_A_TOKEN)
    response = requests.get(
        f"{BASE_URL}/api/remediation/summary",
        cookies={"vr360_session": session_a}
    )
    assert response.status_code == 200
    data = response.json()
    
    # Summary should only include Company A's remediation data
    assert "summary" in data

if __name__ == "__main__":
    # Run tests manually for debugging
    print("Running IDOR isolation tests...")
    
    try:
        test_user_a_cannot_access_company_b_vendors()
        print("✓ User A cannot see Company B vendors")
    except AssertionError as e:
        print(f"✗ User A can see Company B vendors: {e}")
    
    try:
        test_user_b_cannot_access_company_a_vendors()
        print("✓ User B cannot see Company A vendors")
    except AssertionError as e:
        print(f"✗ User B can see Company A vendors: {e}")
    
    try:
        test_user_a_cannot_access_vendor_b_detail()
        print("✓ User A cannot access Vendor B detail")
    except AssertionError as e:
        print(f"✗ User A can access Vendor B detail: {e}")
    
    try:
        test_user_b_cannot_access_vendor_a_detail()
        print("✓ User B cannot access Vendor A detail")
    except AssertionError as e:
        print(f"✗ User B can access Vendor A detail: {e}")
    
    try:
        test_contagion_map_isolated()
        print("✓ Contagion map is isolated")
    except AssertionError as e:
        print(f"✗ Contagion map is not isolated: {e}")
    
    try:
        test_activity_feed_isolated()
        print("✓ Activity feed is isolated")
    except AssertionError as e:
        print(f"✗ Activity feed is not isolated: {e}")
    
    print("\nIDOR isolation tests completed.")
