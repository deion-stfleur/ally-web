from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import UserTodo
from deps import get_current_session, get_db
from models.schemas import TodoListResponse, UserTodoOut, UserTodoPut
from services.chat_persist import resolve_db_user_id
from services.session_store import UserSession

router = APIRouter(prefix="/todos", tags=["todos"])


async def _list_for_user(db: AsyncSession, user_id) -> TodoListResponse:
    result = await db.execute(
        select(UserTodo)
        .where(UserTodo.user_id == user_id)
        .order_by(UserTodo.sort_order.asc(), UserTodo.created_at.asc())
    )
    rows = result.scalars().all()
    return TodoListResponse(
        todos=[
            UserTodoOut(id=r.id, text=r.text, done=r.done, created_at=r.created_at)
            for r in rows
        ]
    )


@router.get("", response_model=TodoListResponse)
async def list_todos(
    session: UserSession = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
) -> TodoListResponse:
    user_id = await resolve_db_user_id(db, session.google_sub, session.db_user_id)
    if user_id is None:
        return TodoListResponse(todos=[])
    return await _list_for_user(db, user_id)


@router.put("", response_model=TodoListResponse)
async def replace_todos(
    body: UserTodoPut,
    session: UserSession = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
) -> TodoListResponse:
    user_id = await resolve_db_user_id(db, session.google_sub, session.db_user_id)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is not available; sign in again with the database enabled.",
        )
    await db.execute(delete(UserTodo).where(UserTodo.user_id == user_id))
    for i, item in enumerate(body.todos):
        raw = (item.text or "").strip()
        text = raw if raw else "New task"
        if len(text) > 4000:
            text = text[:4000]
        db.add(
            UserTodo(
                id=item.id,
                user_id=user_id,
                text=text,
                done=item.done,
                sort_order=i,
            )
        )
    await db.commit()
    return await _list_for_user(db, user_id)
