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
    # Stripe (optional). When prices + secret are set, SMS is gated on active subscription.
    stripe_secret_key: str | None
    stripe_webhook_secret: str | None
    stripe_price_starter_monthly: str | None
    stripe_price_pro_monthly: str | None
    stripe_price_sms_monthly: str | None  # legacy alias for Pro price id
    # MCP gateway (optional): self-hosted HTTP service (Playwright) — optional if using Apify.
    mcp_gateway_url: str | None
    mcp_gateway_secret: str | None
    # Apify: hosted MCP actors (OpenTable Booker, Resy Booker). https://console.apify.com/account/integrations
    apify_token: str | None
    apify_opentable_mcp_url: str | None
    apify_resy_mcp_url: str | None
    # Google Maps Platform (Places + Geocoding) for things_to_do_near tool.
    google_maps_api_key: str | None
    # Public base for published mini-sites (defaults to FRONTEND_URL → /s/{slug}).
    ally_sites_public_base_url: str | None
    # Meeting BaaS (optional): bot joins Meet/Zoom/Teams for notes.
    meeting_baas_api_key: str | None
    backend_public_url: str | None


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
        stripe_secret_key=_optional("STRIPE_SECRET_KEY"),
        stripe_webhook_secret=_optional("STRIPE_WEBHOOK_SECRET"),
        stripe_price_starter_monthly=_optional("STRIPE_PRICE_STARTER_MONTHLY"),
        stripe_price_pro_monthly=_optional("STRIPE_PRICE_PRO_MONTHLY"),
        stripe_price_sms_monthly=_optional("STRIPE_PRICE_SMS_MONTHLY"),
        mcp_gateway_url=_optional("MCP_GATEWAY_URL"),
        mcp_gateway_secret=_optional("MCP_GATEWAY_SECRET"),
        apify_token=_optional("APIFY_TOKEN"),
        apify_opentable_mcp_url=_optional("APIFY_OPENTABLE_MCP_URL"),
        apify_resy_mcp_url=_optional("APIFY_RESY_MCP_URL"),
        google_maps_api_key=_optional("GOOGLE_MAPS_API_KEY"),
        ally_sites_public_base_url=_optional("ALLY_SITES_PUBLIC_BASE_URL"),
        meeting_baas_api_key=_optional("MEETING_BAAS_API_KEY"),
        backend_public_url=_optional("BACKEND_PUBLIC_URL"),
    )


settings = load_settings()
