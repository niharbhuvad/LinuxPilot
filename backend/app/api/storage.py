"""LinuxAI — Storage API"""
from fastapi import APIRouter, Depends
from app.api.auth import get_current_user
from app.models.user import User
from app.diagnostics.storage import get_lvm_info, get_mount_points, get_block_devices
from app.diagnostics.disk import find_large_files, get_directory_sizes, get_journal_disk_usage

router = APIRouter()

@router.get("")
async def storage(user: User = Depends(get_current_user)):
    return {
        "block_devices": await get_block_devices(),
        "lvm": await get_lvm_info(),
        "mounts": await get_mount_points(),
    }

@router.get("/lvm")
async def lvm(user: User = Depends(get_current_user)):
    return await get_lvm_info()

@router.get("/large-files")
async def large_files(path: str = "/", size_mb: int = 100, user: User = Depends(get_current_user)):
    return await find_large_files(path, size_mb)

@router.get("/journal")
async def journal_usage(user: User = Depends(get_current_user)):
    return await get_journal_disk_usage()
