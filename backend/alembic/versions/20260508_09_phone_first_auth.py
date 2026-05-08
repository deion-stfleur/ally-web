"""Phone-first auth: OTP challenges + optional google_sub.

- Make users.google_sub nullable (phone-only accounts).
- Add partial unique index for google_sub where non-null.
- Add users.phone_verified_at to record successful OTP verification.
- Add phone_otp_challenges table for short-lived SMS codes.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20260508_09"
down_revision = "20260425_08"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Replace old unique index with partial unique for nullable column.
    op.drop_index("ix_users_google_sub", table_name="users")
    op.alter_column("users", "google_sub", existing_type=sa.String(255), nullable=True)
    op.create_index(
        "ix_users_google_sub_unique",
        "users",
        ["google_sub"],
        unique=True,
        postgresql_where=sa.text("google_sub IS NOT NULL"),
    )

    op.add_column(
        "users",
        sa.Column("phone_verified_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "phone_otp_challenges",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("phone_e164", sa.String(32), nullable=False, index=True),
        sa.Column("code_hash", sa.String(128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "attempts",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("phone_otp_challenges")
    op.drop_column("users", "phone_verified_at")
    op.drop_index("ix_users_google_sub_unique", table_name="users")
    op.alter_column("users", "google_sub", existing_type=sa.String(255), nullable=False)
    op.create_index("ix_users_google_sub", "users", ["google_sub"], unique=True)

