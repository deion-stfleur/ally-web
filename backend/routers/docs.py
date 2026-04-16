from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from deps import get_current_session
from models.schemas import (
    AppendDocRequest,
    CreateDocRequest,
    DocOkResponse,
    DocWriteResponse,
    ReplaceDocBodyRequest,
)
from services import docs_service
from services.session_store import UserSession

router = APIRouter(prefix="/docs", tags=["docs"])


@router.post("", response_model=DocWriteResponse)
def docs_create(
    body: CreateDocRequest,
    session: UserSession = Depends(get_current_session),
) -> DocWriteResponse:
    try:
        out = docs_service.create_document(
            session.credentials,
            title=body.title,
            initial_text=body.initial_text,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return DocWriteResponse(document_id=out["document_id"], url=out["url"])


@router.post("/{document_id}/append", response_model=DocOkResponse)
def docs_append(
    document_id: str,
    body: AppendDocRequest,
    session: UserSession = Depends(get_current_session),
) -> DocOkResponse:
    try:
        docs_service.append_text(session.credentials, document_id, body.text)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return DocOkResponse(
        document_id=document_id,
        url=f"https://docs.google.com/document/d/{document_id}/edit",
    )


@router.post("/{document_id}/replace-body", response_model=DocOkResponse)
def docs_replace_body(
    document_id: str,
    body: ReplaceDocBodyRequest,
    session: UserSession = Depends(get_current_session),
) -> DocOkResponse:
    try:
        docs_service.replace_body_plain(
            session.credentials, document_id, body.text
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return DocOkResponse(
        document_id=document_id,
        url=f"https://docs.google.com/document/d/{document_id}/edit",
    )
