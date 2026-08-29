"""LinuxAI — Logs API"""
 
from fastapi import APIRouter, Depends
from app.api.auth import get_current_user
from app.models.user import User
from app.diagnostics.logs import get_system_logs, get_recent_errors, search_logs, get_boot_logs

router = APIRouter()

@router.get("")
async def logs(lines: int = 100, user: User = Depends(get_current_user)):
    return await get_system_logs(min(lines, 1000))

@router.get("/errors")
async def errors(lines: int = 50, user: User = Depends(get_current_user)):
    return await get_recent_errors(min(lines, 500))

@router.get("/boot")
async def boot_logs(user: User = Depends(get_current_user)):
    return await get_boot_logs()

@router.get("/search")
async def search(
    query: str, service: str | None = None, since: str = "today",
    lines: int = 100, user: User = Depends(get_current_user)
):

    return await search_logs(query, service, since, min(lines, 500))
