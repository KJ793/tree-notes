"""Translation between the three shapes the graph takes.

There are three, not two, and mixing them up is the quiet failure mode of this
integration:

1. **Cytoscape** `{nodes: [{data, position}], edges: [{data}]}` - what
   GraphPanel renders and what it PUTs back.
2. **Neo4j records** - `(:Concept)` nodes and `[:RELATES_TO]` relationships.
3. **Concept schema** `{"concepts": [{concept_id, concept_name, importance,
   relationships: [...]}]}` - what the LLM emits *and* what
   `generate_summary()` expects to be handed back. Every worked example in the
   summary prompt is in this shape, so feeding it Cytoscape JSON would degrade
   the summary with no error anywhere.

Everything here is pure. No driver, no session, no I/O.
"""

from typing import Any, Dict, Iterable, List, Optional, Tuple

from backend.graph.normalisation import humanise, normalise_concept_name

# Only these keys survive a round trip into storage.
#
# GraphPanel's getEditedGraphData() spreads `...node.data()` wholesale, so the
# PUT body contains every field the GET sent down. Without an allowlist, any
# field the API adds for display later becomes silently writable by the client
# and would be persisted as though the user had authored it.
PERSISTABLE_NODE_KEYS = frozenset({"id", "label", "importance", "color", "shape"})
PERSISTABLE_EDGE_KEYS = frozenset({"id", "source", "target", "label", "weight"})

# Manual elements are identified by the id prefix the frontend mints. That is
# the only provenance signal available - the client does not send a source
# field - so it is a heuristic, not a guarantee. Documented in
# FRONTEND_INTEGRATION.md so the frontend keeps the prefix when it moves to
# crypto.randomUUID().
_MANUAL_PREFIX = "manual"


def _clamp_unit(value: Any) -> Optional[float]:
    """Coerce to a float in [0, 1], or None.

    importance and weight are declared 0-1 by the AI prompt and the summary
    prompt's bolding rules key off that range. A model that emits 1.5, or a
    client that sends a string, should not silently widen the scale.
    """
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number:  # NaN
        return None
    return max(0.0, min(1.0, number))


def _source_of(element_id: Any) -> str:
    return "manual" if str(element_id or "").startswith(_MANUAL_PREFIX) else "ai"


