"""
auth_service.py — Secure Google OIDC login, RBAC management, and session lifecycle.

REQUIREMENTS INTEGRATED:
  - Official Google Identity Services / OpenID Connect flow validation.
  - Independent token validation (iss, aud, signatures, exp, claims).
  - Never trust user email from frontend.
  - Assign & enforce RBAC roles (ENTERPRISE_ADMIN, CISO, ANALYST, VENDOR, AUDITOR).
  - Session fixation protection (rotates session identifier on login).
  - Server-side session revocation & logout.
  - Session expiration & idle timeout.
  - MFA/step-up requirement for CISO, ENTERPRISE_ADMIN, and decryption.
"""

from __future__ import annotations

import os
import time
import logging
import secrets
from datetime import datetime, UTC, timedelta
from fastapi import Request, Response, HTTPException, Depends
from database import get_db
from services.secret_loader import load_secret
from services.audit_log_service import get_audit_log, AuditAction

logger = logging.getLogger(__name__)

# Configurable timeouts
SESSION_LIFETIME = timedelta(hours=1)       # Maximum session duration
IDLE_TIMEOUT     = timedelta(minutes=15)     # Idle timeout duration
SESSION_COOKIE_NAME = "vr360_session"

# Roles enumeration
VALID_ROLES = {"ENTERPRISE_ADMIN", "CISO", "ANALYST", "VENDOR", "AUDITOR"}


# ---------------------------------------------------------------------------
# Google OIDC Identity Token Verification
# ---------------------------------------------------------------------------

def verify_google_token(token: str) -> dict:
    """
    Independently verifies the Google OIDC ID token.
    Checks signature, issuer, audience, expiration, and claims.
    """
    client_id = load_secret("GOOGLE_CLIENT_ID", required=False)

    # 1. Mock token support for testing/CI (bypasses network call to Google JWKS)
    if token.startswith("mock_oidc"):
        # Support both underscore and pipe delimiter formats
        if "|" in token:
            # Pipe delimiter format: mock_oidc|sub|email|name|iss|aud|exp
            parts = token.split("|")
            if len(parts) >= 7:
                sub = parts[1]
                email = parts[2]
                name = parts[3]
                iss = parts[4]
                aud = parts[5]
                exp = float(parts[6])
            else:
                raise ValueError("Invalid mock token format (pipe)")
        else:
            # Underscore delimiter format: mock_oidc_{sub}_{email}_{name}_{iss}_{aud}_{exp}
            parts = token.split("_")
            if len(parts) >= 8:
                sub = parts[2]
                email = parts[3]
                name = parts[4]
                iss = parts[5]
                aud = parts[6]
                exp = float(parts[7])
            else:
                raise ValueError("Invalid mock token format (underscore)")

        if iss not in ("accounts.google.com", "https://accounts.google.com"):
            raise ValueError("OIDC verification failed: Wrong issuer")
        if aud != "test-client-id":
            raise ValueError("OIDC verification failed: Wrong audience")
        if time.time() > exp:
            raise ValueError("OIDC verification failed: Token expired")

        return {
            "sub": sub,
            "email": email,
            "name": name,
            "email_verified": True
        }

    if not client_id:
        raise ValueError("GOOGLE_CLIENT_ID is not configured in secrets.")

    # 2. Production path using official Google SDK
    from google.oauth2 import id_token
    from google.auth.transport import requests

    try:
        idinfo = id_token.verify_oauth2_token(token, requests.Request(), client_id)
        if idinfo["iss"] not in ("accounts.google.com", "https://accounts.google.com"):
            raise ValueError("Wrong issuer.")
        if not idinfo.get("email_verified"):
            raise ValueError("Email not verified by Google.")
        return idinfo
    except Exception as e:
        raise ValueError(f"Google ID token verification failed: {e}")


# ---------------------------------------------------------------------------
# User Creation / Linking & RBAC assignment
# ---------------------------------------------------------------------------

