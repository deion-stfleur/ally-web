"""Add stripe_plan tier (starter | pro) on users."""

from alembic import op
import sqlalchemy as sa

revision = "20260518_13"
down_revision = "20260517_12"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("stripe_plan", sa.String(16), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "stripe_plan")
