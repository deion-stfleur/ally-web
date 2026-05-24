"""Published Ally mini-sites (HTML at /s/{slug})."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "20260523_16"
down_revision = "20260522_15"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "published_sites",
        sa.Column("id", UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("html_content", sa.Text(), nullable=False),
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
        sa.UniqueConstraint("slug", name="uq_published_sites_slug"),
    )
    op.create_index("ix_published_sites_user_id", "published_sites", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_published_sites_user_id", table_name="published_sites")
    op.drop_table("published_sites")
