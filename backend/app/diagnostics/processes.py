"""
LinuxAI — Process Diagnostic & Management Module
Supports fetching and managing processes from both remote connected Linux targets (via SSH ps/top) and local PC workstation (via psutil).
"""

import asyncio
import psutil
from app.config import get_settings
from app.executor.runner import runner


async def get_top_processes(target: str = "auto", n: int = 50, sort_by: str = "cpu") -> dict:
    """Get process list and system statistics from target (remote SSH or local PC)."""
    from app.api.ssh import _load_persistent_config
    _load_persistent_config()
    settings = get_settings()

    is_remote = (target == "remote") or (target == "auto" and settings.ssh_enabled and bool(settings.ssh_host))

    if is_remote:
        return await _get_remote_processes(settings.ssh_host or "Linux Target", n, sort_by)
    else:
        return await _get_local_processes(n, sort_by)


async def _get_remote_processes(host_name: str, n: int, sort_by: str) -> dict:
    """Fetch remote Linux processes using ps -eo over SSH."""
    # ps command retrieving pid, ppid, user, %cpu, %mem, rss (KB), stat, command
    sort_flag = "-%cpu" if sort_by == "cpu" else "-%mem"
    cmd = ["ps", "-eo", "pid,ppid,user,%cpu,%mem,rss,stat,comm,args", f"--sort={sort_flag}"]
    
    res = await runner.run(cmd, approved=True)
    if res.exit_code != 0 or not res.stdout:
        # Fallback to standard ps aux
        res = await runner.run(["ps", "aux"], approved=True)

    procs = []
    lines = [l for l in res.stdout.splitlines() if l.strip()]
    header_skipped = False

    running_cnt = 0
    sleeping_cnt = 0
    stopped_cnt = 0
    zombie_cnt = 0

    for line in lines:
        parts = line.split(None, 8)
        if not parts or parts[0] == "PID" or parts[0] == "USER":
            header_skipped = True
            continue

        try:
            # Handle ps -eo formatting or ps aux formatting
            if len(parts) >= 8:
                pid = int(parts[0])
                ppid = int(parts[1]) if parts[1].isdigit() else 0
                user = parts[2]
                try:
                    cpu = float(parts[3])
                except ValueError:
                    cpu = 0.0
                try:
                    mem = float(parts[4])
                except ValueError:
                    mem = 0.0
                try:
                    rss_kb = float(parts[5])
                    mem_mb = round(rss_kb / 1024, 1)
                except ValueError:
                    mem_mb = 0.0
                stat_code = parts[6]
                name = parts[7]
                cmdline = parts[8] if len(parts) > 8 else name

                # Status mapping
                if "Z" in stat_code:
                    status = "zombie"
                    zombie_cnt += 1
                elif "R" in stat_code:
                    status = "running"
                    running_cnt += 1
                elif "T" in stat_code:
                    status = "stopped"
                    stopped_cnt += 1
                else:
                    status = "sleeping"
                    sleeping_cnt += 1

                procs.append({
                    "pid": pid,
                    "ppid": ppid,
                    "name": name,
                    "username": user,
                    "cpu_percent": round(cpu, 1),
                    "memory_percent": round(mem, 1),
                    "memory_mb": mem_mb,
                    "status": status,
                    "command": cmdline,
                })
        except Exception:
            continue

    # Sort
    key = "memory_percent" if sort_by == "memory" else "cpu_percent"
    sorted_procs = sorted(procs, key=lambda p: p.get(key, 0), reverse=True)[:n]

    total_procs = len(procs)
    return {
        "target": "remote",
        "target_name": f"Remote Linux System ({host_name})",
        "host": host_name,
        "processes": sorted_procs,
        "stats": {
            "total": total_procs,
            "running": running_cnt,
            "sleeping": sleeping_cnt,
            "stopped": stopped_cnt,
            "zombies": zombie_cnt,
        },
    }


