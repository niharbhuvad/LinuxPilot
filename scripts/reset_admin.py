import asyncio
import sys
import os
# pyrefly: ignore [missing-import]
import bcrypt

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.database.session import init_db, AsyncSessionLocal
from app.models.user import User
from sqlalchemy import select, delete


async def reset():
    await init_db()
    async with AsyncSessionLocal() as db:
        # Delete existing admin
        await db.execute(delete(User).where(User.username == "admin"))
        await db.commit()

        # Hash admin123
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(b"admin123", salt).decode('utf-8')

        admin = User(
            username="admin",
            hashed_password=hashed,
            role="ADMIN",
            is_active=True,
        )
        db.add(admin)
        await db.commit()
        print("[OK] Successfully reset admin password to 'admin123'")

        # Test verification
        res = await db.execute(select(User).where(User.username == "admin"))
        user = res.scalar_one_or_none()
        valid = bcrypt.checkpw(b"admin123", user.hashed_password.encode('utf-8'))
        print(f"[VERIFY] Password check for 'admin123': {valid}")

if __name__ == "__main__":
    asyncio.run(reset())
