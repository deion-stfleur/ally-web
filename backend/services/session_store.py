from __future__ import annotations

import uuid
from dataclasses import dataclass

from google.oauth2.credentials import Credentials


@dataclass
class UserSession:
    id: str
    credentials: Credentials
    email: str | None = None
    name: str | None = None
    picture: str | None = None
    google_sub: str | None = None
    db_user_id: uuid.UUID | None = None


_sessions: dict[str, UserSession] = {}


def save_session(session_id: str, session: UserSession) -> None:
    _sessions[session_id] = session


def get_session(session_id: str) -> UserSession | None:
    return _sessions.get(session_id)


def delete_session(session_id: str) -> None:
    _sessions.pop(session_id, None)