def cytoscape_to_records(
        payload: Dict[str, Any],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Cytoscape elements -> (concepts, relationships) ready for the repository.

    Returns records keyed by `normalized_name` rather than by the client's
    element id. The client's ids are not identity: a freshly generated graph
    uses the LLM's sequential integers, a manual node uses a timestamp, and a
    reloaded graph uses server UUIDs. All three must converge on the same node
    when they name the same concept in the same note.

    Concepts that normalise to nothing are dropped. Duplicates within one
    payload collapse to the first occurrence, because the identity key cannot
    hold both.
    """
    concepts: List[Dict[str, Any]] = []
    by_normalised: Dict[str, Dict[str, Any]] = {}
    # client element id -> normalized_name, for resolving edge endpoints.
    client_to_key: Dict[str, str] = {}

    for node in payload.get("nodes") or []:
        if not isinstance(node, dict):
            continue

        data = node.get("data")
        if not isinstance(data, dict):
            continue

        data = {k: v for k, v in data.items() if k in PERSISTABLE_NODE_KEYS}

        client_id = data.get("id")
        label = data.get("label") or ""
        normalized = normalise_concept_name(label)
        if not normalized:
            # A node with no usable label has no identity. Keeping it would
            # mean writing a concept under an empty key that every other
            # unlabelled node would then collide with.
            continue

        if client_id is not None:
            client_to_key[str(client_id)] = normalized

        if normalized in by_normalised:
            continue

        position = node.get("position")
        position = position if isinstance(position, dict) else {}

        record = {
            "normalized_name": normalized,
            "name": humanise(label),
            "importance": _clamp_unit(data.get("importance")),
            "source": _source_of(client_id),
            # None means "leave whatever is already stored alone", which is
            # what preserves a node's position across a regeneration.
            "ui_x": _as_float(position.get("x")),
            "ui_y": _as_float(position.get("y")),
            "ui_color": data.get("color"),
            "ui_shape": data.get("shape"),
        }
        by_normalised[normalized] = record
        concepts.append(record)

    relationships: List[Dict[str, Any]] = []
    seen_pairs = set()

    for edge in payload.get("edges") or []:
        if not isinstance(edge, dict):
            continue

        data = edge.get("data")
        if not isinstance(data, dict):
            continue

        data = {k: v for k, v in data.items() if k in PERSISTABLE_EDGE_KEYS}

        source_key = client_to_key.get(str(data.get("source")))
        target_key = client_to_key.get(str(data.get("target")))

        # An edge naming an endpoint that is not in the node list cannot be
        # stored, and Cytoscape would throw on it if we ever sent it back.
        # ai_adapter._to_cytoscape() drops these for the same reason.
        if not source_key or not target_key:
            continue
        if source_key == target_key:
            continue

        pair = (source_key, target_key)
        if pair in seen_pairs:
            continue
        seen_pairs.add(pair)

        relationships.append({
            "source_key": source_key,
            "target_key": target_key,
            "label": humanise(data.get("label") or ""),
            "weight": _clamp_unit(data.get("weight")),
            "source": _source_of(data.get("id")),
        })

    return concepts, relationships


def _as_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def records_to_cytoscape(
        concept_rows: Iterable[Dict[str, Any]],
        relationship_rows: Iterable[Dict[str, Any]],
) -> Dict[str, List[Dict[str, Any]]]:
    """Stored concepts and relationships -> the shape GraphPanel renders.

    Node ids are the Neo4j-minted UUIDs, so a graph that has been saved once is
    stable across reloads regardless of what ids the client originally sent.
    """
    nodes: List[Dict[str, Any]] = []
    known_ids = set()

    for row in concept_rows:
        concept_id = row.get("id")
        if concept_id is None:
            continue

        concept_id = str(concept_id)
        known_ids.add(concept_id)

        data: Dict[str, Any] = {
            "id": concept_id,
            "label": row.get("name") or "",
            "importance": row.get("importance"),
        }
        # Only emit styling the user actually set. Sending color: null would
        # match Cytoscape's `node[color]` selector and paint the node null.
        if row.get("ui_color"):
            data["color"] = row["ui_color"]
        if row.get("ui_shape"):
            data["shape"] = row["ui_shape"]

        node: Dict[str, Any] = {"data": data}

        x, y = row.get("ui_x"), row.get("ui_y")
        if x is not None and y is not None:
            node["position"] = {"x": x, "y": y}

        nodes.append(node)

    edges: List[Dict[str, Any]] = []

    for row in relationship_rows:
        source_id = row.get("source_id")
        target_id = row.get("target_id")
        if source_id is None or target_id is None:
            continue

        source_id, target_id = str(source_id), str(target_id)
        if source_id not in known_ids or target_id not in known_ids:
            continue

        edges.append({
            "data": {
                "id": f"e{source_id}-{target_id}",
                "source": source_id,
                "target": target_id,
                "label": row.get("label") or "",
                "weight": row.get("weight"),
            }
        })

    return {"nodes": nodes, "edges": edges}


def records_to_concept_schema(
        concept_rows: Iterable[Dict[str, Any]],
        relationship_rows: Iterable[Dict[str, Any]],
) -> Dict[str, List[Dict[str, Any]]]:
    """Stored graph -> the schema generate_summary() expects.

    Concept ids are renumbered to sequential integers because that is what the
    prompt template declares and every one of its examples uses. Handing the
    model UUIDs where it expects ints is exactly the kind of mismatch that
    degrades output without producing an error.
    """
    ordered = [row for row in concept_rows if row.get("id") is not None]

    index_of = {str(row["id"]): position for position, row in enumerate(ordered, start=1)}

    outgoing: Dict[str, List[Dict[str, Any]]] = {}
    for row in relationship_rows:
        source_id = str(row.get("source_id"))
        target_id = str(row.get("target_id"))
        if source_id not in index_of or target_id not in index_of:
            continue
        outgoing.setdefault(source_id, []).append({
            "target_id": index_of[target_id],
            # The prompt declares "relationship" singular; its worked example
            # emits "relationships". ai_adapter reads either. Emit the
            # documented one.
            "relationship": row.get("label") or "",
            "weight": row.get("weight"),
        })

    concepts = []
    for row in ordered:
        concept_id = str(row["id"])
        concepts.append({
            "concept_id": index_of[concept_id],
            "concept_name": row.get("name") or "",
            "importance": row.get("importance"),
            "relationships": outgoing.get(concept_id, []),
        })

    return {"concepts": concepts}
