"""
LinuxAI Backend — Main FastAPI Application
"""

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.config import get_settings

settings = get_settings()
logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    logger.info(
        "LinuxAI starting",
        version=settings.app_version,
        env=settings.app_env,
    )
    # Initialize database tables on startup
    from app.database.session import init_db
    await init_db()

    logger.info("LinuxAI ready", model=settings.openai_model)
    yield

    logger.info("LinuxAI shutting down")


def create_app() -> FastAPI:
    app = FastAPI(
        title="LinuxAI",
        description="AI-Powered Linux System Administration Agent",
        version=settings.app_version,
        docs_url="/api/docs" if settings.is_development else None,
        redoc_url="/api/redoc" if settings.is_development else None,
        lifespan=lifespan,
    )

    # ── Middleware ─────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # ── Routers ────────────────────────────────────────────────────────────
    from app.api.system import router as system_router
    from app.api.chat import router as chat_router
    from app.api.commands import router as commands_router
    from app.api.services import router as services_router
    from app.api.processes import router as processes_router
    from app.api.network import router as network_router
    from app.api.storage import router as storage_router
    from app.api.logs import router as logs_router
    from app.api.tasks import router as tasks_router
    from app.api.alerts import router as alerts_router
    from app.api.auth import router as auth_router
    from app.api.ssh import router as ssh_router
    from app.api.files import router as files_router
    from app.api.users import router as users_router
    from app.api.packages import router as packages_router

    from app.api.quick_fix import router as quick_fix_router

    from app.api.terminal_ws import router as terminal_ws_router

    app.include_router(auth_router,     prefix="/api/auth",      tags=["Auth"])
    app.include_router(terminal_ws_router, prefix="/api/terminal", tags=["Terminal PTY"])
    app.include_router(ssh_router,      prefix="/api/ssh",       tags=["SSH"])
    app.include_router(files_router,    prefix="/api/files",     tags=["Files"])
    app.include_router(users_router,    prefix="/api/users",     tags=["Users"])
    app.include_router(packages_router, prefix="/api/packages",  tags=["Packages"])
    app.include_router(chat_router,     prefix="/api/chat",      tags=["Chat"])
    app.include_router(system_router,   prefix="/api/system",    tags=["System"])

    app.include_router(services_router, prefix="/api/services",  tags=["Services"])
    app.include_router(processes_router,prefix="/api/processes", tags=["Processes"])
    app.include_router(network_router,  prefix="/api/network",   tags=["Network"])
    app.include_router(storage_router,  prefix="/api/storage",   tags=["Storage"])
    app.include_router(logs_router,     prefix="/api/logs",      tags=["Logs"])
    app.include_router(quick_fix_router,prefix="/api/commands/quick-fix", tags=["Quick Fix"])
    app.include_router(commands_router, prefix="/api/commands",  tags=["Commands"])
    app.include_router(tasks_router,    prefix="/api/tasks",     tags=["Tasks"])
    app.include_router(alerts_router,   prefix="/api/alerts",    tags=["Alerts"])

    # ── Health check ───────────────────────────────────────────────────────
    @app.get("/health", tags=["Health"])
    async def health():
        return {
            "status": "ok",
            "name": settings.app_name,
            "version": settings.app_version,
            "env": settings.app_env,
        }

    return app


app = create_app()
