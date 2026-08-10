import json
import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    openai_api_key: str = ""
    google_spreadsheet_id: str = ""
    google_service_account_json: str = ""  # path or inline JSON
    vyaya_api_secret: str = ""  # optional Bearer token for your API
    cors_origins: str = "http://localhost:5173,https://vamshiganesh98.github.io"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


def load_service_account_info(settings: Settings) -> dict:
    raw = settings.google_service_account_json.strip()
    if not raw:
        raise ValueError("GOOGLE_SERVICE_ACCOUNT_JSON is not set")
    if raw.startswith("{"):
        return json.loads(raw)
    with open(raw, encoding="utf-8") as f:
        return json.load(f)
