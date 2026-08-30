import asyncio

from sqlalchemy import select

from app.database.session import AsyncSessionLocal
from app.models.api_key import UserAPIKey
from app.utils.encryption import decrypt_api_key


async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(UserAPIKey).order_by(UserAPIKey.created_at)
        )

        keys = result.scalars().all()

        print(f"STORED KEYS: {len(keys)}")

        for key in keys:
            try:
                decrypted = decrypt_api_key(key.encrypted_key)

                print(
                    f"PROVIDER: {key.provider} | "
                    f"DECRYPTION: {'PASS' if decrypted else 'FAIL'}"
                )
            except Exception as e:
                print(
                    f"PROVIDER: {key.provider} | "
                    f"DECRYPTION: FAIL ({type(e).__name__})"
                )


if __name__ == "__main__":
    asyncio.run(main())