import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.database.session import init_db, AsyncSessionLocal
from app.models.user import User
from app.api.auth import verify_password, hash_password
from sqlalchemy import select, delete


async def test_and_fix():
    await init_db()
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).where(User.username == "admin"))
        user = res.scalar_one_or_none()

        if user:
            print("Existing user found:", user.username)
            print("Existing hash:", user.hashed_password)
            valid = verify_password("admin123", user.hashed_password)
            print("Is valid with verify_password:", valid)
            if not valid:
                user.hashed_password = hash_password("admin123")
                await db.commit()
                print("Updated hash using auth.hash_password")
        else:
            admin = User(
                username="admin",
                hashed_password=hash_password("admin123"),
                role="ADMIN",
                is_active=True,
            )
            db.add(admin)
            await db.commit()
            print("Created admin user with auth.hash_password")

        # Verify again
        res2 = await db.execute(select(User).where(User.username == "admin"))
        user2 = res2.scalar_one_or_none()
        print("Final verification check:", verify_password("admin123", user2.hashed_password))

if __name__ == "__main__":
    asyncio.run(test_and_fix())
