from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    DATABASE_URL: str

    # Secret used for HMAC hashing of temporary auth values
    AUTH_HASH_SECRET: str

    # Frontend URL used for password-reset links
    FRONTEND_URL: str = "http://localhost:5173"

    # SMTP settings
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str | None = None

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()