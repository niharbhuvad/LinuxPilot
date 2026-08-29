"""
LinuxAI — Remote SSH Lab Connection & Saved Profiles API
Manages SSH connection configuration, saved connection profiles, and remote host testing.
Allows editing and deleting any connection profile (including default presets).
"""

import asyncio
import json
import time
import sys
import uuid
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.auth import get_current_user
from app.config import get_settings
from app.models.user import User

router = APIRouter()


class SSHConfigRequest(BaseModel):
    enabled: bool = True
    host: str = Field(..., description="Remote RHEL host or IP address")
    port: int = Field(default=22, description="SSH Port (default 22)")
    user: str = Field(default="root", description="SSH Username")
    password: Optional[str] = Field(default="", description="SSH Password (optional)")
    key_path: Optional[str] = Field(default="", description="Path to SSH key file (optional)")


class SSHTestRequest(BaseModel):
    host: str
    port: int = 22
    user: str = "root"
    password: Optional[str] = ""
    key_path: Optional[str] = ""


class SSHProfileModel(BaseModel):
    id: Optional[str] = None
    name: str = Field(..., description="Profile Name e.g. AWS Production Host")
    description: Optional[str] = Field(default="", description="Short description")
    host: str
    port: int = 22
    user: str = "student"
    password: Optional[str] = ""
    key_path: Optional[str] = ""
    is_fixed: bool = False


class SSHStatusResponse(BaseModel):
    enabled: bool
    host: str
    port: int
    user: str
    has_password: bool
    has_key_path: bool
    status: str
    target_info: Optional[dict] = None


SSH_CONFIG_FILE = Path(__file__).resolve().parent.parent.parent / "ssh_config.json"
SSH_PROFILES_FILE = Path(__file__).resolve().parent.parent.parent / "ssh_saved_profiles.json"

DEFAULT_FIXED_PROFILES = [
    {
        "id": "fixed-kali-linux",
        "name": "Kali Linux VM (Port 2222)",
        "description": "Kali Linux Target VM via SSH Port Forwarding (127.0.0.1:2222)",
        "host": "127.0.0.1",
        "port": 2222,
        "user": "kali",
        "password": "kali",
        "key_path": "",
        "is_fixed": True,
    },
    {
        "id": "fixed-rhel-lab",
        "name": "RHEL 9 Target Lab Workstation",
        "description": "Default local Red Hat Enterprise Linux 9 target lab",
        "host": "172.25.250.9",
        "port": 22,
        "user": "student",
        "password": "student",
        "key_path": "",
        "is_fixed": True,
    },
    {
        "id": "fixed-pinggy-tunnel",
        "name": "Online Pinggy SSH Tunnel Host",
        "description": "Remote online RHEL tunnel server via Pinggy",
        "host": "yqpjs-120-136-44-4.run.pinggy-free.link",
        "port": 35685,
        "user": "student",
        "password": "student",
        "key_path": "",
        "is_fixed": True,
    },
    {
        "id": "fixed-local-vm",
        "name": "Internal Dev Linux VM",
        "description": "Local development VM or VMware Linux guest",
        "host": "192.168.232.146",
        "port": 22,
        "user": "yash",
        "password": "yash",
        "key_path": "",
        "is_fixed": True,
    },
    {
        "id": "fixed-localhost",
        "name": "Localhost / Local Machine (127.0.0.1)",
        "description": "Local SSH connection to this machine via 127.0.0.1 loopback interface",
        "host": "127.0.0.1",
        "port": 22,
        "user": "yash",
        "password": "",
        "key_path": "",
        "is_fixed": True,
    },
]


