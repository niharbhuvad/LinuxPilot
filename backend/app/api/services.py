"""LinuxAI — Services API"""
from fastapi import APIRouter, Depends, Query
from app.api.auth import get_current_user
from app.models.user import User
from pydantic import BaseModel, Field
from typing import Optional
from app.diagnostics.services import (
    get_service_status, get_failed_services, get_service_logs,
    list_all_services, control_service, get_service_unit_file,
    create_custom_service, diagnose_service_with_ai
)

router = APIRouter()


class ServiceActionRequest(BaseModel):
    action: str  # start, stop, restart, reload, enable, disable, mask, unmask


class CreateServiceRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=64, description="Service name (e.g. my-app)")
    description: str = Field(default="", description="Description of the service")
    exec_start: str = Field(..., min_length=2, description="Command to execute")
    working_directory: Optional[str] = Field(default=None, description="Working directory path")
    user: Optional[str] = Field(default="root", description="User to run as")
    restart: Optional[str] = Field(default="on-failure", description="Restart policy: on-failure, always, no")
    restart_sec: Optional[int] = Field(default=5, description="Restart interval in seconds")
    environment_vars: Optional[list[str]] = Field(default=None, description="Environment variables e.g. ['PORT=8080']")
    enable_and_start: bool = Field(default=True, description="Enable and start immediately after creation")


@router.get("")
async def services(user: User = Depends(get_current_user)):
    """List all services with categories, states, and summary counts."""
    return await list_all_services()


@router.get("/failed")
async def failed(user: User = Depends(get_current_user)):
    """Get failed services."""
    return await get_failed_services()


@router.get("/{name}")
async def service_detail(name: str, user: User = Depends(get_current_user)):
    """Get detailed service status, properties, PID, uptime, memory."""
    return await get_service_status(name)


@router.get("/{name}/logs")
async def service_logs(name: str, lines: int = Query(default=100, ge=10, le=1000), user: User = Depends(get_current_user)):
    """Get recent journalctl logs for a service."""
    return await get_service_logs(name, lines)


@router.get("/{name}/unit-file")
async def service_unit_file(name: str, user: User = Depends(get_current_user)):
    """Get systemd unit configuration file content."""
    return await get_service_unit_file(name)


@router.post("/create")
async def create_service(req: CreateServiceRequest, user: User = Depends(get_current_user)):
    """Create and deploy a custom systemd service."""
    return await create_custom_service(
        name=req.name,
        description=req.description,
        exec_start=req.exec_start,
        working_directory=req.working_directory,
        user=req.user,
        restart=req.restart,
        restart_sec=req.restart_sec,
        environment_vars=req.environment_vars,
        enable_and_start=req.enable_and_start,
    )


@router.post("/{name}/diagnose")
async def service_diagnose(name: str, user: User = Depends(get_current_user)):
    """Run AI diagnosis and get troubleshooting advice for a service."""
    return await diagnose_service_with_ai(name)


@router.post("/{name}/action")
async def service_action(name: str, req: ServiceActionRequest, user: User = Depends(get_current_user)):
    """Execute lifecycle action: start, stop, restart, reload, enable, disable, mask, unmask."""
    return await control_service(name, req.action)


@router.post("/{name}/{action}")
async def service_action_direct(name: str, action: str, user: User = Depends(get_current_user)):
    """Execute direct lifecycle action."""
    return await control_service(name, action)
