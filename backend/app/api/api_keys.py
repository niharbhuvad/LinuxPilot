"""
LinuxPilot — User API Key Management API

API keys are encrypted before being stored in the database.
Raw API keys are never returned by these endpoints.
"""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.database.session import get_db
from app.models.api_key import UserAPIKey
from app.models.user import User
from app.utils.encryption import encrypt_api_key


router = APIRouter()


Provider = Literal["openai", "gemini", "groq"]


class APIKeyCreate(BaseModel):
    provider: Provider
    api_key: str = Field(min_length=1, max_length=2048)


class APIKeyResponse(BaseModel):
    provider: str
    configured: bool


@router.get("", response_model=list[APIKeyResponse])
async def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List configured providers without exposing API keys."""

    result = await db.execute(
        select(UserAPIKey)
        .where(UserAPIKey.user_id == current_user.id)
        .order_by(UserAPIKey.provider)
    )

    keys = result.scalars().all()

    return [
        APIKeyResponse(
            provider=key.provider,
            configured=True,
        )
        for key in keys
    ]


@router.post(
    "",
    response_model=APIKeyResponse,
    status_code=status.HTTP_201_CREATED,
)
async def save_api_key(
    payload: APIKeyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or replace an API key for the current user."""

    result = await db.execute(
        select(UserAPIKey).where(
            UserAPIKey.user_id == current_user.id,
            UserAPIKey.provider == payload.provider,
        )
    )

    existing = result.scalar_one_or_none()

    encrypted_key = encrypt_api_key(payload.api_key)

    if existing:
        existing.encrypted_key = encrypted_key
    else:
        existing = UserAPIKey(
            user_id=current_user.id,
            provider=payload.provider,
            encrypted_key=encrypted_key,
        )
        db.add(existing)

    await db.commit()

    return APIKeyResponse(
        provider=payload.provider,
        configured=True,
    )


@router.delete("/{provider}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key(
    provider: Provider,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete the current user's API key for a provider."""

    result = await db.execute(
        select(UserAPIKey).where(
            UserAPIKey.user_id == current_user.id,
            UserAPIKey.provider == provider,
        )
    )

    existing = result.scalar_one_or_none()

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No {provider} API key configured.",
        )

    await db.delete(existing)
    await db.commit()