def _save_persistent_config(enabled: bool, host: str, port: int, user: str, password: str = "", key_path: str = ""):
    try:
        data = {
            "enabled": enabled,
            "host": host,
            "port": port,
            "user": user,
            "password": password,
            "key_path": key_path,
        }
        with open(SSH_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception:
        pass


def _load_persistent_config():
    settings = get_settings()
    # Default to enabled with lab host if not configured
    settings.ssh_enabled = True
    if not settings.ssh_host:
        settings.ssh_host = "192.168.232.129"
    if not settings.ssh_user:
        settings.ssh_user = "mahesh"

    if SSH_CONFIG_FILE.exists():
        try:
            with open(SSH_CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "enabled" in data:
                    settings.ssh_enabled = bool(data["enabled"])
                if "host" in data and data["host"]:
                    settings.ssh_host = str(data["host"])
                if "port" in data:
                    settings.ssh_port = int(data["port"])
                if "user" in data and data["user"]:
                    settings.ssh_user = str(data["user"])
                if "password" in data:
                    settings.ssh_password = str(data["password"])
                if "key_path" in data:
                    settings.ssh_key_path = str(data["key_path"])
        except Exception:
            pass


def _load_saved_profiles() -> list[dict]:
    if SSH_PROFILES_FILE.exists():
        try:
            with open(SSH_PROFILES_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    
    # Save default presets on first run
    _save_profiles_to_disk(DEFAULT_FIXED_PROFILES)
    return DEFAULT_FIXED_PROFILES


def _save_profiles_to_disk(profiles: list[dict]):
    try:
        with open(SSH_PROFILES_FILE, "w", encoding="utf-8") as f:
            json.dump(profiles, f, indent=2)
    except Exception as e:
        print(f"[Error] Failed to save SSH profiles to disk ({SSH_PROFILES_FILE}): {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save profile to disk: {str(e)}")


# Automatically load persistent config on import
_load_persistent_config()


@router.get("/config", response_model=SSHStatusResponse)
async def get_ssh_config(current_user: User = Depends(get_current_user)):
    """Get active SSH remote host connection configuration."""
    _load_persistent_config()
    settings = get_settings()
    is_connected = bool(settings.ssh_enabled and settings.ssh_host)
    target_info = getattr(settings, "_ssh_target_info", None) if is_connected else None
    return SSHStatusResponse(
        enabled=settings.ssh_enabled,
        host=settings.ssh_host or "192.168.232.146",
        port=settings.ssh_port or 22,
        user=settings.ssh_user or "yash",
        has_password=bool(settings.ssh_password),
        has_key_path=bool(settings.ssh_key_path),
        status="CONNECTED" if is_connected else "DISCONNECTED",
        target_info=target_info,
    )


@router.post("/config")
async def update_ssh_config(
    data: SSHConfigRequest,
    current_user: User = Depends(get_current_user),
):
    """Save and activate remote SSH connection settings."""
    settings = get_settings()
    settings.ssh_enabled = data.enabled
    settings.ssh_host = data.host.strip()
    settings.ssh_port = data.port
    settings.ssh_user = data.user.strip()
    if data.password is not None:
        settings.ssh_password = data.password
    if data.key_path is not None:
        settings.ssh_key_path = data.key_path.strip()

    _save_persistent_config(
        enabled=settings.ssh_enabled,
        host=settings.ssh_host,
        port=settings.ssh_port,
        user=settings.ssh_user,
        password=settings.ssh_password,
        key_path=settings.ssh_key_path,
    )

    return {
        "message": "SSH configuration updated successfully",
        "enabled": settings.ssh_enabled,
        "host": settings.ssh_host,
        "port": settings.ssh_port,
        "user": settings.ssh_user,
        "status": "CONNECTED" if settings.ssh_enabled else "DISCONNECTED",
    }


@router.post("/disconnect")
async def disconnect_ssh(current_user: User = Depends(get_current_user)):
    """Disconnect remote SSH lab and return to local / simulation execution mode."""
    settings = get_settings()
    settings.ssh_enabled = False
    if hasattr(settings, "_ssh_target_info"):
        delattr(settings, "_ssh_target_info")

    _save_persistent_config(
        enabled=False,
        host=settings.ssh_host,
        port=settings.ssh_port,
        user=settings.ssh_user,
        password=settings.ssh_password,
        key_path=settings.ssh_key_path,
    )
    return {"message": "Disconnected from remote SSH server. Switched to local mode.", "enabled": False, "status": "DISCONNECTED"}


# ─── SAVED & FIXED PROFILES ENDPOINTS ────────────────────────────────────────

@router.get("/saved")
async def get_saved_profiles(current_user: User = Depends(get_current_user)):
    """List all saved SSH host profiles."""
    return _load_saved_profiles()


@router.post("/saved")
async def save_profile(data: SSHProfileModel, current_user: User = Depends(get_current_user)):
    """Create or update any SSH connection profile (including presets)."""
    all_profiles = _load_saved_profiles()
    profile_id = data.id or f"profile-{uuid.uuid4().hex[:8]}"

    new_profile = {
        "id": profile_id,
        "name": data.name.strip(),
        "description": (data.description or "").strip(),
        "host": data.host.strip(),
        "port": data.port,
        "user": data.user.strip(),
        "password": data.password or "",
        "key_path": (data.key_path or "").strip(),
        "is_fixed": data.is_fixed,
    }

    # Replace existing or append
    existing_idx = next((i for i, p in enumerate(all_profiles) if p["id"] == profile_id), -1)
    if existing_idx >= 0:
        all_profiles[existing_idx] = new_profile
    else:
        all_profiles.append(new_profile)

    _save_profiles_to_disk(all_profiles)
    return {"message": f'Saved SSH profile "{data.name}"', "profile": new_profile}


@router.delete("/saved/{profile_id}")
async def delete_profile(profile_id: str, current_user: User = Depends(get_current_user)):
    """Delete any saved SSH connection profile."""
    all_profiles = _load_saved_profiles()
    target = next((p for p in all_profiles if p["id"] == profile_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="SSH Profile not found")

    updated_profiles = [p for p in all_profiles if p["id"] != profile_id]
    _save_profiles_to_disk(updated_profiles)
    return {"message": f'Deleted profile "{target.get("name")}"'}


@router.post("/saved/{profile_id}/connect")
async def connect_profile(profile_id: str, current_user: User = Depends(get_current_user)):
    """Activate a saved SSH connection profile as the live SSH host target."""
    all_profiles = _load_saved_profiles()
    target = next((p for p in all_profiles if p["id"] == profile_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="SSH Profile not found")

    settings = get_settings()
    settings.ssh_enabled = True
    settings.ssh_host = target["host"].strip()
    settings.ssh_port = target["port"]
    settings.ssh_user = target["user"].strip()
    settings.ssh_password = target.get("password") or ""
    settings.ssh_key_path = target.get("key_path") or ""

    _save_persistent_config(
        enabled=True,
        host=settings.ssh_host,
        port=settings.ssh_port,
        user=settings.ssh_user,
        password=settings.ssh_password,
        key_path=settings.ssh_key_path,
    )

    return {
        "message": f'Activated SSH connection profile "{target.get("name")}" ({settings.ssh_host})',
        "host": settings.ssh_host,
        "user": settings.ssh_user,
        "port": settings.ssh_port,
    }


def _run_paramiko_probe(host: str, port: int, user: str, password: str, key_path: str, timeout: float = 6.0):
    import paramiko
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    connect_kwargs = {
        "hostname": host,
        "port": port,
        "username": user,
        "timeout": timeout,
        "banner_timeout": timeout,
        "auth_timeout": timeout,
    }
    if password and password.strip():
        connect_kwargs["password"] = password.strip()
    if key_path and key_path.strip():
        connect_kwargs["key_filename"] = key_path.strip()

    try:
        client.connect(**connect_kwargs)
        probe_cmd = "hostname; uname -r; cat /etc/redhat-release 2>/dev/null || cat /etc/os-release | grep PRETTY_NAME"
        stdin, stdout, stderr = client.exec_command(probe_cmd, timeout=timeout)
        raw_out = stdout.read().decode("utf-8", errors="replace")
        raw_err = stderr.read().decode("utf-8", errors="replace")
        exit_code = stdout.channel.recv_exit_status()
        client.close()
        return exit_code, raw_out, raw_err, None
    except paramiko.AuthenticationException:
        client.close()
        return -1, "", "", "Authentication failed. Please verify password or SSH key credentials for user."
    except Exception as e:
        client.close()
        return -1, "", "", str(e)


@router.post("/test")
async def test_ssh_connection(
    data: SSHTestRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Test SSH connection to the remote RHEL lab server.
    Executes diagnostic probe over SSH to retrieve hostname, OS, kernel, and latency.
    """
    host = data.host.strip()
    if not host:
        raise HTTPException(status_code=400, detail="Host address is required")

    start_time = time.monotonic()

    # Use Paramiko for reliable SSH connection testing
    exit_code, raw_stdout, raw_stderr, err_msg = await asyncio.to_thread(
        _run_paramiko_probe,
        host,
        data.port,
        data.user.strip(),
        data.password or "",
        data.key_path or "",
        6.0,
    )
    latency_ms = round((time.monotonic() - start_time) * 1000, 1)

    if exit_code == 0:
        stdout_lines = [line.strip() for line in raw_stdout.splitlines() if line.strip()]
        hostname = stdout_lines[0] if stdout_lines else host
        kernel = stdout_lines[1] if len(stdout_lines) > 1 else "Linux 5.14"
        os_name = stdout_lines[2] if len(stdout_lines) > 2 else "Red Hat Enterprise Linux 9"

        info = {
            "hostname": hostname,
            "kernel": kernel,
            "os_name": os_name.replace('PRETTY_NAME=', '').strip('"'),
            "latency_ms": latency_ms,
            "verified": True,
        }
        # Store target info on settings
        settings = get_settings()
        settings._ssh_target_info = info

        return {
            "success": True,
            "message": f"Successfully connected to RHEL Lab ({hostname}) via SSH!",
            "info": info,
        }
    else:
        failure_reason = err_msg or raw_stderr.strip() or "Host unreachable or authentication refused."
        return {
            "success": False,
            "message": f"SSH Connection failed: {failure_reason}",
            "latency_ms": latency_ms,
            "suggestion": "Check host IP, SSH port 22 firewall, username, and SSH key/password credentials.",
        }
