from sqlalchemy import create_engine
from sqlalchemy import inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def initialize_database() -> None:
    from app.models import Folder, StoredFile, User  # noqa: F401

    Base.metadata.create_all(bind=engine)

    with engine.begin() as conn:
        inspector = inspect(conn)
        table_names = set(inspector.get_table_names())
        if "files" in table_names:
            file_columns = {column["name"] for column in inspector.get_columns("files")}
            if "folder_id" not in file_columns:
                conn.execute(text("ALTER TABLE files ADD COLUMN folder_id UUID"))
            foreign_keys = inspector.get_foreign_keys("files")
            has_folder_fk = any("folder_id" in fk.get("constrained_columns", []) for fk in foreign_keys)
            if not has_folder_fk and "folders" in table_names:
                conn.execute(
                    text(
                        "ALTER TABLE files ADD CONSTRAINT fk_files_folder_id "
                        "FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE SET NULL"
                    )
                )

