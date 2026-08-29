"""
LinuxAI — Persistent PTY & Interactive Shell WebSocket Handler
Provides real bi-directional PTY terminal session with full ANSI, interactive
stdin/stdout, password prompts (su/sudo), signals (Ctrl+C/D/Z), and state persistence.
"""

import os
import sys
import json
import time
import asyncio
import socket
from typing import Dict, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import structlog

from app.config import get_settings
from app.api.ssh import _load_persistent_config

logger = structlog.get_logger(__name__)
router = APIRouter()

IS_LINUX = sys.platform.startswith("linux")
IS_WINDOWS = sys.platform.startswith("win")

# In-memory store for session output history (for AI contextual assistance)
session_history_buffers: Dict[str, list[str]] = {}


@router.websocket("/ws")
async def terminal_websocket(websocket: WebSocket, session_id: Optional[str] = "default"):
    """
    WebSocket endpoint for real interactive PTY shell.
    Supports SSH remote lab sessions, local Linux PTY, and interactive state persistence.
    """
    await websocket.accept()
    _load_persistent_config()
    settings = get_settings()

    cols = 120
    rows = 35

    logger.info("Terminal WebSocket connected", session_id=session_id, ssh_enabled=settings.ssh_enabled, host=settings.ssh_host)

    # Check if remote SSH lab is configured
    if settings.ssh_enabled and settings.ssh_host:
        await handle_ssh_pty(websocket, settings, cols, rows, session_id)
    elif IS_LINUX:
        await handle_local_linux_pty(websocket, cols, rows, session_id)
    else:
        await handle_dev_interactive_shell(websocket, cols, rows, session_id)


async def handle_ssh_pty(websocket: WebSocket, settings, cols: int, rows: int, session_id: str):
    """Bridge WebSocket to persistent Paramiko interactive SSH PTY channel."""
    import paramiko

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    ssh_host = settings.ssh_host
    ssh_port = int(settings.ssh_port)
    ssh_user = settings.ssh_user
    ssh_password = settings.ssh_password
    ssh_key = settings.ssh_key_path

    try:
        connect_kwargs = {
            "hostname": ssh_host,
            "port": ssh_port,
            "username": ssh_user,
            "timeout": 10.0,
        }
        if ssh_password and ssh_password.strip():
            connect_kwargs["password"] = ssh_password.strip()
        if ssh_key and ssh_key.strip():
            connect_kwargs["key_filename"] = ssh_key.strip()

        await asyncio.to_thread(client.connect, **connect_kwargs)
        
        # Invoke persistent interactive PTY shell directly on the real Linux VM
        channel = client.invoke_shell(term="xterm-256color", width=cols, height=rows)
        channel.setblocking(0)
        logger.info("Real SSH PTY Shell active", host=ssh_host, user=ssh_user)
    except Exception as e:
        logger.error("SSH PTY Connection failed", error=str(e), host=ssh_host)
        # Fallback to dev interactive shell on connection failure
        await websocket.send_text(
            f"\r\n\x1b[33m[LinuxAI]\x1b[0m Remote SSH connection to {ssh_user}@{ssh_host}:{ssh_port} failed: {str(e)}\r\n"
            f"\x1b[33m[LinuxAI]\x1b[0m Starting interactive local development shell...\r\n\r\n"
        )
        if IS_LINUX:
            await handle_local_linux_pty(websocket, cols, rows, session_id)
        else:
            await handle_dev_interactive_shell(websocket, cols, rows, session_id)
        return

    # Track output buffer for AI diagnostics
    history_buffer = session_history_buffers.setdefault(session_id, [])

    # Task to read from SSH PTY and send to WebSocket
    async def ssh_to_ws():
        try:
            while True:
                await asyncio.sleep(0.01)
                if channel.recv_ready():
                    data = channel.recv(4096).decode("utf-8", errors="replace")
                    if data:
                        history_buffer.append(data)
                        if len(history_buffer) > 200:
                            history_buffer.pop(0)
                        await websocket.send_text(data)
                elif channel.exit_status_ready():
                    break
        except Exception:
            pass

    read_task = asyncio.create_task(ssh_to_ws())

    try:
        while True:
            raw_msg = await websocket.receive_text()
            try:
                # Handle control messages (resize, ping) or raw input
                if raw_msg.startswith("{") and "type" in raw_msg:
                    payload = json.loads(raw_msg)
                    msg_type = payload.get("type")
                    if msg_type == "resize":
                        new_cols = int(payload.get("cols", cols))
                        new_rows = int(payload.get("rows", rows))
                        channel.resize_pty(width=new_cols, height=new_rows)
                    elif msg_type == "input":
                        channel.send(payload.get("data", ""))
                else:
                    # Raw stdin keystrokes
                    channel.send(raw_msg)
            except Exception as e:
                logger.warn("Error sending to SSH channel", error=str(e))
    except (WebSocketDisconnect, asyncio.CancelledError):
        pass
    finally:
        read_task.cancel()
        try:
            channel.close()
            client.close()
        except Exception:
            pass
        logger.info("SSH PTY session closed", session_id=session_id)


