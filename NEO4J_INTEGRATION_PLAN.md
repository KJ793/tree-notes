# TreeNotes - Neo4j: remaining work

Everything in this document is **outstanding**. Phases 1 and 2 of the original
plan - infrastructure and per-note graph persistence - are implemented and
verified against a running stack, and have been removed from here.

Companion documents: `FRONTEND_INTEGRATION.md` (the client-side changes still
needed, written for the frontend owner), `DEVOPS_GUIDE.md` (running the stack).

---

## 1. What already exists

Enough context to build on, not a description of the work.

| Area | Where |
|---|---|
| Driver, lazy connect, `get_graph()` dependency | `backend/graph_db.py` |
| Constraints and indexes, applied on startup | `backend/graph/schema.py` |
| All Cypher, `user_id`-scoped | `backend/graph/repository.py` |
| Cytoscape ↔ records ↔ concept schema | `backend/graph/projections.py` |
| Concept name normalisation | `backend/graph/normalisation.py` |
| Orphaned-subgraph cleanup script | `backend/graph/reconcile.py` |
| `PUT`/`GET`/`DELETE /api/notes/{id}/graph` | `backend/routers/note_graph.py` |
| `notes.graph_status`, `graph_updated_at` | migration `d4e5f6a7b8c9` |
| Tests: projections (pure) + isolation (live Neo4j) | `backend/tests/` |

### The stored model

```cypher
(:User    {id})                             // = postgres users.id
(:Note    {id, user_id, title, updated_at}) // = postgres notes.id
(:Concept {id, note_id, user_id, name, normalized_name, importance, source,
           ui_x, ui_y, ui_color, ui_shape, created_at})

(:User)-[:OWNS]->(:Note)
(:Note)-[:HAS_CONCEPT]->(:Concept)
(:Concept)-[:RELATES_TO {label, weight, source, created_at}]->(:Concept)
```

**Concepts are scoped to their note.** "Photosynthesis" in note A and in note B
are two distinct nodes, keyed `(note_id, normalized_name)`, with no relationship
between them. This is a settled decision and everything below assumes it.

---

## 2. Rules any new graph code must follow

Not features - constraints on the work below. The second one was learned the
hard way during Phase 2.

### 2.1 The dividing rule

> Postgres owns anything with a body of text, an owner, or an auth boundary.
> Neo4j owns the graph - its shape and how it is drawn.

Note bodies, cue/summary sections, credentials, profile fields, sessions and AI
suggestion reasoning stay in Postgres. Nothing in Postgres holds a foreign key
into Neo4j; the reference is one-way.

### 2.2 Anchoring only works if the anchor itself is guarded

Every repository function takes `user_id` and every query anchors on it:

```cypher
MATCH (u:User {id: $user_id})-[:OWNS]->(n:Note {id: $note_id})
```

**That rule alone is not sufficient.** During Phase 2 every read anchored
correctly and the write still allowed one user to destroy another's graph - not
because a query omitted `user_id`, but because the statement that *established*
the anchor was unguarded:

```cypher
MERGE (n:Note {id: $note_id})   -- matches another user's existing note
SET n.user_id = $user_id        -- silently transfers ownership
MERGE (u)-[:OWNS]->(n)          -- and grants the caller an OWNS edge
```

Every subsequent anchored `MATCH` then matched legitimately. The router's
Postgres ownership check masked it over HTTP, so an endpoint-level test would
have passed; it was caught by a test calling the repository directly.

**Generalised: any `MERGE` on a node keyed solely by an id that crosses the
Postgres boundary needs an explicit ownership check, because `MERGE` will
happily adopt an existing node belonging to someone else.** See
`repository.GraphOwnershipError` for the pattern.

### 2.3 Parameters only

Concept names originate in LLM output derived from user text. An f-string into
Cypher is an injection hole. No exceptions.

### 2.4 Review checklist for new queries

1. Does it bind *and* match `user_id`?
2. Does any `MERGE` adopt a node it has not proven the caller owns?
3. Is every value a bound parameter?
4. If it writes `ui_*`, does it `coalesce` so unset values preserve what is
   stored rather than nulling it?

---

## 3. Outstanding work

### 3.1 Frontend integration - blocks all user-visible value

**Nothing built so far is reachable from the UI.** `saveGraph()` has no caller,
there is no load path, and a hardcoded fixture overwrites every response.

