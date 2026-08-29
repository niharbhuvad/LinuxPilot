"""
LinuxAI — Diagnostic Maintenance Module
Provides safe, automated quick maintenance actions for personal Linux setups.
"""

import os
import glob
import shutil
import datetime
from app.executor.runner import runner


async def clean_disk_space() -> dict:
    """
    Perform safe system cleanup:
    1. Vacuum system logs (journalctl --vacuum-time=3d)
    2. Clean package manager cache (dnf/apt/pacman)
    3. Prune dangling Docker resources (if docker is available)
    """
    cleaned_items = []
    
    # 1. Vacuum journalctl logs
    res1 = await runner.run(["journalctl", "--vacuum-time=3d"])
    if res1.stdout:
        cleaned_items.append({"action": "journalctl_vacuum", "result": res1.stdout.strip()})

    # 2. Package manager cache clean
    res_dnf = await runner.run(["dnf", "clean", "all"])
    if res_dnf.exit_code == 0:
        cleaned_items.append({"action": "dnf_clean", "result": res_dnf.stdout.strip() or "DNF cache cleaned"})
    else:
        res_apt = await runner.run(["apt-get", "clean"])
        if res_apt.exit_code == 0:
            cleaned_items.append({"action": "apt_clean", "result": "APT package cache cleaned"})
        else:
            res_pac = await runner.run(["pacman", "-Sc", "--noconfirm"])
            if res_pac.exit_code == 0:
                cleaned_items.append({"action": "pacman_clean", "result": "Pacman cache cleaned"})

    # 3. Docker system prune (if installed)
    res_docker = await runner.run(["docker", "system", "prune", "-f"])
    if res_docker.exit_code == 0:
        cleaned_items.append({"action": "docker_prune", "result": res_docker.stdout.strip() or "Dangling Docker containers & images removed"})

    return {
        "status": "success",
        "message": "System cleanup completed successfully.",
        "details": cleaned_items,
    }


async def optimize_performance() -> dict:
    """
    Diagnose top CPU and Memory hogs and recommend optimizations.
    """
    from app.diagnostics.processes import get_top_processes
    
    top_cpu = await get_top_processes(n=5, sort_by="cpu")
    top_mem = await get_top_processes(n=5, sort_by="memory")
    
    recommendations = []
    for proc in top_cpu:
        if proc.get("cpu_percent", 0) > 50:
            recommendations.append(
                f"Process '{proc.get('name')}' (PID {proc.get('pid')}) is using {proc.get('cpu_percent')}% CPU."
            )
            
    for proc in top_mem:
        if proc.get("memory_percent", 0) > 30:
            recommendations.append(
                f"Process '{proc.get('name')}' (PID {proc.get('pid')}) is consuming {proc.get('memory_percent')}% Memory."
            )
            
    return {
        "top_cpu_processes": top_cpu,
        "top_memory_processes": top_mem,
        "recommendations": recommendations or ["System performance is within optimal bounds. No critical hogs detected."],
    }


async def audit_security() -> dict:
    """
    Perform 1-click personal security audit:
    - Open listening network ports
    - Firewall status
    - SELinux / AppArmor status
    - Failed SSH login attempts
    """
    from app.diagnostics.network import get_open_ports, get_firewall_status
    from app.diagnostics.security import get_selinux_status, get_auth_failures
    
    ports = await get_open_ports()
    firewall = await get_firewall_status()
    selinux = await get_selinux_status()
    auth_failures = await get_auth_failures()
    
    issues = []
    for p in ports:
        if p.get("port") in [22, 80, 443, 8000]:
            continue
        issues.append(f"Unusual open listening port: {p.get('port')} ({p.get('process') or 'unknown'})")
        
    if "inactive" in str(firewall.get("status", "")).lower() or "disabled" in str(firewall.get("status", "")).lower():
        issues.append("Firewall is inactive or disabled.")

    return {
        "status": "warning" if issues else "secure",
        "open_ports_count": len(ports),
        "firewall": firewall,
        "selinux": selinux,
        "auth_failures_recent": auth_failures.get("total_failures", 0),
        "security_findings": issues or ["No immediate security vulnerabilities or open risks detected."],
    }


async def rollback_last_action(filepath: str | None = None) -> dict:
    """
    Restores the most recent timestamped file backup.
    """
    if filepath and os.path.exists(filepath):
        backups = sorted(glob.glob(f"{filepath}.bak.*"), reverse=True)
        if backups:
            target_bak = backups[0]
            shutil.copy2(target_bak, filepath)
            return {"status": "success", "message": f"Restored {filepath} from {target_bak}"}
        return {"status": "error", "message": f"No backup found for {filepath}"}
        
    search_pattern = "/etc/**/*.bak.*"
    all_backups = sorted(glob.glob(search_pattern, recursive=True), key=os.path.getmtime, reverse=True)
    if not all_backups:
        return {"status": "error", "message": "No system backup files found to restore."}
        
    latest_bak = all_backups[0]
    target_file = latest_bak.split(".bak.")[0]
    if os.path.exists(latest_bak):
        shutil.copy2(latest_bak, target_file)
        return {"status": "success", "message": f"Restored {target_file} from backup {latest_bak}"}
        
    return {"status": "error", "message": "Failed to perform rollback."}
