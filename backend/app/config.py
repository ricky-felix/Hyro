"""Application configuration loaded from environment variables.

Mirrors the NestJS ConfigModule (.forRoot, isGlobal). Values are read from the
process environment and a local ``.env`` file when present.
"""
from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Supabase
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str

    # Server
    PORT: int = 3000

    # CORS
    FRONTEND_URL: str = "http://localhost:5173"

    # Payment gateway webhook secrets
    XENDIT_WEBHOOK_TOKEN: Optional[str] = None
    MIDTRANS_SERVER_KEY: Optional[str] = None

    # Scheduler cron overrides (crontab format)
    CRON_MATERIALIZE_BILLS: str = "0 6 * * *"
    CRON_EXPIRE_SUBSCRIPTIONS: str = "15 6 * * *"
    CRON_PAYMENT_REMINDERS: str = "0 8 * * *"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
