import { useCallback, useEffect, useState } from "react";

import { buildGraph, getLocalGraph } from "../graph";

const VIEW_WIDTH = 360;
const VIEW_HEIGHT = 240;
const PADDING = 40;
const NODE_RADIUS = 9;

// Reads the live editor rather than the last saved note, so the panel reflects
// unsaved edits. Safe to call unguarded: it only runs in response to a
// box-selected event, which the prototype script itself dispatches.
function readEditor() {
  const notes = document.querySelector("#text .container");
  return buildGraph(window.serializeCanvas(), notes?.innerHTML ?? "");
}

// Normalises canvas coordinates into the panel viewBox, reusing the layout the
// user already arranged instead of running a force simulation.
function layout(nodes) {
  const xs = nodes.map((node) => node.x);
  const ys = nodes.map((node) => node.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;
  const width = VIEW_WIDTH - PADDING * 2;
  const height = VIEW_HEIGHT - PADDING * 2;

  const place = (value, min, span, size) =>
    span === 0 ? PADDING + size / 2 : PADDING + ((value - min) / span) * size;

  return new Map(
    nodes.map((node) => [
      node.id,
      {
        x: place(node.x, minX, spanX, width),
        y: place(node.y, minY, spanY, height),
      },
    ])
  );
}

// Reuses the prototype's existing highlight effect on the real canvas box.
function setGlow(id, on) {
  const box = document.getElementById(id);
  if (!box) return;
  document.documentElement.style.setProperty("--glow-color", "#6f6ce8");
  box.classList.toggle("glow", on);
}

function GraphPanel() {
  const [selectedId, setSelectedId] = useState(null);
  const [graph, setGraph] = useState(null);

  useEffect(() => {
    function handleSelect(event) {
      setSelectedId(String(event.detail.id));
      setGraph(readEditor());
    }

    window.addEventListener("box-selected", handleSelect);
    return () => window.removeEventListener("box-selected", handleSelect);
  }, []);

  const focus = useCallback((id) => {
    setSelectedId(id);
    setGraph(readEditor());
  }, []);

  if (!selectedId || !graph) {
    return (
      <aside className="graph-panel">
        <h3>Connections</h3>
        <p className="graph-panel-empty">Select a box to see what it links to.</p>
      </aside>
    );
  }

  const local = getLocalGraph(graph, selectedId);
  if (!local) {
    return (
      <aside className="graph-panel">
        <h3>Connections</h3>
        <p className="graph-panel-empty">That box is no longer on the canvas.</p>
      </aside>
    );
  }

  const positions = layout(local.nodes);
  const selected = local.nodes.find((node) => node.id === selectedId);
  const neighbours = local.nodes.filter((node) => node.id !== selectedId);
  const snippets = graph.textByBox.get(selectedId) ?? [];

  return (
    <aside className="graph-panel">
      <h3>Connections</h3>
      <p className="graph-panel-focus">{selected.label}</p>

      <svg
        className="graph-panel-canvas"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="img"
        aria-label={`Boxes linked to ${selected.label}`}
      >
        {local.edges.map(([a, b]) => (
          <line
            key={`${a}_${b}`}
            x1={positions.get(a).x}
            y1={positions.get(a).y}
            x2={positions.get(b).x}
            y2={positions.get(b).y}
          />
        ))}

        {local.nodes.map((node) => {
          const point = positions.get(node.id);
          const isSelected = node.id === selectedId;
          return (
            <g
              key={node.id}
              className={isSelected ? "graph-node is-selected" : "graph-node"}
              onClick={() => !isSelected && focus(node.id)}
              onMouseEnter={() => setGlow(node.id, true)}
              onMouseLeave={() => setGlow(node.id, false)}
            >
              <circle cx={point.x} cy={point.y} r={NODE_RADIUS} fill={node.color} />
              <text x={point.x} y={point.y + NODE_RADIUS + 14} textAnchor="middle">
                {node.label.slice(0, 18)}
              </text>
            </g>
          );
        })}
      </svg>

      <h4>Linked boxes</h4>
      {neighbours.length ? (
        <ul className="graph-panel-list">
          {neighbours.map((node) => (
            <li key={node.id}>
              <button
                onClick={() => focus(node.id)}
                onMouseEnter={() => setGlow(node.id, true)}
                onMouseLeave={() => setGlow(node.id, false)}
              >
                {node.label}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="graph-panel-empty">No linked boxes yet.</p>
      )}

      <h4>Related text</h4>
      {snippets.length ? (
        <ul className="graph-panel-snippets">
          {/* Plain text only: the stored markup carries onclick attributes. */}
          {snippets.map((text, index) => (
            <li key={index}>{text}</li>
          ))}
        </ul>
      ) : (
        <p className="graph-panel-empty">
          No text linked to this box. Right-click a selection in the notes area to link it.
        </p>
      )}
    </aside>
  );
}

export default GraphPanel;
