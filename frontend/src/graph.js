// Turns a serialized canvas plus the notes-section HTML into a graph the panel
// can render. Deliberately free of any live-DOM dependency: it takes the same
// shapes that are stored in the database, so the gallery could reuse it later.

/**
 * @param {{boxes: object[], lines: string[][]}} canvas - serializeCanvas() output.
 * @param {string} notesHtml - innerHTML of the notes section.
 */
export function buildGraph(canvas, notesHtml) {
  const nodes = (canvas?.boxes ?? []).map((box) => ({
    id: String(box.id),
    x: box.x,
    y: box.y,
    color: box.color || "#f1f1f1",
    label: labelFor(box.content),
  }));

  // Edges come from the serialized line list rather than the prototype's
  // in-memory `boxes` Map: deleteLine() strips ids from every box's adjacency
  // array instead of just the two endpoints, so the Map under-reports.
  const known = new Set(nodes.map((node) => node.id));
  const edges = (canvas?.lines ?? [])
    .map(([a, b]) => [String(a), String(b)])
    .filter(([a, b]) => known.has(a) && known.has(b));

  return { nodes, edges, textByBox: textByBox(notesHtml) };
}

/**
 * Selected node plus everything reachable within `depth` undirected hops.
 * @returns {{nodes: object[], edges: string[][]}|null} null if the id is unknown.
 */
export function getLocalGraph(graph, selectedId, depth = 1) {
  const id = String(selectedId);
  if (!graph.nodes.some((node) => node.id === id)) return null;

  const reached = new Map([[id, 0]]);
  let frontier = [id];

  for (let hop = 1; hop <= depth; hop += 1) {
    const next = [];
    frontier.forEach((current) => {
      graph.edges.forEach(([a, b]) => {
        const other = a === current ? b : b === current ? a : null;
        if (other && !reached.has(other)) {
          reached.set(other, hop);
          next.push(other);
        }
      });
    });
    frontier = next;
  }

  return {
    nodes: graph.nodes
      .filter((node) => reached.has(node.id))
      .map((node) => ({ ...node, depth: reached.get(node.id) })),
    edges: graph.edges.filter(([a, b]) => reached.has(a) && reached.has(b)),
  };
}

function labelFor(html) {
  if (!html) return "Untitled box";
  const doc = parse(html);
  // createNewBlock() appends an <h6 class="boxFooter">#N</h6> that CSS hides in
  // the editor; without this it would surface as a stray "#2" in the label.
  doc.querySelectorAll(".boxFooter").forEach((el) => el.remove());
  return (doc.body.textContent || "").trim().slice(0, 40) || "Untitled box";
}

/** @returns {Map<string, string[]>} box id -> highlighted snippets bound to it. */
function textByBox(html) {
  const result = new Map();
  if (!html) return result;

  parse(html)
    .querySelectorAll("[data-box-id]")
    .forEach((span) => {
      const id = span.dataset.boxId;
      // "none" is the dropdown's unset sentinel, not a box id.
      if (!id || id === "none") return;

      const text = (span.textContent || "").trim();
      if (!text) return;

      if (!result.has(id)) result.set(id, []);
      result.get(id).push(text);
    });

  return result;
}

// DOMParser builds an inert document, so the onclick attributes the prototype
// writes onto linked spans never run and no resources load.
function parse(html) {
  return new DOMParser().parseFromString(html, "text/html");
}
