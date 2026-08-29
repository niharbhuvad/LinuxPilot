"""
LinuxAI — File Operations API (Vim Editor Support)
Endpoints for reading and writing file contents safely across local and remote SSH targets via SFTP.
"""

import asyncio
import os
import posixpath
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.api.auth import get_current_user
from app.models.user import User
from app.config import get_settings

router = APIRouter()


class WriteFileRequest(BaseModel):
    path: str
    content: str


def _ssh_read_file_sftp(host: str, port: int, user: str, password: str, key_path: str, file_path: str) -> tuple[bool, str, str]:
    import paramiko
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    connect_kwargs = {
        "hostname": host,
        "port": port,
        "username": user,
        "timeout": 10.0,
        "banner_timeout": 10.0,
        "auth_timeout": 10.0,
    }
    if password and password.strip():
        connect_kwargs["password"] = password.strip()
        connect_kwargs["look_for_keys"] = False
        connect_kwargs["allow_agent"] = False
    elif key_path and key_path.strip():
        connect_kwargs["key_filename"] = key_path.strip()

    try:
        client.connect(**connect_kwargs)
        sftp = client.open_sftp()
        try:
            with sftp.open(file_path, "rb") as f:
                content_bytes = f.read()
            sftp.close()
            client.close()
            return True, content_bytes.decode("utf-8", errors="replace"), ""
        except FileNotFoundError:
            sftp.close()
            client.close()
            return False, "", "File not found"
        except Exception as e:
            sftp.close()
            client.close()
            return False, "", str(e)
    except paramiko.AuthenticationException:
        return False, "", f"SSH authentication failed for user '{user}' on {host}:{port}. Check password or SSH key in Settings."
    except Exception as e:
        return False, "", f"Cannot connect to {host}:{port} via SSH: {str(e)}"


def _ssh_write_file_sftp(host: str, port: int, user: str, password: str, key_path: str, file_path: str, content_bytes: bytes):
    import paramiko, base64, shlex
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    connect_kwargs = {
        "hostname": host,
        "port": port,
        "username": user,
        "timeout": 10.0,
        "banner_timeout": 10.0,
        "auth_timeout": 10.0,
    }
    if password and password.strip():
        connect_kwargs["password"] = password.strip()
        connect_kwargs["look_for_keys"] = False
        connect_kwargs["allow_agent"] = False
    elif key_path and key_path.strip():
        connect_kwargs["key_filename"] = key_path.strip()

    try:
        client.connect(**connect_kwargs)
    except paramiko.AuthenticationException:
        raise Exception(f"SSH authentication failed for user '{user}' on {host}:{port}. Please check password/key in Settings.")
    except Exception as e:
        raise Exception(f"Cannot connect to {host}:{port} via SSH: {str(e)}")

    try:
        # 1. Ensure directory exists using mkdir -p over SSH command
        dir_path = posixpath.dirname(file_path)
        if dir_path and dir_path != "/":
            stdin, stdout, stderr = client.exec_command(f"mkdir -p {shlex.quote(dir_path)}", timeout=10.0)
            stdout.channel.recv_exit_status()

        # 2. Write file directly via SFTP binary stream
        sftp = client.open_sftp()
        with sftp.file(file_path, "wb") as f:
            f.write(content_bytes)
        sftp.close()
        client.close()
    except (PermissionError, OSError, IOError) as perm_err:
        # Fall back to base64 echo with sudo if SFTP permission denied
        try:
            b64_str = base64.b64encode(content_bytes).decode("ascii")
            sudo_cmd = f"echo '{b64_str}' | base64 -d | sudo tee {shlex.quote(file_path)} >/dev/null"
            stdin, stdout, stderr = client.exec_command(sudo_cmd, timeout=10.0)
            exit_code = stdout.channel.recv_exit_status()
            client.close()
            if exit_code != 0:
                raise Exception(f"Permission denied writing to '{file_path}'. Write access requires root or write permissions.")
        except Exception:
            client.close()
            raise Exception(f"Permission denied writing to '{file_path}'. Write access requires root or write permissions.")
    except Exception as e:
        client.close()
        raise e


@router.get("/read")
async def read_file(
    path: str = Query(..., description="Absolute or relative file path to read"),
    user: User = Depends(get_current_user),
):
    """Read file content for Vim Editor."""
    file_path = path.strip()
    if not file_path:
        raise HTTPException(status_code=400, detail="File path is required")

    from app.api.ssh import _load_persistent_config
    _load_persistent_config()
    settings = get_settings()

    # If remote SSH is active, read via SFTP
    if settings.ssh_enabled and settings.ssh_host:
        exists, content, err_msg = await asyncio.to_thread(
            _ssh_read_file_sftp,
            settings.ssh_host,
            settings.ssh_port,
            settings.ssh_user,
            settings.ssh_password or "",
            settings.ssh_key_path or "",
            file_path,
        )
        if not exists:
            return {
                "path": file_path,
                "exists": False,
                "content": "",
                "size_bytes": 0,
                "lines": 0,
                "message": f"New file or empty: {file_path}",
            }

        lines = content.splitlines()
        return {
            "path": file_path,
            "exists": True,
            "content": content,
            "size_bytes": len(content.encode("utf-8")),
            "lines": len(lines),
            "message": f'"{file_path}" {len(lines)}L, {len(content.encode("utf-8"))}B',
        }

    # Local / Simulation mode
    if not os.path.exists(file_path):
        return {
            "path": file_path,
            "exists": False,
            "content": "",
            "size_bytes": 0,
            "lines": 0,
            "message": f"New file: {file_path}",
        }

    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        lines = content.splitlines()
        return {
            "path": file_path,
            "exists": True,
            "content": content,
            "size_bytes": len(content.encode("utf-8")),
            "lines": len(lines),
            "message": f'"{file_path}" {len(lines)}L, {len(content.encode("utf-8"))}B',
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot read file: {str(e)}")


@router.post("/write")
async def write_file(
    data: WriteFileRequest,
    user: User = Depends(get_current_user),
):
    """Safely write content to file for Vim Editor via SFTP or local open."""
    file_path = data.path.strip()
    if not file_path:
        raise HTTPException(status_code=400, detail="File path is required")

    from app.api.ssh import _load_persistent_config
    _load_persistent_config()
    settings = get_settings()
    content_bytes = data.content.encode("utf-8")

    # If remote SSH is active, write via SFTP binary stream
    if settings.ssh_enabled and settings.ssh_host:
        try:
            await asyncio.to_thread(
                _ssh_write_file_sftp,
                settings.ssh_host,
                settings.ssh_port,
                settings.ssh_user,
                settings.ssh_password or "",
                settings.ssh_key_path or "",
                file_path,
                content_bytes,
            )
            lines = data.content.splitlines()
            bytes_written = len(content_bytes)
            return {
                "status": "success",
                "path": file_path,
                "lines": len(lines),
                "size_bytes": bytes_written,
                "message": f'"{file_path}" {len(lines)}L, {bytes_written}B written remotely via SFTP',
            }
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to save file remotely over SSH: {str(e)}")

    # Local filesystem write
    try:
        dirname = os.path.dirname(os.path.abspath(file_path))
        if dirname:
            os.makedirs(dirname, exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(data.content)

        lines = data.content.splitlines()
        bytes_written = len(content_bytes)
        return {
            "status": "success",
            "path": file_path,
            "lines": len(lines),
            "size_bytes": bytes_written,
            "message": f'"{file_path}" {len(lines)}L, {bytes_written}B written',
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to save file: {str(e)}")
