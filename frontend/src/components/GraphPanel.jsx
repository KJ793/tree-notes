import { useRef, useEffect, useState, forwardRef, useImperativeHandle,} from "react";
import cytoscape from "cytoscape";

const GraphPanel = forwardRef(function GraphPanel(
  { rawNotes, selectedText, addNodeTrigger, noteId },
  ref
) {
  // << frontend dev >> //
  // Stores graph JSON returned from AI/backend //
  const [graphData, setGraphData] = useState(null);

  // Handles graph loading state //
  const [loading, setLoading] = useState(false);

  // Handles graph generation errors //
  const [error, setError] = useState("");

  // References the HTML div where Cytoscape renders //
  const graphContainerRef = useRef(null);

  // Stores the Cytoscape instance so other functions can access it //
  const cyRef = useRef(null);

  const linkModeRef = useRef(false);
  const firstNodeToLinkRef = useRef(null);

  // Stores currently selected node //
  const [selectedNode, setSelectedNode] = useState(null);

  // To link nodes// 
const [linkMode, setLinkMode] = useState(false);

// TO save first node clicked to link to second //

const [firstNodeToLink, setFirstNodeToLink] = useState(null);

  async function generateGraph() {
    if (!rawNotes || rawNotes.trim() === "") {
      setError("Please write some notes before generating a graph.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // << BACKEND CONNECTION >> //
      const response = await fetch("/api/graph", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rawNotes: rawNotes,
        }),
      });

      if (!response.ok) {
        throw new Error("Graph generation failed. Please try again.");
      }

      const data = await response.json();

      // Store returned graph JSON //
      setGraphData(data);

    } catch (error) {
      console.error("Graph generation error:", error);

      setError("Unable to generate graph. Please try again.");

    } finally {
      setLoading(false);
    }

    // TEMPORARY TEST GRAPH DATA //
    // Keep this while Docker / AI is not running //
    const testGraphData = {
      nodes: [
        {
          data: {
            id: "1",
            label: "React",
          },
        },
        {
          data: {
            id: "2",
            label: "JavaScript",
          },
        },
        {
          data: {
            id: "3",
            label: "Components",
          },
        },
      ],

      edges: [
        {
          data: {
            id: "e1",
            source: "1",
            target: "2",
          },
        },
        {
          data: {
            id: "e2",
            source: "1",
            target: "3",
          },
        },
      ],
    };

    setGraphData(testGraphData);
  }

  // << CYTOSCAPE FRONTEND >> //
  useEffect(() => {
    if (!graphData || !graphContainerRef.current) {
      return;
    }

    const cy = cytoscape({
      container: graphContainerRef.current,

      elements: [
        ...graphData.nodes,
        ...graphData.edges,
      ],

      layout: {
        name: "cose",
        animate: true,
        fit: true,
        padding: 50,
      },

      style: [
        {
          selector: "node",
          style: {
            "background-color": "#6366F1",

            width: 110,
            height: 52,

            shape: "round-rectangle",

            label: "data(label)",

            color: "#ffffff",
            "font-size": "16px",
            "font-weight": "500",

            "text-valign": "center",
            "text-halign": "center",

            "text-wrap": "wrap",
            "text-max-width": "75px",

            "border-width": 1,
            "border-color": "#818CF8",

            "overlay-opacity": 0,
          },
        },
        // highlight the selected node
        {
          selector: "node:selected",
          style: {
            "border-width": 4,
            "border-color": "#41d19f",
            "background-color": "#4F46E5",
          },
        },

        // If node has saved colour data, use it //
        {
          selector: "node[color]",
          style: {
            "background-color": "data(color)",
          },
        },

        {
          selector: "edge",
          style: {
            width: 2,

            "line-color": "#475569",
            "target-arrow-color": "#6366F1",
            "target-arrow-shape": "triangle",

            "curve-style": "bezier",

            opacity: 0.8,

            "arrow-scale": 1.1,
          },
        },
        // overlay for edge
        {
          selector: "node:active",
          style: {
            "overlay-opacity": 0.08,
          },
        },

        {
          selector: "edge:selected",
          style: {
            width: 3,
            "line-color": "#41d19f",
            "target-arrow-color": "#818CF8",
          },
        },
      ],
    });
    cyRef.current = cy;

    // Detect selected node //
  cy.on("tap", "node", (event) => {
  const clickedNode = event.target;

  // Normal node selection
  if (!linkModeRef.current) {
    setSelectedNode(clickedNode.data());
    console.log("Selected node:", clickedNode.data());
    return;
  }

  // First node selected for linking
  if (!firstNodeToLinkRef.current) {
    firstNodeToLinkRef.current = clickedNode.id();

    setFirstNodeToLink(clickedNode.id());

    console.log(
      "First node selected for link:",
      clickedNode.data("label")
    );

    return;
  }

  // Prevent linking node to itself
  if (firstNodeToLinkRef.current === clickedNode.id()) {
    console.log("Cannot link a node to itself");
    return;
  }

  const sourceId = firstNodeToLinkRef.current;
  const targetId = clickedNode.id();

  const edgeId = `manual-edge-${Date.now()}`;

  cy.add({
    group: "edges",
    data: {
      id: edgeId,
      source: sourceId,
      target: targetId,
    },
  });

  console.log(
    "Nodes linked:",
    sourceId,
    "→",
    targetId
  );

  // Exit link mode
  linkModeRef.current = false;
  firstNodeToLinkRef.current = null;

  setLinkMode(false);
  setFirstNodeToLink(null);
});

cy.one("layoutstop", () => {
  cy.resize();
  cy.fit(cy.elements(), 50);
});

return () => {
  cy.destroy();
  cyRef.current = null;
};

}, [graphData]);

