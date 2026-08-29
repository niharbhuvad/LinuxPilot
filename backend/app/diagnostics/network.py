"""
LinuxAI — Network Diagnostic Module
When SSH is active, fetches real network data from the remote RHEL target.
Falls back to local psutil when SSH is disconnected.
"""

import sys
import json
import socket
import psutil
from app.executor.runner import runner


IS_LINUX = sys.platform.startswith("linux")


def _is_ssh_active() -> bool:
    """Check if SSH remote execution is currently enabled."""
    try:
        from app.config import get_settings
        from app.api.ssh import _load_persistent_config
        _load_persistent_config()
        s = get_settings()
        return s.ssh_enabled and bool(s.ssh_host)
    except Exception:
        return False


async def get_network_interfaces() -> list[dict]:
    """Get all network interfaces and their addresses from remote or local."""
    if _is_ssh_active():
        # Use ip -j addr show for JSON output from remote
        res = await runner.run(["ip", "-j", "addr", "show"], approved=True)
        interfaces = []
        if res.succeeded and res.stdout.strip():
            try:
                ifaces = json.loads(res.stdout)
                for iface in ifaces:
                    addresses = []
                    for addr_info in iface.get("addr_info", []):
                        if addr_info.get("family") == "inet":
                            addresses.append({
                                "type": "IPv4",
                                "address": addr_info.get("local", ""),
                                "netmask": str(addr_info.get("prefixlen", "")),
                            })
                        elif addr_info.get("family") == "inet6":
                            addresses.append({
                                "type": "IPv6",
                                "address": addr_info.get("local", ""),
                            })
                    state = iface.get("operstate", "UNKNOWN")
                    interfaces.append({
                        "name": iface.get("ifname", "unknown"),
                        "is_up": state.upper() in ("UP", "UNKNOWN"),
                        "speed_mbps": 0,
                        "mtu": iface.get("mtu", 0),
                        "addresses": addresses,
                        "state": state,
                    })
            except (json.JSONDecodeError, KeyError):
                # Fallback to ip addr show text parsing
                text_res = await runner.run(["ip", "-br", "addr", "show"], approved=True)
                if text_res.succeeded:
                    for line in text_res.stdout.strip().splitlines():
                        parts = line.split()
                        if len(parts) >= 2:
                            name = parts[0]
                            state = parts[1]
                            addrs = [{"type": "IPv4" if "." in a.split("/")[0] else "IPv6", "address": a} for a in parts[2:]]
                            interfaces.append({
                                "name": name,
                                "is_up": state.upper() in ("UP", "UNKNOWN"),
                                "speed_mbps": 0,
                                "mtu": 0,
                                "addresses": addrs,
                                "state": state,
                            })
        return interfaces
    else:
        # Local psutil fallback
        interfaces = []
        stats = psutil.net_if_stats()
        addrs = psutil.net_if_addrs()
        for iface, addr_list in addrs.items():
            iface_stat = stats.get(iface)
            addresses = []
            for addr in addr_list:
                if addr.family == socket.AF_INET:
                    addresses.append({"type": "IPv4", "address": addr.address, "netmask": addr.netmask})
                elif addr.family == socket.AF_INET6:
                    addresses.append({"type": "IPv6", "address": addr.address})
            interfaces.append({
                "name": iface,
                "is_up": iface_stat.isup if iface_stat else False,
                "speed_mbps": iface_stat.speed if iface_stat else 0,
                "mtu": iface_stat.mtu if iface_stat else 0,
                "addresses": addresses,
            })
        return interfaces


async def get_open_ports() -> dict:
    """Get open listening ports from remote or local."""
    result = await runner.run(["ss", "-tulpn"], approved=True)

    connections = []
    if _is_ssh_active():
        # Parse ss output from remote
        if result.succeeded:
            for line in result.stdout.splitlines()[1:]:  # Skip header
                parts = line.split()
                if len(parts) >= 5 and parts[0] in ("tcp", "udp"):
                    state = parts[1]
                    local_addr = parts[4]
                    proto = parts[0]
                    # Extract process info if available
                    proc_info = parts[-1] if "users:" in parts[-1] else ""
                    connections.append({
                        "protocol": proto,
                        "local_address": local_addr,
                        "state": state,
                        "process": proc_info,
                        "pid": None,
                    })
    else:
        for proc in psutil.net_connections(kind="inet"):
            if proc.status == "LISTEN" and proc.laddr:
                laddr = proc.laddr
                ip = getattr(laddr, "ip", laddr[0] if len(laddr) > 0 else "")
                port = getattr(laddr, "port", laddr[1] if len(laddr) > 1 else "")
                connections.append({
                    "protocol": "tcp",
                    "local_address": f"{ip}:{port}",
                    "pid": proc.pid,
                })

    return {
        "raw_ss": result.stdout,
        "listening_ports": connections,
    }


async def get_routes() -> dict:
    """Get network routing table."""
    result = await runner.run(["ip", "route"], approved=True)
    return {"raw": result.stdout}


async def get_firewall_status() -> dict:
    """Get firewalld status on RHEL."""
    result = await runner.run(["firewall-cmd", "--list-all"], approved=True)
    status_result = await runner.run(["systemctl", "status", "firewalld", "--no-pager"], approved=True)
    return {
        "firewall_rules": result.stdout,
        "service_status": status_result.stdout,
        "is_available": result.exit_code == 0,
    }


async def get_dns_status() -> dict:
    """Check DNS resolution status."""
    result = await runner.run(["resolvectl", "status"], approved=True)
    return {"raw": result.stdout}


async def check_network_connectivity(host: str = "8.8.8.8", count: int = 4) -> dict:
    """Ping a host to check network connectivity."""
    args = ["ping", "-c", str(count), host]
    result = await runner.run(args, approved=True)
    return {
        "host": host,
        "success": result.exit_code == 0,
        "output": result.stdout,
    }
