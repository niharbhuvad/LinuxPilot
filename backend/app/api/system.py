"""
LinuxAI — System API
REST endpoints for system metrics, health score, and live monitoring.
"""

import asyncio
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from app.api.auth import get_current_user
from app.models.user import User
from app.diagnostics.system import (
    get_system_info, get_cpu_usage, get_memory_usage,
    get_disk_usage, get_load_average,
)
from app.diagnostics.services import get_failed_services
from app.diagnostics.security import get_selinux_status

router = APIRouter()


@router.get("")
async def system_overview(user: User = Depends(get_current_user)):
    """Get complete system information."""
    return await get_system_info()


@router.get("/cpu")
async def cpu(user: User = Depends(get_current_user)):
    return await get_cpu_usage()


@router.get("/memory")
async def memory(user: User = Depends(get_current_user)):
    return await get_memory_usage()


@router.get("/disk")
async def disk(user: User = Depends(get_current_user)):
    return await get_disk_usage()


@router.get("/health-score")
async def health_score(user: User = Depends(get_current_user)):
    """Compute system health score (0–100) with explainable components."""
    cpu_data = await get_cpu_usage()
    mem_data = await get_memory_usage()
    disk_data = await get_disk_usage()
    failed = await get_failed_services()
    load = await get_load_average()
    selinux = await get_selinux_status()

    components = {}
    score = 100
    alerts = []

    # ── CPU Score (20 points) ─────────────────────────────────────────────────
    cpu_pct = cpu_data["percent"]
    if cpu_pct >= 95:
        cpu_score = 0
        alerts.append(f"CPU critical: {cpu_pct}%")
    elif cpu_pct >= 80:
        cpu_score = 10
        alerts.append(f"CPU high: {cpu_pct}%")
    elif cpu_pct >= 60:
        cpu_score = 15
    else:
        cpu_score = 20
    components["cpu"] = {"score": cpu_score, "max": 20, "value": f"{cpu_pct}%"}
    score -= (20 - cpu_score)

    # ── Memory Score (20 points) ──────────────────────────────────────────────
    mem_pct = mem_data["percent"]
    if mem_pct >= 95:
        mem_score = 0
        alerts.append(f"Memory critical: {mem_pct}%")
    elif mem_pct >= 85:
        mem_score = 10
        alerts.append(f"Memory high: {mem_pct}%")
    elif mem_pct >= 70:
        mem_score = 15
    else:
        mem_score = 20
    components["memory"] = {"score": mem_score, "max": 20, "value": f"{mem_pct}%"}
    score -= (20 - mem_score)

    # ── Disk Score (20 points) ────────────────────────────────────────────────
    max_disk_pct = max((d["percent"] for d in disk_data), default=0)
    if max_disk_pct >= 95:
        disk_score = 0
        alerts.append(f"Disk critical: {max_disk_pct}%")
    elif max_disk_pct >= 85:
        disk_score = 10
        alerts.append(f"Disk warning: {max_disk_pct}%")
    elif max_disk_pct >= 70:
        disk_score = 15
    else:
        disk_score = 20
    components["disk"] = {"score": disk_score, "max": 20, "value": f"{max_disk_pct}%"}
    score -= (20 - disk_score)

    # ── Services Score (20 points) ────────────────────────────────────────────
    failed_count = failed.get("failed_count", 0)
    if failed_count >= 5:
        svc_score = 0
        alerts.append(f"{failed_count} failed services")
    elif failed_count >= 2:
        svc_score = 10
        alerts.append(f"{failed_count} failed services")
    elif failed_count == 1:
        svc_score = 15
        alerts.append("1 failed service")
    else:
        svc_score = 20
    components["services"] = {"score": svc_score, "max": 20, "value": f"{failed_count} failed"}
    score -= (20 - svc_score)

    # ── SELinux Score (10 points) ─────────────────────────────────────────────
    selinux_mode_raw = selinux.get("mode", "").strip().lower()
    if "enforcing" in selinux_mode_raw or not selinux_mode_raw:
        sel_score = 10
        display_val = "enforcing"
    elif "permissive" in selinux_mode_raw:
        sel_score = 7
        display_val = "permissive"
        alerts.append("SELinux in permissive mode")
    elif "disabled" in selinux_mode_raw:
        sel_score = 3
        display_val = "disabled"
        alerts.append("SELinux disabled")
    else:
        sel_score = 10
        display_val = "enforcing"
    components["selinux"] = {"score": sel_score, "max": 10, "value": display_val}
    score -= (10 - sel_score)

    # ── Load Score (10 points) ────────────────────────────────────────────────
    load_1 = load[0] if load else 0
    cpu_count = cpu_data.get("count_logical", 1)
    load_ratio = load_1 / max(cpu_count, 1)
    if load_ratio >= 2.0:
        load_score = 0
        alerts.append(f"High load average: {load_1}")
    elif load_ratio >= 1.0:
        load_score = 5
    else:
        load_score = 10
    components["load"] = {"score": load_score, "max": 10, "value": f"{load_1}"}
    score -= (10 - load_score)

    score = max(0, min(100, score))

    if score >= 90:
        grade = "A"
    elif score >= 75:
        grade = "B"
    elif score >= 60:
        grade = "C"
    elif score >= 40:
        grade = "D"
    else:
        grade = "F"

    return {
        "score": score,
        "grade": grade,
        "components": components,
        "alerts": alerts,
    }


@router.websocket("/ws/metrics")
async def websocket_metrics(websocket: WebSocket):
    """WebSocket for live metric streaming to the frontend dashboard."""
    await websocket.accept()
    try:
        while True:
            cpu = await get_cpu_usage()
            mem = await get_memory_usage()
            load = await get_load_average()
            await websocket.send_json({
                "type": "metrics",
                "cpu": cpu,
                "memory": mem,
                "load": load,
            })
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        pass


@router.post("/maintenance/clean-disk")
async def api_clean_disk(user: User = Depends(get_current_user)):
    """Run 1-click system disk space cleanup."""
    from app.diagnostics.maintenance import clean_disk_space
    return await clean_disk_space()


@router.post("/maintenance/optimize")
async def api_optimize(user: User = Depends(get_current_user)):
    """Run 1-click system performance diagnosis."""
    from app.diagnostics.maintenance import optimize_performance
    return await optimize_performance()


@router.get("/maintenance/audit-security")
async def api_audit_security(user: User = Depends(get_current_user)):
    """Run 1-click personal security audit."""
    from app.diagnostics.maintenance import audit_security
    return await audit_security()


@router.post("/maintenance/rollback")
async def api_rollback(filepath: str | None = None, user: User = Depends(get_current_user)):
    """Restore latest timestamped backup configuration file."""
    from app.diagnostics.maintenance import rollback_last_action
    return await rollback_last_action(filepath)

