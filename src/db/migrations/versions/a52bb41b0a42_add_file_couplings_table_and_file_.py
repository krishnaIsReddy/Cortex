"""add file_couplings table and file_changes composite index

Revision ID: a52bb41b0a42
Revises: 33ba45c174e5
Create Date: 2026-10-24 17:09:47.402700

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a52bb41b0a42'
down_revision: Union[str, Sequence[str], None] = '33ba45c174e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the file_couplings table and add a composite index to file_changes."""
    op.create_table('file_couplings',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('repo_id', sa.UUID(), nullable=False),
        sa.Column('file_a', sa.String(), nullable=False),
        sa.Column('file_b', sa.String(), nullable=False),
        sa.Column('co_commit_count', sa.Integer(), nullable=False),
        sa.Column('total_commits_a', sa.Integer(), nullable=False),
        sa.Column('total_commits_b', sa.Integer(), nullable=False),
        sa.Column('coupling_score', sa.Float(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['repo_id'], ['repos.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('repo_id', 'file_a', 'file_b', name='uq_coupling_pair'),
    )
    op.create_index('ix_couplings_repo_score', 'file_couplings', ['repo_id', 'coupling_score'], unique=False)
    op.create_index('ix_file_changes_commit_file', 'file_changes', ['commit_id', 'file_path'], unique=False)


def downgrade() -> None:
    """Drop the file_couplings table and the composite index on file_changes."""
    op.drop_index('ix_file_changes_commit_file', table_name='file_changes')
    op.drop_index('ix_couplings_repo_score', table_name='file_couplings')
    op.drop_table('file_couplings')
