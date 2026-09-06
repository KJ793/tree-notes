"""Every Cypher statement in the application lives here.

Two rules, both load-bearing:

1. **Every function takes `user_id` and every query anchors on it.** The rest
   of the app is scoped by SQLAlchemy filters on `current_user.id`; Cypher has
   no equivalent safety net. A query written as
   `MATCH (n:Note {id: $note_id})` instead of
   `MATCH (u:User {id: $user_id})-[:OWNS]->(n:Note {id: $note_id})` leaks one
   user's entire concept graph into another's panel, and nothing else in the
   stack would catch it.

2. **Parameters only, never f-strings.** Concept names originate in LLM output
   derived from user-supplied text. String interpolation into Cypher is an
   injection hole; the driver's parameter binding is the only acceptable path.

Review checklist for anything added below: does the query bind *and* match
`user_id`?
"""

from typing import Any, Dict, List, Tuple

from neo4j import ManagedTransaction, Session

# Anchoring clause, repeated verbatim rather than shared as a constant so that
# every query reads as a complete statement at its call site.
_OWNED_NOTE = "MATCH (u:User {id: $user_id})-[:OWNS]->(n:Note {id: $note_id})"


class GraphOwnershipError(PermissionError):
    """A write targeted a note belonging to another user.

    Routers already check ownership in Postgres before calling in, so reaching
    this means either a caller bypassed that check or the two stores disagree.
    Either way the write must not proceed.
    """


def save_note_graph(
        session: Session,
        user_id: int,
        note_id: int,
        note_title: str,
        concepts: List[Dict[str, Any]],
        relationships: List[Dict[str, Any]],
) -> None:
    """Replace a note's concept graph, preserving presentation state.

    Atomic: either the whole graph is replaced or none of it is. Concepts the
    payload no longer mentions are removed, so this is a replace rather than a
    merge - which is what makes a regeneration converge instead of accumulating
    every concept the LLM has ever produced for this note.

    Positions and styling survive when the incoming record leaves them unset.
    That is the guarantee that lets a user regenerate a graph without losing
    the layout they arranged by hand.
    """
    session.execute_write(
        _save_tx, user_id, note_id, note_title, concepts, relationships
    )


def _save_tx(
        tx: ManagedTransaction,
        user_id: int,
        note_id: int,
        note_title: str,
        concepts: List[Dict[str, Any]],
        relationships: List[Dict[str, Any]],
) -> None:
    # Refuse before writing anything if the note already belongs to someone
    # else.
    #
    # This check is not redundant with the router's Postgres lookup. Without
    # it, the MERGE below matches the *existing* node by id and then reassigns
    # its user_id, silently transferring ownership - after which every
    # subsequent `MATCH (u)-[:OWNS]->(n)` in this module legitimately succeeds
    # and the anchoring pattern provides no protection at all. Anchoring only
    # works if the statement that establishes the anchor is itself guarded.
    #
    # Raising inside the managed transaction rolls back the whole save.
    conflict = tx.run(
        """
        OPTIONAL MATCH (n:Note {id: $note_id})
        RETURN n IS NOT NULL AND n.user_id <> $user_id AS conflict
        """,
        user_id=user_id, note_id=note_id,
    ).single()

    if conflict and conflict["conflict"]:
        raise GraphOwnershipError(
            f"Note {note_id} belongs to a different user"
        )

    # The user node carries no data beyond the id; it exists so that ownership
    # is a graph relationship rather than a property every query must remember
    # to check.
    #
    # user_id is ON CREATE only: an existing note's owner is never rewritten,
    # so even if the guard above were removed this could not silently change
    # hands.
    tx.run(
        """
        MERGE (u:User {id: $user_id})
        MERGE (n:Note {id: $note_id})
          ON CREATE SET n.created_at = datetime(),
                        n.user_id = $user_id
        SET n.title = $title,
            n.updated_at = datetime()
        MERGE (u)-[:OWNS]->(n)
        """,
        user_id=user_id, note_id=note_id, title=note_title,
    )

    if concepts:
        tx.run(
            """
            MATCH (u:User {id: $user_id})-[:OWNS]->(n:Note {id: $note_id})
            UNWIND $concepts AS incoming
            MERGE (c:Concept {
                note_id: $note_id,
                normalized_name: incoming.normalized_name
            })
              ON CREATE SET c.id = randomUUID(),
                            c.created_at = datetime()
            SET c.user_id = $user_id,
                c.name = incoming.name,
                c.importance = incoming.importance,
                c.source = incoming.source,
                // coalesce, not assignment: a null in the payload means "leave
                // what is stored alone", which is what preserves a hand-placed
                // position across a regeneration.
                c.ui_x = coalesce(incoming.ui_x, c.ui_x),
                c.ui_y = coalesce(incoming.ui_y, c.ui_y),
                c.ui_color = coalesce(incoming.ui_color, c.ui_color),
                c.ui_shape = coalesce(incoming.ui_shape, c.ui_shape)
            MERGE (n)-[:HAS_CONCEPT]->(c)
            """,
            user_id=user_id, note_id=note_id, concepts=concepts,
        )

    # Drop concepts this note no longer claims. DETACH also removes their
    # RELATES_TO relationships, which is why this runs before the relationship
    # rewrite below.
    tx.run(
        """
        MATCH (u:User {id: $user_id})-[:OWNS]->(n:Note {id: $note_id})
        MATCH (n)-[:HAS_CONCEPT]->(c:Concept)
        WHERE NOT c.normalized_name IN $keep
        DETACH DELETE c
        """,
        user_id=user_id,
        note_id=note_id,
        keep=[c["normalized_name"] for c in concepts],
    )

    # Relationships are rewritten wholesale rather than reconciled. Concepts
    # never leave their note, so every RELATES_TO belongs to exactly one note
    # and no other note's edges can be caught by this delete.
    tx.run(
        """
        MATCH (u:User {id: $user_id})-[:OWNS]->(n:Note {id: $note_id})
        MATCH (n)-[:HAS_CONCEPT]->(a:Concept)-[r:RELATES_TO]->(b:Concept)
        DELETE r
        """,
        user_id=user_id, note_id=note_id,
    )

    if relationships:
        tx.run(
            """
            MATCH (u:User {id: $user_id})-[:OWNS]->(n:Note {id: $note_id})
            UNWIND $relationships AS incoming
            MATCH (n)-[:HAS_CONCEPT]->(a:Concept {
                note_id: $note_id, normalized_name: incoming.source_key
            })
            MATCH (n)-[:HAS_CONCEPT]->(b:Concept {
                note_id: $note_id, normalized_name: incoming.target_key
            })
            MERGE (a)-[r:RELATES_TO]->(b)
              ON CREATE SET r.created_at = datetime()
            SET r.label = incoming.label,
                r.weight = incoming.weight,
                r.source = incoming.source
            """,
            user_id=user_id, note_id=note_id, relationships=relationships,
        )


