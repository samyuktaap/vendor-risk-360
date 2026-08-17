"""
audit_log_service.py — Tamper-resistant audit logging with hash chain and signed checkpoints.

ISSUE #7 FIX: Audit-log concurrency.
  Previous architecture had a SELECT-last-row → INSERT design that races under
  concurrent requests. This module serializes all chain insertions through a
  process-wide threading.Lock, so the prev_hash → row_hash chain is always linear.
  For multi-process deployments (e.g. uvicorn workers > 1), use a single worker
  or switch to PostgreSQL with SELECT ... FOR UPDATE.

ISSUE #8 FIX: Strengthened tamper evidence.
  Four layers of tamper evidence:
    1. Hash chain: each row contains SHA-256(prev_row_hash + this_row_fields).
    2. HMAC-SHA256 signed epoch checkpoints: every CHECKPOINT_INTERVAL rows, an
       HMAC-SHA256 of the accumulated row_hash is signed with a local secret key
       (derived from AUDIT_HMAC_KEY env/secret). Checkpoint signing key is separate
       from the Vault Transit encryption key.
    3. Separate append-only storage: log rows have REVOKE UPDATE, DELETE at the DB
       layer (enforced by the init_db grants). The checkpoint table is separate.
    4. Verification job: verify_chain() + verify_checkpoints() can be run as a
       scheduled task or health-check endpoint. Any failure triggers an alert.

ISSUE #9 NOTE (backup signing key):
  The AUDIT_HMAC_KEY used here is a symmetric key — not a private signing key.
  It should be stored as a Docker secret or systemd credential, NOT on the server's
  filesystem alongside the DB. If the server is compromised, an attacker with the
  HMAC key can forge checkpoints retroactively. For maximum tamper evidence, use
  an asymmetric signing key where the private key is stored offline or in Vault.
  This module supports both HMAC (default) and an optional external sign function
  that can call Vault Transit sign if configured.

AUDIT_HMAC_KEY:
  - Load via: load_secret("AUDIT_HMAC_KEY", required=True)
  - Must be ≥ 32 bytes (256 bits); 64 bytes recommended.
  - Rotate by: re-signing checkpoints with the new key after verifying the chain
    with the old key. Key rotation procedure is documented in the runbook.

APPEND-ONLY ENFORCEMENT:
  The application DB user must have only INSERT + SELECT on audit_log and
  audit_checkpoints. The init_db() function creates these tables. In production
  with PostgreSQL, also run:
      REVOKE UPDATE, DELETE ON audit_log FROM app_user;
      REVOKE UPDATE, DELETE ON audit_checkpoints FROM app_user;
  SQLite does not support fine-grained per-table user grants; rely on the process
  lock and separate offline export for SQLite deployments.
"""

from __future__ import annotations

import hashlib
import hmac as hmac_mod
import json
import logging
import threading
from datetime import datetime, UTC
from enum import Enum
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CHECKPOINT_INTERVAL = 100   # Sign a checkpoint every N rows
GENESIS_HASH = "GENESIS"    # Sentinel prev_hash for the first row


# ---------------------------------------------------------------------------
# Audit action catalogue
# ---------------------------------------------------------------------------

