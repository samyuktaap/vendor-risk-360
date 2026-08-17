"""
alert_engine.py — Alert generation logic for VendorRisk 360.

All alerts are generated from REAL database events only.
No fake/demo alerts are created.

Configurable thresholds via environment variables:
  ALERT_HIGH_RISK_THRESHOLD  (default: 70) — risk_score to be HIGH_RISK_VENDOR
  ALERT_MAJOR_CHANGE_DELTA   (default: 20) — absolute score delta for MAJOR_RISK_CHANGE
  ALERT_CERT_EXPIRY_DAYS     (default: 30) — days-before-expiry for CERTIFICATION_EXPIRING

Alert dedup keys (UNIQUE constraint prevents duplicates):
  HIGH_RISK_VENDOR    → "HIGH_RISK:{vendor_id}:{score_bucket}"
  MAJOR_RISK_CHANGE   → "MAJOR_CHANGE:{vendor_id}:{old_bucket}:{new_bucket}:{date}"
  ASSESSMENT_OVERDUE  → "ASSESSMENT_OVERDUE:{assessment_id}"
  CERT_EXPIRING       → "CERT_EXPIRING:{framework_id}:{expiry_date_bucket}"
  CERT_EXPIRED        → "CERT_EXPIRED:{framework_id}:{expiry_date}"
"""
import os
import json
import logging
from datetime import datetime, timedelta, UTC

