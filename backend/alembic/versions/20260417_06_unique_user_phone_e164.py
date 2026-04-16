"""Partial unique index on users.phone_e164 (non-null only)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260417_06"
down_revision = "20260416_05"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_users_phone_e164_unique",
        "users",
        ["phone_e164"],
        unique=True,
        postgresql_where=sa.text("phone_e164 IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_users_phone_e164_unique", table_name="users")
