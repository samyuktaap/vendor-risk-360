import os
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

from database import init_db, get_db, get_quota_stats
from seed_data import seed_database
from services.risk_engine import compute_vendor_risk_score

app = FastAPI(title="VendorRisk 360 API", version="1.0.0")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
    last_checked_at: Optional[str] = None
    created_at: str

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
def get_vendors():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, domain, sector, risk_tier, risk_score, hibp_score, news_score, sanctions_score, last_checked_at, created_at
        FROM vendors
        ORDER BY risk_score DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/vendors", status_code=201)
def add_vendor(vendor: VendorCreate):
    conn = get_db()
    cursor = conn.cursor()

    # Check for existing domain
    cursor.execute("SELECT id FROM vendors WHERE domain = ?", (vendor.domain.lower(),))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail=f"Vendor with domain '{vendor.domain}' already exists.")

    # Compute 100% live risk score across all 7 vectors
    try:
        score_data = compute_vendor_risk_score(vendor.domain, vendor.name)
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Live risk scoring failed: {str(e)}")

    breakdown = score_data.get("breakdown", {})
    now = datetime.utcnow().isoformat()

    # Safely extract sub-scores — each service returns its own key name
    hibp_score   = breakdown.get("hibp", {}).get("hibp_score", 0)
    news_score   = breakdown.get("news", {}).get("news_score", 0)
    abuse_score  = breakdown.get("abuseipdb", {}).get("score", 0)

    cursor.execute("""
        INSERT INTO vendors (name, domain, sector, risk_tier, risk_score, hibp_score, news_score, sanctions_score, last_checked_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        vendor.name,
        vendor.domain.lower(),
        vendor.sector,
        score_data["risk_tier"],
        score_data["overall_score"],
        hibp_score,
        news_score,
        abuse_score,
        now,
        now
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
        f"https://{vendor.domain}",
        now
    ))

    conn.commit()
    conn.close()

    return {
        "id": vendor_id,
        "name": vendor.name,
        "domain": vendor.domain,
        "sector": vendor.sector,
        "risk_tier": score_data["risk_tier"],
        "risk_score": score_data["overall_score"],
        "breakdown_summary": {
            "news": news_score,
            "hibp": hibp_score,
            "abuse_ip": abuse_score
        },
        "message": f"✅ {vendor.name} onboarded. Live risk score: {score_data['overall_score']}/100 ({score_data['risk_tier']})"
    }

@app.get("/api/vendors/{vendor_id}")
def get_vendor_detail(vendor_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM vendors WHERE id = ?", (vendor_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Vendor not found.")

    v = dict(row)
    # Compute full live/cached breakdown
    score_data = compute_vendor_risk_score(v["domain"], v["name"])

    return {
        "vendor": v,
        "risk_assessment": score_data
    }

@app.post("/api/vendors/{vendor_id}/refresh")
def refresh_vendor_risk(vendor_id: int):
    """Manual trigger to re-check API risk scores for a single vendor."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM vendors WHERE id = ?", (vendor_id,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Vendor not found.")

    v = dict(row)
    score_data = compute_vendor_risk_score(v["domain"], v["name"])
    breakdown = score_data["breakdown"]
    now = datetime.utcnow().isoformat()

    cursor.execute("""
        UPDATE vendors
        SET risk_tier = ?,
            risk_score = ?,
            hibp_score = ?,
            news_score = ?,
            sanctions_score = ?,
            last_checked_at = ?
        WHERE id = ?
    """, (
        score_data["risk_tier"],
        score_data["overall_score"],
        breakdown["hibp"]["score"],
        breakdown["news"]["score"],
        breakdown["sanctions"]["score"],
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
def delete_vendor(vendor_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM vendors WHERE id = ?", (vendor_id,))
    conn.commit()
    conn.close()
    return {"message": "Vendor deleted successfully."}

# --- INCIDENT MANAGEMENT (Inspired by reference repo) ---

SEVERITY_POINTS = {"LOW": 5, "MEDIUM": 15, "HIGH": 30, "CRITICAL": 50}

class IncidentCreate(BaseModel):
    title: str = Field(..., example="Ransomware Attack Detected")
    description: Optional[str] = Field(None, example="Vendor reported unauthorized access to internal systems")
    severity: str = Field("MEDIUM", example="HIGH")

@app.post("/api/vendors/{vendor_id}/incidents", status_code=201)
def log_incident(vendor_id: int, incident: IncidentCreate):
    """Log a new security incident against a vendor. Automatically raises the vendor risk score."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM vendors WHERE id = ?", (vendor_id,))
    vendor = cursor.fetchone()
    if not vendor:
        conn.close()
        raise HTTPException(status_code=404, detail="Vendor not found.")

    severity = incident.severity.upper()
    points = SEVERITY_POINTS.get(severity, 15)
    now = datetime.utcnow().isoformat()

    # Insert incident record
    cursor.execute("""
        INSERT INTO incidents (vendor_id, title, description, severity, status, score_impact, reported_at)
        VALUES (?, ?, ?, ?, 'OPEN', ?, ?)
    """, (vendor_id, incident.title, incident.description, severity, points, now))
    incident_id = cursor.lastrowid

    # Raise vendor risk score (cap at 100)
    new_score = min(100, vendor["risk_score"] + points)
    cursor.execute("UPDATE vendors SET risk_score = ?, last_checked_at = ? WHERE id = ?", (new_score, now, vendor_id))

    # Log to activity feed
    cursor.execute("""
        INSERT INTO risk_events (vendor_id, vendor_name, source, title, summary, risk_level, url, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        vendor_id, vendor["name"], "Manual Incident Log",
        f"[{severity}] Incident Logged: {incident.title}",
        incident.description or f"Security incident reported for {vendor['name']}. Risk score increased by {points} points.",
        "HIGH" if severity in ("HIGH", "CRITICAL") else "MEDIUM",
        f"https://{vendor['domain']}", now
    ))

    conn.commit()
    conn.close()

    return {
        "incident_id": incident_id,
        "vendor": vendor["name"],
        "severity": severity,
        "score_impact": f"+{points} pts",
        "new_risk_score": new_score,
        "message": f"Incident logged. Vendor risk score raised by {points} points to {new_score}/100."
    }

@app.post("/api/incidents/{incident_id}/resolve")
def resolve_incident(incident_id: int):
    """Mark an incident resolved. Vendor risk score is reduced by half the original impact points."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,))
    inc = cursor.fetchone()
    if not inc:
        conn.close()
        raise HTTPException(status_code=404, detail="Incident not found.")

    if inc["status"] == "RESOLVED":
        conn.close()
        raise HTTPException(status_code=400, detail="Incident is already resolved.")

    now = datetime.utcnow().isoformat()
    refund = inc["score_impact"] // 2  # Refund half the score impact on resolution

    cursor.execute("UPDATE incidents SET status = 'RESOLVED', resolved_at = ? WHERE id = ?", (now, incident_id))

    cursor.execute("SELECT * FROM vendors WHERE id = ?", (inc["vendor_id"],))
    vendor = cursor.fetchone()
    new_score = max(0, vendor["risk_score"] - refund)
    cursor.execute("UPDATE vendors SET risk_score = ?, last_checked_at = ? WHERE id = ?", (new_score, now, inc["vendor_id"]))

    # Log resolution to activity feed
    cursor.execute("""
        INSERT INTO risk_events (vendor_id, vendor_name, source, title, summary, risk_level, url, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        vendor["id"], vendor["name"], "Incident Resolved",
        f"Incident Resolved: {inc['title']}",
        f"Incident marked resolved. Risk score reduced by {refund} points to {new_score}/100.",
        "LOW", f"https://{vendor['domain']}", now
    ))

    conn.commit()
    conn.close()

    return {
        "incident_id": incident_id,
        "status": "RESOLVED",
        "score_refund": f"-{refund} pts",
        "new_risk_score": new_score,
        "message": f"Incident resolved. Risk score reduced by {refund} points to {new_score}/100."
    }

@app.get("/api/vendors/{vendor_id}/incidents")
def get_vendor_incidents(vendor_id: int):
    """Get all security incidents logged against a vendor."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM incidents WHERE vendor_id = ? ORDER BY reported_at DESC
    """, (vendor_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/contagion")
def get_risk_contagion_map():
    """Returns network nodes and edges for the Risk Contagion View."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, domain, sector, risk_tier, risk_score FROM vendors")
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
def get_activity_feed(limit: int = Query(20, ge=1, le=100)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, vendor_id, vendor_name, source, title, summary, risk_level, url, timestamp
        FROM risk_events
        ORDER BY timestamp DESC
        LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/quota")
def get_quota_debug_info():
    """Dev debug panel data for API call budgets and circuit breakers."""
    stats = get_quota_stats()
    return {
        "demo_mode": os.getenv("DEMO_MODE", "true").lower() == "true",
        "quotas": stats,
        "cooldown_window": "60 minutes"
    }

@app.post("/api/quota/reset")
def reset_quota_counters():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM api_quota")
    cursor.execute("DELETE FROM cached_responses")
    conn.commit()
    conn.close()
    return {"message": "Reset API quota counters and cleared response cache."}
