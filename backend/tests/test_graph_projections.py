"""Tests for the pure graph translation layer.

These import nothing outside backend/graph, so they run without a database,
without Neo4j and without the `neo4j` package installed:

    pytest backend/tests
"""

from backend.graph.normalisation import humanise, normalise_concept_name
from backend.graph.projections import (
    cytoscape_to_records,
    records_to_concept_schema,
    records_to_cytoscape,
)


class TestNormalisation:
    def test_lowercases_and_trims(self):
        assert normalise_concept_name("  Photosynthesis ") == "photosynthesis"

    def test_underscores_and_hyphens_become_spaces(self):
        assert normalise_concept_name("photosynthesis_process") == "photosynthesis process"
        assert normalise_concept_name("Calvin-Cycle") == "calvin cycle"

    def test_strips_punctuation_and_collapses_whitespace(self):
        assert normalise_concept_name("  The   Calvin-Cycle. ") == "the calvin cycle"

    def test_names_differing_only_in_case_share_an_identity(self):
        assert normalise_concept_name("BEES") == normalise_concept_name("bees")

    def test_empty_input_normalises_to_empty(self):
        # Callers must treat this as unusable rather than storing under "".
        assert normalise_concept_name("") == ""
        assert normalise_concept_name("___") == ""
        assert normalise_concept_name(None) == ""

    def test_humanise_preserves_case(self):
        # Display and identity have different rules.
        assert humanise("Ash_Clouds") == "Ash Clouds"


class TestCytoscapeToRecords:
    def test_extracts_concepts_and_relationships(self):
        concepts, relationships = cytoscape_to_records({
            "nodes": [
                {"data": {"id": "1", "label": "bees", "importance": 0.8}},
                {"data": {"id": "2", "label": "flowers", "importance": 0.7}},
            ],
            "edges": [
                {"data": {"id": "e1-2", "source": "1", "target": "2",
                          "label": "collect_nectar", "weight": 0.6}},
            ],
        })

        assert [c["normalized_name"] for c in concepts] == ["bees", "flowers"]
        assert len(relationships) == 1
        assert relationships[0]["source_key"] == "bees"
        assert relationships[0]["target_key"] == "flowers"
        assert relationships[0]["label"] == "collect nectar"

    def test_position_becomes_ui_coordinates(self):
        concepts, _ = cytoscape_to_records({
            "nodes": [{"data": {"id": "1", "label": "bees"},
                       "position": {"x": 10, "y": 20}}],
            "edges": [],
        })
        assert (concepts[0]["ui_x"], concepts[0]["ui_y"]) == (10.0, 20.0)

    def test_missing_position_is_none_not_zero(self):
        """None means "leave what is stored alone".

        Defaulting to 0.0 would stack every node at the origin on any save
        that omitted positions.
        """
        concepts, _ = cytoscape_to_records({
            "nodes": [{"data": {"id": "1", "label": "bees"}}],
            "edges": [],
        })
        assert concepts[0]["ui_x"] is None
        assert concepts[0]["ui_y"] is None

    def test_unknown_data_keys_are_not_persistable(self):
        """GraphPanel spreads ...node.data(), so the body carries whatever the
        client held. Only allowlisted keys may reach storage."""
        concepts, _ = cytoscape_to_records({
            "nodes": [{"data": {"id": "1", "label": "bees",
                                "injected": "arbitrary", "user_id": 999}}],
            "edges": [],
        })
        assert "injected" not in concepts[0]
        assert "user_id" not in concepts[0]

    def test_duplicate_normalised_names_collapse(self):
        concepts, _ = cytoscape_to_records({
            "nodes": [
                {"data": {"id": "1", "label": "bees"}},
                {"data": {"id": "2", "label": "BEES"}},
            ],
            "edges": [],
        })
        assert len(concepts) == 1

    def test_edge_resolves_through_a_collapsed_duplicate(self):
        """An edge naming the dropped duplicate must still land on the survivor
        rather than being discarded."""
        _, relationships = cytoscape_to_records({
            "nodes": [
                {"data": {"id": "1", "label": "bees"}},
                {"data": {"id": "2", "label": "BEES"}},
                {"data": {"id": "3", "label": "flowers"}},
            ],
            "edges": [{"data": {"id": "e", "source": "2", "target": "3"}}],
        })
        assert len(relationships) == 1
        assert relationships[0]["source_key"] == "bees"

    def test_unlabelled_nodes_are_dropped(self):
        concepts, _ = cytoscape_to_records({
            "nodes": [{"data": {"id": "1", "label": "   "}}],
            "edges": [],
        })
        assert concepts == []

    def test_dangling_and_self_referential_edges_are_dropped(self):
        """Cytoscape throws on an edge whose endpoint is absent, so these must
        never reach storage and be echoed back on load."""
        _, relationships = cytoscape_to_records({
            "nodes": [{"data": {"id": "1", "label": "bees"}}],
            "edges": [
                {"data": {"id": "a", "source": "1", "target": "99"}},
                {"data": {"id": "b", "source": "1", "target": "1"}},
            ],
        })
        assert relationships == []

    def test_manual_prefix_marks_provenance(self):
        concepts, relationships = cytoscape_to_records({
            "nodes": [
                {"data": {"id": "1", "label": "bees"}},
                {"data": {"id": "manual-1699", "label": "honey"}},
            ],
            "edges": [{"data": {"id": "manual-edge-77",
                                "source": "1", "target": "manual-1699"}}],
        })
        assert [c["source"] for c in concepts] == ["ai", "manual"]
        assert relationships[0]["source"] == "manual"

    def test_importance_is_coerced_and_clamped(self):
        concepts, _ = cytoscape_to_records({
            "nodes": [
                {"data": {"id": "1", "label": "a", "importance": "1.9"}},
                {"data": {"id": "2", "label": "b", "importance": -3}},
                {"data": {"id": "3", "label": "c", "importance": "nonsense"}},
            ],
            "edges": [],
        })
        assert [c["importance"] for c in concepts] == [1.0, 0.0, None]

    def test_malformed_payload_does_not_raise(self):
        concepts, relationships = cytoscape_to_records({
            "nodes": [None, {"no_data": True}, {"data": "not a dict"}],
            "edges": [None, {"data": None}],
        })
        assert concepts == []
        assert relationships == []


