import sqlite3
import os
import json
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), "vendor_risk.db")

def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=10.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode=WAL")
    except Exception:
        pass
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Vendors Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS vendors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            domain TEXT UNIQUE NOT NULL,
            email TEXT,
            ip_address TEXT,
            software TEXT,
            country TEXT,
            sector TEXT NOT NULL,
            risk_tier TEXT DEFAULT 'Medium',
            risk_score INTEGER DEFAULT 0,
            hibp_score INTEGER DEFAULT 0,
            news_score INTEGER DEFAULT 0,
            sanctions_score INTEGER DEFAULT 0,
            abuse_score INTEGER DEFAULT 0,
            criticality_tier TEXT DEFAULT 'Tier 2 - Business Operational',
            data_sensitivity TEXT DEFAULT 'Public Data',
            contract_value INTEGER DEFAULT 0,
            custom_ticker TEXT,
            compliance_certs TEXT DEFAULT 'SOC2 Type II',
            last_checked_at TEXT,
            created_at TEXT NOT NULL,
            vendor_name TEXT,
            contact_name TEXT,
            contact_email TEXT,
            contact_phone TEXT,
            service_category TEXT,
            criticality TEXT,
            data_handled TEXT,
            status TEXT DEFAULT 'ACTIVE',
            updated_at TEXT,
            created_by TEXT
        )
    """)

    # Sub-Vendors (4th-Party Vendor-of-Vendor Supply Chain)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sub_vendors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            parent_vendor_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            domain TEXT NOT NULL,
            sector TEXT DEFAULT 'Sub-Tier Supplier',
            risk_score INTEGER DEFAULT 25,
            created_at TEXT NOT NULL,
            FOREIGN KEY (parent_vendor_id) REFERENCES vendors (id) ON DELETE CASCADE
        )
    """)

    # Column migrations for existing SQLite DB files
    for col_def in [
        "email TEXT",
        "ip_address TEXT",
        "software TEXT",
        "country TEXT",
        "abuse_score INTEGER DEFAULT 0",
        "criticality_tier TEXT DEFAULT 'Tier 2 - Business Operational'",
        "data_sensitivity TEXT DEFAULT 'Public Data'",
        "contract_value INTEGER DEFAULT 0",
        "custom_ticker TEXT",
        "compliance_certs TEXT DEFAULT 'SOC2 Type II'",
        "vendor_name TEXT",
        "contact_name TEXT",
        "contact_email TEXT",
        "contact_phone TEXT",
        "service_category TEXT",
        "criticality TEXT",
        "data_handled TEXT",
        "status TEXT DEFAULT 'ACTIVE'",
        "updated_at TEXT",
        "created_by TEXT"
    ]:
        try:
            cursor.execute(f"ALTER TABLE vendors ADD COLUMN {col_def}")
        except Exception:
            pass  # Column already exists

    # Risk Events Table (Feed)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS risk_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vendor_id INTEGER,
            vendor_name TEXT NOT NULL,
            source TEXT NOT NULL,
            title TEXT NOT NULL,
            summary TEXT,
            risk_level TEXT NOT NULL,
            url TEXT,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE
        )
    """)

    # Manual Incidents Table (Inspired by reference repo feature)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vendor_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            category TEXT DEFAULT 'Security Breach',
            severity TEXT NOT NULL DEFAULT 'MEDIUM',
            status TEXT NOT NULL DEFAULT 'OPEN',
            score_impact INTEGER DEFAULT 0,
            reported_at TEXT NOT NULL,
            resolved_at TEXT,
            FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE
        )
    """)

    # Compliance Frameworks Table (VendorAuditAI-inspired)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS compliance_frameworks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vendor_id INTEGER NOT NULL,
            framework_name TEXT NOT NULL,
            framework_type TEXT NOT NULL,
            compliance_score INTEGER DEFAULT 0,
            last_assessed_at TEXT,
            next_due_at TEXT,
            status TEXT DEFAULT 'NOT_ASSESSED',
            document_path TEXT,
            gaps_identified INTEGER DEFAULT 0,
            controls_passed INTEGER DEFAULT 0,
            controls_total INTEGER DEFAULT 0,
            FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE
        )
    """)

    # Remediation Tasks Table (VendorAuditAI-inspired)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS remediation_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vendor_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            priority TEXT NOT NULL DEFAULT 'MEDIUM',
            status TEXT NOT NULL DEFAULT 'OPEN',
            assigned_to TEXT,
            due_date TEXT,
            created_at TEXT NOT NULL,
            completed_at TEXT,
            source_type TEXT DEFAULT 'MANUAL',
            source_reference INTEGER,
            FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE
        )
    """)

    try:
        cursor.execute("ALTER TABLE incidents ADD COLUMN category TEXT DEFAULT 'Security Breach'")
    except Exception:
        pass

    # Risk Assessments Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS assessments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vendor_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'DRAFT',
            created_at TEXT NOT NULL,
            submitted_at TEXT,
            FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE
        )
    """)

    # Assessment Answers Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS assessment_answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assessment_id INTEGER NOT NULL,
            question_id TEXT NOT NULL,
            category TEXT NOT NULL,
            answer_value TEXT NOT NULL,
            FOREIGN KEY (assessment_id) REFERENCES assessments (id) ON DELETE CASCADE
        )
    """)

    # Risk Assessment Scores Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS risk_assessment_scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assessment_id INTEGER NOT NULL UNIQUE,
            vendor_id INTEGER NOT NULL,
            total_score REAL NOT NULL,
            risk_level TEXT NOT NULL,
            cybersecurity_score REAL NOT NULL,
            compliance_score REAL NOT NULL,
            financial_stability_score REAL NOT NULL,
            operational_risk_score REAL NOT NULL,
            data_privacy_score REAL NOT NULL,
            scoring_version TEXT NOT NULL,
            calculated_at TEXT NOT NULL,
            FOREIGN KEY (assessment_id) REFERENCES assessments (id) ON DELETE CASCADE,
            FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE
        )
    """)

    # API Cache Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cached_responses (
            cache_key TEXT PRIMARY KEY,
            response_json TEXT NOT NULL,
            expires_at TEXT NOT NULL
        )
    """)

    # API Quota Counter Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS api_quota (
            service_name TEXT NOT NULL,
            date_str TEXT NOT NULL,
            call_count INTEGER DEFAULT 0,
            daily_limit INTEGER NOT NULL,
            PRIMARY KEY (service_name, date_str)
        )
    """)

    # -----------------------------------------------------------------------
    # Security: Tamper-Evident Audit Log
    # Every row contains the SHA-256 hash of the previous row (hash chain) and
    # the SHA-256 of its own fields. Any deletion or modification breaks the chain.
    #
    # PRODUCTION NOTE: In PostgreSQL, also run:
    #   REVOKE UPDATE, DELETE ON audit_log FROM app_user;
    # -----------------------------------------------------------------------
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_log (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp   TEXT NOT NULL,
            actor_id    INTEGER,
            actor_email TEXT NOT NULL DEFAULT 'system',
            actor_role  TEXT NOT NULL DEFAULT 'system',
            action      TEXT NOT NULL,
            resource    TEXT NOT NULL,
            ip_address  TEXT NOT NULL DEFAULT '',
            session_id  TEXT NOT NULL DEFAULT '',
            outcome     TEXT NOT NULL DEFAULT 'SUCCESS',
            details     TEXT NOT NULL DEFAULT '{}',
            prev_hash   TEXT NOT NULL,
            row_hash    TEXT NOT NULL
        )
    """)

    # -----------------------------------------------------------------------
    # Security: Audit Checkpoints (HMAC-SHA256 signed every N rows)
    # Signed with AUDIT_HMAC_KEY from Docker secret / env var.
    # -----------------------------------------------------------------------
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_checkpoints (
            checkpoint_seq   INTEGER PRIMARY KEY,
            row_id           INTEGER NOT NULL,
            accumulated_hash TEXT NOT NULL,
            hmac_sha256      TEXT NOT NULL,
            created_at       TEXT NOT NULL
        )
    """)

    # -----------------------------------------------------------------------
    # Security: TOTP Replay Protection Cache
    # Records (user_id, code, window_slot) tuples with a 90-second TTL.
    # Any re-submission of the same code within the same 30-second window is
    # rejected, even if the TOTP math is valid.
    # -----------------------------------------------------------------------
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS totp_used_codes (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL,
            code        TEXT NOT NULL,
            window_slot INTEGER NOT NULL,
            expires_at  TEXT NOT NULL,
            UNIQUE (user_id, code, window_slot)
        )
    """)
    # -----------------------------------------------------------------------
    # Security: TOTP Rate Limiting
    # Tracks failed and successful TOTP attempts per user and IP address.
    # -----------------------------------------------------------------------
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS totp_attempts (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id      INTEGER NOT NULL,
            ip_address   TEXT NOT NULL,
            attempt_time TEXT NOT NULL,
            is_successful INTEGER NOT NULL
        )
    """)
    # -----------------------------------------------------------------------
    # Security: Users and Sessions
    # -----------------------------------------------------------------------
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            email           TEXT UNIQUE NOT NULL,
            name            TEXT NOT NULL,
            google_sub      TEXT UNIQUE NOT NULL,
            role            TEXT NOT NULL,
            totp_secret_enc TEXT,
            totp_secret_aad TEXT,
            mfa_enabled     INTEGER NOT NULL DEFAULT 0,
            created_at      TEXT NOT NULL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            session_id       TEXT PRIMARY KEY,
            user_id          INTEGER NOT NULL,
            ip_address       TEXT NOT NULL,
            user_agent       TEXT NOT NULL,
            mfa_verified     INTEGER NOT NULL DEFAULT 0,
            created_at       TEXT NOT NULL,
            expires_at       TEXT NOT NULL,
            last_activity_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    """)

    conn.commit()
    conn.close()

