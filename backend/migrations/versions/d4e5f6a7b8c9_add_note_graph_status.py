"""add note graph status

Tracks whether Neo4j holds a current concept graph for each note. The graph
itself lives in Neo4j; these two columns are the only trace of it in Postgres,
and exist so a failed graph write is visible rather than silent.

Revision ID: d4e5f6a7b8c9
Revises: ffa13c790c4e
Create Date: 2026-09-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'ffa13c790c4e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # server_default rather than a Python-side default: existing rows predate
    # the column and need a value, and a plain default would leave them null
    # against a NOT NULL constraint.
    op.add_column(
        'notes',
        sa.Column(
            'graph_status',
            sa.String(length=20),
            nullable=False,
            server_default='none',
        ),
    )
    op.add_column(
        'notes',
        sa.Column(
            'graph_updated_at',
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
    )
    op.create_check_constraint(
        'ck_notes_graph_status',
        'notes',
        "graph_status IN ('none', 'ok', 'stale')",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('ck_notes_graph_status', 'notes', type_='check')
    op.drop_column('notes', 'graph_updated_at')
    op.drop_column('notes', 'graph_status')
