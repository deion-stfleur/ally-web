"""Add optional SMS phone on users."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260416_05"
down_revision = "20260413_04_sendblue_sms"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("phone_e164", sa.String(length=32), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "phone_e164")
