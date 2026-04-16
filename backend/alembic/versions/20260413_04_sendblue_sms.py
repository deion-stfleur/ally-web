"""Sendblue inbound dedupe + user SMS conversation link."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260413_04_sendblue_sms"
down_revision = "20260411_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sendblue_inbound_dedupe",
        sa.Column("message_handle", sa.String(length=160), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("message_handle"),
    )
    op.add_column(
        "users",
        sa.Column("sendblue_conversation_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_users_sendblue_conversation_id",
        "users",
        "conversations",
        ["sendblue_conversation_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_sendblue_conversation_id", "users", type_="foreignkey")
    op.drop_column("users", "sendblue_conversation_id")
    op.drop_table("sendblue_inbound_dedupe")