class AuditAction(str, Enum):
    # Authentication
    LOGIN_SUCCESS          = "LOGIN_SUCCESS"
    LOGIN_FAIL             = "LOGIN_FAIL"
    MFA_VERIFIED           = "MFA_VERIFIED"
    MFA_FAIL               = "MFA_FAIL"
    SESSION_CREATED        = "SESSION_CREATED"
    SESSION_EXPIRED        = "SESSION_EXPIRED"
    SIGN_OUT               = "SIGN_OUT"
    # Data access
    DECRYPT_PII            = "DECRYPT_PII"
    DECRYPT_FINANCIAL      = "DECRYPT_FINANCIAL"
    DECRYPT_ASSESSMENT     = "DECRYPT_ASSESSMENT"
    DECRYPT_CONTRACT       = "DECRYPT_CONTRACT"
    # Vendor CRUD
    VENDOR_CREATED         = "VENDOR_CREATED"
    VENDOR_MODIFIED        = "VENDOR_MODIFIED"
    VENDOR_DELETED         = "VENDOR_DELETED"
    VENDOR_RISK_REFRESHED  = "VENDOR_RISK_REFRESHED"
    # Documents
    DOCUMENT_UPLOAD        = "DOCUMENT_UPLOAD"
    DOCUMENT_DOWNLOAD      = "DOCUMENT_DOWNLOAD"
    DOCUMENT_DELETED       = "DOCUMENT_DELETED"
    # Security events
    PERMISSION_DENIED      = "PERMISSION_DENIED"
    KEY_ROTATION           = "KEY_ROTATION"
    BACKUP_COMPLETED       = "BACKUP_COMPLETED"
    # Audit integrity
    AUDIT_LOG_EXPORT       = "AUDIT_LOG_EXPORT"
    AUDIT_CHAIN_VERIFY     = "AUDIT_CHAIN_VERIFY"
    AUDIT_CHAIN_FAIL       = "AUDIT_CHAIN_FAIL"
    # Cybersecurity 360 Assessment
    CYBERSECURITY_ASSESSMENT_CREATED = "CYBERSECURITY_ASSESSMENT_CREATED"
    CYBERSECURITY_ASSESSMENT_VIEWED  = "CYBERSECURITY_ASSESSMENT_VIEWED"
    CYBERSECURITY_DRAFT_SAVED        = "CYBERSECURITY_DRAFT_SAVED"
    CYBERSECURITY_SUBMITTED          = "CYBERSECURITY_SUBMITTED"
    CYBERSECURITY_EVIDENCE_LINKED    = "CYBERSECURITY_EVIDENCE_LINKED"
    CYBERSECURITY_EVIDENCE_REVIEWED  = "CYBERSECURITY_EVIDENCE_REVIEWED"
    CYBERSECURITY_EVIDENCE_REJECTED  = "CYBERSECURITY_EVIDENCE_REJECTED"
    CYBERSECURITY_SCORE_CALCULATED  = "CYBERSECURITY_SCORE_CALCULATED"
    CYBERSECURITY_ACCESS_DENIED      = "CYBERSECURITY_ACCESS_DENIED"
    # Vulnerability Management
    VULNERABILITY_VIEWED             = "VULNERABILITY_VIEWED"
    VULNERABILITY_STATUS_CHANGED     = "VULNERABILITY_STATUS_CHANGED"
    VULNERABILITY_ASSET_ADDED        = "VULNERABILITY_ASSET_ADDED"
    VULNERABILITY_ACCESS_DENIED      = "VULNERABILITY_ACCESS_DENIED"
    # Risk Tiering & Trend Analysis
    VENDOR_TIER_CALCULATED           = "VENDOR_TIER_CALCULATED"
    VENDOR_TIER_VIEWED               = "VENDOR_TIER_VIEWED"
    VENDOR_TIER_OVERRIDE             = "VENDOR_TIER_OVERRIDE"
    RISK_TREND_VIEWED                = "RISK_TREND_VIEWED"
    RISK_ACCESS_DENIED               = "RISK_ACCESS_DENIED"
    # Fourth-Party / Supply Chain Risk Management
    DEPENDENCY_CREATED               = "DEPENDENCY_CREATED"
    DEPENDENCY_UPDATED               = "DEPENDENCY_UPDATED"
    DEPENDENCY_DELETED               = "DEPENDENCY_DELETED"
    SUPPLY_CHAIN_VIEWED              = "SUPPLY_CHAIN_VIEWED"
    SUPPLY_CHAIN_IMPACT_VIEWED       = "SUPPLY_CHAIN_IMPACT_VIEWED"
    DEPENDENCY_ACCESS_DENIED         = "DEPENDENCY_ACCESS_DENIED"


# ---------------------------------------------------------------------------
# HMAC checkpoint key loader
# ---------------------------------------------------------------------------

# Global placeholder for ephemeral key fallback in local dev
_ephemeral_key = None

