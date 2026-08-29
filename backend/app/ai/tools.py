"""
LinuxAI — AI Tool Definitions & Dispatch Table
All 30+ AI-callable tools registered as OpenAI function definitions.
The dispatch table maps each tool name to its implementation.
"""

from typing import Any, Callable

# ─── Tool Registry ────────────────────────────────────────────────────────────
# Each entry is an OpenAI-compatible function definition

TOOL_DEFINITIONS: list[dict] = [
    # ── System Tools ──────────────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "get_system_info",
            "description": "Get complete system information: hostname, OS, kernel, CPU, memory, disk, uptime, load average. Use this as the first step when checking server health.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_cpu_usage",
            "description": "Get current CPU usage percentage, core count, and frequency.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_memory_usage",
            "description": "Get RAM and swap usage in GB and percentage.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_disk_usage",
            "description": "Get disk usage for all mounted filesystems.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_load_average",
            "description": "Get system load averages for 1, 5, and 15 minute intervals.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    # ── Process Tools ─────────────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "get_top_processes",
            "description": "Get the top processes sorted by CPU or memory usage.",
            "parameters": {
                "type": "object",
                "properties": {
                    "n": {"type": "integer", "description": "Number of processes to return (default 10)"},
                    "sort_by": {"type": "string", "enum": ["cpu", "memory"], "description": "Sort by cpu or memory"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_process_info",
            "description": "Get detailed information about a specific process by PID.",
            "parameters": {
                "type": "object",
                "properties": {"pid": {"type": "integer", "description": "Process ID"}},
                "required": ["pid"],
            },
        },
    },
    # ── Service Tools ─────────────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "get_service_status",
            "description": "Get the status of a systemd service. Use this when checking if nginx, sshd, httpd, or any service is running.",
            "parameters": {
                "type": "object",
                "properties": {"service": {"type": "string", "description": "Service name (e.g., nginx, sshd, httpd)"}},
                "required": ["service"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_failed_services",
            "description": "List all failed systemd services. Use this for a quick system health check.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_service_logs",
            "description": "Get recent journal log entries for a specific service. Crucial for diagnosing service failures.",
            "parameters": {
                "type": "object",
                "properties": {
                    "service": {"type": "string", "description": "Service name"},
                    "lines": {"type": "integer", "description": "Number of log lines (default 100, max 1000)"},
                },
                "required": ["service"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_all_services",
            "description": "List all systemd services and their current status.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    # ── Network Tools ─────────────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "get_network_interfaces",
            "description": "Get all network interfaces, IP addresses, and their status.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_open_ports",
            "description": "Get all listening network ports and the services using them.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_routes",
            "description": "Get the network routing table.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_firewall_status",
            "description": "Get firewalld rules and status on RHEL.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_network_connectivity",
            "description": "Ping a host to verify network connectivity.",
            "parameters": {
                "type": "object",
                "properties": {
                    "host": {"type": "string", "description": "Hostname or IP to ping (default 8.8.8.8)"},
                    "count": {"type": "integer", "description": "Number of ping packets (default 4)"},
                },
                "required": [],
            },
        },
    },
    # ── Disk Tools ────────────────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "find_large_files",
            "description": "Find files larger than a given size in a directory. Use when investigating disk space issues.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Directory to search (default /)"},
                    "size_mb": {"type": "integer", "description": "Minimum file size in MB (default 100)"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_directory_sizes",
            "description": "Get disk usage of top-level directories at a given path.",
            "parameters": {
                "type": "object",
                "properties": {"path": {"type": "string", "description": "Path to analyze (default /)"}},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_journal_disk_usage",
            "description": "Check how much disk space the systemd journal is using.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    # ── Package Tools ─────────────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "get_package_info",
            "description": "Get information about a specific package (installed or available).",
            "parameters": {
                "type": "object",
                "properties": {"package": {"type": "string", "description": "Package name"}},
                "required": ["package"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_packages",
            "description": "Search for packages matching a query using DNF.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string", "description": "Search query"}},
                "required": ["query"],
            },
        },
    },
    # ── Security Tools ────────────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "get_selinux_status",
            "description": "Get SELinux enforcement mode and policy status. Important for diagnosing permission denied errors.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_auth_failures",
            "description": "Find recent SSH and authentication failure events in the journal.",
            "parameters": {
                "type": "object",
                "properties": {"lines": {"type": "integer", "description": "Number of log lines to check (default 50)"}},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_file_permissions",
            "description": "Get file permissions, ownership, and ACL for a given path.",
            "parameters": {
                "type": "object",
                "properties": {"path": {"type": "string", "description": "Absolute file/directory path"}},
                "required": ["path"],
            },
        },
    },
    # ── Logs Tools ────────────────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "get_system_logs",
            "description": "Get recent system-wide journal log entries.",
            "parameters": {
                "type": "object",
                "properties": {"lines": {"type": "integer", "description": "Number of lines (default 100)"}},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_recent_errors",
            "description": "Get recent ERROR and CRITICAL level journal entries from today.",
            "parameters": {
                "type": "object",
                "properties": {"lines": {"type": "integer", "description": "Number of entries (default 50)"}},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_logs",
            "description": "Search journal logs for a specific term. Use for natural language queries like 'show SSH errors' or 'find nginx failures'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search term"},
                    "service": {"type": "string", "description": "Limit to specific service (optional)"},
                    "since": {"type": "string", "description": "Time filter e.g. 'today', '1 hour ago', '2024-01-01'"},
                    "lines": {"type": "integer", "description": "Max lines to return"},
                },
                "required": ["query"],
            },
        },
    },
    # ── User Tools ────────────────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "get_users",
            "description": "List all system users.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_groups",
            "description": "List all system groups.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_logged_in_users",
            "description": "Show currently logged-in users.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    # ── Storage Tools ─────────────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "get_lvm_info",
            "description": "Get LVM physical volumes, volume groups, and logical volumes.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_block_devices",
            "description": "List all block storage devices (disks, partitions, LVM).",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "clean_disk_space",
            "description": "Safely clean up system disk space: vacuum journalctl logs, clear package cache, and prune unused Docker images.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "optimize_performance",
            "description": "Identify high CPU and memory processes and suggest optimization actions.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "audit_security",
            "description": "Perform 1-click personal security audit: listening ports, firewall, SELinux, failed SSH logins.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "rollback_last_action",
            "description": "Restore the latest timestamped configuration backup file.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filepath": {"type": "string", "description": "Optional specific file path to restore from backup"}
                },
                "required": [],
            },
        },
    },
]

