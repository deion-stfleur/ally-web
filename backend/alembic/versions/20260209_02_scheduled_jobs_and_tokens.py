"""Scheduled jobs + encrypted Google refresh on users.

Revision ID: 20260209_02
Revises: 20250411_01
Create Date: 2026-02-09

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260209_02"
down_revision: Union[str, None] = "20250411_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("google_refresh_token_encrypted", sa.Text(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("google_scopes", sa.Text(), nullable=True),
    )
    op.create_table(
        "scheduled_jobs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("job_type", sa.String(length=64), nullable=False),
        sa.Column("payload_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("run_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=32), server_default="pending", nullable=False),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
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
    )
    op.create_index("ix_scheduled_jobs_user_id", "scheduled_jobs", ["user_id"])
    op.create_index("ix_scheduled_jobs_job_type", "scheduled_jobs", ["job_type"])
    op.create_index("ix_scheduled_jobs_run_at", "scheduled_jobs", ["run_at"])
    op.create_index("ix_scheduled_jobs_status", "scheduled_jobs", ["status"])
    op.create_index(
        "ix_scheduled_jobs_pending_run_at",
        "scheduled_jobs",
        ["status", "run_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_scheduled_jobs_pending_run_at", table_name="scheduled_jobs")
    op.drop_index("ix_scheduled_jobs_status", table_name="scheduled_jobs")
    op.drop_index("ix_scheduled_jobs_run_at", table_name="scheduled_jobs")
    op.drop_index("ix_scheduled_jobs_job_type", table_name="scheduled_jobs")
    op.drop_index("ix_scheduled_jobs_user_id", table_name="scheduled_jobs")
    op.drop_table("scheduled_jobs")
    op.drop_column("users", "google_scopes")
    op.drop_column("users", "google_refresh_token_encrypted")
