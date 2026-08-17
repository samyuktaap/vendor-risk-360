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

    # Companies Table (Multi-Tenancy)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS companies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL
        )
    """)

    # Vendors Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS vendors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL DEFAULT 1,
            name TEXT NOT NULL,
            domain TEXT NOT NULL,
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

    # Operational Risk Module Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS vendor_operational_risk (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vendor_id INTEGER UNIQUE NOT NULL,
            sla_compliance_pct REAL DEFAULT 99.5,
            monthly_downtime_hours REAL DEFAULT 1.0,
            incident_frequency INTEGER DEFAULT 1,
            delivery_delays_count INTEGER DEFAULT 0,
            quality_defect_rate_pct REAL DEFAULT 0.2,
            support_response_time_hrs REAL DEFAULT 1.5,
            bcp_status TEXT DEFAULT 'VERIFIED',
            bcp_audit_score INTEGER DEFAULT 85,
            dr_rto_hours REAL DEFAULT 4.0,
            dr_rpo_hours REAL DEFAULT 1.0,
            dr_testing_status TEXT DEFAULT 'PASSED_Q2',
            dependency_level TEXT DEFAULT 'MODERATE',
            replaceability_score INTEGER DEFAULT 70,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE
        )
    """)

    # Column migrations for existing SQLite DB files
    for col_def in [
        "company_id INTEGER",
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
        "created_by TEXT",
        "calculated_tier TEXT DEFAULT 'TIER_3_MEDIUM'",
        "effective_tier TEXT DEFAULT 'TIER_3_MEDIUM'",
        "tiering_version TEXT DEFAULT 'v1'",
        "tier_override TEXT",
        "tier_override_reason TEXT",
        "tier_overridden_by TEXT",
        "tier_overridden_at TEXT",
        "tier_rationale_json TEXT"
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
            company_id      INTEGER NOT NULL DEFAULT 1,
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

    # Cybersecurity 360° Assessment Tables
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cybersecurity_assessments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vendor_id INTEGER NOT NULL,
            company_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'DRAFT',
            scoring_version TEXT NOT NULL DEFAULT '1.0',
            cybersecurity_score REAL DEFAULT 0.0,
            domain_scores_json TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            submitted_at TEXT,
            FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE,
            FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cybersecurity_answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assessment_id INTEGER NOT NULL,
            question_id TEXT NOT NULL,
            domain TEXT NOT NULL,
            answer_value TEXT NOT NULL,
            evidence_document_id INTEGER,
            evidence_status TEXT DEFAULT 'MISSING',
            evidence_notes TEXT,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (assessment_id) REFERENCES cybersecurity_assessments (id) ON DELETE CASCADE
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cybersecurity_score_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vendor_id INTEGER NOT NULL,
            assessment_id INTEGER NOT NULL,
            company_id INTEGER NOT NULL,
            cybersecurity_score REAL NOT NULL,
            domain_scores_json TEXT NOT NULL,
            scoring_version TEXT NOT NULL,
            calculated_at TEXT NOT NULL,
            FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE,
            FOREIGN KEY (assessment_id) REFERENCES cybersecurity_assessments (id) ON DELETE CASCADE
        )
    """)

    # Vulnerability Management Tables
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS vendor_assets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vendor_id INTEGER NOT NULL,
            company_id INTEGER NOT NULL,
            asset_type TEXT NOT NULL,
            hostname TEXT NOT NULL,
            authorized INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE,
            FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS vulnerabilities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL,
            vendor_id INTEGER NOT NULL,
            asset_id INTEGER,
            cve_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            severity TEXT NOT NULL,
            cvss_score REAL DEFAULT 0.0,
            detected_at TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'NVD',
            status TEXT NOT NULL DEFAULT 'OPEN',
            remediation_due_at TEXT,
            resolved_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE,
            FOREIGN KEY (asset_id) REFERENCES vendor_assets (id) ON DELETE SET NULL,
            FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
        )
    """)

    # Documents Table (Transit Envelope Encryption)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL,
            vendor_id INTEGER NOT NULL,
            uploader_id INTEGER NOT NULL,
            document_type TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            object_id TEXT NOT NULL UNIQUE,
            size_bytes INTEGER NOT NULL,
            upload_timestamp TEXT NOT NULL,
            expiry_date TEXT,
            wrapped_dek TEXT NOT NULL,
            integrity_hash TEXT NOT NULL,
            FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE,
            FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE,
            FOREIGN KEY (uploader_id) REFERENCES users (id) ON DELETE SET NULL
        )
    """)

    # Alerts Table (MVP Alert Engine with Deduplication & Status Lifecycle)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id      INTEGER NOT NULL,
            vendor_id       INTEGER NOT NULL,
            alert_type      TEXT NOT NULL,
            severity        TEXT NOT NULL DEFAULT 'HIGH',
            status          TEXT NOT NULL DEFAULT 'UNREAD',
            title           TEXT NOT NULL,
            message         TEXT NOT NULL,
            metadata_json   TEXT NOT NULL DEFAULT '{}',
            dedup_key       TEXT UNIQUE,
            created_at      TEXT NOT NULL,
            read_at         TEXT,
            acknowledged_at TEXT,
            FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE,
            FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE
        )
    """)

    # Vendor Risk History Table (for Trend Analysis)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS vendor_risk_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vendor_id INTEGER NOT NULL,
            company_id INTEGER NOT NULL,
            score REAL NOT NULL,
            score_type TEXT NOT NULL DEFAULT 'OVERALL',
            calculated_tier TEXT,
            assessment_id INTEGER,
            calculated_at TEXT NOT NULL,
            FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE,
            FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
        )
    """)

    # Vendor Dependencies Table (Multi-Tier Supply Chain Graph)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS vendor_dependencies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL,
            upstream_vendor_id INTEGER NOT NULL,
            downstream_vendor_id INTEGER,
            external_vendor_name TEXT,
            external_vendor_domain TEXT,
            relationship_type TEXT NOT NULL,
            criticality TEXT NOT NULL DEFAULT 'MEDIUM',
            dependency_level TEXT NOT NULL DEFAULT 'MEDIUM',
            status TEXT NOT NULL DEFAULT 'ACTIVE',
            description TEXT,
            created_by TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (upstream_vendor_id) REFERENCES vendors (id) ON DELETE CASCADE,
            FOREIGN KEY (downstream_vendor_id) REFERENCES vendors (id) ON DELETE SET NULL,
            FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
        )
    """)

    # Add company_id to users if it doesn't exist
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN company_id INTEGER")
    except Exception:
        pass

    # Multi-tenancy Migration: Create a default 'Demo Company' and assign existing records to it
    cursor.execute("SELECT id FROM companies WHERE name = 'Demo Company'")
    demo_company = cursor.fetchone()
    if not demo_company:
        now = datetime.utcnow().isoformat()
        cursor.execute("INSERT INTO companies (name, created_at) VALUES (?, ?)", ("Demo Company", now))
        demo_company_id = cursor.lastrowid
    else:
        demo_company_id = demo_company["id"]

    # Assign all existing users and vendors to Demo Company if they have no company_id
    cursor.execute("UPDATE users SET company_id = ? WHERE company_id IS NULL", (demo_company_id,))
    cursor.execute("UPDATE vendors SET company_id = ? WHERE company_id IS NULL", (demo_company_id,))

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