# Incident Database Operations
SEVERITY_SCORES = {
    "CRITICAL": 25,
    "HIGH": 15,
    "MEDIUM": 8,
    "LOW": 4
}

def calculate_incident_impact(severity: str, status: str, reported_at: str = None) -> int:
    if status.upper() in ["RESOLVED", "MITIGATED"]:
        return 0
    
    base_impact = SEVERITY_SCORES.get(severity.upper(), 8)
    
    # Incident aging: reduce impact for older open incidents (graceful degradation)
    if reported_at:
        try:
            reported_date = datetime.fromisoformat(reported_at.replace('Z', '+00:00'))
            days_open = (datetime.utcnow() - reported_date).days
            
            # Reduce impact by 10% for every 30 days open, max 50% reduction
            if days_open > 30:
                aging_factor = max(0.5, 1 - (days_open // 30) * 0.1)
                return int(base_impact * aging_factor)
        except Exception:
            pass
    
    return base_impact

def add_incident(vendor_id: int, title: str, description: str, category: str, severity: str, status: str = "OPEN"):
    conn = get_db()
    cursor = conn.cursor()
    impact = calculate_incident_impact(severity, status)
    now = datetime.utcnow().isoformat()
    resolved_at = now if status.upper() in ["RESOLVED", "MITIGATED"] else None
    
    cursor.execute("""
        INSERT INTO incidents (vendor_id, title, description, category, severity, status, score_impact, reported_at, resolved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (vendor_id, title, description, category, severity.upper(), status.upper(), impact, now, resolved_at))
    conn.commit()
    incident_id = cursor.lastrowid
    conn.close()
    return incident_id

def get_incidents(vendor_id: int = None):
    conn = get_db()
    cursor = conn.cursor()
    if vendor_id:
        cursor.execute("""
            SELECT i.*, v.name as vendor_name, v.domain as vendor_domain 
            FROM incidents i
            JOIN vendors v ON i.vendor_id = v.id
            WHERE i.vendor_id = ?
            ORDER BY i.id DESC
        """, (vendor_id,))
    else:
        cursor.execute("""
            SELECT i.*, v.name as vendor_name, v.domain as vendor_domain 
            FROM incidents i
            JOIN vendors v ON i.vendor_id = v.id
            ORDER BY i.id DESC
        """)
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

def update_incident_status(incident_id: int, status: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT severity, reported_at FROM incidents WHERE id = ?", (incident_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
    severity = row["severity"]
    reported_at = row["reported_at"]
    impact = calculate_incident_impact(severity, status, reported_at)
    resolved_at = datetime.utcnow().isoformat() if status.upper() in ["RESOLVED", "MITIGATED"] else None
    
    cursor.execute("""
        UPDATE incidents 
        SET status = ?, score_impact = ?, resolved_at = ?
        WHERE id = ?
    """, (status.upper(), impact, resolved_at, incident_id))
    conn.commit()
    conn.close()
    return True

def delete_incident(incident_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM incidents WHERE id = ?", (incident_id,))
    conn.commit()
    conn.close()

def get_vendor_incident_score_impact(vendor_id: int) -> dict:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            SUM(score_impact) as total_impact,
            COUNT(*) as total_incidents,
            SUM(CASE WHEN status IN ('OPEN', 'INVESTIGATING') THEN 1 ELSE 0 END) as active_incidents,
            SUM(CASE WHEN severity = 'CRITICAL' AND status IN ('OPEN', 'INVESTIGATING') THEN 1 ELSE 0 END) as critical_active
        FROM incidents
        WHERE vendor_id = ?
    """, (vendor_id,))
    row = cursor.fetchone()
    conn.close()
    
    total_impact = row["total_impact"] if row and row["total_impact"] else 0
    return {
        "total_impact": total_impact,
        "total_incidents": row["total_incidents"] if row and row["total_incidents"] else 0,
        "active_incidents": row["active_incidents"] if row and row["active_incidents"] else 0,
        "critical_active": row["critical_active"] if row and row["critical_active"] else 0
    }

def recalculate_all_incident_impacts():
    """Recalculate score_impact for all open incidents to account for aging."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, severity, status, reported_at FROM incidents WHERE status IN ('OPEN', 'INVESTIGATING')")
    rows = cursor.fetchall()
    
    updated_count = 0
    for row in rows:
        incident_id = row["id"]
        severity = row["severity"]
        status = row["status"]
        reported_at = row["reported_at"]
        
        new_impact = calculate_incident_impact(severity, status, reported_at)
        cursor.execute("UPDATE incidents SET score_impact = ? WHERE id = ?", (new_impact, incident_id))
        updated_count += 1
    
    conn.commit()
    conn.close()
    return updated_count

# Compliance Framework Database Operations (VendorAuditAI-inspired)
COMPLIANCE_FRAMEWORKS = [
    "SOC 2 Type II",
    "SOC 2 Type I", 
    "ISO 27001",
    "NIST CSF",
    "NIST 800-53",
    "PCI DSS",
    "HIPAA",
    "GDPR",
    "DORA",
    "SIG",
    "CAIQ",
    "CMMC"
]

def add_compliance_framework(vendor_id: int, framework_name: str, framework_type: str, compliance_score: int = 0, document_path: str = None):
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    
    # Calculate next due date (1 year from now)
    from datetime import timedelta
    next_due = (datetime.utcnow() + timedelta(days=365)).isoformat()
    
    cursor.execute("""
        INSERT INTO compliance_frameworks (vendor_id, framework_name, framework_type, compliance_score, last_assessed_at, next_due_at, status, document_path)
        VALUES (?, ?, ?, ?, ?, ?, 'ASSESSED', ?)
    """, (vendor_id, framework_name, framework_type, compliance_score, now, next_due, document_path))
    conn.commit()
    framework_id = cursor.lastrowid
    conn.close()
    return framework_id

def get_vendor_compliance_frameworks(vendor_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM compliance_frameworks 
        WHERE vendor_id = ? 
        ORDER BY last_assessed_at DESC
    """, (vendor_id,))
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

def update_compliance_framework(framework_id: int, compliance_score: int, gaps_identified: int, controls_passed: int, controls_total: int):
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    
    from datetime import timedelta
    next_due = (datetime.utcnow() + timedelta(days=365)).isoformat()
    
    cursor.execute("""
        UPDATE compliance_frameworks 
        SET compliance_score = ?, gaps_identified = ?, controls_passed = ?, controls_total = ?, 
            last_assessed_at = ?, next_due_at = ?, status = 'ASSESSED'
        WHERE id = ?
    """, (compliance_score, gaps_identified, controls_passed, controls_total, now, next_due, framework_id))
    conn.commit()
    conn.close()
    return True

def get_compliance_summary():
    """Get overall compliance statistics across all vendors."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            framework_name,
            COUNT(*) as vendor_count,
            AVG(compliance_score) as avg_score,
            SUM(CASE WHEN status = 'ASSESSED' THEN 1 ELSE 0 END) as assessed_count,
            SUM(CASE WHEN next_due_at < datetime('now') THEN 1 ELSE 0 END) as overdue_count
        FROM compliance_frameworks
        GROUP BY framework_name
    """)
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

