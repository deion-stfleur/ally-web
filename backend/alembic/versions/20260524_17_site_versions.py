"""Multi-file site projects with versions, preview tokens, and publish state."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "20260524_17"
down_revision = "20260523_16"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "published_sites",
        sa.Column("preview_token", sa.String(length=36), nullable=True),
    )
    op.add_column(
        "published_sites",
        sa.Column(
            "is_published",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.add_column(
        "published_sites",
        sa.Column("design_tokens", JSONB(), nullable=True),
    )
    op.alter_column("published_sites", "html_content", existing_type=sa.Text(), nullable=True)

    op.create_table(
        "site_versions",
        sa.Column("id", UUID(as_uuid=True), nullable=False),
        sa.Column("site_id", UUID(as_uuid=True), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["site_id"], ["published_sites.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("site_id", "version_number", name="uq_site_versions_site_version"),
    )
    op.create_index("ix_site_versions_site_id", "site_versions", ["site_id"])

    op.create_table(
        "site_files",
        sa.Column("id", UUID(as_uuid=True), nullable=False),
        sa.Column("version_id", UUID(as_uuid=True), nullable=False),
        sa.Column("path", sa.String(length=256), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["version_id"], ["site_versions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("version_id", "path", name="uq_site_files_version_path"),
    )
    op.create_index("ix_site_files_version_id", "site_files", ["version_id"])

    op.add_column(
        "published_sites",
        sa.Column("draft_version_id", UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "published_sites",
        sa.Column("published_version_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_published_sites_draft_version",
        "published_sites",
        "site_versions",
        ["draft_version_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_published_sites_published_version",
        "published_sites",
        "site_versions",
        ["published_version_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Backfill legacy single-html sites as version 1 (published).
    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            "SELECT id, slug, title, html_content, user_id FROM published_sites "
            "WHERE html_content IS NOT NULL"
        )
    ).fetchall()
    for row in rows:
        site_id, _slug, title, html_content, _user_id = row
        import uuid as _uuid

        version_id = str(_uuid.uuid4())
        token = str(_uuid.uuid4())
        conn.execute(
            sa.text(
                "INSERT INTO site_versions (id, site_id, version_number, note, created_at) "
                "VALUES (:vid, :sid, 1, 'legacy import', now())"
            ),
            {"vid": version_id, "sid": str(site_id)},
        )
        conn.execute(
            sa.text(
                "INSERT INTO site_files (id, version_id, path, content) "
                "VALUES (:fid, :vid, 'index.html', :content)"
            ),
            {"fid": str(_uuid.uuid4()), "vid": version_id, "content": html_content},
        )
        conn.execute(
            sa.text(
                "UPDATE published_sites SET preview_token = :token, is_published = true, "
                "draft_version_id = :vid, published_version_id = :vid WHERE id = :sid"
            ),
            {"token": token, "vid": version_id, "sid": str(site_id)},
        )

    op.alter_column("published_sites", "preview_token", nullable=False)
    op.create_index("ix_published_sites_preview_token", "published_sites", ["preview_token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_published_sites_preview_token", table_name="published_sites")
    op.drop_constraint("fk_published_sites_published_version", "published_sites", type_="foreignkey")
    op.drop_constraint("fk_published_sites_draft_version", "published_sites", type_="foreignkey")
    op.drop_column("published_sites", "published_version_id")
    op.drop_column("published_sites", "draft_version_id")
    op.drop_index("ix_site_files_version_id", table_name="site_files")
    op.drop_table("site_files")
    op.drop_index("ix_site_versions_site_id", table_name="site_versions")
    op.drop_table("site_versions")
    op.drop_column("published_sites", "design_tokens")
    op.drop_column("published_sites", "is_published")
    op.drop_column("published_sites", "preview_token")
    op.alter_column("published_sites", "html_content", existing_type=sa.Text(), nullable=False)
