"""Pause proactive SMS until the user replies."""

from alembic import op
import sqlalchemy as sa

revision = "20260521_14"
down_revision = "20260518_13"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_profiles",
        sa.Column(
            "proactive_awaiting_reply",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )


def downgrade() -> None:
    op.drop_column("user_profiles", "proactive_awaiting_reply")
