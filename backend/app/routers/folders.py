import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Folder, StoredFile, User
from app.schemas import FolderCreate, FolderMove, FolderResponse
from app.security import get_current_user

router = APIRouter(prefix="/folders", tags=["folders"])


def _find_user_folder(folder_id: uuid.UUID | None, user_id: uuid.UUID, db: Session) -> Folder | None:
    if folder_id is None:
        return None
    folder = db.scalar(select(Folder).where(Folder.id == folder_id, Folder.owner_id == user_id))
    if not folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")
    return folder


@router.get("", response_model=list[FolderResponse])
def list_folders(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = select(Folder).where(Folder.owner_id == user.id).order_by(Folder.created_at.asc())
    return list(db.scalars(query).all())


@router.post("", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
def create_folder(payload: FolderCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    parent = _find_user_folder(payload.parent_id, user.id, db)
    existing = db.scalar(
        select(Folder).where(
            Folder.owner_id == user.id,
            Folder.parent_id == (parent.id if parent else None),
            Folder.name == payload.name.strip(),
        )
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Folder already exists")

    folder = Folder(owner_id=user.id, parent_id=parent.id if parent else None, name=payload.name.strip())
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return folder


@router.patch("/{folder_id}/move", response_model=FolderResponse)
def move_folder(folder_id: uuid.UUID, payload: FolderMove, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    folder = db.scalar(select(Folder).where(Folder.id == folder_id, Folder.owner_id == user.id))
    if not folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

    parent = _find_user_folder(payload.parent_id, user.id, db)
    if parent and parent.id == folder.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Folder cannot contain itself")

    folder.parent_id = parent.id if parent else None
    db.commit()
    db.refresh(folder)
    return folder


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_folder(folder_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    folder = db.scalar(select(Folder).where(Folder.id == folder_id, Folder.owner_id == user.id))
    if not folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

    child_count = db.scalar(select(func.count()).select_from(Folder).where(Folder.parent_id == folder.id))
    file_count = db.scalar(select(func.count()).select_from(StoredFile).where(StoredFile.folder_id == folder.id))
    if child_count or file_count:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Folder must be empty before deleting")

    db.delete(folder)
    db.commit()
    return None
