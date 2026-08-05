import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import "./App.css";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import { createGroup, deleteGroup, fetchGraph } from "./api";

const RING = 145; // distance between depth rings
const GROUP_R = 27;
const NOTE_R = 18;
const PAD = 95; // room for labels sitting outside the outermost ring

// Floor for the viewBox, so a lone group does not get magnified to fill the
// frame. Roughly the aspect of .group-canvas.
const MIN_VIEW_W = 1040;
const MIN_VIEW_H = 620;

// Turns the flat API response into a tree of only the nodes currently on show.
// A group's contents appear once it has been opened, so the canvas stays small
// until the user asks for more.
function buildTree(graph, expanded) {
  const subgroups = new Map();
  graph.groups.forEach((group) => {
    const key = group.parent_id ?? "root";
    if (!subgroups.has(key)) subgroups.set(key, []);
    subgroups.get(key).push(group);
  });

  const notes = new Map();
  graph.notes.forEach((note) => {
    if (note.group_id == null) return;
    if (!notes.has(note.group_id)) notes.set(note.group_id, []);
    notes.get(note.group_id).push(note);
  });

  function makeGroup(group) {
    const childGroups = subgroups.get(group.id) ?? [];
    const childNotes = notes.get(group.id) ?? [];
    const isOpen = expanded.has(group.id);

    return {
      key: `group-${group.id}`,
      kind: "group",
      id: group.id,
      label: group.name,
      count: childGroups.length + childNotes.length,
      isOpen,
      children: isOpen
        ? [
            ...childGroups.map(makeGroup),
            ...childNotes.map((note) => ({
              key: `note-${note.id}`,
              kind: "note",
              id: note.id,
              label: note.title,
              count: 0,
              children: [],
            })),
          ]
        : [],
    };
  }

  return (subgroups.get("root") ?? []).map(makeGroup);
}

// Linked notes share a colour instead of a drawn edge. Unlinked notes stay
// slate, so colour means "this note is connected to something".
const LOOSE = { fill: "#243044", stroke: "#4b5568" };
const PALETTE = [
  { fill: "#1d6b52", stroke: "#35d29a" },
  { fill: "#6b4a1d", stroke: "#f2a65a" },
  { fill: "#1d3f6b", stroke: "#6fb1ff" },
  { fill: "#6b1d3f", stroke: "#e07a9c" },
  { fill: "#4a1d6b", stroke: "#c58cf5" },
  { fill: "#5c621d", stroke: "#e3d165" },
];

// Every note reachable from another through links forms one connected group and
// takes a single colour - so a chain of three linked notes reads as one cluster
// rather than two separate pairings.
function colourClusters(links) {
  const neighbours = new Map();
  links.forEach(({ note_a_id: a, note_b_id: b }) => {
    if (!neighbours.has(a)) neighbours.set(a, []);
    if (!neighbours.has(b)) neighbours.set(b, []);
    neighbours.get(a).push(b);
    neighbours.get(b).push(a);
  });

  const colours = new Map();
  let next = 0;

  // Sorted so a cluster keeps its colour between renders rather than shuffling
  // whenever the API returns links in a different order.
  [...neighbours.keys()]
    .sort((a, b) => a - b)
    .forEach((start) => {
      if (colours.has(start)) return;

      const colour = PALETTE[next % PALETTE.length];
      next += 1;

      const queue = [start];
      colours.set(start, colour);
      while (queue.length) {
        const current = queue.pop();
        (neighbours.get(current) ?? []).forEach((id) => {
          if (colours.has(id)) return;
          colours.set(id, colour);
          queue.push(id);
        });
      }
    });

  return colours;
}

// Radial tree: depth becomes distance from the centre, and each node owns an
// angular slice sized by how many leaves sit beneath it - so a crowded branch
// gets more of the circle than a sparse one and nothing collides.
function radialLayout(roots) {
  function countLeaves(node) {
    node.leaves = node.children.length
      ? node.children.reduce((sum, child) => sum + countLeaves(child), 0)
      : 1;
    return node.leaves;
  }
  roots.forEach(countLeaves);

  const nodes = [];
  const edges = [];
  const positions = new Map();

  // A lone root sits at the centre with its children fanned around it. Several
  // roots have no natural centre, so they share the first ring instead.
  const rootDepth = roots.length === 1 ? 0 : 1;

  function walk(node, depth, from, to, parentKey) {
    const angle = (from + to) / 2;
    const radius = depth * RING;
    const placed = {
      ...node,
      x: depth === 0 ? 0 : Math.cos(angle) * radius,
      y: depth === 0 ? 0 : Math.sin(angle) * radius,
    };

    nodes.push(placed);
    positions.set(node.key, placed);
    if (parentKey) edges.push([parentKey, node.key]);

    let cursor = from;
    node.children.forEach((child) => {
      const share = ((to - from) * child.leaves) / node.leaves;
      walk(child, depth + 1, cursor, cursor + share, node.key);
      cursor += share;
    });
  }

  const total = roots.reduce((sum, root) => sum + root.leaves, 0) || 1;
  let cursor = -Math.PI / 2; // start at twelve o'clock

  roots.forEach((root) => {
    const share = 2 * Math.PI * (root.leaves / total);
    walk(root, rootDepth, cursor, cursor + share, null);
    cursor += share;
  });

  return { nodes, edges, positions };
}

