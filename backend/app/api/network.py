"""LinuxAI — Network API"""
from fastapi import APIRouter, Depends
from app.api.auth import get_current_user
from app.models.user import User
from app.diagnostics.network import (
    get_network_interfaces, get_open_ports, get_routes,
    get_firewall_status, get_dns_status, check_network_connectivity,
)

router = APIRouter()

@router.get("")
async def network(user: User = Depends(get_current_user)):
    ifaces = await get_network_interfaces()
    ports = await get_open_ports()
    routes = await get_routes()
    return {"interfaces": ifaces, "ports": ports, "routes": routes}

@router.get("/interfaces")
async def interfaces(user: User = Depends(get_current_user)):
    return await get_network_interfaces()

@router.get("/ports")
async def ports(user: User = Depends(get_current_user)):
    return await get_open_ports()

@router.get("/firewall")
async def firewall(user: User = Depends(get_current_user)):
    return await get_firewall_status()

@router.get("/dns")
async def dns(user: User = Depends(get_current_user)):
    return await get_dns_status()

@router.get("/ping")
async def ping(host: str = "8.8.8.8", count: int = 4, user: User = Depends(get_current_user)):
    return await check_network_connectivity(host, min(count, 10))
