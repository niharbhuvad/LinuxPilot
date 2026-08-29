"""
LinuxAI — Packages API
REST endpoints for RPM package management, DNF search, and update checks.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from app.api.auth import get_current_user
from app.models.user import User
from app.diagnostics.packages import (
    get_installed_packages, get_package_info, search_packages, check_available_updates
)

router = APIRouter()


@router.get("")
async def list_installed_packages(user: User = Depends(get_current_user)):
    """List installed RPM packages on the host system."""
    return await get_installed_packages()


@router.get("/updates")
async def check_updates(user: User = Depends(get_current_user)):
    """Check for available DNF package updates."""
    return await check_available_updates()


@router.get("/search")
async def search_dnf_packages(
    query: str = Query(..., description="Package search query"),
    user: User = Depends(get_current_user)
):
    """Search for available packages via DNF."""
    q = query.strip()
    if not q:
        raise HTTPException(status_code=400, detail="Search query is required")
    return await search_packages(q)


@router.get("/info/{package_name}")
async def package_info(package_name: str, user: User = Depends(get_current_user)):
    """Get detailed package inspection info."""
    return await get_package_info(package_name)