# ─── Tool Dispatch Table ──────────────────────────────────────────────────────
# Maps tool names to async callables


async def _build_dispatch_table() -> dict[str, Callable]:
    """Build the dispatch table lazily to avoid circular imports."""
    from app.diagnostics.system import (
        get_system_info, get_cpu_usage, get_memory_usage,
        get_disk_usage, get_load_average,
    )
    from app.diagnostics.processes import get_top_processes, get_process_info

    from app.diagnostics.services import (
        get_service_status, get_failed_services, get_service_logs, list_all_services,
    )
    from app.diagnostics.network import (
        get_network_interfaces, get_open_ports, get_routes,
        get_firewall_status, check_network_connectivity,
    )
    from app.diagnostics.disk import (
        find_large_files, get_directory_sizes, get_journal_disk_usage, get_block_devices,
    )
    from app.diagnostics.packages import get_package_info, search_packages
    from app.diagnostics.security import get_selinux_status, get_auth_failures, get_file_permissions
    from app.diagnostics.logs import get_system_logs, get_recent_errors, search_logs
    from app.diagnostics.users import get_users, get_groups, get_logged_in_users
    from app.diagnostics.storage import get_lvm_info, get_block_devices as get_storage_block
    from app.diagnostics.maintenance import (
        clean_disk_space, optimize_performance, audit_security, rollback_last_action,
    )

    return {
        "get_system_info": get_system_info,
        "get_cpu_usage": get_cpu_usage,
        "get_memory_usage": get_memory_usage,
        "get_disk_usage": get_disk_usage,
        "get_load_average": get_load_average,
        "get_top_processes": get_top_processes,
        "get_process_info": get_process_info,
        "get_service_status": get_service_status,
        "get_failed_services": get_failed_services,
        "get_service_logs": get_service_logs,
        "list_all_services": list_all_services,
        "get_network_interfaces": get_network_interfaces,
        "get_open_ports": get_open_ports,
        "get_routes": get_routes,
        "get_firewall_status": get_firewall_status,
        "check_network_connectivity": check_network_connectivity,
        "find_large_files": find_large_files,
        "get_directory_sizes": get_directory_sizes,
        "get_journal_disk_usage": get_journal_disk_usage,
        "get_block_devices": get_block_devices,
        "get_package_info": get_package_info,
        "search_packages": search_packages,
        "get_selinux_status": get_selinux_status,
        "get_auth_failures": get_auth_failures,
        "get_file_permissions": get_file_permissions,
        "get_system_logs": get_system_logs,
        "get_recent_errors": get_recent_errors,
        "search_logs": search_logs,
        "get_users": get_users,
        "get_groups": get_groups,
        "get_logged_in_users": get_logged_in_users,
        "get_lvm_info": get_lvm_info,
        "clean_disk_space": clean_disk_space,
        "optimize_performance": optimize_performance,
        "audit_security": audit_security,
        "rollback_last_action": rollback_last_action,
    }


_dispatch_cache: dict | None = None


async def dispatch_tool(tool_name: str, tool_args: dict) -> Any:
    """Execute a tool by name with the given arguments."""
    global _dispatch_cache
    if _dispatch_cache is None:
        _dispatch_cache = await _build_dispatch_table()

    handler = _dispatch_cache.get(tool_name)
    if handler is None:
        return {"error": f"Unknown tool: {tool_name}"}

    try:
        result = await handler(**tool_args)
        return result
    except TypeError as e:
        return {"error": f"Invalid arguments for tool {tool_name}: {e}"}
    except Exception as e:
        return {"error": f"Tool {tool_name} failed: {str(e)}"}
