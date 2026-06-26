from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "CloudSpace API"
    api_prefix: str = "/api"
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 60 * 24
    algorithm: str = "HS256"

    database_url: str = "postgresql+psycopg2://cloudspace:cloudspace@localhost:5432/cloudspace"
    storage_dir: str = "/data"

    cors_origins: str = "*"


settings = Settings()
