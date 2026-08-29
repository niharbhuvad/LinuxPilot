"""
LinuxAI — Service Diagnostic Module
Manages systemd service status, unit files, failed services, logs, custom unit creation,
lifecycle actions (start/stop/restart/reload/enable/disable/mask), and AI troubleshooting.
"""

import re
import sys
from typing import Optional
from app.executor.runner import runner

IS_LINUX = sys.platform.startswith("linux")


def _categorize_service(unit_name: str, desc: str) -> str:
    """Categorize systemd service based on unit name and description."""
    u = unit_name.lower()
    d = desc.lower()

    if any(k in u or k in d for k in ["nginx", "httpd", "apache", "caddy", "traefik", "haproxy", "lighttpd", "tomcat", "node", "gunicorn", "uvicorn"]):
        return "Web & Proxy"
    if any(k in u or k in d for k in ["mysql", "mariadb", "postgres", "redis", "mongo", "sqlite", "influxdb", "elasticsearch", "memcached", "etcd"]):
        return "Database & Cache"
    if any(k in u or k in d for k in ["ssh", "sshd", "firewalld", "iptables", "fail2ban", "auditd", "selinux", "ufw", "nftables", "sudo"]):
        return "Security & Auth"
    if any(k in u or k in d for k in ["network", "resolved", "timesyncd", "dhcp", "named", "bind", "dnsmasq", "chrony", "ntp", "wpa_supplicant", "wireguard", "openvpn"]):
        return "Network & Time"
    if any(k in u or k in d for k in ["docker", "containerd", "podman", "k3s", "kubelet", "libvirtd"]):
        return "Containers & Virtualization"
    if any(k in u or k in d for k in ["prometheus", "grafana", "node_exporter", "rsyslog", "journald", "zabbix", "datadog", "vector", "fluentd", "monitoring"]):
        return "Monitoring & Logs"
    if any(k in u or k in d for k in ["systemd", "cron", "crond", "atd", "dbus", "udev", "polkit", "accounts-daemon", "getty", "serial"]):
        return "System Core"
    return "Application & Other"


async def list_all_services() -> dict:
    """
    List all systemd units with their status, unit-file states, categories, and summary stats.
    """
    # 1. Fetch active unit states
    units_res = await runner.run(
        ["systemctl", "list-units", "--type=service", "--no-pager", "--plain", "--all"],
        approved=True,
    )

    # 2. Fetch unit file states (enabled, disabled, static, masked)
    files_res = await runner.run(
        ["systemctl", "list-unit-files", "--type=service", "--no-pager", "--plain"],
        approved=True,
    )

    unit_file_states: dict[str, str] = {}
    if files_res.succeeded:
        for line in files_res.stdout.splitlines():
            line = line.strip()
            if not line or line.startswith("UNIT FILE") or line.startswith("lines") or line.startswith("Legend"):
                continue
            parts = line.split()
            if len(parts) >= 2:
                name = parts[0]
                state = parts[1]
                unit_file_states[name] = state
                # Also store without .service suffix
                if name.endswith(".service"):
                    unit_file_states[name[:-8]] = state

    services = []
    seen_units = set()

    if units_res.succeeded:
        for line in units_res.stdout.splitlines():
            line = line.strip()
            if not line or line.startswith("UNIT") or line.startswith("Legend") or line.startswith("LOAD") or line.startswith("ACTIVE"):
                continue
            # Remove leading bullet symbols (●, ○, etc.)
            clean_line = re.sub(r'^[●○\*\s]+', '', line)
            parts = clean_line.split(None, 4)
            if len(parts) >= 3:
                unit = parts[0].strip()
                if not unit.endswith(".service") and "." in unit:
                    continue  # Only services
                
                name_clean = unit[:-8] if unit.endswith(".service") else unit
                load = parts[1] if len(parts) > 1 else "unknown"
                active = parts[2] if len(parts) > 2 else "unknown"
                sub = parts[3] if len(parts) > 3 else "unknown"
                description = parts[4] if len(parts) > 4 else ""

                file_state = unit_file_states.get(unit, unit_file_states.get(name_clean, "unknown"))
                category = _categorize_service(unit, description)

                services.append({
                    "unit": unit,
                    "name": name_clean,
                    "load": load,
                    "active": active,
                    "sub": sub,
                    "description": description,
                    "unit_file_state": file_state,
                    "category": category,
                    "is_running": active == "active" and sub == "running",
                    "is_failed": active == "failed" or sub == "failed",
                    "is_enabled": file_state == "enabled",
                })
                seen_units.add(unit)

    # Compute summary stats
    running_count = sum(1 for s in services if s["active"] == "active")
    stopped_count = sum(1 for s in services if s["active"] == "inactive")
    failed_count = sum(1 for s in services if s["is_failed"])
    enabled_count = sum(1 for s in services if s["unit_file_state"] == "enabled")
    disabled_count = sum(1 for s in services if s["unit_file_state"] in ("disabled", "masked"))

    stats = {
        "total": len(services),
        "running": running_count,
        "stopped": stopped_count,
        "failed": failed_count,
        "enabled": enabled_count,
        "disabled": disabled_count,
    }

    return {
        "services": services,
        "stats": stats,
    }