def get_incidents(vendor_id: int = None, company_id: int = None):
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
    elif company_id:
        cursor.execute("""
            SELECT i.*, v.name as vendor_name, v.domain as vendor_domain 
            FROM incidents i
            JOIN vendors v ON i.vendor_id = v.id
            WHERE v.company_id = ?
            ORDER BY i.id DESC
        """, (company_id,))
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

def get_compliance_summary(company_id: int = None):
    """Get overall compliance statistics across all vendors or scoped to company."""
    conn = get_db()
    cursor = conn.cursor()
    if company_id:
        cursor.execute("""
            SELECT 
                cf.framework_name,
                COUNT(*) as vendor_count,
                AVG(cf.compliance_score) as avg_score,
                SUM(CASE WHEN cf.status = 'ASSESSED' THEN 1 ELSE 0 END) as assessed_count,
                SUM(CASE WHEN cf.next_due_at < datetime('now') THEN 1 ELSE 0 END) as overdue_count
            FROM compliance_frameworks cf
            JOIN vendors v ON cf.vendor_id = v.id
            WHERE v.company_id = ?
            GROUP BY cf.framework_name
        """, (company_id,))
    else:
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

def get_remediation_summary(company_id: int = None):
    """Get overall remediation task statistics or scoped to company."""
    conn = get_db()
    cursor = conn.cursor()
    if company_id:
        cursor.execute("""
            SELECT 
                rt.priority,
                COUNT(*) as task_count,
                SUM(CASE WHEN rt.status = 'OPEN' THEN 1 ELSE 0 END) as open_count,
                SUM(CASE WHEN rt.status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress_count,
                SUM(CASE WHEN rt.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_count,
                SUM(CASE WHEN rt.due_date < datetime('now') AND rt.status NOT IN ('COMPLETED', 'CLOSED') THEN 1 ELSE 0 END) as overdue_count
            FROM remediation_tasks rt
            JOIN vendors v ON rt.vendor_id = v.id
            WHERE v.company_id = ?
            GROUP BY rt.priority
        """, (company_id,))
    else:
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

def get_dashboard_metrics(company_id: int) -> dict:
    conn = get_db()
    cursor = conn.cursor()
    
    # Total Vendors
    cursor.execute("SELECT COUNT(*) as cnt FROM vendors WHERE company_id = ?", (company_id,))
    total_vendors = cursor.fetchone()["cnt"]
    
    # High-Risk Vendors
    cursor.execute("SELECT COUNT(*) as cnt FROM vendors WHERE company_id = ? AND risk_score >= 70", (company_id,))
    high_risk_vendors = cursor.fetchone()["cnt"]
    
    # Pending Assessments (status = 'DRAFT')
    cursor.execute("""
        SELECT COUNT(*) as cnt FROM assessments a
        JOIN vendors v ON a.vendor_id = v.id
        WHERE v.company_id = ? AND a.status = 'DRAFT'
    """, (company_id,))
    pending_assessments = cursor.fetchone()["cnt"]
    
    # Expiring Certifications (< 30 days from now)
    thirty_days_from_now = (datetime.utcnow() + timedelta(days=30)).isoformat()
    cursor.execute("""
        SELECT COUNT(*) as cnt FROM compliance_frameworks cf
        JOIN vendors v ON cf.vendor_id = v.id
        WHERE v.company_id = ? AND cf.next_due_at < ?
    """, (company_id, thirty_days_from_now))
    expiring_certifications = cursor.fetchone()["cnt"]
    
    # Overall Risk Score
    cursor.execute("SELECT AVG(risk_score) as avg_score FROM vendors WHERE company_id = ?", (company_id,))
    row = cursor.fetchone()
    overall_risk_score = int(row["avg_score"]) if row and row["avg_score"] is not None else 0
    
    # Risk Distribution
    cursor.execute("""
        SELECT 
            CASE 
                WHEN risk_score >= 70 THEN 'CRITICAL'
                WHEN risk_score >= 40 THEN 'WATCH'
                ELSE 'SAFE'
            END as tier,
            COUNT(*) as cnt 
        FROM vendors 
        WHERE company_id = ? 
        GROUP BY tier
    """, (company_id,))
    distribution_rows = cursor.fetchall()
    risk_distribution = {r["tier"]: r["cnt"] for r in distribution_rows}
    
    # Simple Risk Trend
    cursor.execute("""
        SELECT strftime('%Y-%m', calculated_at) as month, AVG(total_score) as avg_score
        FROM risk_assessment_scores ras
        JOIN vendors v ON ras.vendor_id = v.id
        WHERE v.company_id = ?
        GROUP BY month
        ORDER BY month ASC
        LIMIT 6
    """, (company_id,))
    trend_rows = cursor.fetchall()
    risk_trend = [{"month": r["month"], "avg_score": round(r["avg_score"])} for r in trend_rows]

    # Vulnerability metrics for company's vendors
    now_iso = datetime.utcnow().isoformat()
    cursor.execute("""
        SELECT COUNT(*) as cnt FROM vulnerabilities
        WHERE company_id = ? AND severity = 'CRITICAL' AND status IN ('OPEN', 'IN_PROGRESS')
    """, (company_id,))
    critical_vulnerabilities = cursor.fetchone()["cnt"]

    cursor.execute("""
        SELECT COUNT(*) as cnt FROM vulnerabilities
        WHERE company_id = ? AND severity = 'HIGH' AND status IN ('OPEN', 'IN_PROGRESS')
    """, (company_id,))
    open_high_vulnerabilities = cursor.fetchone()["cnt"]

    cursor.execute("""
        SELECT COUNT(*) as cnt FROM vulnerabilities
        WHERE company_id = ? AND status IN ('OPEN', 'IN_PROGRESS') AND remediation_due_at IS NOT NULL AND remediation_due_at < ?
    """, (company_id, now_iso))
    overdue_vulnerabilities = cursor.fetchone()["cnt"]
    
    conn.close()
    
    return {
        "total_vendors": total_vendors,
        "high_risk_vendors": high_risk_vendors,
        "pending_assessments": pending_assessments,
        "expiring_certifications": expiring_certifications,
        "overall_risk_score": overall_risk_score,
        "risk_distribution": risk_distribution,
        "risk_trend": risk_trend,
        "critical_vulnerabilities": critical_vulnerabilities,
        "open_high_vulnerabilities": open_high_vulnerabilities,
        "overdue_vulnerabilities": overdue_vulnerabilities
    }

