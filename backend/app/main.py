from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import initialize_database
from app.routers import auth, files, folders
from app.storage import ensure_storage_dir


app = FastAPI(title=settings.app_name)

origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    initialize_database()
    ensure_storage_dir()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(files.router, prefix=settings.api_prefix)
app.include_router(folders.router, prefix=settings.api_prefix)