async def get_failed_services() -> dict:
    """List all failed systemd services."""
    result = await runner.run(
        ["systemctl", "--failed", "--no-pager", "--plain"],
        approved=True,
    )
    failed = []
    if result.succeeded:
        for line in result.stdout.splitlines():
            line = line.strip()
            if line and not line.startswith("UNIT") and not line.startswith("0") and not line.startswith("Legend") and not line.startswith("LOAD"):
                clean_line = re.sub(r'^[●○\*\s]+', '', line)
                parts = clean_line.split(None, 4)
                if len(parts) >= 3 and ("failed" in parts[2] or "failed" in parts[1] or (len(parts) > 3 and "failed" in parts[3])):
                    unit = parts[0]
                    failed.append({
                        "unit": unit,
                        "name": unit[:-8] if unit.endswith(".service") else unit,
                        "load": parts[1] if len(parts) > 1 else "unknown",
                        "active": parts[2] if len(parts) > 2 else "unknown",
                        "sub": parts[3] if len(parts) > 3 else "unknown",
                        "description": parts[4] if len(parts) > 4 else "",
                        "category": _categorize_service(unit, parts[4] if len(parts) > 4 else ""),
                    })
    return {
        "failed_count": len(failed),
        "services": failed,
        "raw": result.stdout,
    }


async def get_service_status(service: str) -> dict:
    """Get systemd service status with parsed metadata."""
    unit_name = service if service.endswith(".service") or "." in service else f"{service}.service"
    result = await runner.run(
        ["systemctl", "status", unit_name, "--no-pager"],
        approved=True,
    )
    
    parsed = _parse_service_details(result.stdout)
    parsed["service"] = unit_name
    parsed["raw_output"] = result.stdout
    parsed["exit_code"] = result.exit_code
    parsed["command_result"] = result.to_ai_summary()

    return parsed


async def get_service_logs(service: str, lines: int = 100) -> dict:
    """Get recent logs for a systemd service."""
    unit_name = service if service.endswith(".service") or "." in service else f"{service}.service"
    result = await runner.run(
        ["journalctl", "-u", unit_name, "-n", str(min(lines, 1000)), "--no-pager"],
        approved=True,
    )
    return {
        "service": unit_name,
        "lines_requested": lines,
        "log": result.stdout or result.stderr,
        "status": result.status.value,
    }


async def get_service_unit_file(service: str) -> dict:
    """Get the full unit file content of a service."""
    unit_name = service if service.endswith(".service") or "." in service else f"{service}.service"
    result = await runner.run(
        ["systemctl", "cat", unit_name],
        approved=True,
    )
    return {
        "service": unit_name,
        "unit_file": result.stdout or result.stderr,
        "success": result.succeeded,
    }


