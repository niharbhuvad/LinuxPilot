"""
LinuxPilot — API Key Encryption Utilities
"""

from cryptography.fernet import Fernet

from app.config import get_settings


settings = get_settings()


def _get_fernet() -> Fernet:
    """Create a Fernet cipher using the application's encryption key."""
    if not settings.api_key_encryption_key:
        raise RuntimeError(
            "API_KEY_ENCRYPTION_KEY is not configured."
        )

    return Fernet(settings.api_key_encryption_key.encode())


def encrypt_api_key(api_key: str) -> str:
    """Encrypt a plain-text API key."""
    if not api_key:
        raise ValueError("API key cannot be empty.")

    return _get_fernet().encrypt(api_key.encode()).decode()


def decrypt_api_key(encrypted_key: str) -> str:
    """Decrypt an encrypted API key."""
    if not encrypted_key:
        raise ValueError("Encrypted API key cannot be empty.")

    return _get_fernet().decrypt(encrypted_key.encode()).decode()