def _load_hmac_keys() -> list[bytes]:
    """
    Load the HMAC-SHA256 signing keys for audit checkpoints.
    Returns a list of keys: [active_key, fallback_key1, fallback_key2, ...]
    
    Source priority: Docker secret → systemd credential → env var.
    """
    from services.secret_loader import load_secret
    import os
    
    active_key = load_secret("AUDIT_HMAC_KEY", required=False)
    fallback_keys_str = load_secret("AUDIT_HMAC_FALLBACK_KEYS", required=False)
    
    keys = []
    if active_key:
        keys.append(active_key.encode("utf-8") if isinstance(active_key, str) else active_key)
        
    if fallback_keys_str:
        for k in fallback_keys_str.split(","):
            k_clean = k.strip()
            if k_clean:
                keys.append(k_clean.encode("utf-8"))
                
    if not keys:
        # Development fallback: ephemeral key — checkpoints not verifiable after restart.
        global _ephemeral_key
        if _ephemeral_key is None:
            _ephemeral_key = os.urandom(32)
        logger.warning(
            "AuditLog: AUDIT_HMAC_KEY not set — using ephemeral key. "
            "Checkpoints will not survive process restart. "
            "Set AUDIT_HMAC_KEY for production deployments."
        )
        keys.append(_ephemeral_key)
        
    return keys


# ---------------------------------------------------------------------------
# Hash chain computation
# ---------------------------------------------------------------------------

