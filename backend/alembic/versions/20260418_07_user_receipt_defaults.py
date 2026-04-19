"""User defaults for receipt → Sheets flow."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260418_07"
down_revision = "20260417_06"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("default_receipts_spreadsheet_id", sa.String(128), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("default_receipts_sheet_range", sa.String(256), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "receipts_confirm_before_append",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "receipts_confirm_before_append")
    op.drop_column("users", "default_receipts_sheet_range")
    op.drop_column("users", "default_receipts_spreadsheet_id")