from database import (
    get_db,
    create_alert,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configurable thresholds
# ---------------------------------------------------------------------------
HIGH_RISK_THRESHOLD: int = int(os.getenv("ALERT_HIGH_RISK_THRESHOLD", "70"))
MAJOR_CHANGE_DELTA:  int = int(os.getenv("ALERT_MAJOR_CHANGE_DELTA", "20"))
CERT_EXPIRY_DAYS:    int = int(os.getenv("ALERT_CERT_EXPIRY_DAYS", "30"))

# Score bucket: groups of 10 — prevents re-alerting within same bucket on minor fluctuations
def _score_bucket(score: int) -> int:
    return (score // 10) * 10


# ---------------------------------------------------------------------------
# Rule 1 — HIGH_RISK_VENDOR
# ---------------------------------------------------------------------------
def evaluate_high_risk_vendor(
    vendor_id: int,
    company_id: int,
    new_score: int,
    vendor_name: str,
) -> int | None:
    """
    Creates HIGH_RISK_VENDOR alert when a vendor's risk_score >= HIGH_RISK_THRESHOLD.
    Dedup key includes score bucket so the alert fires once per bucket, not every refresh.
    """
    if new_score < HIGH_RISK_THRESHOLD:
        return None

    bucket = _score_bucket(new_score)
    dedup_key = f"HIGH_RISK:{vendor_id}:{bucket}"

    alert_id = create_alert(
        company_id=company_id,
        vendor_id=vendor_id,
        alert_type="HIGH_RISK_VENDOR",
        severity="CRITICAL",
        title=f"High-Risk Vendor: {vendor_name}",
        message=(
            f"Vendor '{vendor_name}' has reached a risk score of {new_score}/100, "
            f"exceeding the HIGH_RISK threshold of {HIGH_RISK_THRESHOLD}. "
            "Immediate review recommended."
        ),
        dedup_key=dedup_key,
        metadata_json=json.dumps({
            "vendor_name": vendor_name,
            "risk_score": new_score,
            "threshold": HIGH_RISK_THRESHOLD,
        }),
    )
    if alert_id:
        logger.info("Alert HIGH_RISK_VENDOR created: id=%s vendor=%s score=%s", alert_id, vendor_name, new_score)
    return alert_id


# ---------------------------------------------------------------------------
# Rule 2 — MAJOR_RISK_CHANGE
# ---------------------------------------------------------------------------
def evaluate_major_risk_change(
    vendor_id: int,
    company_id: int,
    old_score: int,
    new_score: int,
    vendor_name: str,
) -> int | None:
    """
    Creates MAJOR_RISK_CHANGE alert when |new_score - old_score| >= MAJOR_CHANGE_DELTA.
    Dedup key uses a date component so the same day doesn't duplicate but different days do.
    """
    delta = abs(new_score - old_score)
    if delta < MAJOR_CHANGE_DELTA:
        return None

    today = datetime.now(UTC).strftime("%Y-%m-%d")
    old_bucket = _score_bucket(old_score)
    new_bucket = _score_bucket(new_score)
    dedup_key = f"MAJOR_CHANGE:{vendor_id}:{old_bucket}:{new_bucket}:{today}"

    direction = "increased" if new_score > old_score else "decreased"
    alert_id = create_alert(
        company_id=company_id,
        vendor_id=vendor_id,
        alert_type="MAJOR_RISK_CHANGE",
        severity="HIGH",
        title=f"Major Risk Score Change: {vendor_name}",
        message=(
            f"Vendor '{vendor_name}' risk score {direction} by {delta} points "
            f"({old_score} → {new_score}/100), exceeding the major-change threshold of {MAJOR_CHANGE_DELTA}."
        ),
        dedup_key=dedup_key,
        metadata_json=json.dumps({
            "vendor_name": vendor_name,
            "old_score": old_score,
            "new_score": new_score,
            "delta": delta,
            "direction": direction,
        }),
    )
    if alert_id:
        logger.info("Alert MAJOR_RISK_CHANGE created: id=%s vendor=%s %s→%s", alert_id, vendor_name, old_score, new_score)
    return alert_id


# ---------------------------------------------------------------------------
# Rule 3 — ASSESSMENT_OVERDUE
# ---------------------------------------------------------------------------
def evaluate_assessment_alerts(company_id: int) -> list[int]:
    """
    Scans all assessments for the company that:
      - Have a `next_due_at` column set on the assessments table (if present)
      - OR have status = DRAFT and created_at > 90 days ago (generic overdue heuristic)
    
    NOTE: The existing `assessments` table has `status` (DRAFT/SUBMITTED) and `created_at`.
    We treat any DRAFT assessment older than 90 days as overdue.
    """
    conn = get_db()
    cursor = conn.cursor()

    # Assessments that are still DRAFT and created > 90 days ago
    ninety_days_ago = (datetime.now(UTC) - timedelta(days=90)).isoformat()
    cursor.execute("""
        SELECT a.id as assessment_id, a.vendor_id, a.created_at, v.name as vendor_name, v.company_id
        FROM assessments a
        JOIN vendors v ON a.vendor_id = v.id
        WHERE v.company_id = ?
          AND a.status = 'DRAFT'
          AND a.created_at < ?
          AND a.submitted_at IS NULL
    """, (company_id, ninety_days_ago))
    rows = cursor.fetchall()
    conn.close()

    created_ids = []
    for row in rows:
        assessment_id = row["assessment_id"]
        vendor_id = row["vendor_id"]
        vendor_name = row["vendor_name"]
        dedup_key = f"ASSESSMENT_OVERDUE:{assessment_id}"

        alert_id = create_alert(
            company_id=company_id,
            vendor_id=vendor_id,
            alert_type="ASSESSMENT_OVERDUE",
            severity="HIGH",
            title=f"Overdue Assessment: {vendor_name}",
            message=(
                f"A risk assessment for vendor '{vendor_name}' has been in DRAFT status "
                f"since {row['created_at'][:10]} without being submitted. "
                "Assessment is now overdue. Please review and submit."
            ),
            dedup_key=dedup_key,
            metadata_json=json.dumps({
                "vendor_name": vendor_name,
                "assessment_id": assessment_id,
                "created_at": row["created_at"],
            }),
        )
        if alert_id:
            created_ids.append(alert_id)
            logger.info("Alert ASSESSMENT_OVERDUE created: id=%s vendor=%s", alert_id, vendor_name)
    return created_ids


# ---------------------------------------------------------------------------
# Rules 4 & 5 — CERTIFICATION_EXPIRING / CERTIFICATION_EXPIRED
# ---------------------------------------------------------------------------
def evaluate_certification_alerts(company_id: int) -> list[int]:
    """
    Scans compliance_frameworks for the company and creates:
      - CERTIFICATION_EXPIRING if next_due_at is within CERT_EXPIRY_DAYS days
      - CERTIFICATION_EXPIRED  if next_due_at is in the past
    """
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT cf.id as framework_id, cf.vendor_id, cf.framework_name, cf.next_due_at,
               v.name as vendor_name
        FROM compliance_frameworks cf
        JOIN vendors v ON cf.vendor_id = v.id
        WHERE v.company_id = ?
          AND cf.next_due_at IS NOT NULL
    """, (company_id,))
    rows = cursor.fetchall()
    conn.close()

    now = datetime.now(UTC)
    expiry_window = now + timedelta(days=CERT_EXPIRY_DAYS)
    created_ids = []

    for row in rows:
        framework_id = row["framework_id"]
        vendor_id = row["vendor_id"]
        vendor_name = row["vendor_name"]
        framework_name = row["framework_name"]
        next_due_str = row["next_due_at"]

        try:
            next_due = datetime.fromisoformat(next_due_str.replace("Z", "+00:00"))
            if next_due.tzinfo is None:
                next_due = next_due.replace(tzinfo=UTC)
        except Exception:
            continue  # Skip malformed dates

        expiry_date = next_due.strftime("%Y-%m-%d")

        if next_due < now:
            # CERTIFICATION_EXPIRED
            dedup_key = f"CERT_EXPIRED:{framework_id}:{expiry_date}"
            alert_id = create_alert(
                company_id=company_id,
                vendor_id=vendor_id,
                alert_type="CERTIFICATION_EXPIRED",
                severity="CRITICAL",
                title=f"Certification Expired: {vendor_name} — {framework_name}",
                message=(
                    f"The {framework_name} certification for vendor '{vendor_name}' "
                    f"expired on {expiry_date}. Immediate renewal or vendor escalation required."
                ),
                dedup_key=dedup_key,
                metadata_json=json.dumps({
                    "vendor_name": vendor_name,
                    "framework_name": framework_name,
                    "framework_id": framework_id,
                    "expiry_date": expiry_date,
                }),
            )
            if alert_id:
                created_ids.append(alert_id)
                logger.info("Alert CERTIFICATION_EXPIRED created: id=%s vendor=%s cert=%s", alert_id, vendor_name, framework_name)

        elif next_due <= expiry_window:
            # CERTIFICATION_EXPIRING
            days_left = (next_due - now).days
            # Bucket by week to avoid re-alerting on every API call
            week_bucket = days_left // 7
            dedup_key = f"CERT_EXPIRING:{framework_id}:{expiry_date}:{week_bucket}"
            alert_id = create_alert(
                company_id=company_id,
                vendor_id=vendor_id,
                alert_type="CERTIFICATION_EXPIRING",
                severity="HIGH",
                title=f"Certification Expiring Soon: {vendor_name} — {framework_name}",
                message=(
                    f"The {framework_name} certification for vendor '{vendor_name}' "
                    f"will expire in approximately {days_left} day(s) on {expiry_date}. "
                    "Plan for renewal immediately."
                ),
                dedup_key=dedup_key,
                metadata_json=json.dumps({
                    "vendor_name": vendor_name,
                    "framework_name": framework_name,
                    "framework_id": framework_id,
                    "expiry_date": expiry_date,
                    "days_until_expiry": days_left,
                }),
            )
            if alert_id:
                created_ids.append(alert_id)
                logger.info("Alert CERTIFICATION_EXPIRING created: id=%s vendor=%s cert=%s days=%s", alert_id, vendor_name, framework_name, days_left)

    return created_ids


# ---------------------------------------------------------------------------
# Scheduled check — runs all passive rules (no trigger needed)
# ---------------------------------------------------------------------------
def run_all_scheduled_checks(company_id: int) -> dict:
    """
    Evaluate all passive alert rules for a company.
    Safe to call on every GET /api/alerts — idempotent via dedup keys.
    Returns counts of alerts created per category.
    """
    assessment_ids = evaluate_assessment_alerts(company_id)
    cert_ids = evaluate_certification_alerts(company_id)
    return {
        "assessment_overdue": len(assessment_ids),
        "certification": len(cert_ids),
        "total_new": len(assessment_ids) + len(cert_ids),
    }
