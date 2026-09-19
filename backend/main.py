from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import contextlib

from database import engine, Base
from routers import router

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Cleanup on shutdown
    await engine.dispose()

app = FastAPI(title="Israel LPG Finder API", lifespan=lifespan)

# Allow CORS for Angular frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For dev. Change in production.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.get("/")
def read_root():
    return {"message": "Welcome to Israel LPG Finder API"}
