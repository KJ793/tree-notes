"""update initial schema and add example data

Revision ID: 8a86fb63f190
Revises: 1991ad542d07
Create Date: 2026-05-13 02:52:22.356541

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8a86fb63f190'
down_revision: Union[str, Sequence[str], None] = '1991ad542d07'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ========================
    # DROP TABLES (safe rebuild)
    # ========================
    op.execute("DROP TABLE IF EXISTS ai_suggestions CASCADE")
    op.execute("DROP TABLE IF EXISTS note_links CASCADE")
    op.execute("DROP TABLE IF EXISTS notes CASCADE")
    op.execute("DROP TABLE IF EXISTS users CASCADE")

    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    # ========================
    # USERS
    # ========================
    op.create_table(
        'users',
        sa.Column('id', sa.BigInteger, primary_key=True),
        sa.Column('username', sa.String(50), nullable=False),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('password_hash', sa.Text, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
    )

    # ========================
    # NOTES
    # ========================
    op.create_table(
        'notes',
        sa.Column('id', sa.BigInteger, primary_key=True),
        sa.Column('user_id', sa.BigInteger, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('cue_section', sa.Text),
        sa.Column('notes_section', sa.Text),
        sa.Column('summary_section', sa.Text),
        sa.Column('is_node', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
    )

    op.create_index('idx_notes_user_id', 'notes', ['user_id'])

    # ========================
    # NOTE LINKS
    # ========================
    op.create_table(
        'note_links',
        sa.Column('id', sa.BigInteger, primary_key=True),
        sa.Column('note_a_id', sa.BigInteger, sa.ForeignKey('notes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('note_b_id', sa.BigInteger, sa.ForeignKey('notes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('relationship_type', sa.String(50), nullable=False),
        sa.Column('strength', sa.Numeric(4, 3), nullable=False),
        sa.Column('label', sa.String(255)),
        sa.Column('ai_generated', sa.Boolean, nullable=False, server_default='false'),
    )

    op.create_index('idx_note_links_a', 'note_links', ['note_a_id'])
    op.create_index('idx_note_links_b', 'note_links', ['note_b_id'])

    op.create_unique_constraint(
        'unique_note_pair',
        'note_links',
        ['note_a_id', 'note_b_id']
    )

    # ========================
    # AI SUGGESTIONS
    # ========================
    op.create_table(
        'ai_suggestions',
        sa.Column('id', sa.BigInteger, primary_key=True),
        sa.Column('source_note_id', sa.BigInteger, sa.ForeignKey('notes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('target_note_id', sa.BigInteger, sa.ForeignKey('notes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('reasoning', sa.Text),
        sa.Column('confidence_score', sa.Numeric(4, 3), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
    )

    op.create_index('idx_ai_source', 'ai_suggestions', ['source_note_id'])
    op.create_index('idx_ai_target', 'ai_suggestions', ['target_note_id'])
    op.create_index('idx_ai_status', 'ai_suggestions', ['status'])

    op.create_unique_constraint(
        'unique_ai_suggestion',
        'ai_suggestions',
        ['source_note_id', 'target_note_id']
    )

    # ========================
    # INSERT TEST DATA
    # ========================

    op.execute("""
        INSERT INTO users (username, email, password_hash)
        VALUES
        ('alice', 'alice@example.com', 'hash_alice'),
        ('bob', 'bob@example.com', 'hash_bob'),
        ('carol', 'carol@example.com', 'hash_carol')
    """)

    op.execute("""
        INSERT INTO notes (user_id, title, cue_section, notes_section, summary_section, is_node)
        VALUES
        (1, 'SQL Basics', 'What is SQL?', 'SQL is a query language for databases.', 'Intro to SQL', TRUE),
        (1, 'Docker Intro', 'What is Docker?', 'Docker is containerization platform.', 'Docker basics', TRUE),
        (2, 'PostgreSQL Index', 'Why indexes?', 'Indexes speed up queries.', 'Indexing concept', TRUE),
        (2, 'Normalization', 'What is normalization?', 'Organizing database to reduce redundancy.', 'DB design concept', TRUE),
        (3, 'AI Notes Idea', 'How to use AI?', 'AI can suggest related notes.', 'AI feature idea', TRUE)
    """)

    op.execute("""
        INSERT INTO note_links (note_a_id, note_b_id, relationship_type, strength, label, ai_generated)
        VALUES
        (1, 3, 'related', 0.85, 'SQL + Indexing', FALSE),
        (1, 4, 'related', 0.80, 'DB fundamentals', FALSE),
        (2, 5, 'related', 0.60, 'infra + AI', TRUE)
    """)

    op.execute("""
        INSERT INTO ai_suggestions (source_note_id, target_note_id, reasoning, confidence_score, status)
        VALUES
        (1, 3, 'SQL Basics is strongly related to indexing concepts.', 0.92, 'accepted'),
        (1, 4, 'Normalization is fundamental to SQL understanding.', 0.88, 'pending'),
        (2, 5, 'Docker environment can support AI note systems.', 0.70, 'pending'),
        (3, 1, 'AI Notes Idea connects back to SQL structure.', 0.65, 'rejected')
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS ai_suggestions CASCADE")
    op.execute("DROP TABLE IF EXISTS note_links CASCADE")
    op.execute("DROP TABLE IF EXISTS notes CASCADE")
    op.execute("DROP TABLE IF EXISTS users CASCADE")
