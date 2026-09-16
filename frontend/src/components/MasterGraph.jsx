import { useEffect, useRef } from "react";
import cytoscape from "cytoscape";

function MasterGraph({
  notes,
  onOpenNote,
}) {
  const containerRef = useRef(null);
  const cyRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const noteNodes = notes.map((note) => ({
        data: {
            id: `note-${note.id}`,
            noteId: note.id,
            label:
            note.title?.trim() ||
            "Untitled Note",
        },
        }));

        const noteEdges = buildNoteEdges(notes);

        const elements = [
        ...noteNodes,
        ...noteEdges,
        ];

    const cy = cytoscape({
      container: containerRef.current,
      elements,

      layout: {
        name: "cose",
        animate: true,
        padding: 80,
        nodeRepulsion: 900000,
        idealEdgeLength: 180,
        componentSpacing: 180,
        },

      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            width: 150,
            height: 60,
            shape: "round-rectangle",
            "background-color": "#6366F1",
            color: "#ffffff",
            "text-valign": "center",
            "text-halign": "center",
            "text-wrap": "wrap",
            "text-max-width": "120px",
            "font-size": "15px",
          },
        },
        {
        selector: "edge",
        style: {
            width: 3,
            "line-color": "#5b6b88",
            "target-arrow-color": "#7c8cff",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            opacity: 0.95,
        },
        },
      ],
    });

    cyRef.current = cy;

    cy.on(
      "dbltap",
      "node",
      (event) => {
        const noteId =
          event.target.data("noteId");

        onOpenNote(noteId);
      }
    );

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [notes, onOpenNote]);

  return (
    <section className="master-graph-page">
      <div className="master-graph-header">
        <h1>Notes Graph</h1>

        <p>
          Explore connections across all your notes.
        </p>
      </div>

      <div
        ref={containerRef}
        className="master-graph-container"
      />
    </section>
  );
}

function buildNoteEdges(notes) {
  const edges = [];

  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      const noteA = notes[i];
      const noteB = notes[j];

      const textA = `${noteA.title || ""} ${noteA.raw_notes || ""} ${noteA.summary || ""}`
        .toLowerCase();

      const textB = `${noteB.title || ""} ${noteB.raw_notes || ""} ${noteB.summary || ""}`
        .toLowerCase();

      const wordsA = new Set(
        textA
          .split(/\W+/)
          .filter((word) => word.length > 3)
      );

      const wordsB = new Set(
        textB
          .split(/\W+/)
          .filter((word) => word.length > 3)
      );

      const sharedWords = [...wordsA].filter((word) =>
        wordsB.has(word)
      );

      if (sharedWords.length >= 1) {
        edges.push({
          data: {
            id: `edge-${noteA.id}-${noteB.id}`,
            source: `note-${noteA.id}`,
            target: `note-${noteB.id}`,
          },
        });
      }
    }
  }

  return edges;
}

export default MasterGraph;