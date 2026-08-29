"""
LinuxAI — Processes API
Endpoints for fetching process list, system top stats, process inspection, and process termination across remote Linux system and local PC.
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, Field
from app.api.auth import get_current_user, require_role
from app.models.user import User
from app.diagnostics.processes import get_top_processes, get_process_info, get_zombie_processes, kill_process

router = APIRouter()


class KillProcessRequest(BaseModel):
    pid: int = Field(..., description="Process ID to terminate")
    signal: int = Field(default=15, description="Signal number (15=SIGTERM, 9=SIGKILL)")
    target: str = Field(default="auto", description="'remote' for SSH Linux system or 'local' for PC")


@router.get("")
async def list_processes(
    target: str = Query("auto", description="'remote' for connected Linux system or 'local' for PC"),
    n: int = Query(50, ge=1, le=200),
    sort_by: str = Query("cpu", description="'cpu' or 'memory'"),
    user: User = Depends(get_current_user),
):
    """List top processes on target (Connected Linux SSH system or Local PC Workstation)."""
    return await get_top_processes(target=target, n=n, sort_by=sort_by)


@router.post("/kill", dependencies=[Depends(require_role("ADMIN", "OPERATOR"))])
async def kill_proc(
    data: KillProcessRequest,
    user: User = Depends(get_current_user),
):
    """Kill or terminate a process on target host."""
    res = await kill_process(pid=data.pid, signal=data.signal, target=data.target)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("message"))
    return res


@router.get("/zombies")
async def zombies(user: User = Depends(get_current_user)):
    """Get zombie processes."""
    return await get_zombie_processes()


@router.get("/{pid}")
async def process_detail(
    pid: int,
    target: str = Query("auto"),
    user: User = Depends(get_current_user),
):
    """Get detailed process information."""
    return await get_process_info(pid=pid, target=target)