async def _get_local_processes(n: int, sort_by: str) -> dict:
    """Fetch local PC workstation processes using psutil."""
    loop = asyncio.get_event_loop()

    def collect():
        procs = []
        running_cnt = 0
        sleeping_cnt = 0
        stopped_cnt = 0
        zombie_cnt = 0

        for proc in psutil.process_iter(
            ["pid", "name", "username", "cpu_percent", "memory_percent", "memory_info", "status", "cmdline", "ppid"]
        ):
            try:
                info = proc.info
                mem_mb = info["memory_info"].rss / (1024**2) if info.get("memory_info") else 0
                st = str(info.get("status", "unknown")).lower()
                
                if "run" in st:
                    running_cnt += 1
                elif "zomb" in st:
                    zombie_cnt += 1
                elif "stop" in st:
                    stopped_cnt += 1
                else:
                    sleeping_cnt += 1

                procs.append({
                    "pid": info["pid"],
                    "ppid": info.get("ppid") or 0,
                    "name": info["name"] or "unknown",
                    "username": info.get("username") or "system",
                    "cpu_percent": round(info.get("cpu_percent") or 0.0, 1),
                    "memory_percent": round(info.get("memory_percent") or 0.0, 1),
                    "memory_mb": round(mem_mb, 1),
                    "status": st,
                    "command": " ".join(info.get("cmdline") or [info.get("name") or ""]),
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue

        key = "memory_percent" if sort_by == "memory" else "cpu_percent"
        sorted_procs = sorted(procs, key=lambda p: p.get(key, 0), reverse=True)[:n]

        return {
            "target": "local",
            "target_name": "My PC Workstation (Local Host)",
            "host": "Local PC",
            "processes": sorted_procs,
            "stats": {
                "total": len(procs),
                "running": running_cnt,
                "sleeping": sleeping_cnt,
                "stopped": stopped_cnt,
                "zombies": zombie_cnt,
            },
        }

    return await loop.run_in_executor(None, collect)


async def kill_process(pid: int, signal: int = 15, target: str = "auto") -> dict:
    """Kill or terminate a process by PID on remote SSH target or local PC."""
    from app.api.ssh import _load_persistent_config
    _load_persistent_config()
    settings = get_settings()

    is_remote = (target == "remote") or (target == "auto" and settings.ssh_enabled and bool(settings.ssh_host))

    if is_remote:
        cmd = ["kill", f"-{signal}", str(pid)]
        res = await runner.run(cmd, approved=True)
        if res.exit_code == 0:
            return {"success": True, "message": f"Successfully sent signal {signal} to remote PID {pid}"}
        else:
            # Fallback to sudo kill if permission denied
            sudo_res = await runner.run(["sudo", "kill", f"-{signal}", str(pid)], approved=True)
            if sudo_res.exit_code == 0:
                return {"success": True, "message": f"Successfully sent signal {signal} to remote PID {pid} via sudo"}
            return {"success": False, "message": sudo_res.stderr or res.stderr or f"Failed to kill remote PID {pid}"}
    else:
        try:
            p = psutil.Process(pid)
            if signal == 9:
                p.kill()
            else:
                p.terminate()
            return {"success": True, "message": f"Successfully terminated local PID {pid}"}
        except psutil.NoSuchProcess:
            return {"success": False, "message": f"Process PID {pid} not found on local PC"}
        except psutil.AccessDenied:
            return {"success": False, "message": f"Access denied to terminate local PID {pid}. Run LinuxAI as admin."}
        except Exception as e:
            return {"success": False, "message": str(e)}


async def get_process_info(pid: int, target: str = "auto") -> dict:
    """Get detailed information about a specific process."""
    from app.api.ssh import _load_persistent_config
    _load_persistent_config()
    settings = get_settings()

    is_remote = (target == "remote") or (target == "auto" and settings.ssh_enabled and bool(settings.ssh_host))

    if is_remote:
        res = await runner.run(["ps", "-p", str(pid), "-o", "pid,ppid,user,%cpu,%mem,rss,stat,comm,args"], approved=True)
        if res.exit_code == 0 and len(res.stdout.splitlines()) > 1:
            line = res.stdout.splitlines()[1].strip()
            parts = line.split(None, 8)
            return {
                "found": True,
                "process": {
                    "pid": pid,
                    "ppid": parts[1] if len(parts) > 1 else "0",
                    "username": parts[2] if len(parts) > 2 else "unknown",
                    "cpu_percent": parts[3] if len(parts) > 3 else "0.0",
                    "memory_percent": parts[4] if len(parts) > 4 else "0.0",
                    "memory_mb": round(float(parts[5]) / 1024, 1) if len(parts) > 5 and parts[5].isdigit() else "0",
                    "status": parts[6] if len(parts) > 6 else "unknown",
                    "name": parts[7] if len(parts) > 7 else "process",
                    "cmdline": parts[8] if len(parts) > 8 else parts[7],
                },
            }
        return {"found": False, "error": f"Remote Process {pid} not found"}
    else:
        try:
            proc = psutil.Process(pid)
            with proc.oneshot():
                info = {
                    "pid": pid,
                    "name": proc.name(),
                    "status": proc.status(),
                    "username": proc.username(),
                    "cpu_percent": proc.cpu_percent(interval=0.1),
                    "memory_mb": round(proc.memory_info().rss / (1024**2), 1),
                    "cmdline": " ".join(proc.cmdline()),
                    "threads": proc.num_threads(),
                    "ppid": proc.ppid(),
                }
            return {"found": True, "process": info}
        except psutil.NoSuchProcess:
            return {"found": False, "error": f"Process {pid} not found"}
        except psutil.AccessDenied:
            return {"found": False, "error": f"Access denied to process {pid}"}


async def get_zombie_processes() -> list[dict]:
    """Find zombie processes."""
    zombies = []
    for proc in psutil.process_iter(["pid", "name", "status", "username"]):
        try:
            if proc.info["status"] == psutil.STATUS_ZOMBIE:
                zombies.append({
                    "pid": proc.info["pid"],
                    "name": proc.info["name"],
                    "username": proc.info["username"],
                })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return zombies
