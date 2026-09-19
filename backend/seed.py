import json
import asyncio
import asyncpg

DB_URL = "postgresql://postgres:postgrespassword@localhost:5432/israel_lpg"
DEFAULT_URL = "postgresql://postgres:postgrespassword@localhost:5432/postgres"

async def init_db():
    try:
        conn = await asyncpg.connect(DEFAULT_URL)
        # Create database if not exists
        databases = await conn.fetch("SELECT datname FROM pg_database WHERE datname = 'israel_lpg'")
        if not databases:
            await conn.execute('CREATE DATABASE israel_lpg')
            print("Created database israel_lpg")
        await conn.close()
    except Exception as e:
        print(f"Error creating DB: {e}")

async def seed():
    from database import engine, Base
    from models import Station
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import sessionmaker

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    with open('stations.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    async with AsyncSessionLocal() as session:
        for item in data:
            station = Station(**item)
            session.add(station)
        await session.commit()
    print("Database seeded successfully!")

async def main():
    await init_db()
    await seed()

if __name__ == "__main__":
    asyncio.run(main())