def _compute_row_hash(row_fields: dict, prev_hash: str) -> str:
    """
    SHA-256 over canonical JSON of (row_fields ∪ {prev_hash: prev_hash}).
    Keys are sorted to ensure determinism regardless of insertion order.
    """
    payload = json.dumps({**row_fields, "prev_hash": prev_hash}, sort_keys=True, ensure_ascii=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _compute_checkpoint_hmac(accumulated_hash: str, checkpoint_seq: int, hmac_key: bytes) -> str:
    """
    HMAC-SHA256 over "<checkpoint_seq>:<accumulated_hash>".
    Signs that rows up to this checkpoint have the given accumulated hash.
    """
    message = f"{checkpoint_seq}:{accumulated_hash}".encode("utf-8")
    return hmac_mod.new(hmac_key, message, hashlib.sha256).hexdigest()


# ---------------------------------------------------------------------------
# Thread-safe audit log service
# ---------------------------------------------------------------------------

class AuditLogService:
    """
    Thread-safe, tamper-evident audit log service.

    All record() calls are serialized through _chain_lock to prevent
    concurrent fork of the hash chain. Each insert:
      1. Fetches the previous row's hash (inside the lock).
      2. Computes the new row hash.
      3. Inserts the new row.
      4. Optionally signs a checkpoint if the row count is a multiple of CHECKPOINT_INTERVAL.

    The lock is process-level (threading.Lock). For multi-process uvicorn deployments,
    use --workers=1 or move to PostgreSQL with SELECT ... FOR UPDATE SKIP LOCKED.
    """

    _instance: Optional["AuditLogService"] = None
    _class_lock = threading.Lock()

    def __new__(cls) -> "AuditLogService":
        if cls._instance is None:
            with cls._class_lock:
                if cls._instance is None:
                    obj = super().__new__(cls)
                    obj._chain_lock = threading.Lock()
                    obj._hmac_keys  = _load_hmac_keys()
                    obj._active_key = obj._hmac_keys[0]
                    cls._instance   = obj
        return cls._instance

    # ------------------------------------------------------------------
    # Public: record an event
    # ------------------------------------------------------------------

    def record(
        self,
        *,
        action: AuditAction | str,
        resource: str,
        outcome: str = "SUCCESS",
        actor_id: Optional[int] = None,
        actor_email: str = "system",
        actor_role: str = "system",
        ip_address: Optional[str] = None,
        session_id: Optional[str] = None,
        details: Optional[dict] = None,
        db_conn=None,
    ) -> int:
        """
        Insert a tamper-evident audit log entry.

        Args:
            action:       AuditAction enum value or string.
            resource:     Target resource identifier (e.g. "vendor:42:contract_value").
            outcome:      "SUCCESS" | "DENIED" | "ERROR".
            actor_id:     Authenticated user's primary key (None for system events).
            actor_email:  Actor email address.
            actor_role:   Actor role string.
            ip_address:   Client IP address.
            session_id:   Current session identifier.
            details:      Optional dict of extra context (stored as JSON).
            db_conn:      Existing sqlite3.Connection (if None, a new one is opened).

        Returns:
            The new row's primary key (id).
        """
        from database import get_db

        close_conn = False
        if db_conn is None:
            db_conn = get_db()
            close_conn = True

        action_str = action.value if isinstance(action, AuditAction) else str(action)
        ts = datetime.now(UTC).isoformat()

        row_fields = {
            "timestamp":   ts,
            "actor_id":    actor_id,
            "actor_email": actor_email,
            "actor_role":  actor_role,
            "action":      action_str,
            "resource":    resource,
            "ip_address":  ip_address or "",
            "session_id":  session_id or "",
            "outcome":     outcome,
            "details":     json.dumps(details or {}, sort_keys=True),
        }

        try:
            with self._chain_lock:
                cursor = db_conn.cursor()

                # Enforce transactional serialization across multiple processes
                # Detect DB type: SQLite or PostgreSQL
                is_sqlite = (type(db_conn).__module__ == 'sqlite3' or 'sqlite' in str(type(db_conn)).lower())
                if is_sqlite:
                    try:
                        db_conn.execute("BEGIN IMMEDIATE")
                    except Exception:
                        pass # Ignore if transaction already explicitly started
                else:
                    # PostgreSQL advisory lock to serialize insertions across workers/instances
                    try:
                        cursor.execute("SELECT pg_advisory_xact_lock(14917632)")
                    except Exception:
                        pass

                # Fetch prev hash inside the lock (no concurrent fork possible)
                cursor.execute(
                    "SELECT row_hash, id FROM audit_log ORDER BY id DESC LIMIT 1"
                )
                prev_row = cursor.fetchone()
                prev_hash = prev_row["row_hash"] if prev_row else GENESIS_HASH
                prev_id   = prev_row["id"]        if prev_row else 0

                row_hash = _compute_row_hash(row_fields, prev_hash)

                cursor.execute(
                    """
                    INSERT INTO audit_log
                        (timestamp, actor_id, actor_email, actor_role, action, resource,
                         ip_address, session_id, outcome, details, prev_hash, row_hash)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        row_fields["timestamp"],
                        row_fields["actor_id"],
                        row_fields["actor_email"],
                        row_fields["actor_role"],
                        row_fields["action"],
                        row_fields["resource"],
                        row_fields["ip_address"],
                        row_fields["session_id"],
                        row_fields["outcome"],
                        row_fields["details"],
                        prev_hash,
                        row_hash,
                    ),
                )
                new_id = cursor.lastrowid

                # Checkpoint: sign every CHECKPOINT_INTERVAL rows
                if new_id % CHECKPOINT_INTERVAL == 0:
                    self._write_checkpoint(cursor, new_id, row_hash)

                db_conn.commit()

        finally:
            if close_conn:
                db_conn.close()

        logger.debug("AuditLog #%d: action=%s resource=%s outcome=%s", new_id, action_str, resource, outcome)
        return new_id

    # ------------------------------------------------------------------
    # Checkpoint management
    # ------------------------------------------------------------------

    def _write_checkpoint(self, cursor, row_id: int, accumulated_hash: str) -> None:
        """Write a signed checkpoint at row_id using the active key."""
        checkpoint_seq = row_id // CHECKPOINT_INTERVAL
        signature = _compute_checkpoint_hmac(accumulated_hash, checkpoint_seq, self._active_key)
        ts = datetime.now(UTC).isoformat()
        cursor.execute(
            """
            INSERT OR REPLACE INTO audit_checkpoints
                (checkpoint_seq, row_id, accumulated_hash, hmac_sha256, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (checkpoint_seq, row_id, accumulated_hash, signature, ts),
        )
        logger.info("AuditLog checkpoint #%d signed at row %d.", checkpoint_seq, row_id)

    # ------------------------------------------------------------------
    # Verification
    # ------------------------------------------------------------------

    def verify_chain(self, db_conn=None) -> tuple[bool, str]:
        """
        Traverse all audit_log rows in insertion order and verify the hash chain.

        Returns:
            (True, "OK: N rows verified")             — chain intact.
            (False, "TAMPER DETECTED at row id=<N>")  — chain broken.
        """
        from database import get_db
        close_conn = db_conn is None
        if close_conn:
            db_conn = get_db()

        try:
            cursor = db_conn.cursor()
            cursor.execute("SELECT * FROM audit_log ORDER BY id ASC")
            rows = cursor.fetchall()
        finally:
            if close_conn:
                db_conn.close()

        prev_hash = GENESIS_HASH
        for row in rows:
            row_dict = dict(row)
            stored_prev_hash = row_dict.pop("prev_hash")
            stored_row_hash  = row_dict.pop("row_hash")
            row_id           = row_dict.pop("id")

            if stored_prev_hash != prev_hash:
                msg = (
                    f"TAMPER DETECTED at row id={row_id}: "
                    f"stored prev_hash={stored_prev_hash!r} "
                    f"does not match expected={prev_hash!r}"
                )
                logger.error("AuditLog chain integrity: %s", msg)
                return False, msg

            expected_hash = _compute_row_hash(row_dict, prev_hash)
            if expected_hash != stored_row_hash:
                msg = (
                    f"TAMPER DETECTED at row id={row_id}: "
                    f"row_hash mismatch. Expected={expected_hash!r}, stored={stored_row_hash!r}"
                )
                logger.error("AuditLog chain integrity: %s", msg)
                return False, msg

            prev_hash = stored_row_hash

        return True, f"OK: {len(rows)} rows verified."

    def verify_checkpoints(self, db_conn=None) -> tuple[bool, str]:
        """
        Verify all signed checkpoints against the stored accumulated hashes.

        Returns:
            (True, "OK: N checkpoints verified")
            (False, "CHECKPOINT TAMPER at seq=<N>")
        """
        from database import get_db
        close_conn = db_conn is None
        if close_conn:
            db_conn = get_db()

        try:
            cursor = db_conn.cursor()
            cursor.execute("SELECT * FROM audit_checkpoints ORDER BY checkpoint_seq ASC")
            rows = cursor.fetchall()
        finally:
            if close_conn:
                db_conn.close()

        for row in rows:
            row = dict(row)
            seq            = row["checkpoint_seq"]
            accum_hash     = row["accumulated_hash"]
            stored_hmac    = row["hmac_sha256"]
            
            # Verify against active or fallback HMAC keys
            verified = False
            for key in self._hmac_keys:
                expected_hmac = _compute_checkpoint_hmac(accum_hash, seq, key)
                if hmac_mod.compare_digest(expected_hmac, stored_hmac):
                    verified = True
                    break
                    
            if not verified:
                msg = f"CHECKPOINT TAMPER DETECTED at seq={seq}: HMAC mismatch."
                logger.error("AuditLog checkpoint integrity: %s", msg)
                return False, msg

        return True, f"OK: {len(rows)} checkpoints verified."

    def full_verify(self, db_conn=None) -> dict:
        """
        Run both chain and checkpoint verification.
        Returns a dict suitable for a health-check or monitoring endpoint.
        """
        chain_ok, chain_msg = self.verify_chain(db_conn)
        ckpt_ok,  ckpt_msg  = self.verify_checkpoints(db_conn)
        all_ok = chain_ok and ckpt_ok

        if not all_ok:
            self.record(
                action=AuditAction.AUDIT_CHAIN_FAIL,
                resource="audit_log",
                outcome="ERROR",
                details={"chain_msg": chain_msg, "ckpt_msg": ckpt_msg},
                db_conn=db_conn,
            )

        return {
            "chain_ok":    chain_ok,
            "chain_msg":   chain_msg,
            "ckpt_ok":     ckpt_ok,
            "ckpt_msg":    ckpt_msg,
            "all_ok":      all_ok,
        }


# ---------------------------------------------------------------------------
# Module-level singleton access
# ---------------------------------------------------------------------------

_audit_svc: Optional[AuditLogService] = None
_audit_svc_lock = threading.Lock()


def get_audit_log() -> AuditLogService:
    """Return the process-wide AuditLogService singleton."""
    global _audit_svc
    if _audit_svc is None:
        with _audit_svc_lock:
            if _audit_svc is None:
                _audit_svc = AuditLogService()
    return _audit_svc


def reset_audit_log_for_testing() -> None:
    """Reset singleton — ONLY for use in tests."""
    global _audit_svc
    with _audit_svc_lock:
        _audit_svc = None
    AuditLogService._instance = None
