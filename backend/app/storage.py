import os
import shutil
import uuid
from pathlib import Path

from fastapi import UploadFile

from app.config import settings


def ensure_storage_dir() -> Path:
    root = Path(settings.storage_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def save_upload(user_id: str, upload: UploadFile) -> tuple[str, str, int]:
    root = ensure_storage_dir()
    user_dir = root / user_id
    user_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(upload.filename or "").suffix
    stored_name = f"{uuid.uuid4().hex}{ext}"
    destination = user_dir / stored_name

    with destination.open("wb") as out_file:
        shutil.copyfileobj(upload.file, out_file)

    size = os.path.getsize(destination)
    relative_path = str(destination.relative_to(root))
    return stored_name, relative_path, size


def get_absolute_path(relative_path: str) -> Path:
    root = ensure_storage_dir()
    return root / relative_path
