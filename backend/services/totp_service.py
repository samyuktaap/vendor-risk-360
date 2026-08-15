"""
totp_service.py — TOTP MFA with enforced replay protection and rate limiting.

ISSUE #6 FIX: Actual TOTP replay protection.
  This module implements it using a SQLite-backed used-codes cache.

PRIORITY 2 FIX: MFA Rate Limiting.
  This module enforces rate limits on TOTP verification to mitigate brute-force:
    - User Rate Limit: Maximum 5 failed attempts within 10 minutes per user.
    - IP Rate Limit: Maximum 10 failed attempts within 10 minutes per IP address.
  If the rate limit is exceeded, an MfaRateLimitException is raised.
  Every attempt is recorded in the `totp_attempts` table, and failures are logged.
"""

from __future__ import annotations

import base64
import io
import time
import logging
from datetime import datetime, UTC, timedelta

import pyotp

logger = logging.getLogger(__name__)

# TOTP window slot duration in seconds
_WINDOW_SECONDS = 30
# Code expiry in seconds (covers current + adjacent window + small margin)
_CODE_TTL = 90

# Rate limit thresholds
MAX_FAILED_ATTEMPTS_USER = 5
MAX_FAILED_ATTEMPTS_IP = 10
RATE_LIMIT_WINDOW_MINUTES = 10


class MfaRateLimitException(Exception):
    """Raised when TOTP verification is blocked due to rate limiting."""
    def __init__(self, message: str, block_type: str):
        super().__init__(message)
        self.block_type = block_type


# ---------------------------------------------------------------------------
# Replay cache (SQLite — table created in database.py init_db)
# ---------------------------------------------------------------------------

def _prune_expired_codes(cursor) -> None:
    """Remove expired replay cache entries. Called on every verify."""
    now_iso = datetime.now(UTC).isoformat()
    cursor.execute(
        "DELETE FROM totp_used_codes WHERE expires_at < ?", (now_iso,)
    )


def _is_code_replayed(cursor, user_id: int, code: str, window_slot: int) -> bool:
    """Return True if this (user_id, code, window_slot) combo is already in the cache."""
    cursor.execute(
        """
        SELECT 1 FROM totp_used_codes
        WHERE user_id = ? AND code = ? AND window_slot = ?
        LIMIT 1
        """,
        (user_id, code, window_slot),
    )
    return cursor.fetchone() is not None


def _mark_code_used(cursor, user_id: int, code: str, window_slot: int) -> None:
    """Insert a used code into the replay cache with a TTL expiry."""
    expires_at = datetime.fromtimestamp(time.time() + _CODE_TTL, UTC).isoformat()
    cursor.execute(
        """
        INSERT OR IGNORE INTO totp_used_codes (user_id, code, window_slot, expires_at)
        VALUES (?, ?, ?, ?)
        """,
        (user_id, code, window_slot, expires_at),
    )


# ---------------------------------------------------------------------------
# Rate Limiting Logic
# ---------------------------------------------------------------------------

def _check_rate_limit(cursor, user_id: int, ip_address: str) -> None:
    """
    Checks the user-level and IP-level failed attempts in the last 10 minutes.
    Raises MfaRateLimitException if rate limit is exceeded.
    """
    cutoff = (datetime.now(UTC) - timedelta(minutes=RATE_LIMIT_WINDOW_MINUTES)).isoformat()
    
    # 1. Check user-level rate limit
    cursor.execute(
        """
        SELECT COUNT(*) as cnt FROM totp_attempts
        WHERE user_id = ? AND is_successful = 0 AND attempt_time >= ?
        """,
        (user_id, cutoff)
    )
    user_failures = cursor.fetchone()["cnt"]
    if user_failures >= MAX_FAILED_ATTEMPTS_USER:
        logger.warning("MFA Blocked: too many failed attempts for user_id=%d", user_id)
        raise MfaRateLimitException(
            f"Too many failed MFA attempts. Account is locked for 10 minutes.",
            block_type="user"
        )
        
    # 2. Check IP-level rate limit
    cursor.execute(
        """
        SELECT COUNT(*) as cnt FROM totp_attempts
        WHERE ip_address = ? AND is_successful = 0 AND attempt_time >= ?
        """,
        (ip_address, cutoff)
    )
    ip_failures = cursor.fetchone()["cnt"]
    if ip_failures >= MAX_FAILED_ATTEMPTS_IP:
        logger.warning("MFA Blocked: too many failed attempts from IP=%s", ip_address)
        raise MfaRateLimitException(
            f"Too many failed MFA attempts from this IP address.",
            block_type="ip"
        )


