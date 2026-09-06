"""Idempotent Neo4j constraints and indexes.

Run from the FastAPI startup hook. Every statement is `IF NOT EXISTS`, so
running it on every boot is a no-op after the first.

Deliberately avoids anything Enterprise-only: `NODE KEY` (uniqueness *and*
existence) is not available in Community Edition, and depending on it would
mean the schema applies on a developer's licensed instance and silently fails
in CI.
"""

import logging
from typing import List

from neo4j import Session

log = logging.getLogger("uvicorn.error")

STATEMENTS: List[str] = [
    # Mirrors of Postgres primary keys. These are the only identifiers that
    # cross the database boundary.
    "CREATE CONSTRAINT user_id IF NOT EXISTS "
    "FOR (u:User) REQUIRE u.id IS UNIQUE",

    "CREATE CONSTRAINT note_id IF NOT EXISTS "
    "FOR (n:Note) REQUIRE n.id IS UNIQUE",

    "CREATE CONSTRAINT concept_id IF NOT EXISTS "
    "FOR (c:Concept) REQUIRE c.id IS UNIQUE",

    # Concept identity: scoped to the note, never shared across notes.
    # This constraint *is* the "concepts are unique to their note" decision;
    # if it is dropped, a MERGE bug could silently start sharing nodes.
    "CREATE CONSTRAINT concept_identity IF NOT EXISTS "
    "FOR (c:Concept) REQUIRE (c.note_id, c.normalized_name) IS UNIQUE",

    "CREATE INDEX concept_by_note IF NOT EXISTS FOR (c:Concept) ON (c.note_id)",

    # Every query filters on user_id even when note_id alone would be
    # selective, because that filter is the auth boundary. It needs an index
    # behind it.
    "CREATE INDEX concept_owner IF NOT EXISTS FOR (c:Concept) ON (c.user_id)",
    "CREATE INDEX note_owner IF NOT EXISTS FOR (n:Note) ON (n.user_id)",
]


def ensure_schema(session: Session) -> None:
    """Apply every constraint and index. Safe to call repeatedly."""
    for statement in STATEMENTS:
        session.run(statement)
    log.info("Neo4j schema verified (%d constraints/indexes)", len(STATEMENTS))
