import os
from fastapi import FastAPI, HTTPException, Query, Request, Response, Depends, UploadFile, File, Form
from fastapi.responses import StreamingResponse
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
    get_vendor_operational_risk, upsert_vendor_operational_risk, get_operational_risk_summary,
    COMPLIANCE_FRAMEWORKS,
    add_document, get_vendor_documents, get_document_by_id,
    create_alert, get_alerts, get_alert_by_id, mark_alert_read, mark_alert_acknowledged, get_unread_alert_count
)
from seed_data import seed_database
from services.risk_engine import compute_vendor_risk_score
from services.mlRiskService import calculate_shap_vendor_risk
from services.domainVerificationService import verify_vendor_existence


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
    sector: Optional[str] = Field(default="Technology", example="Cloud Observability")
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
            v.criticality_tier, v.data_sensitivity, v.contract_value,
            v.custom_ticker, v.compliance_certs,
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
    old_score = v.get("risk_score", 0) or 0
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

    # --- Alert engine hooks ---
    new_score = score_data["overall_score"]
    company_id = session.get("company_id")
    if company_id:
        from services.alert_engine import evaluate_high_risk_vendor, evaluate_major_risk_change
        try:
            evaluate_high_risk_vendor(vendor_id, company_id, new_score, v["name"])
        except Exception as ae:
            import logging; logging.getLogger(__name__).warning("Alert hook HIGH_RISK_VENDOR failed: %s", ae)
        try:
            evaluate_major_risk_change(vendor_id, company_id, old_score, new_score, v["name"])
        except Exception as ae:
            import logging; logging.getLogger(__name__).warning("Alert hook MAJOR_RISK_CHANGE failed: %s", ae)

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

