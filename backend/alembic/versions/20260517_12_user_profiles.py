"""User interest profiles for proactive SMS."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260517_12"
down_revision = "20260510_11"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_profiles",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("phone_e164", sa.String(length=32), nullable=True),
        sa.Column(
            "interests",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "active_hours",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("preferred_update_time", sa.String(length=128), nullable=True),
        sa.Column(
            "recent_topics_sent",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("timezone", sa.String(length=64), nullable=False, server_default="America/New_York"),
        sa.Column(
            "last_updated",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column("last_proactive_sent", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_memory_extract_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("onboarding_updates_asked", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_user_profiles_last_proactive_sent",
        "user_profiles",
        ["last_proactive_sent"],
    )


def downgrade() -> None:
    op.drop_index("ix_user_profiles_last_proactive_sent", table_name="user_profiles")
    op.drop_table("user_profiles")
