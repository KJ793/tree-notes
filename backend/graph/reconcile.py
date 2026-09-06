"""Remove Neo4j subgraphs whose Postgres note no longer exists.

Deleting a note purges its graph on a best-effort basis
(routers/notes.py::_purge_graph), so a Neo4j outage during a delete leaves an
orphaned `:Note` node behind. That matters beyond tidiness: `notes.id` is a
Postgres sequence, and once it reissues a number an orphaned subgraph would be
adopted by an unrelated new note.

Run inside the backend container:

    docker compose exec backend python -m backend.graph.reconcile
    docker compose exec backend python -m backend.graph.reconcile --dry-run
"""

import argparse
import logging
from typing import List

from backend.database import SessionLocal
from backend.graph_db import get_driver
from backend.models import Note

log = logging.getLogger(__name__)


def find_orphaned_note_ids() -> List[int]:
    """Neo4j :Note ids with no corresponding row in Postgres."""
    with get_driver().session() as session:
        graph_ids = {
            record["id"]
            for record in session.run("MATCH (n:Note) RETURN n.id AS id")
            if record["id"] is not None
        }

    if not graph_ids:
        return []

    db = SessionLocal()
    try:
        live_ids = {
            row[0]
            for row in db.query(Note.id).filter(Note.id.in_(graph_ids)).all()
        }
    finally:
        db.close()

    return sorted(graph_ids - live_ids)


def delete_note_subgraphs(note_ids: List[int]) -> int:
    """Delete the given notes and their concepts. Returns the node count removed."""
    if not note_ids:
        return 0

    with get_driver().session() as session:
        result = session.run(
            """
            UNWIND $note_ids AS note_id
            MATCH (n:Note {id: note_id})
            OPTIONAL MATCH (n)-[:HAS_CONCEPT]->(c:Concept)
            DETACH DELETE c, n
            RETURN count(*) AS removed
            """,
            note_ids=note_ids,
        )
        record = result.single()
        return record["removed"] if record else 0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="report what would be deleted without deleting it",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    orphans = find_orphaned_note_ids()
    if not orphans:
        log.info("No orphaned graphs found.")
        return

    log.info("Orphaned note subgraphs: %s", orphans)

    if args.dry_run:
        log.info("Dry run - nothing deleted.")
        return

    removed = delete_note_subgraphs(orphans)
    log.info("Removed %d node(s) across %d note(s).", removed, len(orphans))


if __name__ == "__main__":
    main()
