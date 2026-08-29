"""
LinuxAI — Security Diagnostic Module (SELinux, ACL, firewall, auth logs)
"""

from app.executor.runner import runner
from app.security.validator import validator


async def get_selinux_status() -> dict:
    """Get SELinux enforcement status."""
    enforce = await runner.run(["getenforce"], approved=True)
    status = await runner.run(["sestatus"], approved=True)

    raw_mode = enforce.stdout.strip()
    clean_lines = [l.strip() for l in raw_mode.splitlines() if l.strip() and not l.startswith("[SIMULATION")]
    mode = clean_lines[-1] if clean_lines else "Enforcing"

    return {
        "mode": mode,
        "detailed": status.stdout,
    }


async def get_auth_failures(lines: int = 50) -> dict:
    """Find recent authentication failures in journal."""
    result = await runner.run(
        ["journalctl", "-u", "sshd", "--since", "today", "-n", str(lines), "--no-pager"],
        approved=True,
    )
    failures = [l for l in result.stdout.splitlines() if "Failed" in l or "Invalid" in l or "authentication failure" in l.lower()]
    return {
        "total_lines": len(result.stdout.splitlines()),
        "failure_lines": len(failures),
        "failures": failures[:20],
        "raw": result.stdout,
    }


async def get_file_permissions(path: str) -> dict:
    """Get file permissions and ACL."""
    v = validator.validate_path(path, must_be_absolute=True)
    if not v.valid:
        return {"error": v.reason}

    stat_result = await runner.run(["stat", path], approved=True)
    ls_result = await runner.run(["ls", "-laZ", path], approved=True)
    acl_result = await runner.run(["getfacl", path], approved=True)

    return {
        "path": path,
        "stat": stat_result.stdout,
        "ls_output": ls_result.stdout,
        "acl": acl_result.stdout,
    }


async def get_selinux_denials(lines: int = 50) -> dict:
    """Find recent SELinux AVC denials."""
    result = await runner.run(
        ["ausearch", "-m", "AVC", "-ts", "today"],
        approved=True,
    )
    return {"output": result.stdout, "found": result.exit_code == 0}
