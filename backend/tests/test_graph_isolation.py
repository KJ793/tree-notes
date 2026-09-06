"""Cross-user isolation at the Cypher layer. Requires a live Neo4j.

The highest-value tests in this suite. Every other guarantee is a convenience;
these are the ones where a regression leaks one user's knowledge graph into
another's.

Deliberately calls the repository directly rather than going through HTTP, so
the router's Postgres ownership check cannot mask a Cypher query that forgot to
anchor on `user_id`. A test that only exercised the endpoints would have passed
against the bootstrap-statement bug these tests were written for: the note was
hijacked by the first MERGE, after which every anchored MATCH legitimately
succeeded.

Community Edition allows only one database, so fixtures are namespaced under
reserved high user ids and torn down explicitly rather than isolated by
database.
"""

import pytest

neo4j = pytest.importorskip("neo4j", reason="neo4j driver not installed")

from backend.graph import repository
from backend.graph_db import GraphUnavailable, get_driver

# Far above any real users.id sequence value.
OWNER = 990001
INTRUDER = 990002
NOTE = 990001

CONCEPTS = [
    {"normalized_name": "photosynthesis", "name": "photosynthesis",
     "importance": 0.9, "source": "ai",
     "ui_x": 100.0, "ui_y": 200.0, "ui_color": "#ff0000", "ui_shape": None},
    {"normalized_name": "sunlight", "name": "sunlight",
     "importance": 0.7, "source": "ai",
     "ui_x": 300.0, "ui_y": 150.0, "ui_color": None, "ui_shape": "diamond"},
]
RELATIONSHIPS = [
    {"source_key": "photosynthesis", "target_key": "sunlight",
     "label": "requires", "weight": 0.8, "source": "ai"},
]


@pytest.fixture
def session():
    try:
        driver = get_driver()
        driver.verify_connectivity()
    except (GraphUnavailable, Exception) as exc:
        pytest.skip(f"Neo4j unavailable: {exc}")

    with driver.session() as s:
        _purge(s)
        yield s
        _purge(s)


def _purge(session):
    session.run(
        """
        MATCH (n:Note) WHERE n.id = $note_id
        OPTIONAL MATCH (n)-[:HAS_CONCEPT]->(c:Concept)
        DETACH DELETE c, n
        """,
        note_id=NOTE,
    )
    session.run(
        "MATCH (u:User) WHERE u.id IN $ids DETACH DELETE u",
        ids=[OWNER, INTRUDER],
    )


@pytest.fixture
def owned_graph(session):
    repository.save_note_graph(
        session, user_id=OWNER, note_id=NOTE, note_title="Photosynthesis",
        concepts=CONCEPTS, relationships=RELATIONSHIPS,
    )
    return session


def _names(session, user_id):
    concepts, _ = repository.load_note_graph(session, user_id, NOTE)
    return sorted(c["name"] for c in concepts)


class TestReadIsolation:
    def test_owner_reads_their_own_graph(self, owned_graph):
        assert _names(owned_graph, OWNER) == ["photosynthesis", "sunlight"]

    def test_another_user_reads_nothing(self, owned_graph):
        assert _names(owned_graph, INTRUDER) == []

    def test_another_user_counts_nothing(self, owned_graph):
        assert repository.count_concepts(owned_graph, INTRUDER, NOTE) == 0


class TestWriteIsolation:
    def test_another_user_cannot_overwrite(self, owned_graph):
        """Regression: the note upsert used to MERGE on id alone and then SET
        user_id, transferring ownership before any anchored query ran."""
        with pytest.raises(repository.GraphOwnershipError):
            repository.save_note_graph(
                owned_graph, user_id=INTRUDER, note_id=NOTE, note_title="pwned",
                concepts=[{"normalized_name": "pwned", "name": "pwned",
                           "importance": 1.0, "source": "manual",
                           "ui_x": None, "ui_y": None,
                           "ui_color": None, "ui_shape": None}],
                relationships=[],
            )

    def test_failed_write_leaves_the_graph_untouched(self, owned_graph):
        with pytest.raises(repository.GraphOwnershipError):
            repository.save_note_graph(
                owned_graph, user_id=INTRUDER, note_id=NOTE, note_title="pwned",
                concepts=[], relationships=[],
            )
        assert _names(owned_graph, OWNER) == ["photosynthesis", "sunlight"]

    def test_another_user_cannot_delete(self, owned_graph):
        repository.delete_note_graph(owned_graph, user_id=INTRUDER, note_id=NOTE)
        assert _names(owned_graph, OWNER) == ["photosynthesis", "sunlight"]

    def test_owner_can_still_delete(self, owned_graph):
        repository.delete_note_graph(owned_graph, user_id=OWNER, note_id=NOTE)
        assert _names(owned_graph, OWNER) == []


class TestRegenerationPreservesLayout:
    """The guarantee that justifies storing presentation state in Neo4j.

    An ON CREATE / ON MATCH slip in the concept MERGE would silently reset
    every saved position, and no other test would notice.
    """

    def test_positions_and_styling_survive_a_regeneration(self, owned_graph):
        regenerated = [
            {"normalized_name": "photosynthesis", "name": "photosynthesis",
             "importance": 0.95, "source": "ai",
             "ui_x": None, "ui_y": None, "ui_color": None, "ui_shape": None},
        ]
        repository.save_note_graph(
            owned_graph, user_id=OWNER, note_id=NOTE, note_title="Photosynthesis",
            concepts=regenerated, relationships=[],
        )

        concepts, _ = repository.load_note_graph(owned_graph, OWNER, NOTE)
        kept = next(c for c in concepts if c["name"] == "photosynthesis")

        assert (kept["ui_x"], kept["ui_y"]) == (100.0, 200.0)
        assert kept["ui_color"] == "#ff0000"
        # Structure still updates.
        assert kept["importance"] == 0.95

    def test_concepts_absent_from_the_payload_are_removed(self, owned_graph):
        repository.save_note_graph(
            owned_graph, user_id=OWNER, note_id=NOTE, note_title="Photosynthesis",
            concepts=CONCEPTS[:1], relationships=[],
        )
        assert _names(owned_graph, OWNER) == ["photosynthesis"]


class TestPerNoteConceptScoping:
    """Concepts are unique to their note - the defining design decision.

    One MERGE key away from silently becoming false, which would start sharing
    nodes between notes and make a recolour in one note change another.
    """

    def test_same_concept_in_two_notes_is_two_nodes(self, session):
        other_note = NOTE + 1
        try:
            for note_id in (NOTE, other_note):
                repository.save_note_graph(
                    session, user_id=OWNER, note_id=note_id,
                    note_title=f"Note {note_id}",
                    concepts=[{"normalized_name": "photosynthesis",
                               "name": "photosynthesis", "importance": 0.9,
                               "source": "ai", "ui_x": 1.0, "ui_y": 2.0,
                               "ui_color": None, "ui_shape": None}],
                    relationships=[],
                )

            first, _ = repository.load_note_graph(session, OWNER, NOTE)
            second, _ = repository.load_note_graph(session, OWNER, other_note)

            assert first[0]["name"] == second[0]["name"] == "photosynthesis"
            assert first[0]["id"] != second[0]["id"], (
                "concepts must not be shared across notes"
            )
        finally:
            session.run(
                """
                MATCH (n:Note {id: $note_id})
                OPTIONAL MATCH (n)-[:HAS_CONCEPT]->(c:Concept)
                DETACH DELETE c, n
                """,
                note_id=other_note,
            )