async def handle_local_linux_pty(websocket: WebSocket, cols: int, rows: int, session_id: str):
    """Bridge WebSocket to local Linux PTY running /bin/bash."""
    import pty
    import termios
    import struct
    import fcntl

    master_fd, slave_fd = pty.openpty()

    # Set initial terminal size
    winsize = struct.pack("HHHH", rows, cols, 0, 0)
    fcntl.ioctl(slave_fd, termios.TIOCSWINSZ, winsize)

    env = os.environ.copy()
    env["TERM"] = "xterm-256color"
    env["SYSTEMD_PAGER"] = "cat"
    env["PAGER"] = "cat"

    proc = await asyncio.create_subprocess_exec(
        "/bin/bash", "-i",
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
        env=env,
        preexec_fn=os.setsid,
    )
    os.close(slave_fd)

    history_buffer = session_history_buffers.setdefault(session_id, [])

    # Read from master_fd and send to WebSocket
    async def pty_to_ws():
        loop = asyncio.get_running_loop()
        try:
            while True:
                data = await loop.run_in_executor(None, os.read, master_fd, 4096)
                if not data:
                    break
                text = data.decode("utf-8", errors="replace")
                history_buffer.append(text)
                if len(history_buffer) > 200:
                    history_buffer.pop(0)
                await websocket.send_text(text)
        except Exception:
            pass

    read_task = asyncio.create_task(pty_to_ws())

    try:
        while True:
            raw_msg = await websocket.receive_text()
            try:
                if raw_msg.startswith("{") and "type" in raw_msg:
                    payload = json.loads(raw_msg)
                    msg_type = payload.get("type")
                    if msg_type == "resize":
                        new_cols = int(payload.get("cols", cols))
                        new_rows = int(payload.get("rows", rows))
                        new_winsize = struct.pack("HHHH", new_rows, new_cols, 0, 0)
                        fcntl.ioctl(master_fd, termios.TIOCSWINSZ, new_winsize)
                    elif msg_type == "input":
                        os.write(master_fd, payload.get("data", "").encode("utf-8"))
                else:
                    os.write(master_fd, raw_msg.encode("utf-8"))
            except Exception:
                pass
    except (WebSocketDisconnect, asyncio.CancelledError):
        pass
    finally:
        read_task.cancel()
        try:
            os.close(master_fd)
            proc.terminate()
        except Exception:
            pass


