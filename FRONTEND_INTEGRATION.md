# Frontend integration: saving and loading the concept graph

The backend can now store and retrieve the graph that `GraphPanel` renders.
Nothing under `frontend/` has been changed — this document is the handover for
whoever owns those files.

**Nothing is broken right now.** The endpoints are additive. If none of the
changes below are made, the app behaves exactly as it does today. But the
feature is not reachable either, because the client-side save path is currently
dead code.

Companion documents: `NEO4J_INTEGRATION_PLAN.md` (why the design is this shape),
`DEVOPS_GUIDE.md` (running the stack).

---

## 1. What exists now

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/notes/{note_id}/graph` | Load the saved graph |
| `PUT` | `/api/notes/{note_id}/graph` | Save the graph, returns it as stored |
| `DELETE` | `/api/notes/{note_id}/graph` | Discard the graph, keep the note |

`POST /api/graph` (generate from raw notes) is **unchanged** — same path, same
request, same response.

### Payload shape

Exactly what `getEditedGraphData()` already produces, in both directions:

```json
{
  "nodes": [
    {
      "data": { "id": "9f8c…", "label": "photosynthesis", "importance": 0.8,
                "color": "#ff0000", "shape": "diamond" },
      "position": { "x": 120.5, "y": 88.0 }
    }
  ],
  "edges": [
    {
      "data": { "id": "e9f8c…-4a1b…", "source": "9f8c…", "target": "4a1b…",
                "label": "converts light", "weight": 0.6 }
    }
  ]
}
```

`color`, `shape` and `position` are **omitted entirely** when unset rather than
sent as `null` — Cytoscape's `node[color]` selector matches on key presence, so
a literal `null` would paint the node null instead of leaving the stylesheet
default alone.

### Status codes

| Code | Meaning | Suggested handling |
|------|---------|--------------------|
| `200` | Success | — |
| `204` | Deleted | — |
| `401` | Not logged in | Existing auth handling |
| `404` | Note missing, or not yours | Treat as "no graph" |
| `502` | Graph store rejected the write | Show a save error; the note itself is safe |
| `503` | Neo4j unreachable | Degrade quietly — the panel still works unsaved |

An empty graph returns `200` with `{"nodes": [], "edges": []}`, **not** a 404.
The note exists; it just has no graph yet.

---

## 2. Changes needed in `frontend/src/components/`

Seven changes across two files. Three are deletions or one-liners.

### 2.1 Delete the test fixture override — **do this first**

[GraphPanel.jsx:76-118](frontend/src/components/GraphPanel.jsx:76)

`generateGraph()` sets `testGraphData` *after* the `try/catch`, unconditionally
overwriting every real backend response with hardcoded React/JavaScript/
Components nodes:

```js
    } finally {
      setLoading(false);
    }

    // TEMPORARY TEST GRAPH DATA //
    const testGraphData = { … };   // ← delete this whole block

    setGraphData(testGraphData);   // ← and this
  }
```

While this is present a successful API call is indistinguishable from a failed
one on screen, and **every change below will appear to work while testing
against fixtures.** Nothing else can be verified until it is gone.

### 2.2 Make `saveGraph` reachable

[GraphPanel.jsx:409](frontend/src/components/GraphPanel.jsx:409)

`saveGraph()` is fully written and has no caller — it is not on the imperative
handle, and no button invokes it. One line fixes it:

```js
useImperativeHandle(ref, () => ({
  getGraphData() {
    return getEditedGraphData();
  },
  saveGraph,          // ← add
}));
```

### 2.3 Call it when the note is saved

[NoteWorkspace.jsx:165](frontend/src/components/NoteWorkspace.jsx:165)

`saveEverything()` already collects the graph and then logs it:

```js
    const savedNote = await response.json();

    console.log("Note saved:", savedNote);
    console.log("Graph ready to save:", graphData);   // ← replace this line
```

with:

```js
    await graphPanelRef.current?.saveGraph();
```

The `graphData` local on line 144 becomes unused and can go. The save button in
`Navbar` already reaches here via `Dashboard.jsx:18`, so no wiring is needed
above this point.

### 2.4 Stop the layout engine discarding saved positions

[GraphPanel.jsx:135](frontend/src/components/GraphPanel.jsx:135)

The Cytoscape instance hardcodes `cose`, which recomputes every coordinate. A
graph loaded with saved positions would have them immediately overwritten:

```js
      layout: {
        name: "cose",
        animate: true,
        fit: true,
        padding: 50,
      },
```

Use `preset` when the payload carries positions, keeping `cose` for a freshly
generated graph that has none:

```js
      layout: graphData.nodes.some((n) => n.position)
        ? { name: "preset", fit: true, padding: 50 }
        : { name: "cose", animate: true, fit: true, padding: 50 },
