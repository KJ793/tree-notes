"""seed dev user
Inserts a single placeholder user (id=1) so that note rows — whose user_id
column is NOT NULL — can be created by the API before authentication is
implemented.

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa



revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "1991ad542d07"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



users_table = sa.table(
    "users",
    sa.column("id", sa.Integer),
    sa.column("username", sa.String),
    sa.column("email", sa.String),
    sa.column("password_hash", sa.String),
    sa.column("is_active", sa.Boolean),
)


def upgrade() -> None:
    """Insert the dev user row."""
    op.bulk_insert(
        users_table,
        [
            {
                "id": 1,
                "username": "devuser",
                "email": "dev@treenotes.local",
                "password_hash": "dev-no-auth-yet",
                "is_active": True,
            }
        ],
    )

    # Bump the users_id_seq past the manually-inserted row so future inserts
    # via the API don't collide on id=1.
    op.execute(
        "SELECT setval('users_id_seq', "
        "(SELECT COALESCE(MAX(id), 1) FROM users))"
    )


def downgrade() -> None:
    """Remove the dev user row."""
    op.execute("DELETE FROM users WHERE id = 1")