function addSelectedTextNode() {
  if (!cyRef.current || !selectedText) {
    return;
  }

  const cy = cyRef.current;

  const nodeAlreadyExists = cy.nodes().some((node) => {
    return (
      node.data("label")?.trim().toLowerCase() ===
      selectedText.trim().toLowerCase()
    );
  });

  if (nodeAlreadyExists) {
    console.log("Node already exists:", selectedText);
    return;
  }

  const newNodeId = `manual-${Date.now()}`;

  const extent = cy.extent();

  const centreX = (extent.x1 + extent.x2) / 2;
  const centreY = (extent.y1 + extent.y2) / 2;

  cy.add({
    group: "nodes",
    data: {
      id: newNodeId,
      label: selectedText,
    },
    position: {
      x: centreX + 60,
      y: centreY + 60,
    },
  });
}   


useEffect(() => 
    { if (addNodeTrigger === 0) 
        { return; }
         addSelectedTextNode(); }, 
         [addNodeTrigger]);


// getting latest graph with all the chnages
function getEditedGraphData() {
  if (!cyRef.current) {
    return null;
  }

  const cy = cyRef.current;

  const nodes = cy.nodes().map((node) => ({
    data: {
      ...node.data(),
    },
    position: {
      x: node.position("x"),
      y: node.position("y"),
    },
  }));

  const edges = cy.edges().map((edge) => ({
    data: {
      ...edge.data(),
    },
  }));

  return {
    nodes,
    edges,
  };
}
// saving graph backend point
async function saveGraph() {
  if (!noteId) {
    console.log("No note ID available");
    return;
  }

  const editedGraph = getEditedGraphData();

  if (!editedGraph) {
    console.log("No graph available to save");
    return;
  }

  try {
    const response = await fetch(
      `/api/notes/${noteId}/graph`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editedGraph),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to save graph");
    }

    console.log("Graph saved successfully");
  } catch (error) {
    console.error("Graph save error:", error);
  }
}

useImperativeHandle(ref, () => ({
  getGraphData() {
    return getEditedGraphData();
  },
}));

  return (
    <section className="graph-panel">
      <h2>Graph Panel</h2>

      <div className="graph-placeholder">

        {!graphData && !loading && (
          <p>Graph will appear here</p>
        )}

        {loading && (
          <p>Generating graph...</p>
        )}

        {error && (
          <p className="graph-error">{error}</p>
        )}

        <div
          ref={graphContainerRef}
          className="graph-container"
        ></div>

        <div className="graph-toolbar">

          <div className="graph-edit-controls">

            {selectedNode ? (
              <>
                <span className="selected-node-name">
                  {selectedNode.label}
                </span>

                {/* NODE COLOUR */}
                <label className="graph-control">
                  Color

                  <input
                    type="color"
                    value={selectedNode.color || "#6366F1"}
                    onChange={(e) => {
                      const newColor = e.target.value;

                      const node =
                        cyRef.current.getElementById(
                          selectedNode.id
                        );

                      // Change node visually //
                      node.style(
                        "background-color",
                        newColor
                      );

                      // Store colour inside Cytoscape node data //
                      node.data("color", newColor);

                      // Update editor UI //
                      setSelectedNode((prevNode) => ({
                        ...prevNode,
                        color: newColor,
                      }));
                    }}
                  />
                </label>

                {/* NODE SHAPE */}
                <label className="graph-control">
                  Shape

                  <select
                    value={selectedNode.shape || "ellipse"}
                    onChange={(e) => {
                      const newShape = e.target.value;

                      const node =
                        cyRef.current.getElementById(
                          selectedNode.id
                        );

                      // Change node visually //
                      node.style(
                        "shape",
                        newShape
                      );

                      // Store shape inside Cytoscape node data //
                      node.data(
                        "shape",
                        newShape
                      );

                      // Update editor UI //
                      setSelectedNode((prevNode) => ({
                        ...prevNode,
                        shape: newShape,
                      }));
                    }}
                  >
                    <option value="ellipse">
                      Circle
                    </option>

                    <option value="rectangle">
                      Rectangle
                    </option>

                    <option value="round-rectangle">
                      Rounded
                    </option>

                    <option value="diamond">
                      Diamond
                    </option>

                    <option value="triangle">
                      Triangle
                    </option>
                  </select>
                </label>
              </>
            ) : (
              <span className="no-node-selected">
                Select a node to edit
              </span>
            )}

          </div>

          <button
            type="button"
            className="generate-graph-button"
            onClick={generateGraph}
            disabled={loading}
          >
            {loading
              ? "Generating..."
              : "Generate Graph"}
          </button>

          <button
            type="button"
            className="generate-graph-button"
            onClick={() => {
                setLinkMode(true);
                setFirstNodeToLink(null);

                linkModeRef.current = true;
                firstNodeToLinkRef.current = null;

                console.log("Link mode started");
            }}
            >
            Link Nodes
            </button>

        </div>
      </div>
    </section>
  );

  }); 
  
export default GraphPanel;