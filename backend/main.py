import os
from fastapi import FastAPI, HTTPException, Query, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

from services.auth_service import get_current_session, get_current_user_with_mfa, SESSION_COOKIE_NAME, verify_vendor_ownership, verify_assessment_ownership

from database import (
    init_db, get_db, get_quota_stats,
    add_incident, get_incidents, update_incident_status, delete_incident,
    get_vendor_incident_score_impact, calculate_incident_impact, recalculate_all_incident_impacts,
    add_compliance_framework, get_vendor_compliance_frameworks, update_compliance_framework, get_compliance_summary,
    create_remediation_task, get_vendor_remediation_tasks, update_remediation_task, get_remediation_summary,
    add_sub_vendor, get_sub_vendors, delete_sub_vendor,
    get_dashboard_metrics,
    create_cybersecurity_assessment,
    get_vendor_cybersecurity_assessments,
    get_cybersecurity_assessment_by_id,
    save_cybersecurity_answers,
    submit_cybersecurity_assessment,
    get_vendor_latest_cybersecurity_score,
    get_vendor_cybersecurity_history,
    review_cybersecurity_evidence,
    COMPLIANCE_FRAMEWORKS
)
from seed_data import seed_database
from services.risk_engine import compute_vendor_risk_score
from services.mlRiskService import calculate_shap_vendor_risk
from services.domainVerificationService import verify_vendor_existence
from services.cybersecurity_catalog import get_questions_catalog, get_question_by_id, CYBERSECURITY_DOMAINS
from services.cybersecurity_scoring import calculate_cybersecurity_score
from services.audit_log_service import get_audit_log, AuditAction


class CybersecurityAnswerItem(BaseModel):
    question_id: str
    domain: str
    answer_value: str
    evidence_document_id: Optional[int] = None
    evidence_status: Optional[str] = None
    evidence_notes: Optional[str] = None

class CybersecurityAnswersSave(BaseModel):
    answers: List[CybersecurityAnswerItem]

class EvidenceReviewRequest(BaseModel):
    status: str
    notes: Optional[str] = None



app = FastAPI(title="VendorRisk 360 API", version="1.0.0")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://localhost:5175"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    seed_database()

# Pydantic Schemas
class VendorCreate(BaseModel):
    name: str = Field(..., example="Datadog")
    domain: str = Field(..., example="datadoghq.com")
    sector: str = Field(..., example="Cloud Observability")
    criticality_tier: Optional[str] = Field(default="Tier 2 - Business Operational", example="Tier 1 - Mission Critical")
    data_sensitivity: Optional[str] = Field(default="Public Data", example="PII / PHI")
    contract_value: Optional[int] = Field(default=0, example=250000)
    custom_ticker: Optional[str] = Field(default=None, example="DDOG")
    compliance_certs: Optional[str] = Field(default="SOC2 Type II", example="SOC2 Type II, ISO 27001")

class VendorResponse(BaseModel):
    id: int
    name: str
    domain: str
    sector: str
    risk_tier: str
    risk_score: int
    hibp_score: int
    news_score: int
    sanctions_score: int
    criticality_tier: Optional[str] = None
    data_sensitivity: Optional[str] = None
    contract_value: Optional[int] = 0
    custom_ticker: Optional[str] = None
    compliance_certs: Optional[str] = None
    last_checked_at: Optional[str] = None
class IncidentCreate(BaseModel):
    vendor_id: int
    title: str = Field(..., example="AWS S3 Data Leak")
    description: Optional[str] = Field(default=None, example="Misconfigured bucket exposed non-sensitive log archives.")
    category: Optional[str] = Field(default="Security Breach", example="Data Leak")
    severity: str = Field(default="MEDIUM", example="HIGH")
    status: str = Field(default="OPEN", example="OPEN")

class IncidentStatusUpdate(BaseModel):
    status: str = Field(..., example="RESOLVED")

class ComplianceFrameworkCreate(BaseModel):
    vendor_id: int
    framework_name: str = Field(..., example="SOC 2 Type II")
    framework_type: str = Field(..., example="Security")
    compliance_score: int = Field(default=0, example=85)
    document_path: Optional[str] = Field(default=None, example="/uploads/soc2_report.pdf")

class ComplianceFrameworkUpdate(BaseModel):
    compliance_score: int
    gaps_identified: int
    controls_passed: int
    controls_total: int

class RemediationTaskCreate(BaseModel):
    vendor_id: int
    title: str = Field(..., example="Implement MFA for admin accounts")
    description: Optional[str] = Field(default=None, example="Vendor must implement multi-factor authentication")
    priority: str = Field(default="MEDIUM", example="HIGH")
    assigned_to: Optional[str] = Field(default=None, example="security-team@company.com")
    due_date: Optional[str] = Field(default=None, example="2026-09-01")
    source_type: str = Field(default="MANUAL", example="INCIDENT")
    source_reference: Optional[int] = Field(default=None)

class RemediationTaskUpdate(BaseModel):
    status: str = Field(..., example="IN_PROGRESS")

# Endpoints

