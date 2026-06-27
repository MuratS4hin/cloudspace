import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Folder, StoredFile, User
from app.schemas import FileResponse as FileSchema
from app.security import get_current_user
from app.storage import get_absolute_path, save_upload

router = APIRouter(prefix="/files", tags=["files"])


def _find_user_folder(folder_id: uuid.UUID | None, user_id: uuid.UUID, db: Session) -> Folder | None:
    if folder_id is None:
        return None
    query = select(Folder).where(Folder.id == folder_id, Folder.owner_id == user_id)
    folder = db.scalar(query)
    if not folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")
    return folder


@router.post("", response_model=FileSchema, status_code=status.HTTP_201_CREATED)
def upload_file(
    uploaded_file: UploadFile = File(...),
    folder_id: uuid.UUID | None = Form(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _find_user_folder(folder_id, user.id, db)
    stored_name, relative_path, size = save_upload(str(user.id), uploaded_file)

    file_record = StoredFile(
        owner_id=user.id,
        folder_id=folder_id,
        original_name=uploaded_file.filename or stored_name,
        stored_name=stored_name,
        relative_path=relative_path,
        content_type=uploaded_file.content_type or "application/octet-stream",
        size_bytes=size,
    )

    db.add(file_record)
    db.commit()
    db.refresh(file_record)
    return file_record


@router.get("", response_model=list[FileSchema])
def list_files(
    folder_id: uuid.UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _find_user_folder(folder_id, user.id, db)
    query = select(StoredFile).where(StoredFile.owner_id == user.id, StoredFile.folder_id == folder_id).order_by(desc(StoredFile.created_at))
    return list(db.scalars(query).all())


def _find_user_file(file_id: uuid.UUID, user_id: uuid.UUID, db: Session) -> StoredFile:
    query = select(StoredFile).where(StoredFile.id == file_id, StoredFile.owner_id == user_id)
    file_record = db.scalar(query)
    if not file_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return file_record


@router.get("/{file_id}/download")
def download_file(file_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    file_record = _find_user_file(file_id, user.id, db)
    absolute_path = get_absolute_path(file_record.relative_path)
    if not absolute_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stored file missing")

    return FileResponse(
        path=absolute_path,
        media_type=file_record.content_type,
        filename=file_record.original_name,
    )


@router.get("/{file_id}/preview")
def preview_file(file_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    file_record = _find_user_file(file_id, user.id, db)
    absolute_path = get_absolute_path(file_record.relative_path)
    if not absolute_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stored file missing")

    return FileResponse(path=absolute_path, media_type=file_record.content_type)


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(file_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    file_record = _find_user_file(file_id, user.id, db)
    absolute_path = get_absolute_path(file_record.relative_path)
    if absolute_path.exists():
        absolute_path.unlink()

    db.delete(file_record)
    db.commit()
    return None


@router.patch("/{file_id}/move", response_model=FileSchema)
def move_file(
    file_id: uuid.UUID,
    folder_id: uuid.UUID | None = Form(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    file_record = _find_user_file(file_id, user.id, db)
    _find_user_folder(folder_id, user.id, db)
    file_record.folder_id = folder_id
    db.commit()
    db.refresh(file_record)
    return file_record
