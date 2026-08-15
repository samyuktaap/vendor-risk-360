"""
secret_loader.py — Credential loader for Vault and other runtime secrets.

Priority order (most secure first):
  1. Docker secret files at /run/secrets/<name>  (production: Docker Swarm / Compose secrets)
  2. systemd credentials at $CREDENTIALS_DIRECTORY/<name>  (production: systemd v250+ credentials)
  3. Environment variables  (local dev ONLY — never use in production for real secrets)

SECURITY CONTRACT:
  - Raw encryption keys must NEVER appear here. Only Vault auth tokens/role credentials.
  - Vault auth tokens are short-lived (≤30 min TTL); this loader fetches fresh credentials.
  - No secret value is ever logged, printed, or stored in a mutable module-level variable
    beyond the duration of the consuming function.

Usage:
    from services.secret_loader import load_secret, load_vault_credentials

    vault_addr    = load_secret("VAULT_ADDR",      required=True)
    vault_role_id = load_secret("VAULT_ROLE_ID",   required=True)
    vault_secret  = load_secret("VAULT_SECRET_ID", required=True)
"""

from __future__ import annotations

import os
from pathlib import Path


# Docker Swarm / Compose secret mount root (Linux production)
_DOCKER_SECRETS_DIR = Path("/run/secrets")

# systemd-credentials mount root (systemd v250+)
_SYSTEMD_CREDS_DIR = Path(os.environ.get("CREDENTIALS_DIRECTORY", "/__nonexistent__"))


def _read_docker_secret(name: str) -> str | None:
    """
    Reads a Docker secret from /run/secrets/<name>.
    Returns stripped string, or None if file does not exist.
    Raises RuntimeError if file exists but cannot be read (permissions error).
    """
    path = _DOCKER_SECRETS_DIR / name
    if not path.exists():
        return None
    try:
        return path.read_text(encoding="utf-8").strip()
    except OSError as exc:
        raise RuntimeError(
            f"Docker secret '{name}' exists at {path} but cannot be read: {exc}"
        ) from exc


def _read_systemd_credential(name: str) -> str | None:
    """
    Reads a systemd credential from $CREDENTIALS_DIRECTORY/<name>.
    Returns stripped string, or None if file does not exist.
    """
    path = _SYSTEMD_CREDS_DIR / name
    if not path.exists():
        return None
    try:
        return path.read_text(encoding="utf-8").strip()
    except OSError as exc:
        raise RuntimeError(
            f"systemd credential '{name}' exists at {path} but cannot be read: {exc}"
        ) from exc


def _read_env_var(name: str) -> str | None:
    """
    Reads a plain environment variable.
    Returns stripped string, or None if unset or empty.

    WARNING: Environment variables are visible to all processes sharing the same
    environment. Use Docker secrets or systemd credentials in production.
    """
    val = os.environ.get(name, "").strip()
    return val if val else None


def load_secret(name: str, *, required: bool = False) -> str | None:
    """
    Load a named secret using the priority chain:
      Docker secret file → systemd credential → environment variable

    Args:
        name:     The secret name (maps to file name and env-var name identically).
        required: If True and no value found, raises RuntimeError.

    Returns:
        The secret value as a stripped string, or None if not found and not required.

    Raises:
        RuntimeError: If required=True and secret is not found in any source.
    """
    value = (
        _read_docker_secret(name)
        or _read_systemd_credential(name)
        or _read_env_var(name)
    )

    if value is None and required:
        sources = []
        sources.append(f"Docker secret file: {_DOCKER_SECRETS_DIR / name}")
        sources.append(f"systemd credential: {_SYSTEMD_CREDS_DIR / name}")
        sources.append(f"environment variable: {name}")
        raise RuntimeError(
            f"Required secret '{name}' not found in any source:\n"
            + "\n".join(f"  - {s}" for s in sources)
            + "\nFor local dev: export the variable. "
              "For production: use Docker secrets or systemd credentials."
        )

    return value


def load_vault_credentials() -> dict[str, str]:
    """
    Load all Vault connection parameters.
    Returns a dict with keys: vault_addr, vault_role_id, vault_secret_id, vault_ca_cert.

    vault_ca_cert is optional (returns None if not set) — used for self-signed CA bundles.

    Raises RuntimeError if VAULT_ADDR, VAULT_ROLE_ID, or VAULT_SECRET_ID are missing.
    """
    return {
        "vault_addr":      load_secret("VAULT_ADDR",      required=True),
        "vault_role_id":   load_secret("VAULT_ROLE_ID",   required=True),
        "vault_secret_id": load_secret("VAULT_SECRET_ID", required=True),
        "vault_ca_cert":   load_secret("VAULT_CA_CERT",   required=False),
    }


def is_vault_configured() -> bool:
    """
    Returns True if Vault connection parameters are present in any secret source.
    Used by encryption_service.py to choose between Vault Transit and local mock.
    """
    return bool(
        _read_docker_secret("VAULT_ADDR")
        or _read_systemd_credential("VAULT_ADDR")
        or _read_env_var("VAULT_ADDR")
    )
