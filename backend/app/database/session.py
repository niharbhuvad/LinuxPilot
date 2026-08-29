"""
LinuxAI — Database Session & Init
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=settings.is_development,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {},
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def init_db():
    """Create all tables on startup and seed default admin user if missing."""
    import uuid
    import bcrypt
    from sqlalchemy import select
    from app.models import user, conversation, command, task, alert, audit  # noqa
    from app.models.user import User
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed default admin user if database has no admin user
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.username == "admin"))
        existing = result.scalar_one_or_none()
        if not existing:
            hashed = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode('utf-8')
            admin = User(
                id=str(uuid.uuid4()),
                username="admin",
                hashed_password=hashed,
                role="ADMIN",
                is_active=True,
            )
            session.add(admin)
            await session.commit()

        # Alerts are dynamically scanned and populated from live host diagnostics in api/alerts.py
        from app.models.task import Alert, Task
        from app.models.command import Command

        tasks_res = await session.execute(select(Task))
        if not tasks_res.scalars().all():
            sample_tasks = [
                Task(
                    id=str(uuid.uuid4()),
                    name="Daily DNF Package Security Scan",
                    description="Automatically run DNF check-update every night to discover available RPM security patches.",
                    schedule="0 2 * * *",
                    actions=["check_available_updates"],
                    enabled=True,
                ),
                Task(
                    id=str(uuid.uuid4()),
                    name="Hourly Journal Log Size Monitoring",
                    description="Check systemd journal disk footprint and alert if logs exceed 2GB.",
                    schedule="0 * * * *",
                    actions=["get_journal_disk_usage"],
                    enabled=True,
                ),
            ]
            session.add_all(sample_tasks)

        # Command history is populated from real user executions — no mock data seeded

        await session.commit()



async def get_db():
    """FastAPI dependency — yields a database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