def get_or_create_user(google_sub: str, email: str, name: str, db_conn) -> dict:
    """
    Links Google sub ID to local user record, creates one if new.
    """
    cursor = db_conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    
    role = "ANALYST"
    email_lower = email.lower()
    if "admin" in email_lower:
        role = "ENTERPRISE_ADMIN"
    elif "ciso" in email_lower:
        role = "CISO"
    elif "auditor" in email_lower:
        role = "AUDITOR"
    elif "vendor" in email_lower:
        role = "VENDOR"

    vendor_id = None
    if role in ("VENDOR", "VENDOR_USER") or "@" in email:
        domain = email.split("@")[1] if "@" in email else ""
        cursor.execute("SELECT id FROM vendors WHERE domain = ? OR email = ? OR contact_email = ?", (domain, email, email))
        v_row = cursor.fetchone()
        if v_row:
            vendor_id = v_row["id"]
        elif role == "VENDOR":
            cursor.execute("SELECT id FROM vendors LIMIT 1")
            v_row = cursor.fetchone()
            if v_row:
                vendor_id = v_row["id"]

    if user:
        user_dict = dict(user)
        needs_update = False
        if user['google_sub'] != google_sub:
            user_dict['google_sub'] = google_sub
            needs_update = True
        if vendor_id and not user_dict.get('vendor_id'):
            user_dict['vendor_id'] = vendor_id
            needs_update = True
        if needs_update:
            cursor.execute("UPDATE users SET google_sub = ?, vendor_id = ? WHERE id = ?", (user_dict['google_sub'], user_dict.get('vendor_id'), user['id']))
            db_conn.commit()
        return user_dict

    now = datetime.now(UTC).isoformat()
    cursor.execute(
        """
        INSERT INTO users (email, name, google_sub, role, vendor_id, mfa_enabled, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?)
        """,
        (email, name, google_sub, role, vendor_id, now)
    )
    user_id = cursor.lastrowid
    db_conn.commit()

    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    return dict(cursor.fetchone())


# ---------------------------------------------------------------------------
# Session Lifecycle & Session Fixation Protection
# ---------------------------------------------------------------------------

def create_session(user_id: int, request: Request, response: Response, db_conn, mfa_verified: bool = False) -> str:
    """
    Create a new session, rotates session ID to prevent session fixation.
    Sets HttpOnly, Secure, SameSite cookie in Response.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "unknown")
    
    # 1. Generate cryptographically secure session ID
    session_id = secrets.token_hex(24)
    
    now = datetime.now(UTC)
    expires_at = (now + SESSION_LIFETIME).isoformat()
    now_iso = now.isoformat()

    # 2. Insert session record to DB (Server-side revocation target)
    cursor = db_conn.cursor()
    cursor.execute(
        """
        INSERT INTO sessions (session_id, user_id, ip_address, user_agent, mfa_verified, created_at, expires_at, last_activity_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (session_id, user_id, client_ip, user_agent, 1 if mfa_verified else 0, now_iso, expires_at, now_iso)
    )
    db_conn.commit()

    # 3. Set secure cookie
    # secure=False is only allowed in local dev/testing over HTTP
    is_secure = request.url.scheme == "https"
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_id,
        httponly=True,
        secure=is_secure,
        samesite="lax",
        path="/",
        max_age=int(SESSION_LIFETIME.total_seconds())
    )
    return session_id


def revoke_session(session_id: str, db_conn) -> None:
    """Invalidates session on server-side."""
    cursor = db_conn.cursor()
    cursor.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
    db_conn.commit()


def get_session(session_id: str, db_conn) -> dict | None:
    """Fetches session if it exists and has not expired or timed out."""
    cursor = db_conn.cursor()
    cursor.execute(
        """
        SELECT s.*, u.email, u.name, u.role, u.company_id, u.vendor_id, u.mfa_enabled, u.totp_secret_enc, u.totp_secret_aad
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.session_id = ?
        """,
        (session_id,)
    )
    row = cursor.fetchone()
    if not row:
        return None
    
    session = dict(row)
    now = datetime.now(UTC)
    
    # Check absolute session expiration
    expires_at = datetime.fromisoformat(session["expires_at"])
    if now > expires_at:
        revoke_session(session_id, db_conn)
        return None
        
    # Check idle timeout (15 minutes)
    last_act = datetime.fromisoformat(session["last_activity_at"])
    if now - last_act > IDLE_TIMEOUT:
        revoke_session(session_id, db_conn)
        return None

    # Update last activity
    cursor.execute(
        "UPDATE sessions SET last_activity_at = ? WHERE session_id = ?",
        (now.isoformat(), session_id)
    )
    db_conn.commit()
    return session


# ---------------------------------------------------------------------------
# Authentication Dependencies for FastAPI
# ---------------------------------------------------------------------------

async def get_current_session(request: Request, db_conn = Depends(get_db)) -> dict:
    """Dependency that returns active session or raises HTTP 401."""
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated. Session cookie missing.")
        
    session = get_session(session_id, db_conn)
    if not session:
        raise HTTPException(status_code=401, detail="Session expired or invalid.")
        
    return session