async def control_service(service: str, action: str) -> dict:
    """
    Execute systemctl start, stop, restart, reload, enable, disable, mask, or unmask on a service.
    """
    allowed_actions = {"start", "stop", "restart", "reload", "enable", "disable", "mask", "unmask"}
    action = action.lower().strip()
    if action not in allowed_actions:
        return {
            "success": False,
            "message": f"Invalid action '{action}'. Must be one of: {', '.join(allowed_actions)}",
            "service": service,
        }

    # Ensure service ends with .service if not specified
    unit_name = service if service.endswith(".service") or "." in service else f"{service}.service"

    result = await runner.run(
        ["systemctl", action, unit_name],
        approved=True,
    )

    return {
        "success": result.succeeded,
        "action": action,
        "service": unit_name,
        "exit_code": result.exit_code,
        "output": result.stdout or result.stderr,
        "message": f"Service '{unit_name}' {action} executed successfully." if result.succeeded else f"Failed to {action} '{unit_name}': {result.stderr or result.stdout}",
    }


async def create_custom_service(
    name: str,
    description: str,
    exec_start: str,
    working_directory: Optional[str] = None,
    user: Optional[str] = "root",
    restart: Optional[str] = "on-failure",
    restart_sec: Optional[int] = 5,
    environment_vars: Optional[list[str]] = None,
    enable_and_start: bool = True,
) -> dict:
    """Create a new custom systemd service unit file."""
    clean_name = re.sub(r'[^a-zA-Z0-9_\-\.]', '', name)
    if not clean_name.endswith(".service"):
        clean_name = f"{clean_name}.service"

    unit_path = f"/etc/systemd/system/{clean_name}"

    env_lines = ""
    if environment_vars:
        for env_item in environment_vars:
            if env_item.strip():
                env_lines += f'Environment="{env_item.strip()}"\n'

    unit_content = f"""[Unit]
Description={description or clean_name}
After=network.target remote-fs.target

[Service]
Type=simple
User={user or 'root'}
{f'WorkingDirectory={working_directory}' if working_directory else ''}
ExecStart={exec_start}
Restart={restart or 'on-failure'}
RestartSec={restart_sec or 5}s
{env_lines}
[Install]
WantedBy=multi-user.target
"""

    # Deploy file via runner
    create_cmd = ["sudo", "sh", "-c", f"cat << 'EOF' > {unit_path}\n{unit_content}\nEOF"]
    write_res = await runner.run(create_cmd, approved=True)

    if not write_res.succeeded:
        return {
            "success": False,
            "service": clean_name,
            "message": f"Failed to write service unit file: {write_res.stderr or write_res.stdout}",
        }

    # Daemon reload
    await runner.run(["systemctl", "daemon-reload"], approved=True)

    action_msg = "Created service file and reloaded systemd daemon."
    if enable_and_start:
        start_res = await runner.run(["systemctl", "enable", "--now", clean_name], approved=True)
        if start_res.succeeded:
            action_msg += " Service enabled and started successfully."
        else:
            action_msg += f" Service created, but failed to enable/start: {start_res.stderr}"

    return {
        "success": True,
        "service": clean_name,
        "unit_path": unit_path,
        "unit_content": unit_content,
        "message": action_msg,
    }


