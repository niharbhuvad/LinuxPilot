"""
LinuxAI — User Diagnostic Module
"""

from app.executor.runner import runner


async def get_users() -> dict:
    """List all system users."""
    result = await runner.run(["getent", "passwd"], approved=True)
    users = []
    for line in result.stdout.strip().splitlines():
        parts = line.split(":")
        if len(parts) >= 7:
            uid = int(parts[2]) if parts[2].isdigit() else -1
            users.append({
                "username": parts[0],
                "uid": uid,
                "gid": parts[3],
                "home": parts[5],
                "shell": parts[6],
                "is_system": uid < 1000 and uid != 0,
            })
    return {"count": len(users), "users": users}


async def get_groups() -> dict:
    """List all groups."""
    result = await runner.run(["getent", "group"], approved=True)
    groups = []
    for line in result.stdout.strip().splitlines():
        parts = line.split(":")
        if len(parts) >= 4:
            groups.append({
                "name": parts[0],
                "gid": parts[2],
                "members": [m for m in parts[3].split(",") if m],
            })
    return {"count": len(groups), "groups": groups}


async def get_logged_in_users() -> dict:
    """Show currently logged-in users."""
    result = await runner.run(["who"], approved=True)
    return {"output": result.stdout}


async def get_user_id(username: str) -> dict:
    """Show user identity details."""
    result = await runner.run(["id", username], approved=True)
    return {"username": username, "output": result.stdout}


async def get_sudo_config() -> dict:
    """Check sudo configuration (read-only)."""
    result = await runner.run(["cat", "/etc/sudoers"], approved=True)
    return {
        "output": result.stdout if result.succeeded else "Cannot read sudoers file",
        "accessible": result.succeeded,
    }
