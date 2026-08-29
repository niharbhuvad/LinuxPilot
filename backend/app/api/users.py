"""
LinuxAI — Users API
REST endpoints for inspecting system users, groups, active logged-in sessions, and sudoers.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from app.api.auth import get_current_user
from app.models.user import User
from app.diagnostics.users import (
    get_users, get_groups, get_logged_in_users, get_user_id, get_sudo_config
)

router = APIRouter()


@router.get("")
async def list_users(user: User = Depends(get_current_user)):
    """List all system users (UID, GID, home, shell, system vs human)."""
    return await get_users()


@router.get("/groups")
async def list_groups(user: User = Depends(get_current_user)):
    """List all system groups and their members."""
    return await get_groups()


@router.get("/logged-in")
async def logged_in_users(user: User = Depends(get_current_user)):
    """Get active logged-in sessions (who / w)."""
    return await get_logged_in_users()


@router.get("/sudo")
async def sudo_config(user: User = Depends(get_current_user)):
    """Get read-only sudoers configuration summary."""
    return await get_sudo_config()


@router.get("/{username}")
async def user_details(username: str, user: User = Depends(get_current_user)):
    """Get detailed id / group info for a specific user."""
    return await get_user_id(username)