Seven changes across two files, specified with before/after snippets in
**`FRONTEND_INTEGRATION.md`**. Owned by the frontend team member; not duplicated
here.

Until those land, the endpoints are only exercisable via `/docs` or `curl`.

### 3.2 Feed the stored graph to the summariser

`generate_summary(raw_data, graph_json, user_summary)`
([ai.py:273](backend/ai/ai.py:273)) accepts a graph, and `SummaryPanel` sends
nothing - `graphJson` defaults to `""`
([schemas.py:147](backend/schemas.py:147)), so summaries are generated from raw
text alone while a perfectly good concept graph sits unused.

`projections.records_to_concept_schema()` **already exists and is currently
called by nothing.** It emits the `{"concepts": [...]}` shape with sequential
integer ids, which is what the summary prompt's every worked example uses.

Remaining work is wiring only:

- Load the note's graph in the summary path and pass it as `graphJson`.
- Decide whether `SummaryPanel` requests this or the backend does it implicitly
  from `note_id`.

> Do **not** pass the Cytoscape `{nodes, edges}` shape. The prompt's bolding
> rules key off `importance` and `weight` in the concept schema; handing it a
> different shape degrades the summary with no error anywhere.

### 3.3 Cross-note discovery - needs a decision first (§4.1)

Per-note scoping means notes share no concept nodes, so this does not arrive
for free. Gap: two notes about overlapping topics cannot surface each other, and
the README's headline feature has no implementation.

Proposed approach - keep nodes separate, add a relationship between them:

```cypher
(:Concept {note_id: 1, name: "photosynthesis"})
  -[:SIMILAR_TO {score, method}]->
(:Concept {note_id: 2, name: "photosynthesis"})
```

`method` is `'exact'` for matching `normalized_name` (deterministic, free) or
`'embedding'` for vector similarity (§3.5). Being a relationship rather than a
merge, a wrong one is a single `DELETE` - a wrong merge has already destroyed
two nodes' separate identities.

**Writing it is server-side only.** Derived at save time; no request-body
change:

```cypher
MATCH (c:Concept {note_id: $note_id, user_id: $user_id})
MATCH (other:Concept {user_id: $user_id, normalized_name: c.normalized_name})
WHERE other.note_id <> $note_id
MERGE (c)-[r:SIMILAR_TO]->(other)
  ON CREATE SET r.score = 1.0, r.method = 'exact', r.created_at = datetime()
```

Because it is derived, a regeneration may destroy it freely and recompute
afterwards rather than trying to preserve it across the subgraph delete.
Idempotent via `MERGE`, and it repairs both directions at once.

**Reading it is where the Cytoscape contract is at stake.** Three options:

- **A. Storage and side-panel only.** `GET /api/notes/{id}/graph` keeps
  filtering to `RELATES_TO`; `SIMILAR_TO` is consumed only by new endpoints
  returning their own shapes. **No frontend change at all.**
- **B. A derived `similarCount` on the node.** Additive; Cytoscape carries
  unknown `data` keys without complaint. Requires the write-path allowlist in
  `projections.PERSISTABLE_NODE_KEYS` to keep excluding it, which it already
  does.
- **C. Cross-note edges drawn on the canvas.** A real contract change: an edge
  with an endpoint outside the note needs a stub node, or Cytoscape throws.
  Also needs a visual treatment, click-to-navigate, and filtering stubs back out
  on save.

**Recommendation: A.** The stored relationship is identical in all three, so
choosing A forecloses nothing.

Endpoints this phase would add:

- `GET /api/graph/related-notes/{note_id}` - notes reachable over `SIMILAR_TO`,
  ranked by count and combined importance.
- `GET /api/graph/concepts/search?q=` - corpus-wide concept lookup by
  `normalized_name`. **Needs no `SIMILAR_TO` at all** - a plain indexed lookup
  filtered by `user_id`, shippable independently and the cheapest win here.
- `GET /api/graph/path?from=&to=` - shortest path, traversing `RELATES_TO`
  within notes and `SIMILAR_TO` between them.

Suggested home: `backend/routers/graph_query.py`.

*Done when:* two notes about overlapping topics surface each other without the
user having linked them by hand.

### 3.4 Move the note-level graph into Neo4j

Only worth starting once §3.1 has landed and the graph is in real use.

`note_links` is already a graph living in a relational table, and it carries
three open problems:

