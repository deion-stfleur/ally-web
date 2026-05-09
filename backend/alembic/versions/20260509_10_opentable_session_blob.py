"""Store encrypted OpenTable session on users."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260509_10"
down_revision = "20260508_09"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("opentable_session_encrypted", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "opentable_session_encrypted")