# ---------------------------------------------------------------------------
# Cybersecurity 360° Assessment Database Helpers
# ---------------------------------------------------------------------------

def create_cybersecurity_assessment(vendor_id: int, company_id: int) -> dict:
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM vendors WHERE id = ? AND company_id = ?", (vendor_id, company_id))
    if not cursor.fetchone():
        conn.close()
        return None
        
    cursor.execute("""
        SELECT * FROM cybersecurity_assessments 
        WHERE vendor_id = ? AND company_id = ? AND status = 'DRAFT'
        ORDER BY id DESC LIMIT 1
    """, (vendor_id, company_id))
    row = cursor.fetchone()
    
    if row:
        assessment_id = row["id"]
    else:
        now = datetime.utcnow().isoformat()
        cursor.execute("""
            INSERT INTO cybersecurity_assessments (vendor_id, company_id, status, scoring_version, created_at, updated_at)
            VALUES (?, ?, 'DRAFT', '1.0', ?, ?)
        """, (vendor_id, company_id, now, now))
        assessment_id = cursor.lastrowid
        conn.commit()
        
    conn.close()
    return get_cybersecurity_assessment_by_id(assessment_id, company_id)

def get_vendor_cybersecurity_assessments(vendor_id: int, company_id: int) -> list:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM cybersecurity_assessments 
        WHERE vendor_id = ? AND company_id = ? 
        ORDER BY id DESC
    """, (vendor_id, company_id))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_cybersecurity_assessment_by_id(assessment_id: int, company_id: int) -> dict | None:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT a.*, v.name as vendor_name, v.domain as vendor_domain 
        FROM cybersecurity_assessments a
        JOIN vendors v ON a.vendor_id = v.id
        WHERE a.id = ? AND a.company_id = ?
    """, (assessment_id, company_id))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
        
    assessment = dict(row)
    if assessment.get("domain_scores_json"):
        try:
            assessment["domain_scores"] = json.loads(assessment["domain_scores_json"])
        except Exception:
            assessment["domain_scores"] = {}
            
    cursor.execute("SELECT * FROM cybersecurity_answers WHERE assessment_id = ?", (assessment_id,))
    ans_rows = cursor.fetchall()
    assessment["answers"] = [dict(r) for r in ans_rows]
    
    conn.close()
    return assessment

