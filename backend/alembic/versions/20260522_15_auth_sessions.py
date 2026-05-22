"""Persist auth sessions in Postgres (Heroku dyno restarts)."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "20260522_15"
down_revision = "20260521_14"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("db_user_id", UUID(as_uuid=True), nullable=True),
        sa.Column("email", sa.String(length=512), nullable=True),
        sa.Column("name", sa.String(length=512), nullable=True),
        sa.Column("picture", sa.String(length=2048), nullable=True),
        sa.Column("google_sub", sa.String(length=255), nullable=True),
        sa.Column("credentials_json", JSONB(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["db_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_auth_sessions_db_user_id", "auth_sessions", ["db_user_id"])


def downgrade() -> None:
    op.drop_index("ix_auth_sessions_db_user_id", table_name="auth_sessions")
    op.drop_table("auth_sessions")
