"""LinuxAI — Diagnostics Package Init"""
from app.diagnostics import system, disk, processes, services, network, packages, users, storage, security, logs

__all__ = ["system", "disk", "processes", "services", "network", "packages", "users", "storage", "security", "logs"]