def save_cybersecurity_answers(assessment_id: int, company_id: int, answers_data: list) -> dict | None:
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, status FROM cybersecurity_assessments WHERE id = ? AND company_id = ?", (assessment_id, company_id))
    ass_row = cursor.fetchone()
    if not ass_row:
        conn.close()
        return None
        
    now = datetime.utcnow().isoformat()
    
    for item in answers_data:
        q_id = item.get("question_id")
        domain = item.get("domain", "")
        val = item.get("answer_value", "")
        doc_id = item.get("evidence_document_id")
        ev_notes = item.get("evidence_notes")
        
        explicit_ev_status = item.get("evidence_status")
        if explicit_ev_status in ("REVIEWED", "REJECTED", "PRESENT", "MISSING"):
            ev_status = explicit_ev_status
        else:
            ev_status = "PRESENT" if doc_id else "MISSING"
            
        cursor.execute("""
            UPDATE cybersecurity_answers
            SET answer_value = ?, evidence_document_id = ?, evidence_status = ?, evidence_notes = ?, updated_at = ?
            WHERE assessment_id = ? AND question_id = ?
        """, (str(val), doc_id, ev_status, ev_notes, now, assessment_id, q_id))
        
        if cursor.rowcount == 0:
            cursor.execute("""
                INSERT INTO cybersecurity_answers 
                (assessment_id, question_id, domain, answer_value, evidence_document_id, evidence_status, evidence_notes, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (assessment_id, q_id, domain, str(val), doc_id, ev_status, ev_notes, now))
            
    cursor.execute("UPDATE cybersecurity_assessments SET updated_at = ? WHERE id = ?", (now, assessment_id))
    conn.commit()
    conn.close()
    
    return get_cybersecurity_assessment_by_id(assessment_id, company_id)

def submit_cybersecurity_assessment(assessment_id: int, company_id: int, score_data: dict) -> dict | None:
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM cybersecurity_assessments WHERE id = ? AND company_id = ?", (assessment_id, company_id))
    ass_row = cursor.fetchone()
    if not ass_row:
        conn.close()
        return None
        
    now = datetime.utcnow().isoformat()
    c_score = score_data["cybersecurity_score"]
    v_version = score_data["scoring_version"]
    d_scores_json = json.dumps(score_data["domain_scores"])
    vendor_id = ass_row["vendor_id"]
    
    cursor.execute("""
        UPDATE cybersecurity_assessments 
        SET status = 'SUBMITTED', cybersecurity_score = ?, domain_scores_json = ?, scoring_version = ?, updated_at = ?, submitted_at = ?
        WHERE id = ?
    """, (c_score, d_scores_json, v_version, now, now, assessment_id))
    
    cursor.execute("""
        INSERT INTO cybersecurity_score_history (vendor_id, assessment_id, company_id, cybersecurity_score, domain_scores_json, scoring_version, calculated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (vendor_id, assessment_id, company_id, c_score, d_scores_json, v_version, now))
    
    conn.commit()
    conn.close()
    
    return get_cybersecurity_assessment_by_id(assessment_id, company_id)

def get_vendor_latest_cybersecurity_score(vendor_id: int, company_id: int) -> dict | None:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM cybersecurity_assessments 
        WHERE vendor_id = ? AND company_id = ? AND status = 'SUBMITTED'
        ORDER BY id DESC LIMIT 1
    """, (vendor_id, company_id))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    res = dict(row)
    if res.get("domain_scores_json"):
        try:
            res["domain_scores"] = json.loads(res["domain_scores_json"])
        except Exception:
            res["domain_scores"] = {}
    return res

def get_vendor_cybersecurity_history(vendor_id: int, company_id: int) -> list:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM cybersecurity_score_history 
        WHERE vendor_id = ? AND company_id = ?
        ORDER BY calculated_at ASC
    """, (vendor_id, company_id))
    rows = cursor.fetchall()
    conn.close()
    result = []
    for r in rows:
        item = dict(r)
        if item.get("domain_scores_json"):
            try:
                item["domain_scores"] = json.loads(item["domain_scores_json"])
            except Exception:
                item["domain_scores"] = {}
        result.append(item)
    return result

def review_cybersecurity_evidence(assessment_id: int, question_id: str, company_id: int, status: str, notes: str = None) -> bool:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM cybersecurity_assessments WHERE id = ? AND company_id = ?", (assessment_id, company_id))
    if not cursor.fetchone():
        conn.close()
        return False
        
    now = datetime.utcnow().isoformat()
    cursor.execute("""
        UPDATE cybersecurity_answers 
        SET evidence_status = ?, evidence_notes = ?, updated_at = ?
        WHERE assessment_id = ? AND question_id = ?
    """, (status, notes, now, assessment_id, question_id))
    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return updated

# ---------------------------------------------------------------------------
# Vulnerability Management Database Helpers
# ---------------------------------------------------------------------------

