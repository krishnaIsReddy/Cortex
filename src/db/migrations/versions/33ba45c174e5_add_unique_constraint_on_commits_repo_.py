"""add unique constraint on commits repo_id sha

Revision ID: 33ba45c174e5
Revises: 3d454f85bb91
Create Date: 2026-10-10 14:29:59.856802

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '33ba45c174e5'
down_revision: Union[str, Sequence[str], None] = '3d454f85bb91'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_commits_repo_id_sha", "commits", ["repo_id", "sha"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_commits_repo_id_sha", "commits", type_="unique")