def load_note_graph(
        session: Session,
        user_id: int,
        note_id: int,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Return (concept_rows, relationship_rows) for one note.

    An empty pair is a valid answer meaning "this note has no saved graph",
    which the router reports as an empty graph rather than a 404 - the note
    exists either way.
    """
    concept_rows = session.execute_read(_load_concepts_tx, user_id, note_id)
    relationship_rows = session.execute_read(_load_relationships_tx, user_id, note_id)
    return concept_rows, relationship_rows


def _load_concepts_tx(
        tx: ManagedTransaction, user_id: int, note_id: int,
) -> List[Dict[str, Any]]:
    result = tx.run(
        _OWNED_NOTE + """
        MATCH (n)-[:HAS_CONCEPT]->(c:Concept)
        RETURN c.id            AS id,
               c.name          AS name,
               c.importance    AS importance,
               c.source        AS source,
               c.ui_x          AS ui_x,
               c.ui_y          AS ui_y,
               c.ui_color      AS ui_color,
               c.ui_shape      AS ui_shape
        ORDER BY c.created_at, c.name
        """,
        user_id=user_id, note_id=note_id,
    )
    return [record.data() for record in result]


def _load_relationships_tx(
        tx: ManagedTransaction, user_id: int, note_id: int,
) -> List[Dict[str, Any]]:
    result = tx.run(
        _OWNED_NOTE + """
        MATCH (n)-[:HAS_CONCEPT]->(a:Concept)-[r:RELATES_TO]->(b:Concept)
        WHERE (n)-[:HAS_CONCEPT]->(b)
        RETURN a.id     AS source_id,
               b.id     AS target_id,
               r.label  AS label,
               r.weight AS weight,
               r.source AS source
        """,
        user_id=user_id, note_id=note_id,
    )
    return [record.data() for record in result]


def delete_note_graph(session: Session, user_id: int, note_id: int) -> None:
    """Remove a note's subgraph. Idempotent.

    Per-note concept scoping makes this a single statement: every concept
    belongs to exactly one note, so nothing has to be checked for other
    referents before deleting.
    """
    session.execute_write(_delete_tx, user_id, note_id)


def _delete_tx(tx: ManagedTransaction, user_id: int, note_id: int) -> None:
    tx.run(
        _OWNED_NOTE + """
        OPTIONAL MATCH (n)-[:HAS_CONCEPT]->(c:Concept)
        DETACH DELETE c, n
        """,
        user_id=user_id, note_id=note_id,
    )


def count_concepts(session: Session, user_id: int, note_id: int) -> int:
    """Concept count for one note. Used by tests and /health diagnostics."""
    return session.execute_read(_count_tx, user_id, note_id)


def _count_tx(tx: ManagedTransaction, user_id: int, note_id: int) -> int:
    result = tx.run(
        _OWNED_NOTE + """
        MATCH (n)-[:HAS_CONCEPT]->(c:Concept)
        RETURN count(c) AS total
        """,
        user_id=user_id, note_id=note_id,
    )
    record = result.single()
    return record["total"] if record else 0
