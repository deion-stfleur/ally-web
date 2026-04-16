from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from db.models import Conversation, Message, User


def google_sub_from_userinfo(userinfo: dict) -> str | None:
    raw = userinfo.get("sub") or userinfo.get("id")
    if raw is None:
        return None
    s = str(raw).strip()
    return s or None


async def upsert_app_user(
    db: AsyncSession,
    *,
    google_sub: str,
    email: str | None,
    name: str | None,
    picture: str | None,
) -> User:
    result = await db.execute(select(User).where(User.google_sub == google_sub))
    row = result.scalar_one_or_none()
    if row is None:
        row = User(
            google_sub=google_sub,
            email=email,
            name=name,
            picture=picture,
        )
        db.add(row)
        await db.flush()
        return row
    row.email = email
    row.name = name
    row.picture = picture
    row.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return row


async def resolve_db_user_id(
    db: AsyncSession,
    session_google_sub: str | None,
    session_db_user_id: uuid.UUID | None,
) -> uuid.UUID | None:
    if session_db_user_id is not None:
        return session_db_user_id
    if not session_google_sub:
        return None
    result = await db.execute(select(User.id).where(User.google_sub == session_google_sub))
    return result.scalar_one_or_none()


async def get_owned_conversation(
    db: AsyncSession, *, user_id: uuid.UUID, conversation_id: uuid.UUID
) -> Conversation | None:
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def create_conversation(
    db: AsyncSession, *, user_id: uuid.UUID, title: str | None
) -> Conversation:
    conv = Conversation(user_id=user_id, title=title)
    db.add(conv)
    await db.flush()
    return conv


async def append_pair(
    db: AsyncSession,
    *,
    conversation: Conversation,
    user_text: str,
    assistant_text: str,
) -> None:
    now = datetime.now(timezone.utc)
    conversation.updated_at = now
    db.add_all(
        [
            Message(conversation_id=conversation.id, role="user", content=user_text),
            Message(
                conversation_id=conversation.id,
                role="assistant",
                content=assistant_text,
            ),
        ]
    )
    await db.flush()


async def list_conversation_summaries(
    db: AsyncSession, *, user_id: uuid.UUID, limit: int = 100
) -> list[Conversation]:
    limit = max(1, min(int(limit), 200))
    r = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == user_id)
        .order_by(Conversation.updated_at.desc())
        .limit(limit)
    )
    return list(r.scalars().all())


async def load_conversation_messages(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    conversation_id: uuid.UUID,
    message_limit: int = 200,
) -> tuple[Conversation | None, list[Message]]:
    conv = await get_owned_conversation(db, user_id=user_id, conversation_id=conversation_id)
    if conv is None:
        return None, []
    r2 = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    msgs = list(r2.scalars().all())[-message_limit:]
    return conv, msgs


async def load_latest_state(
    db: AsyncSession, *, user_id: uuid.UUID, message_limit: int = 200
) -> tuple[uuid.UUID | None, list[Message]]:
    r1 = await db.execute(
        select(Conversation.id)
        .where(Conversation.user_id == user_id)
        .order_by(Conversation.updated_at.desc())
        .limit(1)
    )
    cid = r1.scalar_one_or_none()
    if cid is None:
        return None, []
    r2 = await db.execute(
        select(Message)
        .where(Message.conversation_id == cid)
        .order_by(Message.created_at.asc())
    )
    msgs = list(r2.scalars().all())[-message_limit:]
    return cid, msgs