def _log_attempt(cursor, user_id: int, ip_address: str, is_successful: bool) -> None:
    """Record the TOTP attempt in the database."""
    now_iso = datetime.now(UTC).isoformat()
    cursor.execute(
        """
        INSERT INTO totp_attempts (user_id, ip_address, attempt_time, is_successful)
        VALUES (?, ?, ?, ?)
        """,
        (user_id, ip_address, now_iso, 1 if is_successful else 0)
    )


# ---------------------------------------------------------------------------
# TOTP public API
# ---------------------------------------------------------------------------

def generate_totp_secret() -> str:
    """
    Generate a cryptographically random TOTP secret (base32, 160 bits).
    Store the returned string encrypted in the database via EncryptionService.
    NEVER log or return this value in any API response after the setup flow.
    """
    return pyotp.random_base32()


def get_totp_uri(secret: str, username: str, issuer: str = "Vendor Risk 360") -> str:
    """
    Build the otpauth:// URI for QR code generation.
    This URI encodes the secret — treat it as sensitive and display only once.
    """
    return pyotp.TOTP(secret).provisioning_uri(
        name=username,
        issuer_name=issuer,
    )


def generate_qr_code_png_b64(totp_uri: str) -> str:
    """
    Generate a QR code PNG image as a base64-encoded string.
    Suitable for embedding in a data:image/png;base64,... src attribute.
    Display once during MFA setup — never cache or re-serve.
    """
    try:
        import qrcode
    except ImportError as exc:
        raise RuntimeError("qrcode package is required: pip install qrcode==8.2") from exc

    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(totp_uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def verify_totp(
    secret: str,
    otp_code: str,
    user_id: int,
    ip_address: str = "127.0.0.1",
    db_conn=None,
) -> bool:
    """
    Verify a TOTP code with full replay protection and rate limiting.

    Args:
        secret:     The user's TOTP secret.
        otp_code:   The 6-digit code submitted by the user.
        user_id:    The authenticated user's ID.
        ip_address: Client IP address (for IP-based rate limiting).
        db_conn:    An open sqlite3.Connection.

    Returns:
        True  — code is valid AND not a replay.
        False — code is invalid OR is a replay.

    Raises:
        MfaRateLimitException if rate limit is exceeded.
    """
    close_conn = False
    if db_conn is None:
        from database import get_db
        db_conn = get_db()
        close_conn = True

    try:
        cursor = db_conn.cursor()
        
        # 1. Enforce Rate Limiting before validating
        _check_rate_limit(cursor, user_id, ip_address)
        
        # 2. Check TOTP validity
        totp = pyotp.TOTP(secret)
        current_slot = int(time.time()) // _WINDOW_SECONDS
        
        is_valid = totp.verify(otp_code, valid_window=1)
        if not is_valid:
            logger.warning("TOTP verify: invalid code for user_id=%d from IP=%s", user_id, ip_address)
            _log_attempt(cursor, user_id, ip_address, is_successful=False)
            db_conn.commit()
            return False

        # 3. Check replay cache
        _prune_expired_codes(cursor)
        if _is_code_replayed(cursor, user_id, otp_code, current_slot):
            logger.warning(
                "TOTP replay attempt detected for user_id=%d code=%s slot=%d from IP=%s",
                user_id, otp_code, current_slot, ip_address
            )
            # Replay counts as failed/invalid attempt for rate limiting
            _log_attempt(cursor, user_id, ip_address, is_successful=False)
            db_conn.commit()
            return False

        # 4. Mark successful attempt and update replay cache
        _mark_code_used(cursor, user_id, otp_code, current_slot)
        _log_attempt(cursor, user_id, ip_address, is_successful=True)
        db_conn.commit()
        logger.info("TOTP verify: accepted for user_id=%d from IP=%s", user_id, ip_address)
        return True

    except MfaRateLimitException:
        # Re-raise rate limit exceptions
        raise
    except Exception as e:
        logger.error("Error during TOTP verification: %s", str(e))
        raise
    finally:
        if close_conn:
            db_conn.close()
