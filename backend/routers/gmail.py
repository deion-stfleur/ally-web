from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from deps import get_current_session
from models.schemas import (
    GmailThreadListResponse,
    GmailThreadRow,
    GmailThreadTextResponse,
    SendEmailRequest,
    SendEmailResponse,
)
from services import gmail_service
from services.session_store import UserSession

router = APIRouter(prefix="/gmail", tags=["gmail"])


@router.get("/threads", response_model=GmailThreadListResponse)
def gmail_threads(
    session: UserSession = Depends(get_current_session),
    max_results: int = Query(default=20, ge=1, le=30),
    q: str = Query(default="", max_length=2000),
) -> GmailThreadListResponse:
    try:
        rows = gmail_service.list_threads_summary(
            session.credentials, max_results=max_results, query=q
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return GmailThreadListResponse(
        threads=[GmailThreadRow(thread_id=r["thread_id"], snippet=r["snippet"]) for r in rows]
    )


@router.get("/search", response_model=GmailThreadListResponse)
def gmail_search(
    session: UserSession = Depends(get_current_session),
    query: str = Query(..., min_length=1, max_length=2000),
    max_results: int = Query(default=25, ge=1, le=30),
) -> GmailThreadListResponse:
    try:
        rows = gmail_service.list_threads_summary(
            session.credentials, max_results=max_results, query=query
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return GmailThreadListResponse(
        threads=[GmailThreadRow(thread_id=r["thread_id"], snippet=r["snippet"]) for r in rows]
    )


@router.get("/thread/{thread_id}", response_model=GmailThreadTextResponse)
def gmail_thread(
    thread_id: str,
    session: UserSession = Depends(get_current_session),
) -> GmailThreadTextResponse:
    try:
        text = gmail_service.get_thread_plain_text(session.credentials, thread_id)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return GmailThreadTextResponse(text=text)


@router.post("/send", response_model=SendEmailResponse)
async def gmail_send(
    body: SendEmailRequest,
    session: UserSession = Depends(get_current_session),
) -> SendEmailResponse:
    try:
        out = gmail_service.send_email(
            session.credentials,
            body.to,
            body.subject,
            body.body,
            body.thread_id,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    mid = out.get("message_id")
    if not mid:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Gmail did not return a message id",
        )
    return SendEmailResponse(
        message_id=str(mid),
        thread_id=str(out["thread_id"]) if out.get("thread_id") else None,
    )