- Cross-group linking is blocked outright - `create_link` rejects any link whose
  endpoints are not in the same group
  ([groups.py:154](backend/routers/groups.py:154)). Connections across subjects,
  the most interesting kind, are structurally impossible.
- `read_graph` runs `db.query(NoteLink).all()` and filters in Python
  ([groups.py:92](backend/routers/groups.py:92)).
- `note_links` has no `user_id` column; ownership is inferred by joining through
  both endpoint notes, which is what forces that load-everything loop.

Work:

- Backfill `note_links` into `(:Note)-[:LINKED_TO {label}]->(:Note)`.
- Drop the same-group constraint.
- Rewrite `GET /api/groups/graph` to read from Neo4j.
- Dual-write the Postgres table for one release as a rollback path, then retire
  it.

**This is a real decision, not a formality** (§4.2). Keeping `note_links` in
Postgres is lower risk but leaves graph logic split across two stores and makes
note → concept → note traversal impossible in a single query.

### 3.5 Embeddings and analytics

- Generate an embedding per concept via Ollama, store it on the `:Concept` node,
  add a Neo4j vector index. This is what finally makes semantic search scale:
  `/ai/semantic-search` currently requires the caller to paste an entire graph
  into the prompt and returns an id relative to *that* blob
  ([ai.py:304](backend/ai/ai.py:304)), which works for one note and cannot work
  across a corpus.
- Fuzzy `SIMILAR_TO` on embedding distance, catching `photosynthesis` /
  `the_photosynthesis_process` that normalisation alone will not. Under per-note
  scoping this is an edge with `method: 'embedding'`, never a merge.
- PageRank or community detection over `importance`/`weight` for "central
  concepts in this note".

Stretch. Nothing above depends on it.

### 3.6 Testing gaps

What exists: pure projection tests, and live-Neo4j tests covering isolation,
regeneration-preserves-layout, and per-note concept scoping.

What is missing:

- **Router-level tests.** No endpoint is covered. `httpx` is already in
  `requirements-dev.txt` for this.
- **CI runs no tests at all.** `smoke-test.yml` only waits for `/health`. It
  should install `requirements-dev.txt` and run `pytest`, and could assert the
  graph round-trips through the API.
- **`reconcile.py` is never invoked automatically.** It exists and works as a
  manual command; nothing schedules it.

---

## 4. Open decisions

### 4.1 Adopt `SIMILAR_TO` for cross-note discovery?

See §3.3. Needed before that phase starts; affects nothing already built.
If declined, gap #5 stays open and cross-note connections remain user-curated
via §3.4's note links.

### 4.2 Move `note_links` to Neo4j, or leave it in Postgres?

See §3.4. Recommendation: move, but only after §3.1 and §3.3 are stable.

### 4.3 Manual vs AI precedence

When a regeneration contradicts a hand-drawn edge, which wins? The `source`
property (`'ai'` / `'manual'`) is stored on both nodes and relationships, so
either policy is implementable - but the current save path replaces the note's
subgraph wholesale and does not distinguish them. Someone has to pick, and then
the repository needs changing to honour it.

### 4.4 Scope

§3.1 and §3.2 are small and deliver the visible feature. §3.3 is the interesting
one. §3.4 and §3.5 are genuinely optional and should be treated as stretch
goals, not commitments.

---

## 5. Remaining risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| New Cypher leaks across users, or a `MERGE` adopts another user's node | **High** | §2.2 and the checklist in §2.4; extend `backend/tests/test_graph_isolation.py` alongside any new query |
| **Losing `neo4j_data` loses user work** - node positions and colours are not derivable and an LLM re-run cannot reproduce them | **High** | Back it up as a system of record, not a cache. `docker compose down -v` destroys graph edits; the README and `DEVOPS_GUIDE.md` should say so |
| Summariser fed the Cytoscape shape instead of the concept schema, degrading output with no error | Medium | Use `records_to_concept_schema()` (§3.2) |
| Cross-note discovery never ships, since dedup no longer provides it | Medium | Decide §4.1 before §3.3; concept search is worth shipping either way |
| Untested endpoints regress silently | Medium | §3.6 - router tests and pytest in CI |
| `note_links` migration diverges the two stores | Medium | Dual-write for one release, backfill script, retire only once stable (§3.4) |
| CI runner memory exhaustion as services accumulate | Low | Heap and pagecache limits are already set explicitly in `docker-compose.yml`; do not remove them |
