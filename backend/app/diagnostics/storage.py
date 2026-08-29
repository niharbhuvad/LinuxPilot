"""
LinuxAI — Storage Diagnostic Module (LVM, mounts, partitions)
"""

from app.executor.runner import runner


async def get_lvm_info() -> dict:
    """Get LVM physical volumes, volume groups, and logical volumes."""
    pvs = await runner.run(["pvs", "--noheadings", "-o", "pv_name,vg_name,pv_size,pv_free"], approved=True)
    vgs = await runner.run(["vgs", "--noheadings", "-o", "vg_name,lv_count,vg_size,vg_free"], approved=True)
    lvs = await runner.run(["lvs", "--noheadings", "-o", "lv_name,vg_name,lv_size,lv_attr"], approved=True)
    return {
        "physical_volumes": pvs.stdout,
        "volume_groups": vgs.stdout,
        "logical_volumes": lvs.stdout,
        "lvm_available": pvs.exit_code == 0,
    }


async def get_mount_points() -> dict:
    """Get all current mount points."""
    result = await runner.run(["findmnt", "--tree", "--noheadings"], approved=True)
    return {"output": result.stdout}


async def get_block_devices() -> dict:
    """List all block devices with detailed info."""
    result = await runner.run(
        ["lsblk", "-o", "NAME,MAJ:MIN,RM,SIZE,RO,TYPE,MOUNTPOINTS,FSTYPE,UUID"],
        approved=True,
    )
    return {"output": result.stdout}
