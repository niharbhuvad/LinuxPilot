"""LinuxAI — Alerts API"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, timezone

from app.api.auth import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.models.task import Alert
from app.schemas import AlertOut, AlertUpdate

router = APIRouter()

async def sync_real_system_alerts(db: AsyncSession):
    """Scan live target system diagnostics and generate real active alerts."""
    import uuid
    from app.diagnostics.services import get_failed_services
    from app.diagnostics.system import get_cpu_usage, get_memory_usage, get_disk_usage
    from app.diagnostics.security import get_selinux_status, get_auth_failures

    try:
        failed_data = await get_failed_services()
        cpu_data = await get_cpu_usage()
        mem_data = await get_memory_usage()
        disk_data = await get_disk_usage()
        selinux_data = await get_selinux_status()
        auth_data = await get_auth_failures(lines=20)
    except Exception:
        return

    existing_res = await db.execute(select(Alert))
    existing_alerts = existing_res.scalars().all()
    existing_titles = {a.title for a in existing_alerts}

    # Delete old mock sample alerts if present
    for a in existing_alerts:
        if "62%" in a.title or "Nginx Reverse Proxy Service Active" in a.title:
            await db.delete(a)

    new_alerts = []

    # 1. Real Failed Services Alert
    failed_services = failed_data.get("services", [])
    for svc in failed_services:
        unit = svc.get("unit", "service")
        title = f"Service Failure: {unit}"
        if title not in existing_titles:
            new_alerts.append(Alert(
                id=str(uuid.uuid4()),
                severity="CRITICAL",
                category="service",
                title=title,
                message=f"Systemd service '{unit}' has failed (Sub-state: {svc.get('sub', 'failed')}). {svc.get('description', '')}",
                recommendation=f"Run 'systemctl status {unit}' or inspect logs with 'journalctl -u {unit}'.",
                status="active",
            ))

    # 2. Real Disk Usage Alert
    for d in disk_data:
        mount = d.get("mount", "/")
        pct = d.get("percent", 0)
        if pct >= 80:
            severity = "CRITICAL" if pct >= 90 else "WARNING"
            title = f"High Disk Usage on {mount} ({pct}%)"
            if title not in existing_titles:
                new_alerts.append(Alert(
                    id=str(uuid.uuid4()),
                    severity=severity,
                    category="disk",
                    title=title,
                    message=f"Filesystem mounted at {mount} is using {pct}% of capacity ({d.get('used', '0')} used of {d.get('total', '0')}).",
                    recommendation="Use 'find_large_files' tool or clean package/journal caches to free disk space.",
                    status="active",
                ))

    # 3. Real Memory Usage Alert
    mem_pct = mem_data.get("percent", 0)
    if mem_pct >= 85:
        severity = "CRITICAL" if mem_pct >= 95 else "WARNING"
        title = f"High Memory Utilization ({mem_pct}%)"
        if title not in existing_titles:
            new_alerts.append(Alert(
                id=str(uuid.uuid4()),
                severity=severity,
                category="memory",
                title=title,
                message=f"System RAM usage is currently at {mem_pct}% ({mem_data.get('used_gb', 0)}GB used of {mem_data.get('total_gb', 0)}GB).",
                recommendation="Inspect top memory consuming processes or restart high-memory services.",
                status="active",
            ))

    # 4. Real CPU Usage Alert
    cpu_pct = cpu_data.get("percent", 0)
    if cpu_pct >= 85:
        title = f"High CPU Load ({cpu_pct}%)"
        if title not in existing_titles:
            new_alerts.append(Alert(
                id=str(uuid.uuid4()),
                severity="WARNING",
                category="cpu",
                title=title,
                message=f"CPU processor utilization is at {cpu_pct}% across {cpu_data.get('count_logical', 1)} cores.",
                recommendation="Check top CPU processes using 'get_top_processes'.",
                status="active",
            ))

    # 5. Real SELinux Alert
    mode = selinux_data.get("mode", "").lower()
    if "permissive" in mode or "disabled" in mode:
        title = f"SELinux Security Alert: {mode.capitalize()}"
        if title not in existing_titles:
            new_alerts.append(Alert(
                id=str(uuid.uuid4()),
                severity="WARNING",
                category="selinux",
                title=title,
                message=f"SELinux is operating in '{mode}' mode instead of Enforcing.",
                recommendation="Re-enable SELinux enforcement using 'setenforce 1' or edit /etc/selinux/config.",
                status="active",
            ))

    # 6. Real Auth Failures Alert
    fail_cnt = auth_data.get("failure_lines", 0)
    if fail_cnt > 0:
        title = f"SSH Authentication Failures ({fail_cnt} events)"
        if title not in existing_titles:
            new_alerts.append(Alert(
                id=str(uuid.uuid4()),
                severity="WARNING",
                category="security",
                title=title,
                message=f"Detected {fail_cnt} failed authentication or invalid login attempts in system journal.",
                recommendation="Inspect SSH auth logs and verify firewall/fail2ban rules.",
                status="active",
            ))

    # 7. Real Live System Health Status Alert if clean
    if not new_alerts and not [a for a in existing_alerts if a.severity in ("CRITICAL", "WARNING")]:
        ok_title = "Live Target System Healthy (0 Critical Issues)"
        if ok_title not in existing_titles:
            new_alerts.append(Alert(
                id=str(uuid.uuid4()),
                severity="INFO",
                category="system",
                title=ok_title,
                message=f"Live scan completed. Services, memory ({mem_pct}%), CPU ({cpu_pct}%), and filesystems are operating normally.",
                recommendation="System health is optimal. No action required.",
                status="active",
            ))

    if new_alerts:
        db.add_all(new_alerts)
        await db.commit()


@router.get("")
async def list_alerts(
    status: str = "active", limit: int = 50,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await sync_real_system_alerts(db)
    query = select(Alert).order_by(desc(Alert.created_at)).limit(min(limit, 200))
    if status != "all":
        query = query.where(Alert.status == status)
    result = await db.execute(query)
    return [AlertOut.model_validate(a) for a in result.scalars().all()]

@router.put("/{alert_id}", response_model=AlertOut)
async def update_alert(
    alert_id: str, data: AlertUpdate,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.status = data.status
    alert.resolved_by = user.id
    alert.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(alert)
    return AlertOut.model_validate(alert)
