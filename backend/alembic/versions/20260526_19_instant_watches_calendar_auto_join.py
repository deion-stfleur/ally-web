"""Instant watch mode + calendar meeting auto-join opt-in."""

from alembic import op
import sqlalchemy as sa

revision = "20260526_19"
down_revision = "20260525_18"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_watch_rules",
        sa.Column("watch_mode", sa.String(16), nullable=False, server_default="daily"),
    )
    op.add_column(
        "user_watch_rules",
        sa.Column("poll_interval_minutes", sa.Integer(), nullable=False, server_default="15"),
    )
    op.add_column("user_watch_rules", sa.Column("last_digest", sa.Text(), nullable=True))

    op.add_column(
        "users",
        sa.Column(
            "meeting_calendar_auto_join",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "users",
        sa.Column("meeting_auto_join_opt_in_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.add_column(
        "meeting_bot_jobs",
        sa.Column("calendar_event_id", sa.String(256), nullable=True),
    )
    op.add_column(
        "meeting_bot_jobs",
        sa.Column("join_source", sa.String(32), nullable=True),
    )
    op.create_index(
        "ix_meeting_bot_jobs_user_calendar_event",
        "meeting_bot_jobs",
        ["user_id", "calendar_event_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_meeting_bot_jobs_user_calendar_event", table_name="meeting_bot_jobs")
    op.drop_column("meeting_bot_jobs", "join_source")
    op.drop_column("meeting_bot_jobs", "calendar_event_id")
    op.drop_column("users", "meeting_auto_join_opt_in_at")
    op.drop_column("users", "meeting_calendar_auto_join")
    op.drop_column("user_watch_rules", "last_digest")
    op.drop_column("user_watch_rules", "poll_interval_minutes")
    op.drop_column("user_watch_rules", "watch_mode")
