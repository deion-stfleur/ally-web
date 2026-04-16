import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# Load before reading env (covers imports before main.py runs, e.g. uvicorn workers).
# override=True: a blank DATABASE_URL in the shell/IDE must not hide values from backend/.env.
_BACKEND_ROOT = Path(__file__).resolve().parent
load_dotenv(_BACKEND_ROOT / ".env", override=True)
load_dotenv()


def _require(name: str) -> str:
    v = os.getenv(name, "").strip()
    if not v:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return v


def _optional(name: str) -> str | None:
    v = os.getenv(name, "").strip()
    return v or None


@dataclass(frozen=True)
class Settings:
    google_client_id: str
    google_client_secret: str
    google_redirect_uri: str
    jwt_secret: str
    jwt_algorithm: str
    jwt_expire_days: int
    frontend_url: str
    anthropic_api_key: str
    anthropic_model: str
    # Postgres (Heroku, local, etc.). Optional until chat persistence is wired.
    database_url: str | None
    # Sendblue (SMS / iMessage webhook). All optional — omit to disable webhook.
    sendblue_api_key: str | None
    sendblue_api_secret: str | None
    sendblue_from_number: str | None
    sendblue_allowed_e164: str | None
    sendblue_owner_email: str | None
    sendblue_webhook_secret: str | None


def load_settings() -> Settings:
    db = os.getenv("DATABASE_URL", "").strip()
    return Settings(
        google_client_id=_require("GOOGLE_CLIENT_ID"),
        google_client_secret=_require("GOOGLE_CLIENT_SECRET"),
        google_redirect_uri=os.getenv(
            "GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/callback"
        ).strip(),
        jwt_secret=_require("JWT_SECRET"),
        jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
        jwt_expire_days=int(os.getenv("JWT_EXPIRE_DAYS", "7")),
        frontend_url=os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/"),
        anthropic_api_key=_require("ANTHROPIC_API_KEY"),
        anthropic_model=os.getenv(
            "ANTHROPIC_MODEL", "claude-sonnet-4-20250514"
        ).strip(),
        database_url=db or None,
        sendblue_api_key=_optional("SENDBLUE_API_KEY") or _optional("SENDBLUE_API_API_KEY"),
        sendblue_api_secret=_optional("SENDBLUE_API_SECRET")
        or _optional("SENDBLUE_API_API_SECRET"),
        sendblue_from_number=_optional("SENDBLUE_FROM_NUMBER"),
        sendblue_allowed_e164=_optional("SENDBLUE_ALLOWED_E164"),
        sendblue_owner_email=_optional("SENDBLUE_OWNER_EMAIL"),
        sendblue_webhook_secret=_optional("SENDBLUE_WEBHOOK_SECRET"),
    )


settings = load_settings()
