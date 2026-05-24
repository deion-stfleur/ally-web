"""Meeting BaaS bot jobs (join + webhook lifecycle)."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "20260525_18"
down_revision = "20260524_17"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "meeting_bot_jobs",
        sa.Column("id", UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("external_bot_id", sa.String(length=64), nullable=False),
        sa.Column("meeting_url", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="joined"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("summary_text", sa.Text(), nullable=True),
        sa.Column("webhook_payload", JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("external_bot_id", name="uq_meeting_bot_jobs_external_bot_id"),
    )
    op.create_index("ix_meeting_bot_jobs_user_id", "meeting_bot_jobs", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_meeting_bot_jobs_user_id", table_name="meeting_bot_jobs")
    op.drop_table("meeting_bot_jobs")
