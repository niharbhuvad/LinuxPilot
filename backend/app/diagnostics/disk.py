"""
LinuxAI — Disk Diagnostic Module
"""

from app.executor.runner import runner
import psutil


async def get_filesystem_usage() -> dict:
    """Get filesystem usage with inode info."""
    result_h = await runner.run(["df", "-h"], approved=True)
    result_i = await runner.run(["df", "-i"], approved=True)
    return {
        "disk_usage": result_h.stdout,
        "inode_usage": result_i.stdout,
    }


async def find_large_files(path: str = "/", size_mb: int = 100, max_results: int = 20) -> dict:
    """Find files larger than size_mb in the given path."""
    args = [
        "find", path, "-xdev",
        "-type", "f",
        "-size", f"+{size_mb}M",
        "-printf", "%s %p\n",
    ]
    result = await runner.run(args, approved=True)
    files = []
    if result.succeeded:
        lines = result.stdout.strip().splitlines()[:max_results]
        for line in lines:
            parts = line.split(" ", 1)
            if len(parts) == 2:
                try:
                    size_bytes = int(parts[0])
                    files.append({
                        "path": parts[1],
                        "size_mb": round(size_bytes / (1024 * 1024), 1),
                    })
                except ValueError:
                    continue
        files.sort(key=lambda f: f["size_mb"], reverse=True)
    return {"path": path, "min_size_mb": size_mb, "files": files}


async def get_directory_sizes(path: str = "/") -> dict:
    """Get top-level directory sizes."""
    result = await runner.run(["du", "-xhd1", path], approved=True)
    return {"path": path, "output": result.stdout}


async def get_journal_disk_usage() -> dict:
    """Get systemd journal disk usage."""
    result = await runner.run(["journalctl", "--disk-usage"], approved=True)
    return {"output": result.stdout}


async def get_block_devices() -> dict:
    """List block devices."""
    result = await runner.run(["lsblk", "-o", "NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE,UUID"], approved=True)
    return {"output": result.stdout}