# Remediation Task Database Operations (VendorAuditAI-inspired)
def create_remediation_task(vendor_id: int, title: str, description: str, priority: str = "MEDIUM", assigned_to: str = None, due_date: str = None, source_type: str = "MANUAL", source_reference: int = None):
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    
    cursor.execute("""
        INSERT INTO remediation_tasks (vendor_id, title, description, priority, assigned_to, due_date, created_at, source_type, source_reference)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (vendor_id, title, description, priority.upper(), assigned_to, due_date, now, source_type, source_reference))
    conn.commit()
    task_id = cursor.lastrowid
    conn.close()
    return task_id

def get_vendor_remediation_tasks(vendor_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM remediation_tasks 
        WHERE vendor_id = ? 
        ORDER BY priority DESC, due_date ASC
    """, (vendor_id,))
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

def update_remediation_task(task_id: int, status: str):
    conn = get_db()
    cursor = conn.cursor()
    completed_at = datetime.utcnow().isoformat() if status.upper() in ["COMPLETED", "CLOSED"] else None
    
    cursor.execute("""
        UPDATE remediation_tasks 
        SET status = ?, completed_at = ?
        WHERE id = ?
    """, (status.upper(), completed_at, task_id))
    conn.commit()
    conn.close()
    return True

def get_remediation_summary():
    """Get overall remediation task statistics."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            priority,
            COUNT(*) as task_count,
            SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) as open_count,
            SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress_count,
            SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_count,
            SUM(CASE WHEN due_date < datetime('now') AND status NOT IN ('COMPLETED', 'CLOSED') THEN 1 ELSE 0 END) as overdue_count
        FROM remediation_tasks
        GROUP BY priority
    """)
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