def get_vendor_assets(vendor_id: int, company_id: int) -> list:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM vendor_assets "
        "WHERE vendor_id = ? AND company_id = ? "
        "ORDER BY created_at DESC",
        (vendor_id, company_id)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def add_vendor_asset(vendor_id: int, company_id: int, asset_type: str, hostname: str, authorized: bool = True) -> dict | None:
    conn = get_db()
    cursor = conn.cursor()
    
    # Verify vendor ownership
    cursor.execute("SELECT id FROM vendors WHERE id = ? AND company_id = ?", (vendor_id, company_id))
    if not cursor.fetchone():
        conn.close()
        return None
        
    now = datetime.utcnow().isoformat()
    cursor.execute(
        "INSERT INTO vendor_assets (vendor_id, company_id, asset_type, hostname, authorized, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (vendor_id, company_id, asset_type.upper(), hostname.strip(), 1 if authorized else 0, now)
    )
    asset_id = cursor.lastrowid
    conn.commit()
    
    cursor.execute("SELECT * FROM vendor_assets WHERE id = ?", (asset_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_vendor_vulnerabilities(vendor_id: int, company_id: int, severity: str = None, status: str = None, asset_id: int = None, search: str = None) -> list:
    conn = get_db()
    cursor = conn.cursor()
    
    query = (
        "SELECT v.*, a.hostname as asset_hostname, a.asset_type as asset_type "
        "FROM vulnerabilities v "
        "LEFT JOIN vendor_assets a ON v.asset_id = a.id "
        "WHERE v.vendor_id = ? AND v.company_id = ?"
    )
    params = [vendor_id, company_id]
    
    if severity:
        query += " AND UPPER(v.severity) = ?"
        params.append(severity.upper())
        
    if status:
        query += " AND UPPER(v.status) = ?"
        params.append(status.upper())
        
    if asset_id:
        query += " AND v.asset_id = ?"
        params.append(asset_id)
        
    if search:
        query += " AND (v.cve_id LIKE ? OR v.title LIKE ? OR v.description LIKE ?)"
        search_param = f"%{search}%"
        params.extend([search_param, search_param, search_param])
        
    query += " ORDER BY CASE v.severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 WHEN 'LOW' THEN 4 ELSE 5 END, v.detected_at DESC"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_vulnerability_by_id(vulnerability_id: int, company_id: int) -> dict | None:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT v.*, a.hostname as asset_hostname, a.asset_type as asset_type, vn.name as vendor_name "
        "FROM vulnerabilities v "
        "LEFT JOIN vendor_assets a ON v.asset_id = a.id "
        "JOIN vendors vn ON v.vendor_id = vn.id "
        "WHERE v.id = ? AND v.company_id = ?",
        (vulnerability_id, company_id)
    )
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def update_vulnerability_status(vulnerability_id: int, company_id: int, new_status: str, notes: str = None) -> dict | None:
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM vulnerabilities WHERE id = ? AND company_id = ?", (vulnerability_id, company_id))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        return None
        
    now = datetime.utcnow().isoformat()
    resolved_at = now if new_status.upper() in ("RESOLVED", "MITIGATED") else None
    
    cursor.execute(
        "UPDATE vulnerabilities "
        "SET status = ?, resolved_at = ?, updated_at = ? "
        "WHERE id = ? AND company_id = ?",
        (new_status.upper(), resolved_at, now, vulnerability_id, company_id)
    )
    conn.commit()
    
    cursor.execute(
        "SELECT v.*, a.hostname as asset_hostname, a.asset_type as asset_type, vn.name as vendor_name "
        "FROM vulnerabilities v "
        "LEFT JOIN vendor_assets a ON v.asset_id = a.id "
        "JOIN vendors vn ON v.vendor_id = vn.id "
        "WHERE v.id = ? AND v.company_id = ?",
        (vulnerability_id, company_id)
    )
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_vendor_vulnerability_summary_counts(vendor_id: int, company_id: int) -> dict:
    conn = get_db()
    cursor = conn.cursor()
    
    # Verify vendor exists and belongs to company
    cursor.execute("SELECT id FROM vendors WHERE id = ? AND company_id = ?", (vendor_id, company_id))
    if not cursor.fetchone():
        conn.close()
        return None
        
    now_iso = datetime.utcnow().isoformat()
    
    cursor.execute(
        "SELECT "
        "COUNT(*) as total, "
        "SUM(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END) as critical_count, "
        "SUM(CASE WHEN severity = 'HIGH' THEN 1 ELSE 0 END) as high_count, "
        "SUM(CASE WHEN severity = 'MEDIUM' THEN 1 ELSE 0 END) as medium_count, "
        "SUM(CASE WHEN severity = 'LOW' THEN 1 ELSE 0 END) as low_count, "
        "SUM(CASE WHEN severity NOT IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW') THEN 1 ELSE 0 END) as unknown_count, "
        "SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) as open_count, "
        "SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress_count, "
        "SUM(CASE WHEN status = 'MITIGATED' THEN 1 ELSE 0 END) as mitigated_count, "
        "SUM(CASE WHEN status = 'RESOLVED' THEN 1 ELSE 0 END) as resolved_count, "
        "SUM(CASE WHEN status = 'ACCEPTED_RISK' THEN 1 ELSE 0 END) as accepted_risk_count, "
        "SUM(CASE WHEN status IN ('OPEN', 'IN_PROGRESS') AND remediation_due_at IS NOT NULL AND remediation_due_at < ? THEN 1 ELSE 0 END) as overdue_count "
        "FROM vulnerabilities "
        "WHERE vendor_id = ? AND company_id = ?",
        (now_iso, vendor_id, company_id)
    )
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return {
            "total": 0, "critical_count": 0, "high_count": 0, "medium_count": 0, "low_count": 0, "unknown_count": 0,
            "open_count": 0, "in_progress_count": 0, "mitigated_count": 0, "resolved_count": 0, "accepted_risk_count": 0,
            "overdue_count": 0
        }
        
    return {
        "total": row["total"] or 0,
        "critical_count": row["critical_count"] or 0,
        "high_count": row["high_count"] or 0,
        "medium_count": row["medium_count"] or 0,
        "low_count": row["low_count"] or 0,
        "unknown_count": row["unknown_count"] or 0,
        "open_count": row["open_count"] or 0,
        "in_progress_count": row["in_progress_count"] or 0,
        "mitigated_count": row["mitigated_count"] or 0,
        "resolved_count": row["resolved_count"] or 0,
        "accepted_risk_count": row["accepted_risk_count"] or 0,
        "overdue_count": row["overdue_count"] or 0
    }

# ---------------------------------------------------------------------------
# Vendor Tiering & Risk Trend Database Helpers
# ---------------------------------------------------------------------------

def get_vendor_tier_info(vendor_id: int, company_id: int) -> dict | None:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, name, domain, risk_score, criticality_tier, data_sensitivity, contract_value, "
        "calculated_tier, effective_tier, tiering_version, "
        "tier_override, tier_override_reason, tier_overridden_by, tier_overridden_at, "
        "tier_rationale_json "
        "FROM vendors "
        "WHERE id = ? AND company_id = ?",
        (vendor_id, company_id)
    )
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
        
    item = dict(row)
    rationale = []
    if item.get("tier_rationale_json"):
        try:
            rationale = json.loads(item["tier_rationale_json"])
        except Exception:
            rationale = []
    item["rationale"] = rationale
    item["is_overridden"] = bool(item.get("tier_override"))
    return item

def update_vendor_tier(vendor_id: int, company_id: int, calculated_tier: str, effective_tier: str, rationale_list: list, tiering_version: str = "v1") -> bool:
    conn = get_db()
    cursor = conn.cursor()
    rationale_json = json.dumps(rationale_list)
    cursor.execute(
        "UPDATE vendors "
        "SET calculated_tier = ?, effective_tier = ?, tier_rationale_json = ?, tiering_version = ? "
        "WHERE id = ? AND company_id = ?",
        (calculated_tier, effective_tier, rationale_json, tiering_version, vendor_id, company_id)
    )
    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return updated