@app.get("/health")
def health_check():
    return {
        "status": "online",
        "service": "VendorRisk 360 Security Monitor",
        "demo_mode": os.getenv("DEMO_MODE", "true").lower() == "true",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/api/dashboard/metrics")
def get_dashboard_metrics_endpoint(session = Depends(get_current_session)):
    user_company_id = session.get("company_id")
    if not user_company_id:
        raise HTTPException(status_code=403, detail="User has no company association")
    return get_dashboard_metrics(user_company_id)

@app.get("/api/vendors")
def get_vendors(session = Depends(get_current_session)):
    user_company_id = session.get("company_id")
    if not user_company_id:
        raise HTTPException(status_code=403, detail="User has no company association")
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            v.id, v.name, v.domain, v.sector, v.risk_tier, v.risk_score,
            v.hibp_score, v.news_score, v.sanctions_score, v.abuse_score,
            v.criticality_tier, v.data_sensitivity, v.contract_value, v.compliance_certs,
            v.last_checked_at, v.created_at,
            COALESCE((
                SELECT SUM(score_impact) FROM incidents
                WHERE vendor_id = v.id AND status IN ('OPEN', 'INVESTIGATING')
            ), 0) AS incident_penalty,
            COALESCE((
                SELECT COUNT(*) FROM incidents
                WHERE vendor_id = v.id AND status IN ('OPEN', 'INVESTIGATING')
            ), 0) AS active_incidents,
            COALESCE((
                SELECT COUNT(*) FROM incidents
                WHERE vendor_id = v.id AND severity = 'CRITICAL'
                  AND status IN ('OPEN', 'INVESTIGATING')
            ), 0) AS critical_active
        FROM vendors v
        WHERE v.company_id = ?
        ORDER BY v.risk_score DESC
    """, (user_company_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/vendors", status_code=201)
def add_vendor(vendor: VendorCreate, session = Depends(get_current_user_with_mfa)):
    if session["role"] not in ("CISO", "ENTERPRISE_ADMIN", "ANALYST"):
        raise HTTPException(status_code=403, detail="Unauthorized role for this operation.")
    
    user_company_id = session.get("company_id")
    if not user_company_id:
        raise HTTPException(status_code=403, detail="User has no company association")
    
    conn = get_db()
    cursor = conn.cursor()

    domain_clean = vendor.domain.lower().replace("https://", "").replace("http://", "").strip("/")
    if "." not in domain_clean or len(domain_clean) < 4:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Invalid domain format: '{vendor.domain}'. Must be e.g. company.com")

    # Check for existing domain within the same company
    cursor.execute("SELECT id FROM vendors WHERE domain = ? AND company_id = ?", (domain_clean, user_company_id))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail=f"Vendor with domain '{domain_clean}' already exists in your company.")

    # Execute Multi-Probe Domain Existence Verification (DNS + HTTPS + Syntax)
    verification = verify_vendor_existence(domain_clean)
    if not verification["is_valid"]:
        conn.close()
        raise HTTPException(
            status_code=400, 
            detail=f"Vendor Domain Verification Failed: {verification['message']}"
        )

    # Compute 100% live risk score across all vectors
    try:
        score_data = compute_vendor_risk_score(
            domain=domain_clean, 
            vendor_name=vendor.name, 
            email=getattr(vendor, 'email', None),
            ip_address=getattr(vendor, 'ip_address', None),
            software=getattr(vendor, 'software', None),
            country=getattr(vendor, 'country', None),
            custom_ticker=vendor.custom_ticker
        )
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Live risk scoring failed: {str(e)}")

    breakdown = score_data.get("breakdown", {})
    now = datetime.utcnow().isoformat()

    # Safely extract sub-scores
    hibp_score      = breakdown.get("hibp", {}).get("hibp_score", 0)
    news_score      = breakdown.get("news", {}).get("score", 0) or breakdown.get("news", {}).get("news_score", 0)
    sanctions_score = breakdown.get("sanctions", {}).get("sanctions_score", 0)
    abuse_score     = breakdown.get("abuseipdb", {}).get("score", 0)

    cursor.execute("""
        INSERT INTO vendors (name, domain, sector, risk_tier, risk_score, hibp_score, news_score, sanctions_score, abuse_score,
                            criticality_tier, data_sensitivity, contract_value, custom_ticker, compliance_certs,
                            last_checked_at, created_at, company_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        vendor.name,
        domain_clean,
        vendor.sector,
        score_data["risk_tier"],
        score_data["overall_score"],
        hibp_score,
        news_score,
        sanctions_score,
        abuse_score,
        vendor.criticality_tier or "Tier 2 - Business Operational",
        vendor.data_sensitivity or "Public Data",
        vendor.contract_value or 0,
        vendor.custom_ticker or None,
        vendor.compliance_certs or "SOC2 Type II",
        now,
        now,
        user_company_id
    ))
    vendor_id = cursor.lastrowid

    # Create activity feed event for vendor onboarding
    cursor.execute("""
        INSERT INTO risk_events (vendor_id, vendor_name, source, title, summary, risk_level, url, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        vendor_id,
        vendor.name,
        "Vendor Onboarding",
        f"New Vendor Onboarded: {vendor.name}",
        f"Live security risk assessment completed — {score_data['overall_score']}/100 ({score_data['risk_tier']} Risk). 7 live vectors scanned: News, CISA KEV, AbuseIPDB, Stock, SSL, DNS, IPinfo.",
        "HIGH" if score_data['overall_score'] >= 70 else ("MEDIUM" if score_data['overall_score'] >= 40 else "LOW"),
        f"https://{domain_clean}",
        now
    ))

    conn.commit()
    conn.close()

    return {
        "id": vendor_id,
        "name": vendor.name,
        "domain": domain_clean,
        "sector": vendor.sector,
        "risk_tier": score_data["risk_tier"],
        "risk_score": score_data["overall_score"],
        "breakdown_summary": {
            "news": news_score,
            "hibp": hibp_score,
            "abuse_ip": abuse_score,
            "sanctions": sanctions_score
        },
        "message": f"✅ {vendor.name} onboarded. Live risk score: {score_data['overall_score']}/100 ({score_data['risk_tier']})"
    }

@app.get("/api/vendors/{vendor_id}")
def get_vendor_detail(vendor_id: int, session = Depends(get_current_session)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM vendors WHERE id = ?", (vendor_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Vendor not found.")

    v = dict(row)
    
    # Verify vendor belongs to user's company
    if not verify_vendor_ownership(vendor_id, session, get_db()):
        raise HTTPException(status_code=403, detail="Access denied: Vendor does not belong to your company")
    
    score_data = compute_vendor_risk_score(
        domain=v["domain"], 
        vendor_name=v["name"], 
        email=v.get("email"),
        ip_address=v.get("ip_address"),
        software=v.get("software"),
        country=v.get("country"),
        custom_ticker=v.get("custom_ticker"), 
        vendor_id=vendor_id
    )

    return {
        "vendor": v,
        "risk_assessment": score_data
    }

@app.post("/api/vendors/{vendor_id}/refresh")
def refresh_vendor_risk(vendor_id: int, session = Depends(get_current_session)):
    if session["role"] not in ("CISO", "ENTERPRISE_ADMIN", "ANALYST"):
        raise HTTPException(status_code=403, detail="Unauthorized role for this operation.")
    
    # Verify vendor belongs to user's company
    if not verify_vendor_ownership(vendor_id, session, get_db()):
        raise HTTPException(status_code=403, detail="Access denied: Vendor does not belong to your company")
    
    """Manual trigger to re-check API risk scores for a single vendor."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM vendors WHERE id = ?", (vendor_id,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Vendor not found.")

    v = dict(row)
    score_data = compute_vendor_risk_score(
        domain=v["domain"], 
        vendor_name=v["name"], 
        email=v.get("email"),
        ip_address=v.get("ip_address"),
        software=v.get("software"),
        country=v.get("country"),
        custom_ticker=v.get("custom_ticker"), 
        vendor_id=vendor_id
    )
    breakdown = score_data.get("breakdown", {})
    now = datetime.utcnow().isoformat()

    hibp_score      = breakdown.get("hibp", {}).get("hibp_score", 0)
    news_score      = breakdown.get("news", {}).get("score", 0) or breakdown.get("news", {}).get("news_score", 0)
    sanctions_score = breakdown.get("sanctions", {}).get("sanctions_score", 0)
    abuse_score     = breakdown.get("abuseipdb", {}).get("score", 0)

    cursor.execute("""
        UPDATE vendors
        SET risk_tier = ?,
            risk_score = ?,
            hibp_score = ?,
            news_score = ?,
            sanctions_score = ?,
            abuse_score = ?,
            last_checked_at = ?
        WHERE id = ?
    """, (
        score_data["risk_tier"],
        score_data["overall_score"],
        hibp_score,
        news_score,
        sanctions_score,
        abuse_score,
        now,
        vendor_id
    ))

    # Log refresh event
    cursor.execute("""
        INSERT INTO risk_events (vendor_id, vendor_name, source, title, summary, risk_level, url, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        vendor_id,
        v["name"],
        "Manual Refresh",
        f"Security Audit Refreshed for {v['name']}",
        f"Manual security risk scan updated risk score to {score_data['overall_score']}/100.",
        "HIGH" if score_data['overall_score'] >= 70 else "LOW",
        f"https://{v['domain']}",
        now
    ))

    conn.commit()
    conn.close()

    return {
        "message": f"Refreshed security risk data for {v['name']}.",
        "new_score": score_data["overall_score"],
        "risk_tier": score_data["risk_tier"],
        "last_checked_at": now
    }

@app.delete("/api/vendors/{vendor_id}")
def delete_vendor(vendor_id: int, request: Request, current_user = Depends(get_current_user_with_mfa)):
    from services.audit_log_service import get_audit_log, AuditAction
    
    # RBAC: Only CISO or ENTERPRISE_ADMIN can delete a vendor
    if current_user["role"] not in ("CISO", "ENTERPRISE_ADMIN"):
        audit = get_audit_log()
        client_ip = request.client.host if request.client else "127.0.0.1"
        audit.record(
            action=AuditAction.PERMISSION_DENIED,
            resource=f"vendor:{vendor_id}:delete",
            outcome="DENIED",
            actor_id=current_user["user_id"],
            actor_email=current_user["email"],
            actor_role=current_user["role"],
            ip_address=client_ip,
            session_id=current_user["session_id"]
        )
        raise HTTPException(status_code=403, detail="Unauthorized role for this operation.")
    
    # Verify vendor belongs to user's company
    if not verify_vendor_ownership(vendor_id, current_user, get_db()):
        audit = get_audit_log()
        client_ip = request.client.host if request.client else "127.0.0.1"
        audit.record(
            action=AuditAction.PERMISSION_DENIED,
            resource=f"vendor:{vendor_id}:delete",
            outcome="DENIED",
            actor_id=current_user["user_id"],
            actor_email=current_user["email"],
            actor_role=current_user["role"],
            ip_address=client_ip,
            session_id=current_user["session_id"],
            details={"reason": "Vendor does not belong to user's company"}
        )
        raise HTTPException(status_code=403, detail="Access denied: Vendor does not belong to your company")
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM vendors WHERE id = ?", (vendor_id,))
    vendor = cursor.fetchone()
    if not vendor:
        conn.close()
        raise HTTPException(status_code=404, detail="Vendor not found.")
        
    cursor.execute("DELETE FROM vendors WHERE id = ?", (vendor_id,))
    conn.commit()
    conn.close()
    
    # Audit log success
    audit = get_audit_log()
    client_ip = request.client.host if request.client else "127.0.0.1"
    audit.record(
        action=AuditAction.VENDOR_DELETED,
        resource=f"vendor:{vendor_id}:{vendor['name']}",
        actor_id=current_user["user_id"],
        actor_email=current_user["email"],
        actor_role=current_user["role"],
        ip_address=client_ip,
        session_id=current_user["session_id"]
    )
    return {"message": "Vendor deleted successfully."}

@app.get("/api/vendors/{vendor_id}/shap-risk")
def get_vendor_shap_risk(vendor_id: int, session = Depends(get_current_session)):
    """Scikit-Learn RandomForest + SHAP Feature Attribution Endpoint"""
    # Verify vendor belongs to user's company
    if not verify_vendor_ownership(vendor_id, session, get_db()):
        raise HTTPException(status_code=403, detail="Access denied: Vendor does not belong to your company")
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT v.*,
            COALESCE((
                SELECT SUM(score_impact) FROM incidents
                WHERE vendor_id = v.id AND status IN ('OPEN', 'INVESTIGATING')
            ), 0) AS incident_penalty,
            COALESCE((
                SELECT COUNT(*) FROM incidents
                WHERE vendor_id = v.id AND status IN ('OPEN', 'INVESTIGATING')
            ), 0) AS active_incidents
        FROM vendors v WHERE v.id = ?
    """, (vendor_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Vendor not found.")

    v = dict(row)
    shap_data = calculate_shap_vendor_risk(v)
    return shap_data


class VendorIncidentCreate(BaseModel):
    title: str = Field(..., example="Ransomware Attack Detected")
    description: Optional[str] = Field(default=None, example="Vendor reported unauthorized access")
    category: Optional[str] = Field(default="Security Breach", example="Ransomware")
    severity: str = Field(default="MEDIUM", example="HIGH")
    status: str = Field(default="OPEN", example="OPEN")

@app.get("/api/contagion")
def get_risk_contagion_map(session = Depends(get_current_session)):
    """Returns network nodes and edges for the Risk Contagion View."""
    user_company_id = session.get("company_id")
    if not user_company_id:
        raise HTTPException(status_code=403, detail="User has no company association")
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, domain, sector, risk_tier, risk_score FROM vendors WHERE company_id = ?", (user_company_id,))
    vendors = [dict(r) for r in cursor.fetchall()]
    conn.close()

    nodes = [
        {
            "id": "center_company",
            "name": "Your Organization (HQ)",
            "type": "organization",
            "domain": "internal",
            "risk_score": 0,
            "risk_tier": "Safe"
        }
    ]

    edges = []

    for v in vendors:
        node_id = f"vendor_{v['id']}"
        nodes.append({
            "id": node_id,
            "vendor_id": v["id"],
            "name": v["name"],
            "domain": v["domain"],
            "sector": v["sector"],
            "type": "vendor",
            "risk_score": v["risk_score"],
            "risk_tier": v["risk_tier"]
        })

        # Define link status & color based on risk score threshold
        if v["risk_score"] >= 70:
            link_status = "CRITICAL_CONTAGION"
            color = "#f43f5e" # Rose red
        elif v["risk_score"] >= 40:
            link_status = "ELEVATED_RISK"
            color = "#f59e0b" # Amber
        else:
            link_status = "SAFE_CONNECTION"
            color = "#10b981" # Emerald green

        edges.append({
            "source": "center_company",
            "target": node_id,
            "vendor_name": v["name"],
            "risk_score": v["risk_score"],
            "status": link_status,
            "color": color
        })

    return {
        "nodes": nodes,
        "edges": edges,
        "total_vendors": len(vendors),
        "critical_count": sum(1 for v in vendors if v["risk_score"] >= 70)
    }

@app.get("/api/feed")
def get_activity_feed(limit: int = Query(20, ge=1, le=100), session = Depends(get_current_session)):
    user_company_id = session.get("company_id")
    if not user_company_id:
        raise HTTPException(status_code=403, detail="User has no company association")
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT re.id, re.vendor_id, re.vendor_name, re.source, re.title, re.summary, re.risk_level, re.url, re.timestamp
        FROM risk_events re
        JOIN vendors v ON re.vendor_id = v.id
        WHERE v.company_id = ?
        ORDER BY re.timestamp DESC
        LIMIT ?
    """, (user_company_id, limit))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/quota")
def get_quota_debug_info(session = Depends(get_current_session)):
    """Dev debug panel data for API call budgets and circuit breakers."""
    # Restrict quota debug to admin roles only
    if session["role"] not in ("CISO", "ENTERPRISE_ADMIN"):
        raise HTTPException(status_code=403, detail="Unauthorized: Quota debug restricted to admins")
    
    stats = get_quota_stats()
    return {
        "demo_mode": os.getenv("DEMO_MODE", "true").lower() == "true",
        "quotas": stats,
        "cooldown_window": "60 minutes"
    }

@app.post("/api/quota/reset")
def reset_quota_counters(session = Depends(get_current_user_with_mfa)):
    if session["role"] not in ("ENTERPRISE_ADMIN", "CISO"):
        raise HTTPException(status_code=403, detail="Unauthorized role for this operation.")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM api_quota")
    cursor.execute("DELETE FROM cached_responses")
    conn.commit()
    conn.close()
    return {"message": "Reset API quota counters and cleared response cache."}

# Security Incident Management API Endpoints

@app.get("/api/incidents")
def list_incidents(vendor_id: Optional[int] = Query(None), session = Depends(get_current_session)):
    """Fetch all reported vendor security incidents."""
    user_company_id = session.get("company_id")
    if not user_company_id:
        raise HTTPException(status_code=403, detail="User has no company association")
    
    if vendor_id:
        # Verify vendor belongs to user's company
        if not verify_vendor_ownership(vendor_id, session, get_db()):
            raise HTTPException(status_code=403, detail="Access denied: Vendor does not belong to your company")
        incidents = get_incidents(vendor_id)
    else:
        incidents = get_incidents(company_id=user_company_id)
    return incidents

@app.get("/api/vendors/{vendor_id}/incidents")
def get_vendor_incidents_list(vendor_id: int, session = Depends(get_current_session)):
    """Fetch incidents for a specific vendor along with score impact metrics."""
    # Verify vendor belongs to user's company
    if not verify_vendor_ownership(vendor_id, session, get_db()):
        raise HTTPException(status_code=403, detail="Access denied: Vendor does not belong to your company")
    
    incidents = get_incidents(vendor_id)
    impact_stats = get_vendor_incident_score_impact(vendor_id)
    return {
        "incidents": incidents,
        "impact_stats": impact_stats
    }

@app.post("/api/vendors/{vendor_id}/incidents", status_code=201)
def log_vendor_incident(vendor_id: int, payload: VendorIncidentCreate, session = Depends(get_current_user_with_mfa)):
    if session["role"] not in ("CISO", "ENTERPRISE_ADMIN", "ANALYST"):
        raise HTTPException(status_code=403, detail="Unauthorized role for this operation.")
    
    # Verify vendor belongs to user's company
    if not verify_vendor_ownership(vendor_id, session, get_db()):
        raise HTTPException(status_code=403, detail="Access denied: Vendor does not belong to your company")
    
    """Log incident from vendor detail panel — delegates to unified incident engine."""
    return create_new_incident(IncidentCreate(
        vendor_id=vendor_id,
        title=payload.title,
        description=payload.description,
        category=payload.category,
        severity=payload.severity,
        status=payload.status,
    ))

@app.post("/api/incidents")
def create_new_incident(payload: IncidentCreate, session = Depends(get_current_user_with_mfa)):
    if session["role"] not in ("CISO", "ENTERPRISE_ADMIN", "ANALYST"):
        raise HTTPException(status_code=403, detail="Unauthorized role for this operation.")
    
    # Verify vendor belongs to user's company
    if not verify_vendor_ownership(payload.vendor_id, session, get_db()):
        raise HTTPException(status_code=403, detail="Access denied: Vendor does not belong to your company")
    
    """Log a new security incident against a vendor and trigger risk score recalculation."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, domain FROM vendors WHERE id = ?", (payload.vendor_id,))
    vendor = cursor.fetchone()
    conn.close()
    
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    incident_id = add_incident(
        vendor_id=payload.vendor_id,
        title=payload.title,
        description=payload.description or "",
        category=payload.category or "Security Breach",
        severity=payload.severity,
        status=payload.status
    )

    # Recalculate vendor's risk score incorporating the new incident impact
    score_res = compute_vendor_risk_score(domain=vendor["domain"], vendor_name=vendor["name"], vendor_id=vendor["id"])
    new_score = score_res["overall_score"]
    new_tier = score_res["risk_tier"]

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE vendors SET risk_score = ?, risk_tier = ? WHERE id = ?", (new_score, new_tier, vendor["id"]))
    
    # Log to risk_events feed
    cursor.execute("""
        INSERT INTO risk_events (vendor_id, vendor_name, source, title, summary, risk_level, url, timestamp)
        VALUES (?, ?, 'INCIDENT_LOG', ?, ?, ?, '', ?)
    """, (
        vendor["id"],
        vendor["name"],
        f"🚨 Logged Incident: {payload.title}",
        f"Severity: {payload.severity} | Category: {payload.category}. Score Impact: +{calculate_incident_impact(payload.severity, payload.status)} pts",
        payload.severity,
        datetime.utcnow().isoformat()
    ))
    conn.commit()
    conn.close()

    return {
        "id": incident_id,
        "message": "Security incident logged successfully and vendor risk score recalculated.",
        "new_risk_score": new_score,
        "new_risk_tier": new_tier
    }

@app.patch("/api/incidents/{incident_id}")
def update_incident(incident_id: int, payload: IncidentStatusUpdate, session = Depends(get_current_user_with_mfa)):
    if session["role"] not in ("CISO", "ENTERPRISE_ADMIN", "ANALYST"):
        raise HTTPException(status_code=403, detail="Unauthorized role for this operation.")
    
    """Update incident resolution status (e.g. RESOLVED / INVESTIGATING) and update vendor risk score."""
    success = update_incident_status(incident_id, payload.status)
    if not success:
        raise HTTPException(status_code=404, detail="Incident not found")

    new_score = None
    new_tier = None

    # Find affected vendor and recalculate risk score
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT vendor_id FROM incidents WHERE id = ?", (incident_id,))
    row = cursor.fetchone()
    if row:
        vendor_id = row["vendor_id"]
        
        # Verify vendor belongs to user's company
        if not verify_vendor_ownership(vendor_id, session, conn):
            conn.close()
            raise HTTPException(status_code=403, detail="Access denied: Vendor does not belong to your company")
        
        cursor.execute("SELECT id, name, domain FROM vendors WHERE id = ?", (vendor_id,))
        vendor = cursor.fetchone()
        conn.close()
        if vendor:
            score_res = compute_vendor_risk_score(domain=vendor["domain"], vendor_name=vendor["name"], vendor_id=vendor["id"])
            new_score = score_res["overall_score"]
            new_tier = score_res["risk_tier"]
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("UPDATE vendors SET risk_score = ?, risk_tier = ? WHERE id = ?", (new_score, new_tier, vendor["id"]))
            conn.commit()
            conn.close()
    else:
        conn.close()

    return {
        "message": f"Incident #{incident_id} status updated to {payload.status}.",
        "new_risk_score": new_score,
        "new_risk_tier": new_tier,
    }

@app.delete("/api/incidents/{incident_id}")
def delete_incident_endpoint(incident_id: int, session = Depends(get_current_user_with_mfa)):
    if session["role"] not in ("CISO", "ENTERPRISE_ADMIN"):
        raise HTTPException(status_code=403, detail="Unauthorized role for this operation.")
    
    """Delete an incident record and recalculate vendor risk score."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT vendor_id FROM incidents WHERE id = ?", (incident_id,))
    row = cursor.fetchone()
    
    if row:
        vendor_id = row["vendor_id"]
        # Verify vendor belongs to user's company
        if not verify_vendor_ownership(vendor_id, session, conn):
            conn.close()
            raise HTTPException(status_code=403, detail="Access denied: Vendor does not belong to your company")
    
    conn.close()

    delete_incident(incident_id)

    if row:
        vendor_id = row["vendor_id"]
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, domain FROM vendors WHERE id = ?", (vendor_id,))
        vendor = cursor.fetchone()
        conn.close()
        if vendor:
            score_res = compute_vendor_risk_score(domain=vendor["domain"], vendor_name=vendor["name"], vendor_id=vendor["id"])
            new_score = score_res["overall_score"]
            new_tier = score_res["risk_tier"]
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("UPDATE vendors SET risk_score = ?, risk_tier = ? WHERE id = ?", (new_score, new_tier, vendor["id"]))
            conn.commit()
            conn.close()

    return {"message": f"Incident #{incident_id} deleted."}

@app.post("/api/incidents/recalculate-aging")
def recalculate_incident_aging(session = Depends(get_current_session)):
    """Recalculate all open incident impacts to apply aging logic (reduces impact for older incidents)."""
    updated_count = recalculate_all_incident_impacts()
    
    # Recalculate all vendor risk scores after aging update
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, domain FROM vendors")
    vendors = cursor.fetchall()
    conn.close()
    
    for vendor in vendors:
        try:
            score_res = compute_vendor_risk_score(domain=vendor["domain"], vendor_name=vendor["name"], vendor_id=vendor["id"])
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("UPDATE vendors SET risk_score = ?, risk_tier = ? WHERE id = ?", 
                         (score_res["overall_score"], score_res["risk_tier"], vendor["id"]))
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error recalculating risk for vendor {vendor['id']}: {e}")
    
    return {
        "message": f"Recalculated aging for {updated_count} open incidents and updated all vendor risk scores.",
        "incidents_updated": updated_count,
        "vendors_updated": len(vendors)
    }

# Compliance Framework API Endpoints (VendorAuditAI-inspired)

@app.get("/api/compliance/frameworks")
def list_compliance_frameworks(session = Depends(get_current_session)):
    """Get list of available compliance frameworks."""
    return {"frameworks": COMPLIANCE_FRAMEWORKS}

@app.get("/api/vendors/{vendor_id}/compliance")
def get_vendor_compliance(vendor_id: int, session = Depends(get_current_session)):
    """Get compliance frameworks for a specific vendor."""
    # Verify vendor belongs to user's company
    if not verify_vendor_ownership(vendor_id, session, get_db()):
        raise HTTPException(status_code=403, detail="Access denied: Vendor does not belong to your company")
    
    frameworks = get_vendor_compliance_frameworks(vendor_id)
    return {"frameworks": frameworks}

@app.post("/api/vendors/{vendor_id}/compliance", status_code=201)
def add_vendor_compliance(vendor_id: int, payload: ComplianceFrameworkCreate, session = Depends(get_current_user_with_mfa)):
    if session["role"] not in ("CISO", "ENTERPRISE_ADMIN", "ANALYST"):
        raise HTTPException(status_code=403, detail="Unauthorized role for this operation.")
    
    # Verify vendor belongs to user's company
    if not verify_vendor_ownership(vendor_id, session, get_db()):
        raise HTTPException(status_code=403, detail="Access denied: Vendor does not belong to your company")
    
    """Add a compliance framework assessment for a vendor."""
    framework_id = add_compliance_framework(
        vendor_id=vendor_id,
        framework_name=payload.framework_name,
        framework_type=payload.framework_type,
        compliance_score=payload.compliance_score,
        document_path=payload.document_path
    )
    return {
        "id": framework_id,
        "message": f"Compliance framework {payload.framework_name} added for vendor."
    }

@app.patch("/api/compliance/{framework_id}")
def update_compliance(framework_id: int, payload: ComplianceFrameworkUpdate, session = Depends(get_current_user_with_mfa)):
    if session["role"] not in ("CISO", "ENTERPRISE_ADMIN", "ANALYST"):
        raise HTTPException(status_code=403, detail="Unauthorized role for this operation.")
    """Update compliance framework assessment results."""
    success = update_compliance_framework(
        framework_id=framework_id,
        compliance_score=payload.compliance_score,
        gaps_identified=payload.gaps_identified,
        controls_passed=payload.controls_passed,
        controls_total=payload.controls_total
    )
    if not success:
        raise HTTPException(status_code=404, detail="Compliance framework not found")
    return {"message": "Compliance framework updated successfully."}

@app.get("/api/compliance/summary")
def get_compliance_stats(session = Depends(get_current_session)):
    """Get overall compliance statistics across all vendors."""
    user_company_id = session.get("company_id")
    if not user_company_id:
        raise HTTPException(status_code=403, detail="User has no company association")
    
    summary = get_compliance_summary(company_id=user_company_id)
    return {"summary": summary}

# Remediation Task API Endpoints (VendorAuditAI-inspired)

@app.get("/api/vendors/{vendor_id}/remediation")
def get_vendor_remediation(vendor_id: int, session = Depends(get_current_session)):
    """Get remediation tasks for a specific vendor."""
    # Verify vendor belongs to user's company
    if not verify_vendor_ownership(vendor_id, session, get_db()):
        raise HTTPException(status_code=403, detail="Access denied: Vendor does not belong to your company")
    
    tasks = get_vendor_remediation_tasks(vendor_id)
    return {"tasks": tasks}

@app.post("/api/vendors/{vendor_id}/remediation", status_code=201)
def create_remediation(vendor_id: int, payload: RemediationTaskCreate, session = Depends(get_current_user_with_mfa)):
    if session["role"] not in ("CISO", "ENTERPRISE_ADMIN", "ANALYST"):
        raise HTTPException(status_code=403, detail="Unauthorized role for this operation.")
    
    # Verify vendor belongs to user's company
    if not verify_vendor_ownership(vendor_id, session, get_db()):
        raise HTTPException(status_code=403, detail="Access denied: Vendor does not belong to your company")
    
    """Create a remediation task for a vendor."""
    task_id = create_remediation_task(
        vendor_id=vendor_id,
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        assigned_to=payload.assigned_to,
        due_date=payload.due_date,
        source_type=payload.source_type,
        source_reference=payload.source_reference
    )
    return {
        "id": task_id,
        "message": "Remediation task created successfully."
    }

@app.patch("/api/remediation/{task_id}")
def update_remediation(task_id: int, payload: RemediationTaskUpdate, session = Depends(get_current_user_with_mfa)):
    if session["role"] not in ("CISO", "ENTERPRISE_ADMIN", "ANALYST", "VENDOR"):
        raise HTTPException(status_code=403, detail="Unauthorized role for this operation.")
    """Update remediation task status."""
    success = update_remediation_task(task_id=task_id, status=payload.status)
    if not success:
        raise HTTPException(status_code=404, detail="Remediation task not found")
    return {"message": f"Remediation task status updated to {payload.status}."}

@app.get("/api/remediation/summary")
def get_remediation_stats(session = Depends(get_current_session)):
    """Get overall remediation task statistics."""
    user_company_id = session.get("company_id")
    if not user_company_id:
        raise HTTPException(status_code=403, detail="User has no company association")
    
    summary = get_remediation_summary(company_id=user_company_id)
    return {"summary": summary}

# 4th-Party Sub-Vendor Supply Chain Endpoints
class SubVendorCreate(BaseModel):
    name: str = Field(..., example="AWS Cloud Hosting")
    domain: str = Field(..., example="aws.amazon.com")
    sector: Optional[str] = Field(default="Sub-Tier Supplier", example="Cloud Infrastructure")
    risk_score: Optional[int] = Field(default=25, example=15)

@app.get("/api/vendors/{vendor_id}/sub-vendors")
def get_vendor_sub_vendors(vendor_id: int, session = Depends(get_current_session)):
    """Retrieve 4th-party sub-vendors supplying a specific 3rd-party vendor."""
    # Verify vendor belongs to user's company
    if not verify_vendor_ownership(vendor_id, session, get_db()):
        raise HTTPException(status_code=403, detail="Access denied: Vendor does not belong to your company")
    
    return get_sub_vendors(vendor_id)

@app.post("/api/vendors/{vendor_id}/sub-vendors", status_code=201)
def create_vendor_sub_vendor(vendor_id: int, sub: SubVendorCreate, session = Depends(get_current_user_with_mfa)):
    if session["role"] not in ("CISO", "ENTERPRISE_ADMIN", "ANALYST"):
        raise HTTPException(status_code=403, detail="Unauthorized role for this operation.")
    
    # Verify vendor belongs to user's company
    if not verify_vendor_ownership(vendor_id, session, get_db()):
        raise HTTPException(status_code=403, detail="Access denied: Vendor does not belong to your company")
    
    """Add a 4th-party sub-vendor under a 3rd-party vendor with domain existence verification."""
    sub_domain_clean = sub.domain.lower().replace("https://", "").replace("http://", "").strip("/")
    verification = verify_vendor_existence(sub_domain_clean)
    if not verification["is_valid"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Sub-Vendor Domain Verification Failed: {verification['message']}"
        )

    sub_id = add_sub_vendor(vendor_id, sub.name, sub_domain_clean, sub.sector, sub.risk_score)
    return {"id": sub_id, "message": f"Added 4th-party sub-vendor {sub.name} for vendor ID {vendor_id}"}

@app.delete("/api/sub-vendors/{sub_id}")
def remove_sub_vendor(sub_id: int, session = Depends(get_current_user_with_mfa)):
    if session["role"] not in ("CISO", "ENTERPRISE_ADMIN"):
        raise HTTPException(status_code=403, detail="Unauthorized role for this operation.")
    """Remove a 4th-party sub-vendor from the supply chain graph."""
    delete_sub_vendor(sub_id)
    return {"message": "Sub-vendor removed successfully."}

# Google OIDC & MFA Endpoints
class GoogleLoginRequest(BaseModel):
    id_token: str

@app.get("/api/auth/me")
def get_me_endpoint(session = Depends(get_current_session)):
    return {
        "status": "success",
        "user": {
            "id": session["user_id"],
            "email": session["email"],
            "name": session["name"],
            "role": session["role"],
            "mfa_enabled": bool(session["mfa_enabled"]),
            "mfa_verified": bool(session["mfa_verified"])
        }
    }

@app.post("/api/auth/google-login")
def google_login_endpoint(payload: GoogleLoginRequest, request: Request, response: Response):
    from services.auth_service import verify_google_token, get_or_create_user, create_session
    from services.audit_log_service import get_audit_log, AuditAction
    
    db_conn = get_db()
    audit = get_audit_log()
    client_ip = request.client.host if request.client else "127.0.0.1"
    
    try:
        # 1. Verify Google identity token
        idinfo = verify_google_token(payload.id_token)
        email = idinfo["email"]
        sub = idinfo["sub"]
        name = idinfo.get("name", email.split("@")[0])
        
        # 2. Get or create user
        user = get_or_create_user(sub, email, name, db_conn)
        
        # 3. Session Fixation Protection: Revoke any existing session in incoming cookies
        from services.auth_service import SESSION_COOKIE_NAME, revoke_session
        old_session_id = request.cookies.get(SESSION_COOKIE_NAME)
        if old_session_id:
            revoke_session(old_session_id, db_conn)
            
        # 4. Create new session with rotated ID
        session_id = create_session(user["id"], request, response, db_conn, mfa_verified=False)
        
        # 4. Audit log success
        audit.record(
            action=AuditAction.LOGIN_SUCCESS,
            resource="auth:google-login",
            actor_id=user["id"],
            actor_email=user["email"],
            actor_role=user["role"],
            ip_address=client_ip,
            session_id=session_id
        )
        
        # Determine if MFA step-up is required
        mfa_required = user["role"] in ("CISO", "ENTERPRISE_ADMIN") or bool(user["mfa_enabled"])
        
        return {
            "status": "success",
            "user": {
                "id": user["id"],
                "email": user["email"],
                "name": user["name"],
                "role": user["role"],
                "mfa_required": mfa_required
            }
        }
    except Exception as e:
        audit.record(
            action=AuditAction.LOGIN_FAIL,
            resource="auth:google-login",
            outcome="DENIED",
            ip_address=client_ip,
            details={"error": str(e)}
        )
        raise HTTPException(status_code=401, detail=str(e))
    finally:
        db_conn.close()

@app.post("/api/auth/logout")
def logout_endpoint(request: Request, response: Response):
    from services.auth_service import revoke_session, SESSION_COOKIE_NAME
    from services.audit_log_service import get_audit_log, AuditAction
    
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if session_id:
        db_conn = get_db()
        try:
            # Get session details for audit logging before revocation
            cursor = db_conn.cursor()
            cursor.execute(
                "SELECT s.*, u.email, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.session_id = ?",
                (session_id,)
            )
            row = cursor.fetchone()
            if row:
                audit = get_audit_log()
                client_ip = request.client.host if request.client else "127.0.0.1"
                audit.record(
                    action=AuditAction.SIGN_OUT,
                    resource="auth:logout",
                    actor_id=row["user_id"],
                    actor_email=row["email"],
                    actor_role=row["role"],
                    ip_address=client_ip,
                    session_id=session_id
                )
            revoke_session(session_id, db_conn)
        finally:
            db_conn.close()
            
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return {"status": "success", "message": "Logged out successfully"}

@app.post("/api/auth/setup-mfa")
def setup_mfa_endpoint(request: Request, session = Depends(get_current_session)):
    from services.totp_service import generate_totp_secret, get_totp_uri, generate_qr_code_png_b64
    from services.encryption_service import get_encryption_service
    
    db_conn = get_db()
    try:
        secret = generate_totp_secret()
        
        # Encrypt the TOTP secret using Vault Transit (or mock Transit)
        enc_svc = get_encryption_service()
        ev = enc_svc.encrypt(
            secret,
            tenant_id="enterprise-1",
            vendor_id=session["user_id"],
            resource_type="user_mfa",
            field_name="totp_secret"
        )
        
        # Save to DB
        cursor = db_conn.cursor()
        cursor.execute(
            "UPDATE users SET totp_secret_enc = ?, totp_secret_aad = ? WHERE id = ?",
            (ev.ciphertext, ev.aad_str, session["user_id"])
        )
        db_conn.commit()
        
        # Generate URI & QR Code
        uri = get_totp_uri(secret, session["email"])
        qr_b64 = generate_qr_code_png_b64(uri)
        
        return {
            "status": "success",
            "provisioning_uri": uri,
            "qr_code_png_b64": qr_b64
        }
    finally:
        db_conn.close()

class MfaVerifyRequest(BaseModel):
    otp_code: str

@app.post("/api/auth/verify-mfa")
def verify_mfa_endpoint(payload: MfaVerifyRequest, request: Request, session = Depends(get_current_session)):
    from services.totp_service import verify_totp, MfaRateLimitException
    from services.encryption_service import get_encryption_service
    from services.audit_log_service import get_audit_log, AuditAction
    
    db_conn = get_db()
    audit = get_audit_log()
    client_ip = request.client.host if request.client else "127.0.0.1"
    
    # 1. Read encrypted secret from user profile
    totp_enc = session["totp_secret_enc"]
    totp_aad = session["totp_secret_aad"]
    
    if not totp_enc or not totp_aad:
        db_conn.close()
        raise HTTPException(status_code=400, detail="MFA setup has not been initiated.")
        
    try:
        # 2. Decrypt secret key
        enc_svc = get_encryption_service()
        secret = enc_svc.decrypt_raw(totp_enc, totp_aad)
        
        # 3. Verify TOTP (with rate limiting and replay protection)
        is_valid = verify_totp(
            secret=secret,
            otp_code=payload.otp_code,
            user_id=session["user_id"],
            ip_address=client_ip,
            db_conn=db_conn
        )
        
        if not is_valid:
            audit.record(
                action=AuditAction.MFA_FAIL,
                resource="auth:mfa-verify",
                outcome="DENIED",
                actor_id=session["user_id"],
                actor_email=session["email"],
                actor_role=session["role"],
                ip_address=client_ip,
                session_id=session["session_id"]
            )
            raise HTTPException(status_code=400, detail="Invalid OTP code or already used (replay protection)")
            
        # 4. Mark session and user as MFA enabled/verified
        cursor = db_conn.cursor()
        cursor.execute("UPDATE sessions SET mfa_verified = 1 WHERE session_id = ?", (session["session_id"],))
        cursor.execute("UPDATE users SET mfa_enabled = 1 WHERE id = ?", (session["user_id"],))
        db_conn.commit()
        
        audit.record(
            action=AuditAction.MFA_VERIFIED,
            resource="auth:mfa-verify",
            actor_id=session["user_id"],
            actor_email=session["email"],
            actor_role=session["role"],
            ip_address=client_ip,
            session_id=session["session_id"]
        )
        return {"status": "success", "message": "MFA verified and enabled successfully"}
    except MfaRateLimitException as e:
        raise HTTPException(status_code=429, detail=str(e))
    finally:
        db_conn.close()

# --- Vendor Risk Questionnaire APIs ---

from pydantic import BaseModel
from typing import List, Dict, Optional

class AnswerPayload(BaseModel):
    question_id: str
    category: str
    answer_value: str

class AnswersUpdate(BaseModel):
    answers: List[AnswerPayload]

@app.post("/api/assessments")
def create_assessment(payload: dict, request: Request, session = Depends(get_current_session)):
    vendor_id = payload.get("vendor_id")
    if not vendor_id:
        raise HTTPException(status_code=400, detail="vendor_id required")
    
    # Verify vendor belongs to user's company
    if not verify_vendor_ownership(vendor_id, session, get_db()):
        raise HTTPException(status_code=403, detail="Access denied: Vendor does not belong to your company")
        
    db_conn = get_db()
    cursor = db_conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute(
        "INSERT INTO assessments (vendor_id, status, created_at) VALUES (?, ?, ?)",
        (vendor_id, "DRAFT", now)
    )
    assessment_id = cursor.lastrowid
    db_conn.commit()
    db_conn.close()
    
    from services.audit_log_service import get_audit_log
    get_audit_log().record(
        action="ASSESSMENT_CREATED",
        resource=f"assessment:{assessment_id}",
        actor_id=session["user_id"],
        actor_email=session["email"],
        actor_role=session["role"],
        ip_address=request.client.host if request.client else "127.0.0.1",
        session_id=session["session_id"]
    )
    return {"status": "success", "assessment_id": assessment_id}

@app.get("/api/assessments/{assessment_id}")
def get_assessment(assessment_id: int, request: Request, session = Depends(get_current_session)):
    # Verify assessment belongs to user's company
    if not verify_assessment_ownership(assessment_id, session, get_db()):
        raise HTTPException(status_code=403, detail="Access denied: Assessment does not belong to your company")
    
    db_conn = get_db()
    cursor = db_conn.cursor()
    cursor.execute("SELECT * FROM assessments WHERE id = ?", (assessment_id,))
    assessment = cursor.fetchone()
    if not assessment:
        db_conn.close()
        raise HTTPException(status_code=404, detail="Assessment not found")
        
    cursor.execute("SELECT question_id, category, answer_value FROM assessment_answers WHERE assessment_id = ?", (assessment_id,))
    answers = cursor.fetchall()
    db_conn.close()
    
    from services.audit_log_service import get_audit_log
    get_audit_log().record(
        action="ASSESSMENT_VIEWED",
        resource=f"assessment:{assessment_id}",
        actor_id=session["user_id"],
        actor_email=session["email"],
        actor_role=session["role"],
        ip_address=request.client.host if request.client else "127.0.0.1",
        session_id=session["session_id"]
    )
    return {"assessment": dict(assessment), "answers": [dict(a) for a in answers]}

@app.put("/api/assessments/{assessment_id}/answers")
def save_assessment_answers(assessment_id: int, payload: AnswersUpdate, request: Request, session = Depends(get_current_session)):
    # Verify assessment belongs to user's company
    if not verify_assessment_ownership(assessment_id, session, get_db()):
        raise HTTPException(status_code=403, detail="Access denied: Assessment does not belong to your company")
    
    db_conn = get_db()
    cursor = db_conn.cursor()
    
    cursor.execute("SELECT status FROM assessments WHERE id = ?", (assessment_id,))
    row = cursor.fetchone()
    if not row:
        db_conn.close()
        raise HTTPException(status_code=404, detail="Assessment not found")
    if row["status"] != "DRAFT":
        db_conn.close()
        raise HTTPException(status_code=400, detail="Cannot edit a submitted assessment")
        
    # Overwrite answers
    cursor.execute("DELETE FROM assessment_answers WHERE assessment_id = ?", (assessment_id,))
    for ans in payload.answers:
        cursor.execute(
            "INSERT INTO assessment_answers (assessment_id, question_id, category, answer_value) VALUES (?, ?, ?, ?)",
            (assessment_id, ans.question_id, ans.category, ans.answer_value)
        )
    db_conn.commit()
    db_conn.close()
    
    from services.audit_log_service import get_audit_log
    get_audit_log().record(
        action="ASSESSMENT_DRAFT_SAVED",
        resource=f"assessment:{assessment_id}",
        actor_id=session["user_id"],
        actor_email=session["email"],
        actor_role=session["role"],
        ip_address=request.client.host if request.client else "127.0.0.1",
        session_id=session["session_id"]
    )
    return {"status": "success", "message": "Answers saved"}

@app.post("/api/assessments/{assessment_id}/submit")
def submit_assessment(assessment_id: int, request: Request, session = Depends(get_current_session)):
    # Verify assessment belongs to user's company
    if not verify_assessment_ownership(assessment_id, session, get_db()):
        raise HTTPException(status_code=403, detail="Access denied: Assessment does not belong to your company")
    
    db_conn = get_db()
    cursor = db_conn.cursor()
    cursor.execute("SELECT status FROM assessments WHERE id = ?", (assessment_id,))
    row = cursor.fetchone()
    if not row:
        db_conn.close()
        raise HTTPException(status_code=404, detail="Assessment not found")
    if row["status"] == "SUBMITTED":
        db_conn.close()
        raise HTTPException(status_code=400, detail="Already submitted")
        
    now = datetime.utcnow().isoformat()
    cursor.execute("UPDATE assessments SET status = 'SUBMITTED', submitted_at = ? WHERE id = ?", (now, assessment_id))
    db_conn.commit()
    db_conn.close()
    
    from services.audit_log_service import get_audit_log
    get_audit_log().record(
        action="ASSESSMENT_SUBMITTED",
        resource=f"assessment:{assessment_id}",
        actor_id=session["user_id"],
        actor_email=session["email"],
        actor_role=session["role"],
        ip_address=request.client.host if request.client else "127.0.0.1",
        session_id=session["session_id"]
    )
    
    return {"status": "success"}

# --- Vendor Risk Scoring Endpoints ---
from services.risk_scoring_service import calculate_assessment_score

@app.post("/api/assessments/{assessment_id}/calculate-score")
def calculate_score_endpoint(assessment_id: int, request: Request, session = Depends(get_current_user_with_mfa)):
    from services.audit_log_service import get_audit_log, AuditAction
    
    # Verify assessment belongs to user's company
    if not verify_assessment_ownership(assessment_id, session, get_db()):
        raise HTTPException(status_code=403, detail="Access denied: Assessment does not belong to your company")
    
    # Needs auth, enforce RBAC (vendor users can only access their own)
    # Auditors are read-only (so they can't calculate score)
    if session["role"] not in ("CISO", "ENTERPRISE_ADMIN", "ANALYST", "VENDOR_USER"):
        raise HTTPException(status_code=403, detail="Unauthorized role for score calculation.")
        
    db_conn = get_db()
    cursor = db_conn.cursor()
    cursor.execute("SELECT vendor_id, status FROM assessments WHERE id = ?", (assessment_id,))
    row = cursor.fetchone()
    db_conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Assessment not found")
        
    vendor_id = row["vendor_id"]
    
    if session["role"] == "VENDOR_USER" and session.get("vendor_id") != vendor_id:
        raise HTTPException(status_code=403, detail="Unauthorized: You can only calculate score for your own vendor")

    try:
        result = calculate_assessment_score(assessment_id, vendor_id)
        
        # Log audit event
        audit = get_audit_log()
        client_ip = request.client.host if request.client else "127.0.0.1"
        audit.record(
            action="RISK_SCORE_CALCULATED",
            resource=f"assessment:{assessment_id}",
            actor_id=session["user_id"],
            actor_email=session["email"],
            actor_role=session["role"],
            ip_address=client_ip,
            session_id=session["session_id"],
            details=json.dumps({"score": result["total_score"], "risk_level": result["risk_level"]})
        )
        
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/vendors/{vendor_id}/risk-score")
def get_vendor_risk_score(vendor_id: int, request: Request, session = Depends(get_current_session)):
    from services.audit_log_service import get_audit_log, AuditAction
    
    # Verify vendor belongs to user's company
    if not verify_vendor_ownership(vendor_id, session, get_db()):
        raise HTTPException(status_code=403, detail="Access denied: Vendor does not belong to your company")
    
    if session["role"] == "VENDOR_USER" and session.get("vendor_id") != vendor_id:
        raise HTTPException(status_code=403, detail="Unauthorized: You can only access your own vendor's risk score")
        
    db_conn = get_db()
    cursor = db_conn.cursor()
    cursor.execute("""
        SELECT * FROM risk_assessment_scores 
        WHERE vendor_id = ? 
        ORDER BY calculated_at DESC LIMIT 1
    """, (vendor_id,))
    row = cursor.fetchone()
    db_conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="No completed risk assessment score found for this vendor")
        
    result = dict(row)
    
    # Log audit event
    audit = get_audit_log()
    client_ip = request.client.host if request.client else "127.0.0.1"
    audit.record(
        action="RISK_SCORE_VIEWED",
        resource=f"vendor:{vendor_id}:score",
        actor_id=session["user_id"],
        actor_email=session["email"],
        actor_role=session["role"],
        ip_address=client_ip,
        session_id=session["session_id"]
    )
    
    return {
        "total_score": result["total_score"],
        "risk_level": result["risk_level"],
        "categories": {
            "cybersecurity": result["cybersecurity_score"],
            "compliance": result["compliance_score"],
            "financial_stability": result["financial_stability_score"],
            "operational_risk": result["operational_risk_score"],
            "data_privacy": result["data_privacy_score"]
        },
        "scoring_version": result["scoring_version"],
        "calculated_at": result["calculated_at"]
    }

@app.get("/api/vendors/{vendor_id}/risk-history")
def get_vendor_risk_history(vendor_id: int, request: Request, session = Depends(get_current_session)):
    # Verify vendor belongs to user's company
    if not verify_vendor_ownership(vendor_id, session, get_db()):
        raise HTTPException(status_code=403, detail="Access denied: Vendor does not belong to your company")
    
    if session["role"] == "VENDOR_USER" and session.get("vendor_id") != vendor_id:
        raise HTTPException(status_code=403, detail="Unauthorized: You can only access your own vendor's risk score history")
        
    db_conn = get_db()
    cursor = db_conn.cursor()
    cursor.execute("""
        SELECT * FROM risk_assessment_scores 
        WHERE vendor_id = ? 
        ORDER BY calculated_at ASC
    """, (vendor_id,))
    rows = cursor.fetchall()
    db_conn.close()
    
    return {"history": [dict(r) for r in rows]}

# ═══════════════════════════════════════════════════════════════════════════════
# CYBERSECURITY 360° ASSESSMENT ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/api/vendors/{vendor_id}/cybersecurity-assessments")
def create_cybersecurity_assessment_endpoint(vendor_id: int, request: Request, session = Depends(get_current_session)):
    user_company_id = session.get("company_id")
    if not user_company_id:
        raise HTTPException(status_code=403, detail="User has no company association")
        
    if not verify_vendor_ownership(vendor_id, session, get_db()):
        audit = get_audit_log()
        client_ip = request.client.host if request.client else "127.0.0.1"
        audit.record(
            action=AuditAction.CYBERSECURITY_ACCESS_DENIED,
            resource=f"vendor:{vendor_id}:cybersecurity",
            actor_id=session["user_id"],
            actor_email=session["email"],
            actor_role=session["role"],
            ip_address=client_ip,
            session_id=session["session_id"],
            outcome="DENIED",
            details={"reason": "Cross-company or invalid vendor"}
        )
        raise HTTPException(status_code=403, detail="Access denied: Vendor does not belong to your company")
        
    assessment = create_cybersecurity_assessment(vendor_id, user_company_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Vendor not found")
        
    audit = get_audit_log()
    client_ip = request.client.host if request.client else "127.0.0.1"
    audit.record(
        action=AuditAction.CYBERSECURITY_ASSESSMENT_CREATED,
        resource=f"cybersecurity_assessment:{assessment['id']}",
        actor_id=session["user_id"],
        actor_email=session["email"],
        actor_role=session["role"],
        ip_address=client_ip,
        session_id=session["session_id"]
    )
    
    assessment["questions_catalog"] = get_questions_catalog()
    assessment["domains"] = CYBERSECURITY_DOMAINS
    return assessment


@app.get("/api/vendors/{vendor_id}/cybersecurity-assessments")
def get_vendor_cybersecurity_assessments_endpoint(vendor_id: int, request: Request, session = Depends(get_current_session)):
    user_company_id = session.get("company_id")
    if not user_company_id:
        raise HTTPException(status_code=403, detail="User has no company association")
        
    if not verify_vendor_ownership(vendor_id, session, get_db()):
        raise HTTPException(status_code=403, detail="Access denied: Vendor does not belong to your company")
        
    assessments = get_vendor_cybersecurity_assessments(vendor_id, user_company_id)
    return {"assessments": assessments}


@app.get("/api/cybersecurity-assessments/{assessment_id}")
def get_cybersecurity_assessment_endpoint(assessment_id: int, request: Request, session = Depends(get_current_session)):
    user_company_id = session.get("company_id")
    if not user_company_id:
        raise HTTPException(status_code=403, detail="User has no company association")
        
    assessment = get_cybersecurity_assessment_by_id(assessment_id, user_company_id)
    if not assessment:
        audit = get_audit_log()
        client_ip = request.client.host if request.client else "127.0.0.1"
        audit.record(
            action=AuditAction.CYBERSECURITY_ACCESS_DENIED,
            resource=f"cybersecurity_assessment:{assessment_id}",
            actor_id=session["user_id"],
            actor_email=session["email"],
            actor_role=session["role"],
            ip_address=client_ip,
            session_id=session["session_id"],
            outcome="DENIED"
        )
        raise HTTPException(status_code=404, detail="Cybersecurity assessment not found")
        
    audit = get_audit_log()
    client_ip = request.client.host if request.client else "127.0.0.1"
    audit.record(
        action=AuditAction.CYBERSECURITY_ASSESSMENT_VIEWED,
        resource=f"cybersecurity_assessment:{assessment_id}",
        actor_id=session["user_id"],
        actor_email=session["email"],
        actor_role=session["role"],
        ip_address=client_ip,
        session_id=session["session_id"]
    )
    
    assessment["questions_catalog"] = get_questions_catalog()
    assessment["domains"] = CYBERSECURITY_DOMAINS
    return assessment


@app.put("/api/cybersecurity-assessments/{assessment_id}/answers")
def save_cybersecurity_answers_endpoint(assessment_id: int, payload: CybersecurityAnswersSave, request: Request, session = Depends(get_current_session)):
    user_company_id = session.get("company_id")
    if not user_company_id:
        raise HTTPException(status_code=403, detail="User has no company association")
        
    answers_list = [a.dict() for a in payload.answers]
    updated_assessment = save_cybersecurity_answers(assessment_id, user_company_id, answers_list)
    if not updated_assessment:
        raise HTTPException(status_code=404, detail="Cybersecurity assessment not found or access denied")
        
    audit = get_audit_log()
    client_ip = request.client.host if request.client else "127.0.0.1"
    audit.record(
        action=AuditAction.CYBERSECURITY_DRAFT_SAVED,
        resource=f"cybersecurity_assessment:{assessment_id}",
        actor_id=session["user_id"],
        actor_email=session["email"],
        actor_role=session["role"],
        ip_address=client_ip,
        session_id=session["session_id"]
    )
    
    for a in payload.answers:
        if a.evidence_document_id:
            audit.record(
                action=AuditAction.CYBERSECURITY_EVIDENCE_LINKED,
                resource=f"cybersecurity_assessment:{assessment_id}:question:{a.question_id}",
                actor_id=session["user_id"],
                actor_email=session["email"],
                actor_role=session["role"],
                ip_address=client_ip,
                session_id=session["session_id"],
                details={"document_id": a.evidence_document_id}
            )
            
    updated_assessment["questions_catalog"] = get_questions_catalog()
    updated_assessment["domains"] = CYBERSECURITY_DOMAINS
    return updated_assessment


@app.post("/api/cybersecurity-assessments/{assessment_id}/submit")
def submit_cybersecurity_assessment_endpoint(assessment_id: int, request: Request, session = Depends(get_current_session)):
    user_company_id = session.get("company_id")
    if not user_company_id:
        raise HTTPException(status_code=403, detail="User has no company association")
        
    assessment = get_cybersecurity_assessment_by_id(assessment_id, user_company_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Cybersecurity assessment not found")
        
    score_data = calculate_cybersecurity_score(assessment.get("answers", []))
    submitted_assessment = submit_cybersecurity_assessment(assessment_id, user_company_id, score_data)
    
    audit = get_audit_log()
    client_ip = request.client.host if request.client else "127.0.0.1"
    audit.record(
        action=AuditAction.CYBERSECURITY_SUBMITTED,
        resource=f"cybersecurity_assessment:{assessment_id}",
        actor_id=session["user_id"],
        actor_email=session["email"],
        actor_role=session["role"],
        ip_address=client_ip,
        session_id=session["session_id"],
        details={"cybersecurity_score": score_data["cybersecurity_score"], "risk_level": score_data["risk_level"]}
    )
    audit.record(
        action=AuditAction.CYBERSECURITY_SCORE_CALCULATED,
        resource=f"cybersecurity_assessment:{assessment_id}:score",
        actor_id=session["user_id"],
        actor_email=session["email"],
        actor_role=session["role"],
        ip_address=client_ip,
        session_id=session["session_id"],
        details={"score": score_data["cybersecurity_score"], "version": score_data["scoring_version"]}
    )
    
    submitted_assessment["questions_catalog"] = get_questions_catalog()
    submitted_assessment["domains"] = CYBERSECURITY_DOMAINS
    return submitted_assessment


@app.get("/api/vendors/{vendor_id}/cybersecurity-score")
def get_vendor_cybersecurity_score_endpoint(vendor_id: int, request: Request, session = Depends(get_current_session)):
    user_company_id = session.get("company_id")
    if not user_company_id:
        raise HTTPException(status_code=403, detail="User has no company association")
        
    if not verify_vendor_ownership(vendor_id, session, get_db()):
        raise HTTPException(status_code=403, detail="Access denied: Vendor does not belong to your company")
        
    score_rec = get_vendor_latest_cybersecurity_score(vendor_id, user_company_id)
    if not score_rec:
        raise HTTPException(status_code=404, detail="No Cybersecurity 360° assessment yet.")
        
    return score_rec


@app.get("/api/vendors/{vendor_id}/cybersecurity-history")
def get_vendor_cybersecurity_history_endpoint(vendor_id: int, request: Request, session = Depends(get_current_session)):
    user_company_id = session.get("company_id")
    if not user_company_id:
        raise HTTPException(status_code=403, detail="User has no company association")
        
    if not verify_vendor_ownership(vendor_id, session, get_db()):
        raise HTTPException(status_code=403, detail="Access denied: Vendor does not belong to your company")
        
    history = get_vendor_cybersecurity_history(vendor_id, user_company_id)
    return {"history": history}


@app.put("/api/cybersecurity-assessments/{assessment_id}/evidence/{question_id}/review")
def review_cybersecurity_evidence_endpoint(assessment_id: int, question_id: str, payload: EvidenceReviewRequest, request: Request, session = Depends(get_current_session)):
    user_company_id = session.get("company_id")
    if not user_company_id:
        raise HTTPException(status_code=403, detail="User has no company association")
        
    if session["role"] not in ("CISO", "ENTERPRISE_ADMIN", "AUDITOR"):
        raise HTTPException(status_code=403, detail="Unauthorized: Evidence review requires CISO, ENTERPRISE_ADMIN, or AUDITOR role")
        
    status_upper = payload.status.upper()
    if status_upper not in ("REVIEWED", "REJECTED"):
        raise HTTPException(status_code=400, detail="Invalid evidence status. Must be REVIEWED or REJECTED.")
        
    success = review_cybersecurity_evidence(assessment_id, question_id, user_company_id, status_upper, payload.notes)
    if not success:
        raise HTTPException(status_code=404, detail="Cybersecurity assessment or question answer not found")
        
    audit = get_audit_log()
    client_ip = request.client.host if request.client else "127.0.0.1"
    audit_action = AuditAction.CYBERSECURITY_EVIDENCE_REVIEWED if status_upper == "REVIEWED" else AuditAction.CYBERSECURITY_EVIDENCE_REJECTED
    audit.record(
        action=audit_action,
        resource=f"cybersecurity_assessment:{assessment_id}:question:{question_id}",
        actor_id=session["user_id"],
        actor_email=session["email"],
        actor_role=session["role"],
        ip_address=client_ip,
        session_id=session["session_id"],
        details={"status": status_upper, "notes": payload.notes}
    )
    
    return {"status": "success", "evidence_status": status_upper}

# --- End Vendor Risk Scoring Endpoints ---

if __name__ == "__main__":
    import uvicorn
    # Enforce workers=1 (Priority 3: SQLite multi-process safety)
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, workers=1)