# Quota Budgeting & Circuit Breaker Helpers
DAILY_LIMITS = {
    "NewsAPI": 100,
    "OpenSanctions": 500,
    "HIBP": 50,
    "StockMarket": 200,
    "SSLHeaderProbe": 300
}

def record_api_call(service_name: str) -> bool:
    """Track API calls made today. Returns True if call is allowed, False if circuit breaker tripped."""
    today = datetime.utcnow().strftime("%Y-%m-%d")
    limit = DAILY_LIMITS.get(service_name, 100)
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO api_quota (service_name, date_str, call_count, daily_limit)
        VALUES (?, ?, 1, ?)
        ON CONFLICT(service_name, date_str) DO UPDATE SET
            call_count = call_count + 1
    """, (service_name, today, limit))
    conn.commit()

    cursor.execute("SELECT call_count FROM api_quota WHERE service_name = ? AND date_str = ?", (service_name, today))
    row = cursor.fetchone()
    count = row["call_count"] if row else 0
    conn.close()

    # Circuit breaker: stop live calls when reaching 90% of daily limit
    if count >= (limit * 0.9):
        print(f"[CIRCUIT BREAKER] {service_name} at {count}/{limit} daily calls (>90%). Switching to cached/mock data.")
        return False
    return True

def get_quota_stats():
    today = datetime.utcnow().strftime("%Y-%m-%d")
    conn = get_db()
    cursor = conn.cursor()
    stats = {}
    for service, limit in DAILY_LIMITS.items():
        cursor.execute("SELECT call_count FROM api_quota WHERE service_name = ? AND date_str = ?", (service, today))
        row = cursor.fetchone()
        used = row["call_count"] if row else 0
        circuit_tripped = used >= (limit * 0.9)
        stats[service] = {
            "used": used,
            "limit": limit,
            "remaining": max(0, limit - used),
            "circuit_breaker_tripped": circuit_tripped
        }
    conn.close()
    return stats

# Cache Helpers
def get_cached_response(cache_key: str):
    bypass = os.getenv("BYPASS_CACHE", "true").lower() == "true"
    if bypass:
        return None  # Force direct live API query on every request

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT response_json, expires_at FROM cached_responses WHERE cache_key = ?", (cache_key,))
    row = cursor.fetchone()
    conn.close()
    if row:
        expires_at = datetime.fromisoformat(row["expires_at"])
        if datetime.utcnow() < expires_at:
            return json.loads(row["response_json"])
    return None

def set_cached_response(cache_key: str, data: dict, ttl_minutes: int = 60):
    conn = get_db()
    cursor = conn.cursor()
    expires_at = (datetime.utcnow() + timedelta(minutes=ttl_minutes)).isoformat()
    cursor.execute("""
        INSERT INTO cached_responses (cache_key, response_json, expires_at)
        VALUES (?, ?, ?)
        ON CONFLICT(cache_key) DO UPDATE SET
            response_json = excluded.response_json,
            expires_at = excluded.expires_at
    """, (cache_key, json.dumps(data), expires_at))
    conn.commit()
    conn.close()

# Sub-Vendor (4th-Party) Helpers
def add_sub_vendor(parent_vendor_id: int, name: str, domain: str, sector: str = "Sub-Tier Supplier", risk_score: int = 25):
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute("""
        INSERT INTO sub_vendors (parent_vendor_id, name, domain, sector, risk_score, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (parent_vendor_id, name, domain, sector, risk_score, now))
    sub_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return sub_id

def get_sub_vendors(parent_vendor_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sub_vendors WHERE parent_vendor_id = ? ORDER BY id DESC", (parent_vendor_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def delete_sub_vendor(sub_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sub_vendors WHERE id = ?", (sub_id,))
    conn.commit()
    conn.close()
    return True