def override_vendor_tier(vendor_id: int, company_id: int, tier_override: str, reason: str, overridden_by: str) -> dict | None:
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM vendors WHERE id = ? AND company_id = ?", (vendor_id, company_id))
    if not cursor.fetchone():
        conn.close()
        return None
        
    now = datetime.utcnow().isoformat()
    cursor.execute(
        "UPDATE vendors "
        "SET tier_override = ?, effective_tier = ?, tier_override_reason = ?, tier_overridden_by = ?, tier_overridden_at = ? "
        "WHERE id = ? AND company_id = ?",
        (tier_override, tier_override, reason, overridden_by, now, vendor_id, company_id)
    )
    conn.commit()
    conn.close()
    
    return get_vendor_tier_info(vendor_id, company_id)

def record_vendor_risk_history(vendor_id: int, company_id: int, score: float, score_type: str = "OVERALL", calculated_tier: str = None, assessment_id: int = None) -> int:
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute(
        "INSERT INTO vendor_risk_history (vendor_id, company_id, score, score_type, calculated_tier, assessment_id, calculated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (vendor_id, company_id, float(score), score_type, calculated_tier, assessment_id, now)
    )
    row_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return row_id

def get_vendor_risk_history(vendor_id: int, company_id: int, score_type: str = None) -> list:
    conn = get_db()
    cursor = conn.cursor()
    if score_type:
        cursor.execute(
            "SELECT * FROM vendor_risk_history "
            "WHERE vendor_id = ? AND company_id = ? AND score_type = ? "
            "ORDER BY calculated_at ASC",
            (vendor_id, company_id, score_type)
        )
    else:
        cursor.execute(
            "SELECT * FROM vendor_risk_history "
            "WHERE vendor_id = ? AND company_id = ? "
            "ORDER BY calculated_at ASC",
            (vendor_id, company_id)
        )
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

# ---------------------------------------------------------------------------
# Fourth-Party / Supply Chain Risk Management DB Helpers
# ---------------------------------------------------------------------------

def create_vendor_dependency(
    company_id: int,
    upstream_vendor_id: int,
    downstream_vendor_id: int | None,
    external_vendor_name: str | None,
    external_vendor_domain: str | None,
    relationship_type: str,
    criticality: str = "MEDIUM",
    dependency_level: str = "MEDIUM",
    status: str = "ACTIVE",
    description: str | None = None,
    created_by: str | None = None
) -> dict:
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute(
        "INSERT INTO vendor_dependencies ("
        "company_id, upstream_vendor_id, downstream_vendor_id, "
        "external_vendor_name, external_vendor_domain, "
        "relationship_type, criticality, dependency_level, "
        "status, description, created_by, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            company_id, upstream_vendor_id, downstream_vendor_id,
            external_vendor_name, external_vendor_domain,
            relationship_type, criticality, dependency_level,
            status, description, created_by, now, now
        )
    )
    dep_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return get_dependency_by_id(dep_id, company_id)

def get_dependency_by_id(dependency_id: int, company_id: int) -> dict | None:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT "
        "d.*, u.name as upstream_vendor_name, u.domain as upstream_vendor_domain, "
        "u.risk_score as upstream_risk_score, u.effective_tier as upstream_tier, "
        "w.name as downstream_vendor_name, w.domain as downstream_vendor_domain, "
        "w.risk_score as downstream_risk_score, w.effective_tier as downstream_tier "
        "FROM vendor_dependencies d "
        "JOIN vendors u ON d.upstream_vendor_id = u.id "
        "LEFT JOIN vendors w ON d.downstream_vendor_id = w.id "
        "WHERE d.id = ? AND d.company_id = ?",
        (dependency_id, company_id)
    )
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_vendor_dependencies(vendor_id: int, company_id: int) -> dict:
    conn = get_db()
    cursor = conn.cursor()
    
    # 1. Direct dependencies: vendor -> downstream
    cursor.execute(
        "SELECT "
        "d.*, u.name as upstream_vendor_name, u.domain as upstream_vendor_domain, "
        "w.name as downstream_vendor_name, w.domain as downstream_vendor_domain, "
        "w.risk_score as downstream_risk_score, w.effective_tier as downstream_tier "
        "FROM vendor_dependencies d "
        "JOIN vendors u ON d.upstream_vendor_id = u.id "
        "LEFT JOIN vendors w ON d.downstream_vendor_id = w.id "
        "WHERE d.upstream_vendor_id = ? AND d.company_id = ? "
        "ORDER BY d.created_at DESC",
        (vendor_id, company_id)
    )
    direct_rows = cursor.fetchall()
    
    # 2. Dependent vendors: upstream -> vendor
    cursor.execute(
        "SELECT "
        "d.*, u.name as upstream_vendor_name, u.domain as upstream_vendor_domain, "
        "u.risk_score as upstream_risk_score, u.effective_tier as upstream_tier, "
        "w.name as downstream_vendor_name, w.domain as downstream_vendor_domain "
        "FROM vendor_dependencies d "
        "JOIN vendors u ON d.upstream_vendor_id = u.id "
        "LEFT JOIN vendors w ON d.downstream_vendor_id = w.id "
        "WHERE d.downstream_vendor_id = ? AND d.company_id = ? "
        "ORDER BY d.created_at DESC",
        (vendor_id, company_id)
    )
    dependent_rows = cursor.fetchall()
    conn.close()
    
    return {
        "vendor_id": vendor_id,
        "direct_dependencies": [dict(r) for r in direct_rows],
        "dependent_vendors": [dict(r) for r in dependent_rows]
    }

