"""
LinuxPilot — User API Key Service

Retrieves and decrypts API keys belonging to the authenticated user.
Raw API keys are never stored in plaintext in the database.
"""

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.api_key import UserAPIKey
from app.utils.encryption import decrypt_api_key


async def get_user_api_key(
    db: AsyncSession,
    user_id: str,
    provider: str,
) -> Optional[str]:
    """
    Retrieve and decrypt a user's API key for a provider.

    Returns:
        Decrypted API key if configured, otherwise None.
    """

    result = await db.execute(
        select(UserAPIKey).where(
            UserAPIKey.user_id == user_id,
            UserAPIKey.provider == provider,
        )
    )

    api_key = result.scalar_one_or_none()

    if not api_key:
        return None

    return decrypt_api_key(api_key.encrypted_key)