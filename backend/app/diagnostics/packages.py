"""
LinuxAI — Package Diagnostic Module (RHEL/DNF/RPM focused)
"""

from app.executor.runner import runner
from app.security.validator import validator


async def get_package_info(package: str) -> dict:
    """Get information about an installed or available package."""
    v = validator.validate_package_name(package)
    if not v.valid:
        return {"error": v.reason}

    result = await runner.run(["rpm", "-qi", package], approved=True)
    if result.exit_code != 0:
        # Try dnf info for non-installed packages
        result = await runner.run(["dnf", "info", package, "-y"], approved=True)

    return {"package": package, "output": result.stdout, "found": result.exit_code == 0}


async def search_packages(query: str) -> dict:
    """Search for packages matching a query."""
    v = validator.validate_package_name(query)
    if not v.valid:
        return {"error": v.reason}
    result = await runner.run(["dnf", "search", query], approved=True)
    return {"query": query, "output": result.stdout}


async def get_installed_packages() -> dict:
    """List all installed packages."""
    result = await runner.run(["rpm", "-qa", "--qf", "%{NAME} %{VERSION}-%{RELEASE} %{ARCH}\n"], approved=True)
    packages = []
    for line in result.stdout.strip().splitlines():
        parts = line.split()
        if len(parts) >= 3:
            packages.append({"name": parts[0], "version": parts[1], "arch": parts[2]})
    return {"count": len(packages), "packages": packages[:200]}  # limit to 200 for UI


async def check_available_updates() -> dict:
    """Check for available package updates (read-only)."""
    result = await runner.run(["dnf", "check-update", "--quiet"], approved=True)
    # exit 100 = updates available, 0 = no updates
    return {
        "output": result.stdout,
        "updates_available": result.exit_code == 100,
    }