```

### 2.5 Add the missing `shape` stylesheet rule

[GraphPanel.jsx:183](frontend/src/components/GraphPanel.jsx:183)

The shape control writes `node.data("shape", …)` and the backend stores it, but
the stylesheet has a rule for `color` and none for `shape`. A restored shape
therefore round-trips through the database and silently fails to render. Add
beside the existing `node[color]` rule:

```js
        {
          selector: "node[shape]",
          style: {
            shape: "data(shape)",
          },
        },
```

### 2.6 Give manual elements stable ids

[GraphPanel.jsx:259](frontend/src/components/GraphPanel.jsx:259) and
[GraphPanel.jsx:316](frontend/src/components/GraphPanel.jsx:316)

`manual-${Date.now()}` collides when two elements are created inside the same
millisecond. Once persisted these are keys:

```js
const edgeId = `manual-edge-${crypto.randomUUID()}`;
const newNodeId = `manual-${crypto.randomUUID()}`;
```

> **Keep the `manual` prefix.** It is the only signal the backend has for
> whether an element was drawn by the user or generated by the LLM, and it is
> stored as `source: 'manual'`. Renaming the prefix silently reclassifies
> everything the user drew as AI output.

### 2.7 Load the saved graph on mount

`GraphPanel` has no load path at all — opening a note shows an empty panel until
the LLM is re-run. Add alongside the other effects:

```js
useEffect(() => {
  if (!noteId) return;

  let cancelled = false;

  (async () => {
    try {
      const response = await fetch(`/api/notes/${noteId}/graph`, {
        credentials: "include",
      });
      if (!response.ok) return;          // 404/503 → leave the panel empty

      const saved = await response.json();
      if (cancelled) return;
      if (saved.nodes?.length) setGraphData(saved);
    } catch (error) {
      console.error("Graph load error:", error);
    }
  })();

  return () => { cancelled = true; };
}, [noteId]);
```

The `cancelled` flag matters: switching notes quickly can otherwise let a slow
response for the previous note land in the new note's panel.

---

## 3. Two behaviours worth knowing

**A node's identity is its label.** The backend keys concepts on
`(note_id, normalised label)`, where normalisation lowercases, converts
underscores and hyphens to spaces, strips punctuation and collapses whitespace.
Two nodes labelled `Bees` and `bees` in one note are **one** concept and will
come back as a single node. The duplicate check in `addSelectedTextNode()`
([GraphPanel.jsx:304](frontend/src/components/GraphPanel.jsx:304)) already
compares labels case-insensitively, so this matches existing behaviour — but
renaming a node changes which concept it is.

**Element ids change on the first save.** The client sends `"1"`, `"2"`,
`manual-…`; the server returns its own UUIDs. The `PUT` response body is the
canonical stored graph precisely so the panel can adopt them without a second
request:

```js
const saved = await response.json();
setGraphData(saved);
```

This is optional — re-saving with stale ids still converges, because identity is
the label, not the id — but adopting them keeps client and server aligned.

---

## 4. Verifying it works

Backend first, no frontend needed. Log in through the app so the session cookie
is set, then from the browser console on `localhost:8080`:

```js
await (await fetch("/api/notes/1/graph")).json()
```

Then end to end, once §2 is done:

1. Open a note, click **Generate Graph** — real concepts appear, not
   React/JavaScript/Components.
2. Drag a node, recolour it, change its shape.
3. Click **Save**.
4. Reload the page and reopen the note.
5. Position, colour and shape are all still there.
6. Click **Generate Graph** again — concepts the model still emits keep their
   positions.

Step 5 is the one that fails if §2.4 is skipped; step 5's shape is the one that
fails if §2.5 is skipped.

---

## 5. Running the stack

One new service and one new environment variable. `.env.example` has the
variable; existing local `.env` files do not need updating, because
`docker-compose.yml` supplies the same default.

```bash
docker compose up -d --build
```

```bash
docker compose run --rm backend alembic -c backend/alembic.ini upgrade head
```

`/health` now reports each store separately:

```json
{"status": "ok", "databases": {"postgres": "ok", "neo4j": "ok"}}
```

Overall status stays `ok` when only Neo4j is down — notes still load and save
without a graph, so the API is degraded rather than unhealthy.

The Neo4j browser is at `http://localhost:7474` (user `neo4j`, password from
`NEO4J_PASSWORD`, default `changeme_graph`).

> **`docker compose down -v` now destroys user work.** Node positions and
> colours live only in Neo4j and cannot be regenerated by re-running the LLM.
> The `neo4j_data` volume is a system of record, not a cache.
