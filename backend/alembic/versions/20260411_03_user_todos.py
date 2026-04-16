"""Per-user todo rows for the chat right rail.

Revision ID: 20260411_03
Revises: 20260209_02
Create Date: 2026-04-11

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260411_03"
down_revision: Union[str, None] = "20260209_02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_todos",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("text", sa.String(length=4000), nullable=False),
        sa.Column("done", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_todos_user_id", "user_todos", ["user_id"], unique=False)
    op.create_index(
        "ix_user_todos_user_id_sort", "user_todos", ["user_id", "sort_order"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_user_todos_user_id_sort", table_name="user_todos")
    op.drop_index("ix_user_todos_user_id", table_name="user_todos")
    op.drop_table("user_todos")
