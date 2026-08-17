import os
import sys
import sqlite3
import pytest
from datetime import datetime

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import init_db, get_db
from services.risk_scoring_service import calculate_assessment_score

def setup_module(module):
    init_db()

def create_mock_assessment(status="SUBMITTED"):
    conn = get_db()
    cursor = conn.cursor()
    # Ensure a vendor exists
    cursor.execute("INSERT OR IGNORE INTO vendors (id, name, domain) VALUES (999, 'Test Vendor', 'test.com')")
    # Insert assessment
    cursor.execute("INSERT INTO assessments (vendor_id, status, created_at, submitted_at) VALUES (?, ?, ?, ?)",
                   (999, status, datetime.utcnow().isoformat(), datetime.utcnow().isoformat()))
    assessment_id = cursor.lastrowid
    
    # Insert some answers
    answers = [
        (assessment_id, "Q1", "CYBERSECURITY", "YES"),
        (assessment_id, "Q2", "COMPLIANCE", "NO"),
        (assessment_id, "Q3", "FINANCIAL_STABILITY", "YES"),
        (assessment_id, "Q4", "OPERATIONAL_RISK", "YES"),
        (assessment_id, "Q5", "DATA_PRIVACY", "YES")
    ]
    cursor.executemany("INSERT INTO assessment_answers (assessment_id, question_id, category, answer_value) VALUES (?, ?, ?, ?)", answers)
    conn.commit()
    conn.close()
    return assessment_id

def test_score_calculation():
    assessment_id = create_mock_assessment("SUBMITTED")
    
    result = calculate_assessment_score(assessment_id, 999)
    
    # Expected: 
    # CYBER: 0, COMPLIANCE: 100, FINANCIAL: 0, OP: 0, PRIVACY: 0
    # Weights: CYBER 0.25, COMPLIANCE 0.20, FINANCIAL 0.15, OP 0.20, PRIVACY 0.20
    # Total = 100 * 0.20 = 20
    assert result["total_score"] == 20.0
    assert result["risk_level"] == "LOW"
    assert result["categories"]["COMPLIANCE"] == 100.0

def test_draft_assessment():
    assessment_id = create_mock_assessment("DRAFT")
    try:
        calculate_assessment_score(assessment_id, 999)
        assert False, "Should raise ValueError for draft assessment"
    except ValueError as e:
        assert "Cannot calculate score for incomplete or draft assessment" in str(e)
        
def test_unauthorized_vendor():
    assessment_id = create_mock_assessment("SUBMITTED")
    try:
        calculate_assessment_score(assessment_id, 888) # Wrong vendor
        assert False, "Should raise ValueError for wrong vendor"
    except ValueError as e:
        assert "Assessment not found or does not belong to vendor" in str(e)