class TestRecordsToCytoscape:
    def _rows(self):
        concepts = [
            {"id": "uuid-a", "name": "bees", "importance": 0.8,
             "ui_x": 10.0, "ui_y": 20.0, "ui_color": "#ff0000", "ui_shape": None},
            {"id": "uuid-b", "name": "flowers", "importance": 0.7,
             "ui_x": None, "ui_y": None, "ui_color": None, "ui_shape": "diamond"},
        ]
        relationships = [
            {"source_id": "uuid-a", "target_id": "uuid-b",
             "label": "collect nectar", "weight": 0.6},
        ]
        return concepts, relationships

    def test_produces_renderable_elements(self):
        graph = records_to_cytoscape(*self._rows())
        assert [n["data"]["id"] for n in graph["nodes"]] == ["uuid-a", "uuid-b"]
        assert graph["edges"][0]["data"]["source"] == "uuid-a"

    def test_stored_position_is_returned(self):
        graph = records_to_cytoscape(*self._rows())
        assert graph["nodes"][0]["position"] == {"x": 10.0, "y": 20.0}

    def test_null_styling_is_omitted_not_emitted_as_null(self):
        """Cytoscape's `node[color]` selector matches on key presence, so
        sending color: null paints the node null rather than leaving the
        stylesheet default in place."""
        graph = records_to_cytoscape(*self._rows())
        assert "color" not in graph["nodes"][1]["data"]
        assert "shape" not in graph["nodes"][0]["data"]
        assert "position" not in graph["nodes"][1]

    def test_edge_to_unknown_node_is_dropped(self):
        concepts, _ = self._rows()
        graph = records_to_cytoscape(
            concepts,
            [{"source_id": "uuid-a", "target_id": "ghost", "label": "", "weight": None}],
        )
        assert graph["edges"] == []

    def test_round_trip_preserves_identity_and_layout(self):
        """Save then load then save must converge, or repeated saves would
        drift the graph."""
        original = {
            "nodes": [
                {"data": {"id": "1", "label": "bees", "importance": 0.8,
                          "color": "#ff0000"},
                 "position": {"x": 10, "y": 20}},
                {"data": {"id": "2", "label": "flowers", "importance": 0.7}},
            ],
            "edges": [{"data": {"id": "e1-2", "source": "1", "target": "2",
                                "label": "collect nectar", "weight": 0.6}}],
        }
        concepts, relationships = cytoscape_to_records(original)

        # Simulate storage assigning UUIDs and reading back.
        stored = [
            {"id": f"uuid-{i}", "name": c["name"], "importance": c["importance"],
             "ui_x": c["ui_x"], "ui_y": c["ui_y"],
             "ui_color": c["ui_color"], "ui_shape": c["ui_shape"]}
            for i, c in enumerate(concepts)
        ]
        key_to_id = {c["normalized_name"]: f"uuid-{i}"
                     for i, c in enumerate(concepts)}
        stored_rels = [
            {"source_id": key_to_id[r["source_key"]],
             "target_id": key_to_id[r["target_key"]],
             "label": r["label"], "weight": r["weight"]}
            for r in relationships
        ]

        reloaded = records_to_cytoscape(stored, stored_rels)
        again, _ = cytoscape_to_records(reloaded)

        assert [c["normalized_name"] for c in again] == ["bees", "flowers"]
        assert (again[0]["ui_x"], again[0]["ui_y"]) == (10.0, 20.0)
        assert again[0]["ui_color"] == "#ff0000"


class TestRecordsToConceptSchema:
    def test_renumbers_to_sequential_integers(self):
        """generate_summary()'s prompt declares sequential int concept_ids and
        every worked example uses them. Handing it UUIDs degrades the summary
        without raising anything."""
        schema = records_to_concept_schema(
            [{"id": "uuid-a", "name": "bees", "importance": 0.8},
             {"id": "uuid-b", "name": "flowers", "importance": 0.7}],
            [{"source_id": "uuid-a", "target_id": "uuid-b",
              "label": "collect nectar", "weight": 0.6}],
        )
        assert [c["concept_id"] for c in schema["concepts"]] == [1, 2]
        assert schema["concepts"][0]["relationships"][0]["target_id"] == 2

    def test_uses_the_singular_relationship_key(self):
        # The prompt declares "relationship"; only its example says
        # "relationships". Emit the documented one.
        schema = records_to_concept_schema(
            [{"id": "a", "name": "x", "importance": 0.1},
             {"id": "b", "name": "y", "importance": 0.1}],
            [{"source_id": "a", "target_id": "b", "label": "rel", "weight": 0.5}],
        )
        assert "relationship" in schema["concepts"][0]["relationships"][0]

    def test_concept_without_relationships_gets_empty_list(self):
        schema = records_to_concept_schema(
            [{"id": "a", "name": "lonely", "importance": 0.5}], []
        )
        assert schema["concepts"][0]["relationships"] == []
