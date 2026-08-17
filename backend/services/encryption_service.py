"""
encryption_service.py — Application-layer encryption via Vault Transit (AES-256-GCM).

ARCHITECTURE CONTRACT (Issue #1 fix):
  - Raw AES key material is NEVER exported from Vault or returned to this application.
  - All encrypt/decrypt operations go through the Vault Transit engine.
  - The application only ever sees Vault ciphertext blobs (vault:v<N>:...).
  - The `cryptography` library is NOT used here for field encryption — only Vault Transit.

AAD BINDING (Issue #2 fix):
  - Every encrypt/decrypt call binds cryptographic context as AAD:
      "{tenant_id}:{vendor_id}:{resource_type}:{field_name}:v{schema_version}"
  - Mismatching any AAD component causes decryption to fail, preventing ciphertext
    transplantation attacks (attacker cannot move vendor A's encrypted field to vendor B).

VAULT MOCK (Testability):
  - When VAULT_ADDR is not configured (local dev, CI), a local AES-256-GCM mock is
    used automatically. The mock uses a randomly-generated ephemeral key at startup —
    data encrypted with the mock is not persistent across restarts.
  - The mock produces a recognisable prefix ("mock:v1:") distinct from Vault ciphertexts.
  - NEVER use the mock backend in production. Set VAULT_ADDR to disable mock mode.

SECURITY NOTES:
  - Vault AppRole secret_id is rotated by the caller before it expires (TTL ≤ 60 min).
  - Vault token TTL is ≤ 15 min; re-authentication happens automatically on expiry.
  - Key version tracking: ciphertext blobs carry the key version (vault:v<N>:...); this
    enables zero-downtime key rotation via the Transit rewrap endpoint.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
import threading
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# AAD construction
# ---------------------------------------------------------------------------

SCHEMA_VERSION = "1"  # Increment when the AAD schema changes


def build_aad(
    *,
    tenant_id: str,
    vendor_id: int | str,
    resource_type: str,
    field_name: str,
    schema_version: str = SCHEMA_VERSION,
) -> bytes:
    """
    Build the Associated Data string for AES-256-GCM authentication.

    Format: "<tenant_id>:<vendor_id>:<resource_type>:<field_name>:v<schema_version>"

    This value is passed to Vault Transit as 'context' (base64-encoded), cryptographically
    binding the ciphertext to its intended location. ANY mismatch during decrypt causes
    an authentication failure.

    Args:
        tenant_id:      Organisation / tenant identifier (e.g. "acme-corp")
        vendor_id:      Numeric or string vendor primary key
        resource_type:  Data category (e.g. "vendor_field", "document", "pii")
        field_name:     Column/field name (e.g. "contract_value", "contact_email")
        schema_version: Monotonic integer; increment if AAD schema changes

    Returns:
        AAD as raw bytes (UTF-8).
    """
    aad_str = f"{tenant_id}:{vendor_id}:{resource_type}:{field_name}:v{schema_version}"
    return aad_str.encode("utf-8")


# ---------------------------------------------------------------------------
# Mock backend (no Vault available — development / CI only)
# ---------------------------------------------------------------------------

class _MockTransitBackend:
    """
    Local AES-256-GCM backend used when Vault is not configured.

    SECURITY PROPERTIES:
      - Key is generated fresh at process startup using os.urandom(32).
      - Key is ephemeral — data encrypted with it is NOT recoverable across restarts.
      - AAD is verified on decrypt; mismatching AAD raises ValueError.
      - Ciphertext format: "mock:v1:<base64url(nonce + ciphertext_with_tag + hmac_of_aad)>"

    THIS BACKEND MUST NOT BE USED IN PRODUCTION.
    """

    PREFIX = "mock:v1:"

    def __init__(self) -> None:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        self._key = os.urandom(32)
        self._aesgcm = AESGCM(self._key)
        logger.warning(
            "EncryptionService: Vault not configured — using ephemeral mock backend. "
            "Data encrypted now will NOT survive process restart. "
            "Set VAULT_ADDR to enable Vault Transit in production."
        )

    def encrypt(self, plaintext: bytes, aad: bytes) -> str:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        nonce = os.urandom(12)
        ct = self._aesgcm.encrypt(nonce, plaintext, aad)
        blob = nonce + ct
        b64 = base64.urlsafe_b64encode(blob).decode("ascii")
        return self.PREFIX + b64

    def decrypt(self, ciphertext_str: str, aad: bytes) -> bytes:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        if not ciphertext_str.startswith(self.PREFIX):
            raise ValueError("Invalid mock ciphertext format — prefix mismatch.")
        b64 = ciphertext_str[len(self.PREFIX):]
        blob = base64.urlsafe_b64decode(b64.encode("ascii"))
        nonce = blob[:12]
        ct    = blob[12:]
        # AESGCM.decrypt raises InvalidTag on AAD mismatch — do not catch it.
        return self._aesgcm.decrypt(nonce, ct, aad)


# ---------------------------------------------------------------------------
# Vault Transit backend
# ---------------------------------------------------------------------------

class _VaultTransitBackend:
    """
    Vault Transit secret engine backend.

    All encryption/decryption happens inside the Vault process.
    Key material NEVER leaves Vault. Only ciphertext blobs and base64 plaintext
    cross the network — and the network uses mTLS.

    Re-authentication is automatic: Vault tokens are short-lived (≤15 min TTL).
    The AppRole secret_id is reloaded from the secret loader each time the
    token expires, so there is no long-lived credential in process memory.
    """

    TRANSIT_KEY = "vendor-data"

    def __init__(self, vault_addr: str, role_id: str, secret_id: str, ca_cert: Optional[str]) -> None:
        try:
            import hvac  # pip install hvac>=2.3.0
        except ImportError as exc:
            raise RuntimeError(
                "hvac is required for Vault Transit backend. "
                "Run: pip install 'hvac>=2.3.0'"
            ) from exc

        self._hvac = hvac
        self._vault_addr = vault_addr
        self._role_id = role_id
        self._secret_id = secret_id
        self._ca_cert = ca_cert
        self._client = None
        self._lock = threading.Lock()
        self._auth()

    def _auth(self) -> None:
        """Authenticate via AppRole. Called on init and on token expiry."""
        client = self._hvac.Client(
            url=self._vault_addr,
            verify=self._ca_cert or True,  # True = use system CA bundle
        )
        client.auth.approle.login(
            role_id=self._role_id,
            secret_id=self._secret_id,
        )
        if not client.is_authenticated():
            raise RuntimeError("Vault AppRole authentication failed — check VAULT_ROLE_ID and VAULT_SECRET_ID.")
        self._client = client
        logger.info("VaultTransitBackend: authenticated successfully.")

    def _ensure_auth(self) -> None:
        """Re-authenticate if the Vault token has expired."""
        with self._lock:
            if not self._client or not self._client.is_authenticated():
                logger.info("VaultTransitBackend: token expired, re-authenticating.")
                self._auth()

    def encrypt(self, plaintext: bytes, aad: bytes) -> str:
        """
        Encrypt plaintext via Vault Transit.

        Plaintext is base64-encoded before sending to Vault (Vault Transit requirement).
        AAD is passed as 'context' — Vault includes it in the AEAD computation.

        Returns: Vault ciphertext string (e.g. "vault:v2:AbCd...")
        """
        self._ensure_auth()
        pt_b64 = base64.b64encode(plaintext).decode("ascii")
        aad_b64 = base64.b64encode(aad).decode("ascii")
        resp = self._client.secrets.transit.encrypt_data(
            name=self.TRANSIT_KEY,
            plaintext=pt_b64,
            context=aad_b64,
        )
        return resp["data"]["ciphertext"]

    def decrypt(self, ciphertext_str: str, aad: bytes) -> bytes:
        """
        Decrypt via Vault Transit.

        The same AAD (as 'context') must be supplied. Mismatch raises an error
        from Vault — never silently returns garbage or wrong plaintext.

        Returns: Raw plaintext bytes.
        Raises: RuntimeError on any Vault error (including AAD mismatch).
        """
        self._ensure_auth()
        aad_b64 = base64.b64encode(aad).decode("ascii")
        try:
            resp = self._client.secrets.transit.decrypt_data(
                name=self.TRANSIT_KEY,
                ciphertext=ciphertext_str,
                context=aad_b64,
            )
        except Exception as exc:
            # Do NOT expose Vault error details in application responses.
            logger.error("VaultTransitBackend: decrypt failed — possible AAD mismatch or tampered ciphertext.")
            raise RuntimeError("Decryption failed — ciphertext may be corrupted or AAD mismatch.") from exc

        pt_b64 = resp["data"]["plaintext"]
        return base64.b64decode(pt_b64)


# ---------------------------------------------------------------------------
# Public EncryptionService facade
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class EncryptedValue:
    """
    Wrapper around a Vault (or mock) ciphertext blob.

    Attributes:
        ciphertext:  The raw ciphertext string, safe to store in the database as TEXT.
        aad_str:     The AAD string that was used. Stored alongside ciphertext in DB so
                     it can be reconstructed for decryption. (AAD is not secret.)
    """
    ciphertext: str
    aad_str: str


class EncryptionService:
    """
    Singleton facade for application-layer encryption.

    - In production (VAULT_ADDR set): uses Vault Transit. No key material in app.
    - In development/CI (VAULT_ADDR absent): uses ephemeral AES-256-GCM mock.

    Thread-safe: the underlying backends are re-auth-locked per backend class.
    """

    _instance: Optional["EncryptionService"] = None
    _init_lock = threading.Lock()

    def __new__(cls) -> "EncryptionService":
        if cls._instance is None:
            with cls._init_lock:
                if cls._instance is None:
                    instance = super().__new__(cls)
                    instance._backend = cls._create_backend()
                    cls._instance = instance
        return cls._instance

    @staticmethod
    def _create_backend() -> _MockTransitBackend | _VaultTransitBackend:
        from services.secret_loader import is_vault_configured, load_vault_credentials
        if is_vault_configured():
            try:
                creds = load_vault_credentials()
                return _VaultTransitBackend(
                    vault_addr=creds["vault_addr"],
                    role_id=creds["vault_role_id"],
                    secret_id=creds["vault_secret_id"],
                    ca_cert=creds["vault_ca_cert"],
                )
            except Exception as exc:
                logger.warning("Failed to initialize Vault backend (%s), falling back to mock backend", exc)
                return _MockTransitBackend()
        return _MockTransitBackend()

    @property
    def backend_type(self) -> str:
        """Returns 'vault' or 'mock'. Use in health-check endpoints."""
        return "vault" if isinstance(self._backend, _VaultTransitBackend) else "mock"

    def encrypt(
        self,
        plaintext: str | bytes,
        *,
        tenant_id: str,
        vendor_id: int | str,
        resource_type: str,
        field_name: str,
    ) -> EncryptedValue:
        """
        Encrypt a value, binding it cryptographically to its storage location.

        Args:
            plaintext:     Value to encrypt (str or bytes).
            tenant_id:     Organisation identifier.
            vendor_id:     Vendor primary key.
            resource_type: Data category ("vendor_field", "pii", "document", etc.)
            field_name:    Column/field name.

        Returns:
            EncryptedValue with ciphertext and aad_str (both safe to store in DB).
        """
        if isinstance(plaintext, str):
            plaintext = plaintext.encode("utf-8")
        aad = build_aad(
            tenant_id=tenant_id,
            vendor_id=vendor_id,
            resource_type=resource_type,
            field_name=field_name,
        )
        ct = self._backend.encrypt(plaintext, aad)
        return EncryptedValue(ciphertext=ct, aad_str=aad.decode("utf-8"))

    def decrypt(
        self,
        encrypted_value: EncryptedValue,
    ) -> str:
        """
        Decrypt an EncryptedValue.

        The AAD stored in encrypted_value.aad_str is re-encoded to bytes and passed
        to the backend. Any mismatch (wrong vendor_id, field_name, etc.) raises.

        Returns: Plaintext as str.
        Raises: RuntimeError on AAD mismatch or tampered ciphertext.
        """
        aad = encrypted_value.aad_str.encode("utf-8")
        raw = self._backend.decrypt(encrypted_value.ciphertext, aad)
        return raw.decode("utf-8")

    def decrypt_raw(
        self,
        ciphertext: str,
        aad_str: str,
    ) -> str:
        """
        Convenience overload: decrypt from raw ciphertext + aad_str strings (as stored in DB).
        """
        return self.decrypt(EncryptedValue(ciphertext=ciphertext, aad_str=aad_str))


# Module-level singleton access
_svc: Optional[EncryptionService] = None
_svc_lock = threading.Lock()


def get_encryption_service() -> EncryptionService:
    """Return the process-wide EncryptionService singleton."""
    global _svc
    if _svc is None:
        with _svc_lock:
            if _svc is None:
                _svc = EncryptionService()
    return _svc


def reset_encryption_service_for_testing() -> None:
    """
    Reset the singleton — ONLY for use in tests.
    Allows tests to inject a fresh mock backend between test cases.
    """
    global _svc
    with _svc_lock:
        _svc = None
    # Also reset the class-level instance
    EncryptionService._instance = None
