from contextlib import asynccontextmanager
import os
from pathlib import Path

from dotenv import load_dotenv

# Same as alembic: load backend/.env even when uvicorn cwd is the repo root.
_BACKEND_ROOT = Path(__file__).resolve().parent
load_dotenv(_BACKEND_ROOT / ".env", override=True)
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.agent_tasks import router as agent_tasks_router
from routers.auth import router as auth_router
from routers.billing import router as billing_router
from routers.chat import router as chat_router
from routers.docs import router as docs_router
from routers.drive import router as drive_router
from routers.gmail import router as gmail_router
from routers.quick_requests import router as quick_requests_router
from routers.schedule import router as schedule_router
from routers.sendblue_webhook import router as sendblue_webhook_router
from routers.opentable import router as opentable_router
from routers.todos import router as todos_router
from routers.watch_rules import router as watch_rules_router
from routers.public_sites import router as public_sites_router
from routers.meeting_baas_webhook import router as meeting_baas_webhook_router
from routers.browser_internal import router as browser_internal_router

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")


def _cors_origins() -> list[str]:
    origins = {FRONTEND_URL}
    for raw in os.getenv("ADDITIONAL_CORS_ORIGINS", "").split(","):
        o = raw.strip().rstrip("/")
        if o:
            origins.add(o)
    # Common local dev ports (even if FRONTEND_URL is only Netlify in .env)
    for o in (
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ):
        origins.add(o)
    return sorted(origins)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    import logging

    from db import session as db_session
    from db.session import create_engine_if_configured, dispose_engine

    create_engine_if_configured()
    if db_session.async_session_maker is None:
        logging.getLogger(__name__).warning(
            "DATABASE_URL is missing in this process; /api/todos returns 503. "
            "Fix backend/.env or remove an empty DATABASE_URL from your IDE/shell env."
        )
    scheduler = None
    try:
        from services.proactive_scheduler import start_proactive_scheduler

        if db_session.async_session_maker is not None:
            scheduler = start_proactive_scheduler()
        yield
    finally:
        if scheduler is not None:
            from services.proactive_scheduler import stop_proactive_scheduler

            stop_proactive_scheduler()
        await dispose_engine()


app = FastAPI(
    title="Ally API",
    description="Google Workspace + Claude backend",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    # Netlify previews / any https *.netlify.app when not listed explicitly
    allow_origin_regex=r"https://[^/]+\.netlify\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(agent_tasks_router, prefix="/api")
app.include_router(billing_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(drive_router, prefix="/api")
app.include_router(docs_router, prefix="/api")
app.include_router(gmail_router, prefix="/api")
app.include_router(quick_requests_router, prefix="/api")
app.include_router(sendblue_webhook_router, prefix="/api")
app.include_router(opentable_router, prefix="/api")
app.include_router(schedule_router, prefix="/api")
app.include_router(todos_router, prefix="/api")
app.include_router(watch_rules_router, prefix="/api")
app.include_router(public_sites_router, prefix="/api")
app.include_router(meeting_baas_webhook_router, prefix="/api")
app.include_router(browser_internal_router, prefix="/api")


@app.get("/api/health")
def health():
    from db import session as db_session
    from db.session import create_engine_if_configured

    create_engine_if_configured()
    return {
        "ok": True,
        "database_configured": db_session.async_session_maker is not None,
    }
