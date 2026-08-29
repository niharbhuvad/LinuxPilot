"""
LinuxAI — Create Default Admin User
Run once after first setup: python scripts/create_admin.py
"""

import asyncio
import sys
import os
import bcrypt
import uuid

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.database.session import init_db, AsyncSessionLocal
from app.models.user import User
from sqlalchemy import select


def hash_password(password: str) -> str:
    pw_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pw_bytes, salt).decode('utf-8')


async def create_admin():
    await init_db()

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.username == "admin"))
        existing = result.scalar_one_or_none()
        if existing:
            print("[OK] Admin user already exists: admin")
            return

        admin = User(
            id=str(uuid.uuid4()),
            username="admin",
            hashed_password=hash_password("admin123"),
            role="ADMIN",
            is_active=True,
        )
        db.add(admin)
        await db.commit()
        print("[OK] Admin user created successfully: admin / admin123")
        print("  WARNING: Change the default password immediately in production!")


if __name__ == "__main__":
    asyncio.run(create_admin())
