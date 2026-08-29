"""
LinuxAI — Logs Diagnostic Module
"""

from app.executor.runner import runner
from app.security.validator import validator


async def get_system_logs(lines: int = 100) -> dict:
    """Get recent system-wide journal logs."""
    result = await runner.run(
        ["journalctl", "-n", str(lines), "--no-pager", "-o", "short-precise"],
        approved=True,
    )
    return {"output": result.stdout, "lines": lines}


async def get_recent_errors(lines: int = 50) -> dict:
    """Get recent ERROR/CRITICAL journal entries."""
    result = await runner.run(
        ["journalctl", "-p", "err", "-n", str(lines), "--no-pager", "--since", "today"],
        approved=True,
    )
    return {"output": result.stdout, "lines": lines}


async def search_logs(
    query: str,
    service: str | None = None,
    since: str = "today",
    lines: int = 100,
) -> dict:
    """Search journal logs for a specific query string."""
    v_q = validator.validate_search_query(query)
    if not v_q.valid:
        return {"error": v_q.reason}

    args = ["journalctl", "--no-pager", "-n", str(lines), "--since", since]
    if service:
        v_s = validator.validate_service_name(service)
        if not v_s.valid:
            return {"error": v_s.reason}
        args += ["-u", service]

    args += ["--grep", query]
    result = await runner.run(args, approved=True)

    matching = [l for l in result.stdout.splitlines() if query.lower() in l.lower()]
    return {
        "query": query,
        "service": service,
        "since": since,
        "total_lines": len(result.stdout.splitlines()),
        "matching_lines": len(matching),
        "output": result.stdout,
    }


async def get_boot_logs() -> dict:
    """Get logs since last boot."""
    result = await runner.run(["journalctl", "-b", "--no-pager", "-n", "200"], approved=True)
    return {"output": result.stdout}