def update_vendor_dependency(dependency_id: int, company_id: int, updates: dict) -> dict | None:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM vendor_dependencies WHERE id = ? AND company_id = ?", (dependency_id, company_id))
    if not cursor.fetchone():
        conn.close()
        return None
        
    allowed_fields = [
        "downstream_vendor_id", "external_vendor_name", "external_vendor_domain",
        "relationship_type", "criticality", "dependency_level", "status", "description"
    ]
    set_clauses = []
    params = []
    
    for f in allowed_fields:
        if f in updates and updates[f] is not None:
            set_clauses.append(f"{f} = ?")
            params.append(updates[f])
            
    if not set_clauses:
        conn.close()
        return get_dependency_by_id(dependency_id, company_id)
        
    set_clauses.append("updated_at = ?")
    params.append(datetime.utcnow().isoformat())
    params.extend([dependency_id, company_id])
    
    query = "UPDATE vendor_dependencies SET " + ", ".join(set_clauses) + " WHERE id = ? AND company_id = ?"
    cursor.execute(query, tuple(params))
    conn.commit()
    conn.close()
    return get_dependency_by_id(dependency_id, company_id)

def delete_vendor_dependency(dependency_id: int, company_id: int) -> bool:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM vendor_dependencies WHERE id = ? AND company_id = ?", (dependency_id, company_id))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