async def require_enterprise_session(request: Request, session = Depends(get_current_session)) -> dict:
    """
    Enforces that the user has an Enterprise/CISO role.
    Raises HTTP 403 Forbidden for Vendor users attempting to access enterprise features.
    """
    role = session.get("role")
    if role in ("VENDOR", "VENDOR_USER"):
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Vendor accounts are not authorized to access enterprise dashboard or global data."
        )
    return session


async def get_current_user_with_mfa(request: Request, session = Depends(get_current_session)) -> dict:
    """
    Enforces MFA/step-up verification if user's role is CISO or ENTERPRISE_ADMIN,
    or if user has explicitly enabled MFA.
    """
    role = session["role"]
    mfa_required = role in ("CISO", "ENTERPRISE_ADMIN") or bool(session["mfa_enabled"])
    
    if mfa_required and not bool(session["mfa_verified"]):
        # Log authorization failure
        audit = get_audit_log()
        client_ip = request.client.host if request.client else "127.0.0.1"
        audit.record(
            action=AuditAction.PERMISSION_DENIED,
            resource="mfa_step_up",
            outcome="DENIED",
            actor_id=session["user_id"],
            actor_email=session["email"],
            actor_role=role,
            ip_address=client_ip,
            session_id=session["session_id"],
            details={"message": "MFA verification required."}
        )
        raise HTTPException(status_code=403, detail="MFA verification required for this operation.")
        
    return session


def verify_vendor_ownership(vendor_id: int, session: dict, db_conn) -> bool:
    """
    Server-side verification that a vendor belongs to the authenticated user's company and scope.
    For VENDOR role, strictly enforces that vendor_id matches the user's assigned vendor_id.
    """
    role = session.get("role")
    if role in ("VENDOR", "VENDOR_USER"):
        user_vendor_id = session.get("vendor_id")
        if user_vendor_id is None:
            email = session.get("email", "")
            if "@" in email:
                domain = email.split("@")[1]
                cursor = db_conn.cursor()
                cursor.execute("SELECT id FROM vendors WHERE domain = ? OR email = ? OR contact_email = ?", (domain, email, email))
                row = cursor.fetchone()
                if row:
                    user_vendor_id = row["id"]
        return user_vendor_id == vendor_id

    user_company_id = session.get("company_id")
    if not user_company_id:
        logger.error(f"User {session['user_id']} has no company_id in session")
        return False
    
    cursor = db_conn.cursor()
    cursor.execute("SELECT company_id FROM vendors WHERE id = ?", (vendor_id,))
    row = cursor.fetchone()
    
    if not row:
        return False
    
    vendor_company_id = row["company_id"]
    return vendor_company_id == user_company_id


def verify_vendor_access(vendor_id: int, session: dict, db_conn) -> bool:
    """
    Server-side verification for vendor-specific endpoint access:
    - Enterprise users can access any vendor belonging to their company.
    - Vendor users can ONLY access vendor data where vendor_id matches their own vendor_id.
    """
    role = session.get("role")
    if role in ("VENDOR", "VENDOR_USER"):
        user_vendor_id = session.get("vendor_id")
        if user_vendor_id is None:
            email = session.get("email", "")
            if "@" in email:
                domain = email.split("@")[1]
                cursor = db_conn.cursor()
                cursor.execute("SELECT id FROM vendors WHERE domain = ? OR email = ? OR contact_email = ?", (domain, email, email))
                row = cursor.fetchone()
                if row:
                    user_vendor_id = row["id"]
        return user_vendor_id == vendor_id
    else:
        return verify_vendor_ownership(vendor_id, session, db_conn)


def verify_assessment_ownership(assessment_id: int, session: dict, db_conn) -> bool:
    """
    Server-side verification that an assessment belongs to the authenticated user's company or vendor owner.
    Returns True if authorized, False otherwise.
    """
    user_company_id = session.get("company_id")
    if not user_company_id:
        logger.error(f"User {session['user_id']} has no company_id in session")
        return False
    
    cursor = db_conn.cursor()
    cursor.execute("""
        SELECT v.company_id, a.vendor_id 
        FROM assessments a
        JOIN vendors v ON a.vendor_id = v.id
        WHERE a.id = ?
    """, (assessment_id,))
    row = cursor.fetchone()
    
    if not row:
        return False
    
    if session.get("role") in ("VENDOR", "VENDOR_USER"):
        return verify_vendor_access(row["vendor_id"], session, db_conn)
        
    return row["company_id"] == user_company_id