async def diagnose_service_with_ai(service: str) -> dict:
    """
    Run an automated diagnostic check on a service and generate troubleshooting guidance.
    """
    unit_name = service if service.endswith(".service") or "." in service else f"{service}.service"
    
    status_data = await get_service_status(unit_name)
    logs_data = await get_service_logs(unit_name, lines=50)

    raw_status = status_data.get("raw_output", "")
    raw_logs = logs_data.get("log", "")
    is_active = status_data.get("status") == "active"
    is_failed = status_data.get("status") == "failed"

    # Analyze root cause
    issues = []
    recommendations = []
    quick_fix_command = None

    if is_failed:
        issues.append(f"Service {unit_name} is in FAILED state.")
        if "status=2/INVALIDARG" in raw_status or "missing" in raw_logs.lower():
            issues.append("Configuration file or credentials path was not found or has syntax issues.")
            recommendations.append(f"Verify configuration files referenced in `/etc/systemd/system/{unit_name}`.")
            quick_fix_command = f"journalctl -u {unit_name} -xe --no-pager -n 50"
        elif "permission denied" in raw_logs.lower() or "code=exited, status=203/EXEC" in raw_status:
            issues.append("Executable path is not executable or user lacks permissions.")
            recommendations.append("Check permissions on the binary: `chmod +x <binary_path>`.")
            quick_fix_command = f"systemctl cat {unit_name}"
        elif "address already in use" in raw_logs.lower() or "bind" in raw_logs.lower():
            issues.append("Port conflict detected. Another process is already bound to this port.")
            recommendations.append("Use `ss -tulpn` or `lsof -i` to find and terminate the conflicting process.")
            quick_fix_command = "ss -tulpn"
        else:
            issues.append("Process exited unexpectedly.")
            recommendations.append("Inspect full journalctl logs and restart the unit.")
            quick_fix_command = f"systemctl restart {unit_name}"
    elif not is_active:
        issues.append(f"Service {unit_name} is currently stopped (inactive).")
        recommendations.append(f"Start the service with `systemctl start {unit_name}` if it is needed.")
        quick_fix_command = f"systemctl start {unit_name}"
    else:
        issues.append(f"Service {unit_name} is healthy and running normally.")
        recommendations.append("No immediate action required. System resources are nominal.")

    return {
        "service": unit_name,
        "status": status_data.get("status", "unknown"),
        "sub_status": status_data.get("sub_status", "unknown"),
        "issues": issues,
        "recommendations": recommendations,
        "quick_fix_command": quick_fix_command,
        "main_pid": status_data.get("main_pid"),
        "memory": status_data.get("memory"),
        "cpu": status_data.get("cpu"),
        "uptime": status_data.get("uptime"),
        "recent_logs": raw_logs[-800:] if raw_logs else "",
    }


def _parse_service_details(output: str) -> dict:
    """Extract detailed service metadata from systemctl status output."""
    details = {
        "status": "unknown",
        "sub_status": "unknown",
        "loaded_line": "",
        "unit_file_path": "",
        "unit_file_state": "",
        "main_pid": None,
        "memory": None,
        "cpu": None,
        "tasks": None,
        "cgroup": "",
        "uptime": "",
        "exec_start": "",
        "docs": "",
    }

    for line in output.splitlines():
        trimmed = line.strip()
        if "Active:" in trimmed:
            if "active (running)" in trimmed:
                details["status"] = "active"
                details["sub_status"] = "running"
            elif "inactive (dead)" in trimmed:
                details["status"] = "inactive"
                details["sub_status"] = "dead"
            elif "failed" in trimmed:
                details["status"] = "failed"
                details["sub_status"] = "failed"
            elif "activating" in trimmed:
                details["status"] = "activating"
                details["sub_status"] = "activating"
            elif "deactivating" in trimmed:
                details["status"] = "deactivating"
                details["sub_status"] = "deactivating"
            
            # Extract uptime/since
            if "since " in trimmed:
                parts = trimmed.split("since ", 1)
                if len(parts) > 1:
                    details["uptime"] = parts[1].split(";")[0].strip()

        elif "Loaded:" in trimmed:
            details["loaded_line"] = trimmed
            m = re.search(r'\(([^;]+);\s*([^;]+)', trimmed)
            if m:
                details["unit_file_path"] = m.group(1).strip()
                details["unit_file_state"] = m.group(2).strip()

        elif "Main PID:" in trimmed:
            m = re.search(r'Main PID:\s*(\d+)', trimmed)
            if m:
                details["main_pid"] = int(m.group(1))

        elif "Memory:" in trimmed:
            details["memory"] = trimmed.replace("Memory:", "").strip()

        elif "CPU:" in trimmed:
            details["cpu"] = trimmed.replace("CPU:", "").strip()

        elif "Tasks:" in trimmed:
            details["tasks"] = trimmed.replace("Tasks:", "").strip()

        elif "CGroup:" in trimmed:
            details["cgroup"] = trimmed.replace("CGroup:", "").strip()

        elif "Docs:" in trimmed:
            details["docs"] = trimmed.replace("Docs:", "").strip()

        elif "Process:" in trimmed and "ExecStart" in trimmed:
            details["exec_start"] = trimmed

    return details