def get_all_company_dependencies(company_id: int) -> list:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT "
        "d.*, u.name as upstream_vendor_name, u.domain as upstream_vendor_domain, "
        "u.risk_score as upstream_risk_score, u.effective_tier as upstream_tier, "
        "w.name as downstream_vendor_name, w.domain as downstream_vendor_domain, "
        "w.risk_score as downstream_risk_score, w.effective_tier as downstream_tier "
        "FROM vendor_dependencies d "
        "JOIN vendors u ON d.upstream_vendor_id = u.id "
        "LEFT JOIN vendors w ON d.downstream_vendor_id = w.id "
        "WHERE d.company_id = ? "
        "ORDER BY d.created_at ASC",
        (company_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

# ---------------------------------------------------------------------------
# Operational Risk Module Helpers
# ---------------------------------------------------------------------------
def get_vendor_operational_risk(vendor_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM vendor_operational_risk WHERE vendor_id = ?", (vendor_id,))
    row = cursor.fetchone()
    
    if not row:
        now = datetime.utcnow().isoformat()
        cursor.execute(
            "INSERT INTO vendor_operational_risk ("
            "vendor_id, sla_compliance_pct, monthly_downtime_hours, incident_frequency, "
            "delivery_delays_count, quality_defect_rate_pct, support_response_time_hrs, "
            "bcp_status, bcp_audit_score, dr_rto_hours, dr_rpo_hours, dr_testing_status, "
            "dependency_level, replaceability_score, updated_at) "
            "VALUES (?, 99.5, 1.0, 1, 0, 0.2, 1.5, 'VERIFIED', 85, 4.0, 1.0, 'PASSED_Q2', 'MODERATE', 70, ?)",
            (vendor_id, now)
        )
        conn.commit()
        cursor.execute("SELECT * FROM vendor_operational_risk WHERE vendor_id = ?", (vendor_id,))
        row = cursor.fetchone()
        
    conn.close()
    return dict(row) if row else {}

def upsert_vendor_operational_risk(vendor_id: int, data: dict):
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    
    cursor.execute(
        "INSERT INTO vendor_operational_risk ("
        "vendor_id, sla_compliance_pct, monthly_downtime_hours, incident_frequency, "
        "delivery_delays_count, quality_defect_rate_pct, support_response_time_hrs, "
        "bcp_status, bcp_audit_score, dr_rto_hours, dr_rpo_hours, dr_testing_status, "
        "dependency_level, replaceability_score, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
        "ON CONFLICT(vendor_id) DO UPDATE SET "
        "sla_compliance_pct = excluded.sla_compliance_pct, "
        "monthly_downtime_hours = excluded.monthly_downtime_hours, "
        "incident_frequency = excluded.incident_frequency, "
        "delivery_delays_count = excluded.delivery_delays_count, "
        "quality_defect_rate_pct = excluded.quality_defect_rate_pct, "
        "support_response_time_hrs = excluded.support_response_time_hrs, "
        "bcp_status = excluded.bcp_status, "
        "bcp_audit_score = excluded.bcp_audit_score, "
        "dr_rto_hours = excluded.dr_rto_hours, "
        "dr_rpo_hours = excluded.dr_rpo_hours, "
        "dr_testing_status = excluded.dr_testing_status, "
        "dependency_level = excluded.dependency_level, "
        "replaceability_score = excluded.replaceability_score, "
        "updated_at = excluded.updated_at",
        (
            vendor_id,
            data.get('sla_compliance_pct', 99.5),
            data.get('monthly_downtime_hours', 1.0),
            data.get('incident_frequency', 1),
            data.get('delivery_delays_count', 0),
            data.get('quality_defect_rate_pct', 0.2),
            data.get('support_response_time_hrs', 1.5),
            data.get('bcp_status', 'VERIFIED'),
            data.get('bcp_audit_score', 85),
            data.get('dr_rto_hours', 4.0),
            data.get('dr_rpo_hours', 1.0),
            data.get('dr_testing_status', 'PASSED_Q2'),
            data.get('dependency_level', 'MODERATE'),
            data.get('replaceability_score', 70),
            now
        )
    )
    conn.commit()
    conn.close()
    return get_vendor_operational_risk(vendor_id)

def get_operational_risk_summary():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute(
        "SELECT "
        "COUNT(v.id) as total_vendors, "
        "AVG(COALESCE(o.sla_compliance_pct, 99.5)) as avg_sla_compliance, "
        "SUM(COALESCE(o.monthly_downtime_hours, 1.0)) as total_downtime_hours, "
        "SUM(COALESCE(o.delivery_delays_count, 0)) as total_delivery_delays, "
        "AVG(COALESCE(o.support_response_time_hrs, 1.5)) as avg_support_mttr, "
        "SUM(CASE WHEN o.dependency_level = 'HIGH_SINGLE_POINT' THEN 1 ELSE 0 END) as high_spof_count, "
        "SUM(CASE WHEN o.bcp_status = 'VERIFIED' THEN 1 ELSE 0 END) as bcp_verified_count, "
        "SUM(CASE WHEN o.dr_testing_status IN ('PASSED_Q1', 'PASSED_Q2', 'PASSED_Q3', 'PASSED_Q4') THEN 1 ELSE 0 END) as dr_passed_count "
        "FROM vendors v "
        "LEFT JOIN vendor_operational_risk o ON v.id = o.vendor_id"
    )
    row = cursor.fetchone()
    conn.close()
    
    res = dict(row) if row else {}
    total = res.get('total_vendors', 0) or 1
    return {
        "total_vendors": res.get('total_vendors', 0),
        "avg_sla_compliance": round(res.get('avg_sla_compliance', 99.5) or 99.5, 2),
        "total_downtime_hours": round(res.get('total_downtime_hours', 0.0) or 0.0, 1),
        "total_delivery_delays": res.get('total_delivery_delays', 0) or 0,
        "avg_support_mttr_hrs": round(res.get('avg_support_mttr', 1.5) or 1.5, 1),
        "high_spof_dependency_count": res.get('high_spof_count', 0) or 0,
        "bcp_verification_rate": round(((res.get('bcp_verified_count', 0) or 0) / total) * 100, 1),
        "dr_test_pass_rate": round(((res.get('dr_passed_count', 0) or 0) / total) * 100, 1)
    }

# ---------------------------------------------------------------------------
# Document Management
# ---------------------------------------------------------------------------

def add_document(company_id: int, vendor_id: int, uploader_id: int, document_type: str, original_filename: str, object_id: str, size_bytes: int, expiry_date: str, wrapped_dek: str, integrity_hash: str):
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute(
        "INSERT INTO documents ("
        "company_id, vendor_id, uploader_id, document_type, original_filename, object_id, "
        "size_bytes, upload_timestamp, expiry_date, wrapped_dek, integrity_hash) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (company_id, vendor_id, uploader_id, document_type, original_filename, object_id, size_bytes, now, expiry_date, wrapped_dek, integrity_hash)
    )
    conn.commit()
    doc_id = cursor.lastrowid
    conn.close()
    return doc_id

def get_vendor_documents(vendor_id: int, company_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT d.*, u.name as uploader_name, u.email as uploader_email "
        "FROM documents d LEFT JOIN users u ON d.uploader_id = u.id "
        "WHERE d.vendor_id = ? AND d.company_id = ? "
        "ORDER BY d.upload_timestamp DESC",
        (vendor_id, company_id)
    )
    docs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return docs

def get_document_by_id(document_id: int, company_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT d.*, v.name as vendor_name "
        "FROM documents d LEFT JOIN vendors v ON d.vendor_id = v.id "
        "WHERE d.id = ? AND d.company_id = ?",
        (document_id, company_id)
    )
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

# ---------------------------------------------------------------------------
# Alert Management CRUD
# ---------------------------------------------------------------------------

def create_alert(company_id: int, vendor_id: int, alert_type: str, severity: str, title: str, message: str, dedup_key: str, metadata_json: str = "{}") -> int | None:
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    try:
        cursor.execute(
            "INSERT INTO alerts (company_id, vendor_id, alert_type, severity, status, title, message, metadata_json, dedup_key, created_at) "
            "VALUES (?, ?, ?, ?, 'UNREAD', ?, ?, ?, ?, ?)",
            (company_id, vendor_id, alert_type, severity, title, message, metadata_json, dedup_key, now)
        )
        conn.commit()
        alert_id = cursor.lastrowid
        return alert_id
    except Exception as e:
        if "UNIQUE" in str(e).upper():
            return None
        raise
    finally:
        conn.close()

def get_alerts(company_id: int, vendor_id: int = None, alert_type: str = None, status: str = None) -> list[dict]:
    conn = get_db()
    cursor = conn.cursor()
    query = (
        "SELECT a.*, v.name as vendor_name, v.domain as vendor_domain "
        "FROM alerts a LEFT JOIN vendors v ON a.vendor_id = v.id "
        "WHERE a.company_id = ?"
    )
    params = [company_id]
    if vendor_id is not None:
        query += " AND a.vendor_id = ?"
        params.append(vendor_id)
    if alert_type:
        query += " AND a.alert_type = ?"
        params.append(alert_type)
    if status:
        query += " AND a.status = ?"
        params.append(status)
    query += " ORDER BY a.created_at DESC"
    cursor.execute(query, params)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

def get_alert_by_id(alert_id: int, company_id: int) -> dict | None:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT a.*, v.name as vendor_name, v.domain as vendor_domain "
        "FROM alerts a LEFT JOIN vendors v ON a.vendor_id = v.id "
        "WHERE a.id = ? AND a.company_id = ?",
        (alert_id, company_id)
    )
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def mark_alert_read(alert_id: int, company_id: int) -> bool:
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute("UPDATE alerts SET status = 'READ', read_at = ? WHERE id = ? AND company_id = ? AND status = 'UNREAD'", (now, alert_id, company_id))
    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return updated

def mark_alert_acknowledged(alert_id: int, company_id: int) -> bool:
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute("UPDATE alerts SET status = 'ACKNOWLEDGED', acknowledged_at = ? WHERE id = ? AND company_id = ? AND (status = 'UNREAD' OR status = 'READ')", (now, alert_id, company_id))
    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return updated

def get_unread_alert_count(company_id: int) -> int:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as cnt FROM alerts WHERE company_id = ? AND status = 'UNREAD'", (company_id,))
    row = cursor.fetchone()
    conn.close()
    return row["cnt"] if row else 0

def add_alert(company_id: int, vendor_id: int, alert_type: str, severity: str, title: str, description: str = None) -> int | None:
    dedup_key = f"{company_id}:{vendor_id}:{alert_type}:{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"
    return create_alert(
        company_id=company_id,
        vendor_id=vendor_id,
        alert_type=alert_type,
        severity=severity,
        title=title,
        message=description or title,
        dedup_key=dedup_key
    )