function GroupGraph() {
  const navigate = useNavigate();

  const [graph, setGraph] = useState(null);
  const [expanded, setExpanded] = useState(new Set());
  const [status, setStatus] = useState("Loading...");
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [managing, setManaging] = useState(false);
  const [pendingNote, setPendingNote] = useState(null);

  // Multiplies the fitted viewBox: above 1 shows more of the canvas (zoomed
  // out), below 1 shows less (zoomed in). Pan is in viewBox units.
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);
  const dragRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchGraph();
      setGraph(data);
      setStatus(data.groups.length ? "" : "No groups yet - create one below.");
    } catch (err) {
      setStatus(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!managing && !pendingNote) return;

    function onKeyDown(event) {
      if (event.key !== "Escape") return;
      setManaging(false);
      setPendingNote(null);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [managing, pendingNote]);

  function toggle(id) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!name.trim()) return;

    try {
      await createGroup(name.trim(), parentId ? Number(parentId) : null);
      setName("");
      setStatus("");
      await load();
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function handleDelete(id, label) {
    if (!window.confirm(`Delete the group "${label}"?`)) return;

    try {
      await deleteGroup(id);
      setStatus("");
      await load();
    } catch (err) {
      setStatus(err.message);
    }
  }

  const tree = graph ? radialLayout(buildTree(graph, expanded)) : null;

  // Clusters are computed from every link, not just the visible ones, so a
  // note keeps its colour whether or not its partner happens to be expanded.
  const clusters = colourClusters(graph?.links ?? []);

  // The frame is a fixed size and the viewBox is fitted to the tree inside it,
  // so expanding a group rescales the drawing rather than resizing the panel -
  // the page never jumps as nodes open and close.
  let view = null;
  if (tree && tree.nodes.length) {
    const xs = tree.nodes.map((node) => node.x);
    const ys = tree.nodes.map((node) => node.y);
    const minX = Math.min(...xs) - PAD;
    const minY = Math.min(...ys) - PAD;
    const contentW = Math.max(...xs) + PAD - minX;
    const contentH = Math.max(...ys) + PAD - minY;

    const w = Math.max(contentW, MIN_VIEW_W);
    const h = Math.max(contentH, MIN_VIEW_H);

    // Centre the tree in whatever slack the minimum leaves over, then apply
    // zoom about that centre so zooming never drifts off the tree.
    const centreX = minX - (w - contentW) / 2 + w / 2;
    const centreY = minY - (h - contentH) / 2 + h / 2;
    const zoomedW = w * zoom;
    const zoomedH = h * zoom;

    view = {
      x: centreX - zoomedW / 2 + pan.x,
      y: centreY - zoomedH / 2 + pan.y,
      w: zoomedW,
      h: zoomedH,
    };
  }

  function startPan(event) {
    // Nodes handle their own clicks; dragging starts on empty canvas only.
    if (event.target.closest(".graph-orb")) return;
    dragRef.current = { x: event.clientX, y: event.clientY, pan };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePan(event) {
    const drag = dragRef.current;
    if (!drag || !view) return;

    // Screen pixels are converted to viewBox units, so a drag moves the canvas
    // the same visible distance at every zoom level.
    const rect = svgRef.current.getBoundingClientRect();
    const unitsPerPixel = view.w / rect.width;

    setPan({
      x: drag.pan.x - (event.clientX - drag.x) * unitsPerPixel,
      y: drag.pan.y - (event.clientY - drag.y) * unitsPerPixel,
    });
  }

  function endPan() {
    dragRef.current = null;
  }

  function changeZoom(factor) {
    setZoom((current) => Math.min(6, Math.max(0.3, current * factor)));
  }

  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  return (
    <main className="dashboard-page">
      <Navbar />

      <div className="dashboard-layout">
        <Sidebar />

        <section className="dashboard-main">
          <div className="group-graph">
            <h1>
              <span className="brand-accent">Groups</span>
            </h1>
            <p className="notes-gallery-subtitle">
              Select a group to fan out what it holds. Notes open in the editor.
              Notes sharing a colour are linked to each other; slate notes have
              no links yet.
            </p>

            <form className="group-form" onSubmit={handleCreate}>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="New group name"
                aria-label="New group name"
              />
              <select
                value={parentId}
                onChange={(event) => setParentId(event.target.value)}
                aria-label="Parent group"
              >
                <option value="">No parent (top level)</option>
                {(graph?.groups ?? []).map((group) => (
                  <option key={group.id} value={group.id}>
                    Inside {group.name}
                  </option>
                ))}
              </select>
              <button type="submit">Create group</button>
              {/* type="button" - inside a form it would otherwise submit and
                  try to create a group. */}
              <button type="button" onClick={() => setManaging(true)}>
                Manage groups
              </button>
            </form>

            {/* While the dialog is open the message belongs inside it, next to
                the action that produced it. */}
            {status && !managing && <p className="group-status">{status}</p>}

            {view && (
              <div className="group-canvas">
                <div className="canvas-zoom">
                  <button onClick={() => changeZoom(1.25)} aria-label="Zoom out">
                    −
                  </button>
                  <button onClick={() => changeZoom(0.8)} aria-label="Zoom in">
                    +
                  </button>
                  <button onClick={resetView}>Fit</button>
                </div>

                <svg
                  ref={svgRef}
                  viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
                  preserveAspectRatio="xMidYMid meet"
                  role="img"
                  aria-label="Groups and the notes they hold"
                  onPointerDown={startPan}
                  onPointerMove={movePan}
                  onPointerUp={endPan}
                  onPointerCancel={endPan}
                >
                  <g>
                    {tree.edges.map(([from, to]) => {
                      const a = tree.positions.get(from);
                      const b = tree.positions.get(to);
                      return (
                        <line
                          key={`${from}->${to}`}
                          className="tree-edge"
                          x1={a.x}
                          y1={a.y}
                          x2={b.x}
                          y2={b.y}
                        />
                      );
                    })}

                    {tree.nodes.map((node) => {
                      const isGroup = node.kind === "group";
                      const r = isGroup ? GROUP_R : NOTE_R;
                      const colour = isGroup
                        ? null
                        : clusters.get(node.id) ?? LOOSE;

                      return (
                        <g
                          key={node.key}
                          className={
                            isGroup ? "graph-orb is-group" : "graph-orb is-note"
                          }
                          onClick={() =>
                            isGroup
                              ? toggle(node.id)
                              : setPendingNote({ id: node.id, label: node.label })
                          }
                        >
                          {/* Inline style, not fill/stroke attributes: SVG
                              presentation attributes lose to stylesheet rules,
                              so the cluster colour would be overridden. */}
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={r}
                            style={
                              colour
                                ? { fill: colour.fill, stroke: colour.stroke }
                                : undefined
                            }
                          />
                          <text x={node.x} y={node.y + r + 17}>
                            {node.label.length > 18
                              ? `${node.label.slice(0, 18)}...`
                              : node.label}
                          </text>
                          {isGroup && !node.isOpen && node.count > 0 && (
                            <text className="orb-count" x={node.x} y={node.y + 5}>
                              {node.count}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                </svg>
              </div>
            )}

            {pendingNote && (
              <div
                className="app-modal"
                onClick={(event) => {
                  if (event.target === event.currentTarget) setPendingNote(null);
                }}
              >
                <div
                  className="app-modal-card"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Open this note?"
                >
                  <h2 className="app-modal-question">
                    Would you like to open this note?
                  </h2>
                  <p>{pendingNote.label}</p>

                  <div className="app-modal-actions">
                    <button onClick={() => navigate(`/dashboard?note=${pendingNote.id}`)}>
                      Yes
                    </button>
                    <button
                      className="modal-secondary"
                      onClick={() => setPendingNote(null)}
                    >
                      No
                    </button>
                  </div>
                </div>
              </div>
            )}

            {managing && (
              <div
                className="app-modal"
                onClick={(event) => {
                  if (event.target === event.currentTarget) setManaging(false);
                }}
              >
                <div
                  className="app-modal-card"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Manage groups"
                >
                  <h2>Manage groups</h2>

                  {graph?.groups.length ? (
                    <ul className="group-admin-list">
                      {graph.groups.map((group) => (
                        <li key={group.id}>
                          <span>{group.name}</span>
                          {/* Drawn rather than the × character: that glyph sits
                              on the font's math axis, so it never centres in a
                              round button. The icon has no accessible name, so
                              the button carries one. */}
                          <button
                            onClick={() => handleDelete(group.id, group.name)}
                            aria-label={`Delete ${group.name}`}
                            title={`Delete ${group.name}`}
                          >
                            <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
                              <path d="M3 3 L9 9 M9 3 L3 9" />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No groups yet.</p>
                  )}

                  {status && <p className="group-status">{status}</p>}

                  <button onClick={() => setManaging(false)}>Close</button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default GroupGraph;
