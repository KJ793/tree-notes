import { useRef, useEffect, useState } from "react";
import cytoscape from "cytoscape";

function GraphPanel({ rawNotes }) {
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

  // Stores currently selected node //
  const [selectedNode, setSelectedNode] = useState(null);

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
            label: "data(label)",
            color: "#fff",
            "text-valign": "center",
            "text-halign": "center",
            "font-size": "12px",
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
            "line-color": "#64748b",
            "target-arrow-color": "#64748b",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
          },
        },
      ],
    });

    cyRef.current = cy;

    // Detect selected node //
    cy.on("tap", "node", (event) => {
      const clickedNode = event.target;

      setSelectedNode(clickedNode.data());

      console.log("Selected node:", clickedNode.data());
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




  // Saves the final state of selected graph //
  function getEditedGraphData() {
    if (!cyRef.current){
        return null;

  }

  const cy = cyRef.current;

  const nodes = cy.nodes().map((node)=> ({
    data: {
        ...node.data(),

    },
    position: {
        x: node.position("x"),
        y: node.position("y"),

    },

  }));

  const edges = cy.edges().map((edge =>({
    data:{
        ...edge.data(),
    },
    })));
    return{
        nodes,
        edges,
 };
}




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

        </div>
      </div>
    </section>
  );
}

export default GraphPanel;