@app.get("/api/vendors/{vendor_id}/risk-events")
def get_vendor_risk_events(vendor_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, vendor_id, vendor_name, source, title, summary, risk_level, url, timestamp
        FROM risk_events
        WHERE vendor_id = ?
        ORDER BY timestamp DESC
    """, (vendor_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/stats")
def get_dashboard_stats():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as total FROM vendors")
    total_vendors = cursor.fetchone()["total"]
    cursor.execute("SELECT COUNT(*) as critical FROM vendors WHERE risk_tier = 'CRITICAL'")
    critical_count = cursor.fetchone()["critical"]
    cursor.execute("SELECT COUNT(*) as high FROM vendors WHERE risk_tier = 'HIGH'")
    high_count = cursor.fetchone()["high"]
    cursor.execute("SELECT COUNT(*) as medium FROM vendors WHERE risk_tier = 'MEDIUM'")
    medium_count = cursor.fetchone()["medium"]
    cursor.execute("SELECT COUNT(*) as low FROM vendors WHERE risk_tier = 'LOW'")
    low_count = cursor.fetchone()["low"]
    cursor.execute("SELECT AVG(risk_score) as avg_score FROM vendors")
    avg_score = cursor.fetchone()["avg_score"] or 0
    conn.close()
    return {
        "total_vendors": total_vendors,
        "critical_vendors": critical_count,
        "high_risk_vendors": high_count,
        "medium_risk_vendors": medium_count,
        "low_risk_vendors": low_count,
        "average_risk_score": round(avg_score, 1)
    }

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

# Operational Risk Module API Endpoints
class OperationalRiskUpdate(BaseModel):
    sla_compliance_pct: Optional[float] = Field(default=99.5, example=99.8)
    monthly_downtime_hours: Optional[float] = Field(default=1.0, example=0.5)
    incident_frequency: Optional[int] = Field(default=1, example=2)
    delivery_delays_count: Optional[int] = Field(default=0, example=1)
    quality_defect_rate_pct: Optional[float] = Field(default=0.2, example=0.1)
    support_response_time_hrs: Optional[float] = Field(default=1.5, example=1.2)
    bcp_status: Optional[str] = Field(default="VERIFIED", example="VERIFIED")
    bcp_audit_score: Optional[int] = Field(default=85, example=92)
    dr_rto_hours: Optional[float] = Field(default=4.0, example=2.0)
    dr_rpo_hours: Optional[float] = Field(default=1.0, example=0.5)
    dr_testing_status: Optional[str] = Field(default="PASSED_Q2", example="PASSED_Q2")
    dependency_level: Optional[str] = Field(default="MODERATE", example="HIGH_SINGLE_POINT")
    replaceability_score: Optional[int] = Field(default=70, example=45)

@app.get("/api/operational-risk/summary")
def get_operational_risk_summary_endpoint():
    """Get aggregate Operational Risk KPIs across all vendors."""
    return get_operational_risk_summary()

@app.get("/api/vendors/{vendor_id}/operational-risk")
def get_vendor_operational_risk_endpoint(vendor_id: int):
    """Fetch operational risk metrics for a specific vendor."""
    op_risk = get_vendor_operational_risk(vendor_id)
    return op_risk

@app.post("/api/vendors/{vendor_id}/operational-risk")
def update_vendor_operational_risk_endpoint(vendor_id: int, payload: OperationalRiskUpdate):
    """Update or create operational risk scorecard for a vendor."""
    updated = upsert_vendor_operational_risk(vendor_id, payload.dict(exclude_unset=True))
    return {
        "message": f"Operational Risk profile updated for vendor #{vendor_id}",
        "operational_risk": updated
    }

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

# --- End Vendor Risk Scoring Endpoints ---

# ---------------------------------------------------------------------------
# Document Management (MVP)
# ---------------------------------------------------------------------------
import uuid
from pathlib import Path
from services.file_encryption_service import encrypt_file_streaming, decrypt_file_streaming

DOCUMENTS_DIR = os.path.join(os.path.dirname(__file__), "storage", "documents")
os.makedirs(DOCUMENTS_DIR, exist_ok=True)

ALLOWED_DOCUMENT_TYPES = {"SOC 2", "ISO 27001", "Contract", "Insurance", "Security Evidence"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

@app.post("/api/vendors/{vendor_id}/documents")
async def upload_document(
    vendor_id: int,
    request: Request,
    file: UploadFile = File(...),
    document_type: str = Form(...),
    expiry_date: Optional[str] = Form(None),
    session = Depends(get_current_session)
):
    from services.audit_log_service import get_audit_log
    
    if session["role"] not in ["SUPER_ADMIN", "ADMIN", "EDITOR", "VENDOR_USER"]:
        raise HTTPException(status_code=403, detail="Unauthorized to upload documents")
        
    if not verify_vendor_ownership(vendor_id, session, get_db()):
        raise HTTPException(status_code=403, detail="Vendor does not belong to your company")
        
    if document_type not in ALLOWED_DOCUMENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid document type. Allowed: {ALLOWED_DOCUMENT_TYPES}")
        
    # Read first chunk to check size implicitly and then get size
    file.file.seek(0, 2)
    size_bytes = file.file.tell()
    file.file.seek(0)
    
    if size_bytes > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 50 MB)")
    if size_bytes == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    object_id = str(uuid.uuid4())
    storage_path = Path(DOCUMENTS_DIR) / f"{object_id}.enc"
    
    try:
        # Stream encrypt to disk
        manifest = encrypt_file_streaming(
            source=file.file,
            dest_path=storage_path,
            vendor_id=vendor_id,
            doc_type=document_type,
            tenant_id=str(session["company_id"])
        )
            
        doc_id = add_document(
            company_id=session["company_id"],
            vendor_id=vendor_id,
            uploader_id=session["user_id"],
            document_type=document_type,
            original_filename=file.filename,
            object_id=object_id,
            size_bytes=size_bytes,
            expiry_date=expiry_date,
            wrapped_dek=manifest["wrapped_dek"],
            integrity_hash=manifest["ct_sha256"]
        )
        
        # Log Audit
        audit = get_audit_log()
        client_ip = request.client.host if request.client else "127.0.0.1"
        audit.record(
            action="DOCUMENT_UPLOADED",
            resource=f"document:{doc_id}",
            actor_id=session["user_id"],
            actor_email=session["email"],
            actor_role=session["role"],
            ip_address=client_ip,
            session_id=session["session_id"],
            details=f"{document_type} - {file.filename}"
        )
        
        return {"status": "success", "document_id": doc_id, "object_id": object_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Encryption failed: {str(e)}")

@app.get("/api/vendors/{vendor_id}/documents")
def list_vendor_documents(vendor_id: int, session = Depends(get_current_session)):
    if not verify_vendor_ownership(vendor_id, session, get_db()):
        raise HTTPException(status_code=403, detail="Vendor does not belong to your company")
        
    docs = get_vendor_documents(vendor_id, session["company_id"])
    return {"documents": docs}

@app.get("/api/documents/{document_id}/download")
def download_document(document_id: int, request: Request, session = Depends(get_current_session)):
    doc = get_document_by_id(document_id, session["company_id"])
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found or access denied")
        
    storage_path = Path(DOCUMENTS_DIR) / f"{doc['object_id']}.enc"
    if not storage_path.exists():
        raise HTTPException(status_code=404, detail="Encrypted document missing from storage")
        
    from services.audit_log_service import get_audit_log
    audit = get_audit_log()
    client_ip = request.client.host if request.client else "127.0.0.1"
    audit.record(
        action="DOCUMENT_DECRYPTED",
        resource=f"document:{document_id}",
        actor_id=session["user_id"],
        actor_email=session["email"],
        actor_role=session["role"],
        ip_address=client_ip,
        session_id=session["session_id"],
        details=f"Downloaded {doc['original_filename']}"
    )

    def file_streamer():
        yield from decrypt_file_streaming(
            source_path=storage_path,
            wrapped_dek=doc["wrapped_dek"],
            vendor_id=doc["vendor_id"],
            doc_type=doc["document_type"],
            expected_ct_sha256=doc["integrity_hash"]
        )

    return StreamingResponse(
        file_streamer(), 
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{doc["original_filename"]}"'}
    )

# ---------------------------------------------------------------------------
# Alert Management Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/alerts/count")
def get_alert_count(session = Depends(get_current_session)):
    """Return unread alert count for header badge (lightweight poll endpoint)."""
    company_id = session.get("company_id")
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company association")
    count = get_unread_alert_count(company_id)
    return {"unread": count}

@app.get("/api/alerts")
def list_alerts(
    request: Request,
    alert_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    vendor_id: Optional[int] = Query(None),
    session = Depends(get_current_session)
):
    """List all alerts for authenticated company. Lazily runs scheduled checks."""
    from services.audit_log_service import get_audit_log
    company_id = session.get("company_id")
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company association")

    # Lazy scheduled checks — idempotent via dedup keys
    try:
        from services.alert_engine import run_all_scheduled_checks
        run_all_scheduled_checks(company_id)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Scheduled alert checks failed: %s", e)

    alerts = get_alerts(company_id, vendor_id=vendor_id, alert_type=alert_type, status=status)

    # Audit ALERT_VIEWED
    audit = get_audit_log()
    client_ip = request.client.host if request.client else "127.0.0.1"
    audit.record(
        action="ALERT_VIEWED",
        resource="alerts:list",
        actor_id=session["user_id"],
        actor_email=session["email"],
        actor_role=session["role"],
        ip_address=client_ip,
        session_id=session["session_id"],
        details=f"Listed {len(alerts)} alerts"
    )

    return {"alerts": alerts, "total": len(alerts)}


@app.get("/api/alerts/{alert_id}")
def get_alert_detail(alert_id: int, request: Request, session = Depends(get_current_session)):
    """Get single alert — enforces company isolation."""
    from services.audit_log_service import get_audit_log
    company_id = session.get("company_id")
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company association")

    alert = get_alert_by_id(alert_id, company_id)
    if not alert:
        # Log ALERT_ACCESS_DENIED — the alert may exist but belong to another company
        audit = get_audit_log()
        client_ip = request.client.host if request.client else "127.0.0.1"
        audit.record(
            action="ALERT_ACCESS_DENIED",
            resource=f"alert:{alert_id}",
            outcome="DENIED",
            actor_id=session["user_id"],
            actor_email=session["email"],
            actor_role=session["role"],
            ip_address=client_ip,
            session_id=session["session_id"],
            details=f"Alert {alert_id} not found or cross-company access attempt"
        )
        raise HTTPException(status_code=404, detail="Alert not found or access denied")

    return {"alert": alert}


@app.post("/api/alerts/{alert_id}/read")
def read_alert(alert_id: int, request: Request, session = Depends(get_current_session)):
    """Mark alert as READ. Lifecycle: UNREAD → READ."""
    from services.audit_log_service import get_audit_log
    company_id = session.get("company_id")
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company association")

    # Verify alert exists and belongs to this company
    alert = get_alert_by_id(alert_id, company_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found or access denied")

    updated = mark_alert_read(alert_id, company_id)
    if not updated:
        raise HTTPException(status_code=409, detail="Alert is not in UNREAD state or already processed")

    audit = get_audit_log()
    client_ip = request.client.host if request.client else "127.0.0.1"
    audit.record(
        action="ALERT_READ",
        resource=f"alert:{alert_id}",
        actor_id=session["user_id"],
        actor_email=session["email"],
        actor_role=session["role"],
        ip_address=client_ip,
        session_id=session["session_id"]
    )

    return {"status": "READ", "alert_id": alert_id}


@app.post("/api/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int, request: Request, session = Depends(get_current_session)):
    """Mark alert as ACKNOWLEDGED. Lifecycle: UNREAD/READ → ACKNOWLEDGED."""
    from services.audit_log_service import get_audit_log
    company_id = session.get("company_id")
    if not company_id:
        raise HTTPException(status_code=403, detail="User has no company association")

    # Verify alert exists and belongs to this company
    alert = get_alert_by_id(alert_id, company_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found or access denied")

    updated = mark_alert_acknowledged(alert_id, company_id)
    if not updated:
        raise HTTPException(status_code=409, detail="Alert is already acknowledged")

    audit = get_audit_log()
    client_ip = request.client.host if request.client else "127.0.0.1"
    audit.record(
        action="ALERT_ACKNOWLEDGED",
        resource=f"alert:{alert_id}",
        actor_id=session["user_id"],
        actor_email=session["email"],
        actor_role=session["role"],
        ip_address=client_ip,
        session_id=session["session_id"]
    )

    return {"status": "ACKNOWLEDGED", "alert_id": alert_id}

# --- End Alert Management Endpoints ---

if __name__ == "__main__":
    import uvicorn
    # Enforce workers=1 (Priority 3: SQLite multi-process safety)
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True, workers=1)