async def handle_dev_interactive_shell(websocket: WebSocket, cols: int, rows: int, session_id: str):
    """
    Rich interactive terminal shell for Windows/Dev environments with true command persistence.
    Supports state persistence (cd, export, whoami, su, sudo), history, and ANSI streaming.
    """
    current_user = "student"
    current_host = "rhel9-dev"
    current_cwd = "/home/student"
    env_vars = {"USER": "student", "HOME": "/home/student", "SHELL": "/bin/bash", "PATH": "/usr/local/bin:/usr/bin:/bin"}

    def get_prompt():
        symbol = "#" if current_user == "root" else "$"
        color = "31" if current_user == "root" else "32"
        return f"\x1b[1;{color}m[{current_user}@{current_host} {current_cwd.split('/')[-1] or '/'}]\x1b[0m{symbol} "

    # Send banner and initial prompt
    await websocket.send_text(
        f"\x1b[1;36m========================================================================\x1b[0m\r\n"
        f"\x1b[1;32m      NEXUS AI-Native Linux Terminal — Persistent Interactive Session    \x1b[0m\r\n"
        f"\x1b[1;36m========================================================================\x1b[0m\r\n"
        f"Connected as \x1b[1;32m{current_user}\x1b[0m on \x1b[1;34m{current_host}\x1b[0m. State and session active.\r\n\r\n"
    )
    await websocket.send_text(get_prompt())

    line_buffer = ""
    history = []
    history_idx = -1
    is_password_mode = False
    password_buffer = ""
    su_target_user = "root"

    history_log = session_history_buffers.setdefault(session_id, [])

    try:
        while True:
            raw_input = await websocket.receive_text()

            # Handle JSON formatted messages
            if raw_input.startswith("{") and "type" in raw_input:
                try:
                    payload = json.loads(raw_input)
                    if payload.get("type") == "input":
                        raw_input = payload.get("data", "")
                    elif payload.get("type") == "resize":
                        continue
                except Exception:
                    pass

            for char in raw_input:
                # Ctrl+C
                if char == "\x03":
                    line_buffer = ""
                    password_buffer = ""
                    is_password_mode = False
                    await websocket.send_text("^C\r\n" + get_prompt())
                    continue

                # Ctrl+D
                if char == "\x04":
                    if current_user == "root":
                        current_user = "student"
                        current_cwd = "/home/student"
                        await websocket.send_text("exit\r\n" + get_prompt())
                    else:
                        await websocket.send_text("\r\nlogout\r\n")
                    continue

                # Enter key (\r or \n)
                if char in ("\r", "\n"):
                    await websocket.send_text("\r\n")

                    if is_password_mode:
                        is_password_mode = False
                        # Any password or admin123 succeeds in dev mode
                        current_user = su_target_user
                        if current_user == "root":
                            current_cwd = "/root"
                        password_buffer = ""
                        await websocket.send_text(get_prompt())
                        continue

                    cmd = line_buffer.strip()
                    if cmd:
                        history.append(cmd)
                        history_idx = len(history)
                        history_log.append(f"{current_user}:{cmd}")

                    line_buffer = ""

                    if not cmd:
                        await websocket.send_text(get_prompt())
                        continue

                    # Handle state-persisting shell commands
                    if cmd == "clear":
                        await websocket.send_text("\x1b[2J\x1b[H" + get_prompt())
                        continue

                    if cmd == "exit":
                        if current_user == "root":
                            current_user = "student"
                            current_cwd = "/home/student"
                            await websocket.send_text(get_prompt())
                        else:
                            await websocket.send_text("logout\r\n" + get_prompt())
                        continue

                    # Handle su / su - / sudo -i
                    if cmd in ("su", "su -", "su root", "su - root", "sudo -i", "sudo su", "sudo su -"):
                        su_target_user = "root"
                        is_password_mode = True
                        password_buffer = ""
                        await websocket.send_text("Password: ")
                        continue

                    if cmd.startswith("su ") or cmd.startswith("su - "):
                        parts = cmd.split()
                        target = parts[-1]
                        su_target_user = target
                        is_password_mode = True
                        password_buffer = ""
                        await websocket.send_text("Password: ")
                        continue

                    # Handle pwd
                    if cmd == "pwd":
                        await websocket.send_text(f"{current_cwd}\r\n" + get_prompt())
                        continue

                    # Handle whoami
                    if cmd == "whoami":
                        await websocket.send_text(f"{current_user}\r\n" + get_prompt())
                        continue

                    # Handle id
                    if cmd == "id":
                        id_str = f"uid=0(root) gid=0(root) groups=0(root)\r\n" if current_user == "root" else f"uid=1000({current_user}) gid=1000({current_user}) groups=1000({current_user}),10(wheel)\r\n"
                        await websocket.send_text(id_str + get_prompt())
                        continue

                    # Handle cd
                    if cmd == "cd" or cmd == "cd ~":
                        current_cwd = "/root" if current_user == "root" else "/home/student"
                        await websocket.send_text(get_prompt())
                        continue
                    elif cmd.startswith("cd "):
                        target_dir = cmd[3:].strip()
                        if target_dir == "..":
                            parts = [p for p in current_cwd.split("/") if p]
                            current_cwd = "/" + "/".join(parts[:-1]) if len(parts) > 1 else "/"
                        elif target_dir.startswith("/"):
                            current_cwd = target_dir
                        else:
                            current_cwd = (current_cwd.rstrip("/") + "/" + target_dir)
                        await websocket.send_text(get_prompt())
                        continue

                    # Handle export VAR=VAL
                    if cmd.startswith("export "):
                        var_part = cmd[7:].strip()
                        if "=" in var_part:
                            k, v = var_part.split("=", 1)
                            env_vars[k.strip()] = v.strip().strip('"').strip("'")
                        await websocket.send_text(get_prompt())
                        continue

                    # Handle echo $VAR
                    if cmd.startswith("echo $"):
                        var_name = cmd[6:].strip()
                        val = env_vars.get(var_name, "")
                        await websocket.send_text(f"{val}\r\n" + get_prompt())
                        continue

                    # Execute via CommandRunner
                    from app.executor.runner import CommandRunner
                    import shlex
                    runner = CommandRunner()
                    try:
                        args = shlex.split(cmd)
                    except Exception:
                        args = cmd.split()

                    res = await runner.run(args, approved=True)
                    if res.stdout:
                        formatted_out = res.stdout.replace("\n", "\r\n")
                        await websocket.send_text(formatted_out + ("\r\n" if not formatted_out.endswith("\r\n") else ""))
                    if res.stderr:
                        formatted_err = f"\x1b[31m{res.stderr}\x1b[0m".replace("\n", "\r\n")
                        await websocket.send_text(formatted_err + ("\r\n" if not formatted_err.endswith("\r\n") else ""))

                    await websocket.send_text(get_prompt())
                    continue

                # Backspace (\x08 or \x7f)
                if char in ("\x08", "\x7f"):
                    if is_password_mode:
                        password_buffer = password_buffer[:-1]
                    elif line_buffer:
                        line_buffer = line_buffer[:-1]
                        await websocket.send_text("\b \b")
                    continue

                # Regular typing
                if is_password_mode:
                    password_buffer += char
                else:
                    line_buffer += char
                    await websocket.send_text(char)

    except (WebSocketDisconnect, asyncio.CancelledError):
        pass
    logger.info("Interactive dev shell closed", session_id=session_id)
