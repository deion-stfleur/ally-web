"""Daily SMS watch rules (spec + local time + timezone)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260510_11"
down_revision = "20260509_10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_watch_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("spec_text", sa.Text(), nullable=False),
        sa.Column("time_local", sa.String(length=5), nullable=False, server_default="09:00"),
        sa.Column(
            "timezone",
            sa.String(length=64),
            nullable=False,
            server_default="America/New_York",
        ),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        sa.Column(
            "next_run_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_user_watch_rules_status_next_run",
        "user_watch_rules",
        ["status", "next_run_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_user_watch_rules_status_next_run", table_name="user_watch_rules")
    op.drop_table("user_watch_rules")
