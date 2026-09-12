import { useRef, useEffect, useState, forwardRef, useImperativeHandle,} from "react";
import {
  ChartLine,
  Palette,
  Shapes,
  Circle,
  RectangleHorizontal,
  Squircle,
  Diamond,
  Triangle,
  Trash2,
  Link2,
  Sparkles,
  ChevronDown,
  X,
  Check,
  CircleAlert,
  LoaderCircle,
  Search,
  ArrowUp,
} from "lucide-react";
import cytoscape from "cytoscape";
import { semanticSearchGraph,} from "../api/graphApi";

/* =========================================================
   GRAPH THEME HELPERS
   ========================================================= */

/*
  Cytoscape does not automatically resolve CSS variables
  in the same way normal DOM CSS does.

  Read the active TreeNotes theme values from <html>
  and give Cytoscape the resolved colour.
*/
function getThemeColour(
  variableName,
  fallback
) {
  const value =
    getComputedStyle(
      document.documentElement
    )
      .getPropertyValue(variableName)
      .trim();

  return value || fallback;
}


function getGraphThemeColours() {
  return {
    nodeBackground:
      getThemeColour(
        "--graph-node-bg",
        "#6366F1"
      ),

    nodeBorder:
      getThemeColour(
        "--graph-node-border",
        "#818CF8"
      ),

    nodeText:
      getThemeColour(
        "--graph-node-text",
        "#ffffff"
      ),

    selectedBorder:
      getThemeColour(
        "--graph-selected-border",
        "#41d19f"
      ),

    selectedGlow:
      getThemeColour(
        "--graph-selected-glow",
        "rgba(65, 209, 159, 0.28)"
      ),

    edge:
      getThemeColour(
        "--graph-edge",
        "#475569"
      ),

    /*
      Use graph-link palette colour 2 for
      "first node selected while linking".
    */
    linkSource:
      getThemeColour(
        "--graph-link-2",
        "#f2c94c"
      ),
  };
}

const NODE_SHAPES = [
  {
    value: "ellipse",
    label: "Circle",
    Icon: Circle,
  },
  {
    value: "rectangle",
    label: "Rectangle",
    Icon: RectangleHorizontal,
  },
  {
    value: "round-rectangle",
    label: "Rounded",
    Icon: Squircle,
  },
  {
    value: "diamond",
    label: "Diamond",
    Icon: Diamond,
  },
  {
    value: "triangle",
    label: "Triangle",
    Icon: Triangle,
  },
];

function getThemeToken(
  tokenName,
  fallback
) {
  const value =
    getComputedStyle(
      document.documentElement
    )
      .getPropertyValue(tokenName)
      .trim();

  return value || fallback;
}


function getGraphThemeTokens() {
  return {
    nodeBg:
      getThemeToken(
        "--graph-node-bg",
        "#6366f1"
      ),

    nodeBorder:
      getThemeToken(
        "--graph-node-border",
        "#7772ff"
      ),

    nodeText:
      getThemeToken(
        "--graph-node-text",
        "#ffffff"
      ),

    selectedBorder:
      getThemeToken(
        "--graph-selected-border",
        "#4fd1a1"
      ),

    selectedGlow:
      getThemeToken(
        "--graph-selected-glow",
        "rgba(79, 209, 161, 0.28)"
      ),

    selectedEdge:
      getThemeToken(
        "--graph-selected-edge",
        "#4fd1a1"
      ),

    linkSource:
      getThemeToken(
        "--graph-link-source",
        "#f2c94c"
      ),

    linkSourceGlow:
      getThemeToken(
        "--graph-link-source-glow",
        "rgba(242, 201, 76, 0.28)"
      ),

    edge:
      getThemeToken(
        "--graph-edge",
        "#465873"
      ),

    edgeArrow:
      getThemeToken(
        "--graph-edge-arrow",
        "#7772ff"
      ),
  };
}

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

  // References the Graph Editor container for focus management //
  const graphEditorRef = useRef(null);
  const [graphEditorActive, setGraphEditorActive] =
    useState(false);

  // Stores the Cytoscape instance so other functions can access it //
  const cyRef = useRef(null);
// STORES SELECTED EDGES STATE
  const [selectedEdge, setSelectedEdge] = useState(null);

  const linkModeRef = useRef(false);
  const firstNodeToLinkRef = useRef(null);

  // Stores currently selected node //
  const [selectedNode, setSelectedNode] = useState(null);

  // To link nodes// 
  const [linkMode, setLinkMode] = useState(false);

  // TO save first node clicked to link to second //

  const [firstNodeToLink, setFirstNodeToLink] = useState(null);

  // =========================================================
  // Graph Toolbar
  // =========================================================

  // Hidden native colour picker
  const nodeColorInputRef = useRef(null);

  // Shape selector popover
  const shapeMenuRef = useRef(null);
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);

  // Generic temporary feedback for graph actions
  const [graphFeedback, setGraphFeedback] = useState(null);

  // Used to clear graph feedback automatically
  const graphFeedbackTimerRef = useRef(null);

  // =========================================================
  // Graph Semantic Search
  // =========================================================

  const [semanticSearchOpen, setSemanticSearchOpen] = useState(false);

  const [semanticSearchQuery, setSemanticSearchQuery] = useState("");

  const [semanticSearchLoading, setSemanticSearchLoading] = useState(false);

  const semanticSearchRef = useRef(null);

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

  function applyActiveGraphTheme(cy) {

    if (!cy) {
      return;
    }


    const graphTheme =
      getGraphThemeColours();


    cy.style()

      /* Normal nodes */

      .selector("node")

      .style({
        "background-color":
          graphTheme.nodeBackground,

        "border-color":
          graphTheme.nodeBorder,

        color:
          graphTheme.nodeText,
      })


      /* Selected node */

      .selector("node:selected")

      .style({
        "border-color":
          graphTheme.selectedBorder,

        "underlay-color":
          graphTheme.selectedBorder,
      })


      /* First node in link mode */

      .selector("node.link-source")

      .style({
        "border-color":
          graphTheme.linkSource,

        "overlay-color":
          graphTheme.linkSource,
      })


      /* Normal edges */

      .selector("edge")

      .style({
        "line-color":
          graphTheme.edge,

        "target-arrow-color":
          graphTheme.nodeBorder,
      })


      /* Selected edges */

      .selector("edge:selected")

      .style({
        "line-color":
          graphTheme.selectedBorder,

        "target-arrow-color":
          graphTheme.selectedBorder,
      })


      .update();
  }

  function applyGraphTheme(
    cy = cyRef.current
  ) {
    if (!cy) {
      return;
    }


    const graphTheme =
      getGraphThemeTokens();


    cy.style()

      /*
        Default nodes
      */
      .selector("node")
      .style({
        "background-color":
          graphTheme.nodeBg,

        "border-color":
          graphTheme.nodeBorder,

        color:
          graphTheme.nodeText,
      })


      /*
        Normal selected node.

        Solid ring = selected.
        Colour comes from the current
        accessibility palette.
      */
      .selector("node:selected")
      .style({
        "border-width": 4,

        "border-style":
          "solid",

        "border-color":
          graphTheme.selectedBorder,

        "underlay-color":
          graphTheme.selectedBorder,

        "underlay-opacity":
          0.18,

        "underlay-padding":
          8,
      })


      /*
        First node selected while
        creating a graph link.

        IMPORTANT:
        Dashed ring distinguishes this
        from normal selection even if the
        colours appear similar.
      */
      .selector("node.link-source")
      .style({
        "border-width": 4,

        "border-style":
          "dashed",

        "border-color":
          graphTheme.linkSource,

        "underlay-color":
          graphTheme.linkSource,

        "underlay-opacity":
          0.22,

        "underlay-padding":
          8,
      })


      /*
        Default edges
      */
      .selector("edge")
      .style({
        width: 2,

        "line-color":
          graphTheme.edge,

        "target-arrow-color":
          graphTheme.edgeArrow,

        "line-style":
          "solid",

        opacity:
          0.8,
      })


      /*
        Selected edge.

        Extra thickness means selection
        does not depend on colour alone.
      */
      .selector("edge:selected")
      .style({
        width: 4,

        "line-color":
          graphTheme.selectedEdge,

        "target-arrow-color":
          graphTheme.selectedEdge,

        opacity:
          1,
      })


      .update();
  }

  // << CYTOSCAPE FRONTEND >> //
  useEffect(() => {
    if (!graphData || !graphContainerRef.current) {
      return;
    }

    const graphTheme = getGraphThemeTokens();

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
        /* =====================================================
          NORMAL NODE
          ===================================================== */

        {
          selector: "node",
          style: {
            "background-color": graphTheme.nodeBg,

            width: 110,
            height: 52,

            shape: "round-rectangle",

            label: "data(label)",

            color: graphTheme.nodeText,
            "font-size": "16px",
            "font-weight": "500",

            "text-valign": "center",
            "text-halign": "center",

            "text-wrap": "wrap",
            "text-max-width": "75px",

            "border-width": 1,
            "border-color": graphTheme.nodeBorder,

            "overlay-opacity": 0,
          },
        },
        
        /*
          =========================================================
          SELECTED NODE
          =========================================================

          Solid outline.

          This intentionally does NOT change
          the node's actual background colour.
        */

        {
          selector: "node:selected",
          style: {
            "border-width": 4,
            "border-style": "solid",
            "border-color": graphTheme.selectedBorder,
            "underlay-color": graphTheme.selectedBorder,
            "underlay-opacity": 0.18,
            "underlay-padding": 8,
          },
        },

        /*
          =========================================================
          LINK SOURCE NODE
          =========================================================

          Dashed outline gives us an additional
          non-colour accessibility cue.
        */

        {
          selector: "node.link-source",
          style: {
            "border-width": 4,
            "border-style": "dashed",
            "border-color": graphTheme.linkSource,
            "overlay-color": graphTheme.linkSource,
            "overlay-opacity": 0.22,
            "overlay-padding": 8,
          },
        },

        /* =====================================================
          SAVED CUSTOM NODE COLOUR
          ===================================================== */
        
        {
          selector: "node[color]",
          style: {
            "background-color": "data(color)",
          },
        },

        /* =====================================================
          SAVED NODE SHAPE
          ===================================================== */

        {
          selector: "node[shape]",
          style: {
            shape: "data(shape)",
          },
        },

        /* =====================================================
          DEFAULT EDGE
          ===================================================== */

        {
          selector: "edge",
          style: {
            width: 2,

            "line-color": graphTheme.edge,
            "target-arrow-color": graphTheme.nodeBorder,
            "target-arrow-shape": "triangle",

            "curve-style": "bezier",

            opacity: 0.8,

            "arrow-scale": 1.1,
          },
        },

        /* =====================================================
          ACTIVE NODE
          ===================================================== */

        {
          selector: "node:active",
          style: {
            "overlay-opacity": 0.08,
          },
        },

        /*
          =========================================================
          SELECTED EDGE
          =========================================================

          Selected edges become both coloured
          AND thicker.
        */

        {
          selector: "edge:selected",
          style: {
            width: 4,
            "line-color": graphTheme.selectedEdge,
            "target-arrow-color": graphTheme.selectedEdge,
            opacity: 1,
          },
        },

        
      ],
    });
    cyRef.current = cy;

    /* =========================================================
      WATCH TREE NOTES THEME / ACCESSIBILITY CHANGES
      ========================================================= */

    const themeObserver =
      new MutationObserver(
        (mutations) => {

          const themeChanged =
            mutations.some(
              (mutation) =>
                mutation.attributeName ===
                  "data-theme" ||

                mutation.attributeName ===
                  "data-color-vision"
            );


          if (!themeChanged) {
            return;
          }


          applyActiveGraphTheme(cy);


          /*
            Keep the Selected Node toolbar colour
            consistent with the newly active theme
            when the node does not have a custom colour.
          */

          setSelectedNode(
            (current) => {

              if (!current) {
                return current;
              }


              const currentCyNode =
                cy.getElementById(
                  current.id
                );


              if (
                !currentCyNode ||
                currentCyNode.empty()
              ) {
                return current;
              }


              const savedColour =
                currentCyNode.data(
                  "color"
                );


              return {
                ...current,

                color:
                  savedColour ||
                  getThemeColour(
                    "--graph-node-bg",
                    "#6366F1"
                  ),
              };
            }
          );
        }
      );


    themeObserver.observe(
      document.documentElement,
      {
        attributes: true,

        attributeFilter: [
          "data-theme",
          "data-color-vision",
        ],
      }
    );

    // Detect selected node //
  cy.on("tap", "node", (event) => {
  const clickedNode =
    event.target;

  const clickedNodeData = {
    ...clickedNode.data(),

    color:
      clickedNode.data("color") ||
      getThemeColour(
        "--graph-node-bg",
        "#6366F1"
      ),

    shape:
      clickedNode.data("shape") ||
      "round-rectangle",
  };
  cy.on("tap", "edge", (event) => {
    const clickedEdge = event.target;
  
    setSelectedEdge({
      ...clickedEdge.data(),
    });
  
    setSelectedNode(null);
  
    console.log(
      "Selected edge:",
      clickedEdge.data()
    );
  });


  // Always update normal node selection
  setSelectedNode(
    clickedNodeData
  );


  // =====================================================
  // NORMAL NODE SELECTION
  // =====================================================

  if (!linkModeRef.current) {
    console.log(
      "Selected node:",
      clickedNode.data()
    );

    return;
  }


  // =====================================================
  // LINK MODE: SELECT FIRST NODE
  // =====================================================

  if (!firstNodeToLinkRef.current) {

    firstNodeToLinkRef.current =
      clickedNode.id();

    setFirstNodeToLink(
      clickedNode.id()
    );

    /*
      Make first selected link node
      visually obvious.
    */
    clickedNode.addClass(
      "link-source"
    );

    console.log(
      "First node selected for link:",
      clickedNode.data("label")
    );

    return;
  }


  // =====================================================
  // PREVENT SELF LINK
  // =====================================================

  if (
    firstNodeToLinkRef.current ===
    clickedNode.id()
  ) {
    return;
  }


  // =====================================================
  // CREATE LINK
  // =====================================================

  const sourceId =
    firstNodeToLinkRef.current;

  const targetId =
    clickedNode.id();


  const sourceNode =
    cy.getElementById(
      sourceId
    );


  const sourceLabel =
    sourceNode.data("label") ||
    sourceId;

  const targetLabel =
    clickedNode.data("label") ||
    targetId;


  const edgeId =
    `manual-edge-${Date.now()}`;


  cy.add({
    group: "edges",

    data: {
      id: edgeId,

      source:
        sourceId,

      target:
        targetId,
    },
  });


  // Remove first-node highlight
  sourceNode.removeClass(
    "link-source"
  );


  // Exit link mode
  linkModeRef.current = false;

  firstNodeToLinkRef.current =
    null;

  setLinkMode(false);

  setFirstNodeToLink(null);


  // =====================================================
  // USER FEEDBACK
  // =====================================================

  showGraphFeedback(
    `Link created: ${sourceLabel} → ${targetLabel}`,
    "success"
  );

  console.log(
    "Nodes linked:",
    sourceId,
    "→",
    targetId
  );
});

cy.one("layoutstop", () => {
  cy.resize();
  cy.fit(cy.elements(), 50);
});

return () => {
  themeObserver.disconnect();

  cy.destroy();
  cyRef.current = null;
};

}, [graphData]);

useEffect(() => {

  const root =
    document.documentElement;


  const observer =
    new MutationObserver(
      (mutations) => {

        const themeChanged =
          mutations.some(
            (mutation) =>
              mutation.attributeName ===
                "data-theme" ||
              mutation.attributeName ===
                "data-color-vision"
          );


        if (!themeChanged) {
          return;
        }


        requestAnimationFrame(() => {
          applyGraphTheme();
        });

      }
    );


  observer.observe(
    root,
    {
      attributes: true,

      attributeFilter: [
        "data-theme",
        "data-color-vision",
      ],
    }
  );


  return () => {
    observer.disconnect();
  };

}, []);

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

function startLinkMode() {
  /*
    Clicking the active Link button
    again cancels link mode.
  */
  if (linkModeRef.current) {
    cancelLinkMode();
    return;
  }


  cyRef.current
    ?.nodes()
    .removeClass(
      "link-source"
    );


  linkModeRef.current = true;

  firstNodeToLinkRef.current =
    null;


  setLinkMode(true);

  setFirstNodeToLink(null);

  setGraphFeedback(null);
}


function cancelLinkMode() {
  cyRef.current
    ?.nodes()
    .removeClass(
      "link-source"
    );


  linkModeRef.current = false;

  firstNodeToLinkRef.current =
    null;


  setLinkMode(false);

  setFirstNodeToLink(null);
}

function createLinkedTextNode(label, linkColor) {
  if (!cyRef.current || !label?.trim()) {
    return null;
  }

  const cy = cyRef.current;

  /*
    If this concept already exists, link to the
    existing node instead of making a duplicate.
  */
  const existingNodes = cy.nodes().filter((node) => {
    return (
      node.data("label")?.trim().toLowerCase() ===
      label.trim().toLowerCase()
    );
  });

  if (existingNodes.length > 0) {
    const existingNode = existingNodes[0];

    existingNode.data(
      "linkColor",
      linkColor
    );

    return existingNode.id();
  }


  const newNodeId =
    typeof crypto.randomUUID === "function"
      ? `manual-${crypto.randomUUID()}`
      : `manual-${Date.now()}`;


  const extent = cy.extent();

  const centreX =
    (extent.x1 + extent.x2) / 2;

  const centreY =
    (extent.y1 + extent.y2) / 2;


  cy.add({
    group: "nodes",

    data: {
      id: newNodeId,
      label: label,
      linkColor: linkColor,
    },

    position: {
      x: centreX + 60,
      y: centreY + 60,
    },
  });


  return newNodeId;
}

function focusNode(nodeId) {
  if (!cyRef.current) {
    return false;
  }

  const cy = cyRef.current;

  const node =
    cy.getElementById(nodeId);

  if (!node || node.empty()) {
    return false;
  }


  cy.elements().unselect();

  node.select();

  setSelectedNode({
    ...node.data(),
  });


  cy.animate(
    {
      center: {
        eles: node,
      },

      zoom: Math.max(
        cy.zoom(),
        1.35
      ),
    },

    {
      duration: 350,
    }
  );


  return true;
}

function setLinkedNodeHover(
  nodeId,
  color,
  isHovered
) {
  if (!cyRef.current) {
    return;
  }

  const node =
    cyRef.current.getElementById(
      nodeId
    );

  if (!node || node.empty()) {
    return;
  }


  if (isHovered) {
    node.data(
      "linkColor",
      color
    );

    node.style({
      "underlay-color": color,
      "underlay-opacity": 0.38,
      "underlay-padding": 20,
    });
  } else {
    /*
      Only turn off our halo.

      Don't call removeStyle() here because that could
      remove the user's custom node colour/shape too.
    */
    node.style(
      "underlay-opacity",
      0
    );
  }
}

function setLinkedNodeColor(
  nodeId,
  color
) {
  if (!cyRef.current) {
    return;
  }

  const node =
    cyRef.current.getElementById(
      nodeId
    );

  if (!node || node.empty()) {
    return;
  }


  node.data(
    "linkColor",
    color
  );

  /*
    Also update an existing hover halo immediately.
  */
  node.style(
    "underlay-color",
    color
  );
}

function getSelectedCyNode() {
  if (
    !cyRef.current ||
    !selectedNode?.id
  ) {
    return null;
  }

  const node =
    cyRef.current.getElementById(
      selectedNode.id
    );

  if (!node || node.empty()) {
    return null;
  }

  return node;
}


function changeSelectedNodeColor(newColor) {
  const node = getSelectedCyNode();

  if (!node) {
    return;
  }

  // Change visually
  node.style(
    "background-color",
    newColor
  );

  // Preserve for saving
  node.data(
    "color",
    newColor
  );

  // Update toolbar indicator
  setSelectedNode((current) => ({
    ...current,
    color: newColor,
  }));
}


function changeSelectedNodeShape(newShape) {
  const node = getSelectedCyNode();

  if (!node) {
    return;
  }

  // Change visually
  node.style(
    "shape",
    newShape
  );

  // Preserve for saving
  node.data(
    "shape",
    newShape
  );

  // Update toolbar/popover
  setSelectedNode((current) => ({
    ...current,
    shape: newShape,
  }));

  setShapeMenuOpen(false);
}

function showGraphFeedback(
  message,
  type = "success"
) {
  setGraphFeedback({
    message,
    type,
  });

  if (graphFeedbackTimerRef.current) {
    clearTimeout(
      graphFeedbackTimerRef.current
    );
  }

  graphFeedbackTimerRef.current =
    setTimeout(() => {
      setGraphFeedback(null);
    }, 2500);
}

function deleteSelectedElement() {
  if (!cyRef.current) {
    return;
  }

  // Delete selected node
  if (selectedNode?.id) {
    const node =
      cyRef.current.getElementById(
        selectedNode.id
      );

    if (node && !node.empty()) {
      const nodeLabel =
        node.data("label") ||
        node.id();

      node.remove();

      setSelectedNode(null);
      setSelectedEdge(null);

      showGraphFeedback(
        `Deleted node: ${nodeLabel}`,
        "success"
      );
    }

    return;
  }

  // Delete selected edge
  if (selectedEdge?.id) {
    const edge =
      cyRef.current.getElementById(
        selectedEdge.id
      );

    if (edge && !edge.empty()) {
      const sourceLabel =
        edge.source().data("label") ||
        edge.source().id();

      const targetLabel =
        edge.target().data("label") ||
        edge.target().id();

      edge.remove();

      setSelectedEdge(null);
      setSelectedNode(null);

      showGraphFeedback(
        `Deleted link: ${sourceLabel} → ${targetLabel}`,
        "success"
      );
    }
  }
}
    
async function handleSemanticSearch() {
  const query =
    semanticSearchQuery.trim();

  if (!query) {
    return;
  }

  // Collapse the search UI as soon as the search is submitted.
  setSemanticSearchOpen(false);

  if (!noteId) {
    showGraphFeedback(
      "Unable to search because no note is selected.",
      "error"
    );
    return;
  }

  setSemanticSearchLoading(true);

  try {
    showGraphFeedback(
      `Searching graph for "${query}"...`,
      "info"
    );

    const result =
      await semanticSearchGraph(
        noteId,
        query,
        graphData
      );

    if (!result?.match) {
      showGraphFeedback(
        `No matching node found for "${query}".`,
        "error"
      );
      return;
    }

    const match = result.match;

    const found =
      focusNode(match.node_id);

    if (!found) {
      showGraphFeedback(
        "The matching node could not be found in the current graph.",
        "error"
      );
      return;
    }

    showGraphFeedback(
      `Closest match to "${query}": ${match.label}`,
      "success"
    );

    setSemanticSearchQuery("");

  } catch (error) {
    console.error(
      "Semantic graph search failed:",
      error
    );

    showGraphFeedback(
      "Unable to search the graph. Please try again.",
      "error"
    );

  } finally {
    setSemanticSearchLoading(false);
  }
}

useEffect(() => {
  if (!semanticSearchOpen) {
    return;
  }

  function handleSemanticSearchOutside(event) {
    if (
      semanticSearchRef.current &&
      !semanticSearchRef.current.contains(event.target)
    ) {
      setSemanticSearchOpen(false);
    }
  }

  document.addEventListener(
    "pointerdown",
    handleSemanticSearchOutside,
    true
  );

  return () => {
    document.removeEventListener(
      "pointerdown",
      handleSemanticSearchOutside,
      true
    );
  };
}, [semanticSearchOpen]);

useEffect(() => {
  function handlePointerDownOutside(event) {
    if (
      graphEditorRef.current &&
      !graphEditorRef.current.contains(event.target)
    ) {
      setGraphEditorActive(false);
    }
  }

  document.addEventListener(
    "pointerdown",
    handlePointerDownOutside
  );

  return () => {
    document.removeEventListener(
      "pointerdown",
      handlePointerDownOutside
    );
  };
}, []);

useEffect(() => {

  function handleClickOutside(event) {
    if (
      shapeMenuRef.current &&
      !shapeMenuRef.current.contains(
        event.target
      )
    ) {
      setShapeMenuOpen(false);
    }
  }


  function handleEscape(event) {
    if (event.key === "Escape") {

      setShapeMenuOpen(false);

      if (linkModeRef.current) {
        cancelLinkMode();
      }
    }
  }


  document.addEventListener(
    "mousedown",
    handleClickOutside
  );

  document.addEventListener(
    "keydown",
    handleEscape
  );


  return () => {

    document.removeEventListener(
      "mousedown",
      handleClickOutside
    );

    document.removeEventListener(
      "keydown",
      handleEscape
    );

    if (
      graphFeedbackTimerRef.current
    ) {
      clearTimeout(
        graphFeedbackTimerRef.current
      );
    }
  };

}, []);

useImperativeHandle(ref, () => ({

  getGraphData() {
    return getEditedGraphData();
  },


  createLinkedTextNode(
    label,
    linkColor
  ) {
    return createLinkedTextNode(
      label,
      linkColor
    );
  },


  focusNode(nodeId) {
    return focusNode(nodeId);
  },


  setLinkedNodeHover(
    nodeId,
    color,
    isHovered
  ) {
    setLinkedNodeHover(
      nodeId,
      color,
      isHovered
    );
  },


  setLinkedNodeColor(
    nodeId,
    color
  ) {
    setLinkedNodeColor(
      nodeId,
      color
    );
  },

}));

  return (
    <section className="graph-panel">

      {/* ================================================= */}
      {/* GRAPH HEADER                                      */}
      {/* ================================================= */}

      <div className="graph-panel-heading">

        <div className="graph-panel-heading-title">
          <h2>Graph View</h2>

          <ChartLine
            size={21}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </div>


        <div className="graph-panel-header-actions">

          {/* Error/status now lives in header */}
          {error && (
            <span className="graph-header-error">
              {error}
            </span>
          )}


          <button
            type="button"
            className="graph-generate-button primary-action"
            onClick={generateGraph}
            disabled={loading}
          >
            <Sparkles
              strokeWidth={1.8}
            />

            <span>
              {loading
                ? "Generating..."
                : "Generate Graph"}
            </span>
          </button>

        </div>

      </div>


      {/* ================================================= */}
      {/* GRAPH EDITOR                                      */}
      {/* Mirrors raw-notes-editor                          */}
      {/* ================================================= */}

      <div
        ref={graphEditorRef}
        className={`graph-editor ${
          graphEditorActive
            ? "graph-editor-active"
            : ""
        }`}
        onPointerDownCapture={() => {
          setGraphEditorActive(true);
        }}
      >

        {/* =============================================== */}
        {/* GRAPH TOOLBAR                                   */}
        {/* =============================================== */}

        <div
          className="graph-node-toolbar"
          role="toolbar"
          aria-label="Graph editing"
        >

          {/* NODE COLOUR */}

          <div className="graph-toolbar-popover-wrapper">

            <button
              type="button"
              className="graph-toolbar-button tooltip-align-left"
              disabled={!selectedNode}
              onClick={() =>
                nodeColorInputRef.current?.click()
              }
              data-tooltip={
                selectedNode
                  ? "Node colour"
                  : "Select a node first"
              }
              aria-label="Node colour"
            >
              <span className="graph-toolbar-color-icon">

                <Palette
                  size={19}
                  strokeWidth={1.8}
                />

                <span
                  className="graph-toolbar-color-indicator"
                  style={{
                    backgroundColor:
                      selectedNode?.color ||
                      getThemeColour(
                        "--graph-node-bg",
                        "#6366F1"
                      ),
                  }}
                />

              </span>
            </button>


            <input
              ref={nodeColorInputRef}
              className="graph-hidden-color-input"
              type="color"
              value={
                selectedNode?.color ||
                "#6366F1"
              }
              onChange={(event) =>
                changeSelectedNodeColor(
                  event.target.value
                )
              }
            />

          </div>


          {/* NODE SHAPE */}

          <div
            className="graph-toolbar-popover-wrapper"
            ref={shapeMenuRef}
          >

            <button
              type="button"

              className={`graph-toolbar-button graph-shape-trigger ${
                shapeMenuOpen
                  ? "graph-toolbar-button-active"
                  : ""
              }`}

              disabled={!selectedNode}

              onClick={() =>
                setShapeMenuOpen(
                  (current) => !current
                )
              }

              data-tooltip={
                selectedNode
                  ? "Node shape"
                  : "Select a node first"
              }

              aria-label="Node shape"
              aria-haspopup="true"
              aria-expanded={shapeMenuOpen}
            >
              <Shapes
                size={19}
                strokeWidth={1.8}
              />

              <ChevronDown
                size={12}
                strokeWidth={1.8}
              />
            </button>


            {shapeMenuOpen && (
              <div className="graph-shape-popover">

                {NODE_SHAPES.map(
                  ({
                    value,
                    label,
                    Icon,
                  }) => (

                    <button
                      key={value}
                      type="button"

                      className={`graph-shape-option ${
                        (
                          selectedNode?.shape ||
                          "round-rectangle"
                        ) === value
                          ? "graph-shape-option-active"
                          : ""
                      }`}

                      onClick={() =>
                        changeSelectedNodeShape(
                          value
                        )
                      }

                      data-tooltip={label}
                      aria-label={label}
                    >
                      <Icon
                        size={18}
                        strokeWidth={1.8}
                      />
                    </button>

                  )
                )}

              </div>
            )}

          </div>


          <span className="graph-toolbar-divider" />

        {/* DELETE ELEMENT */}
        <button
          type="button"
          className="graph-toolbar-button"
          onClick={deleteSelectedElement}
          disabled={!selectedNode && !selectedEdge}
          data-tooltip={
            selectedNode
              ? "Delete node"
              : selectedEdge
              ? "Delete edge"
              : "Select a node or edge first"
          }
          aria-label="Delete selected item"
        >
          <Trash2
            size={19}
            strokeWidth={1.8}
          />
        </button>


          {/* LINK NODES */}

          <button
            type="button"

            className={`graph-toolbar-button ${
              linkMode
                ? "graph-toolbar-button-active"
                : ""
            }`}

            onClick={startLinkMode}

            data-tooltip={
              linkMode
                ? "Cancel link mode"
                : "Link nodes"
            }

            aria-label="Link nodes"
            aria-pressed={linkMode}
          >
            <Link2
              size={19}
              strokeWidth={1.8}
            />
          </button>

        </div>


        {/* =============================================== */}
        {/* GRAPH CANVAS                                    */}
        {/* =============================================== */}

        <div className="graph-canvas-shell">

          <div
            ref={graphContainerRef}
            className="graph-container"
          />


          {/* SELECTED NODE */}

          {selectedNode && (
            <div className="graph-selected-node-overlay">

              <span>
                Selected node
              </span>

              <strong>
                {selectedNode.label}
              </strong>

            </div>
          )}


          {/* LINK MODE */}

          {linkMode && (
            <div className="graph-link-mode-overlay">

              <Link2
                size={16}
                strokeWidth={1.8}
              />

              <div>

                {!firstNodeToLink ? (
                  <>
                    <strong>
                      Link nodes
                    </strong>

                    <span>
                      Select the first node
                    </span>
                  </>
                ) : (
                  <>
                    <strong>
                      First node:{" "}
                      {
                        cyRef.current
                          ?.getElementById(
                            firstNodeToLink
                          )
                          .data("label")
                      }
                    </strong>

                    <span>
                      Select the second node
                    </span>
                  </>
                )}

              </div>


              <button
                type="button"
                onClick={cancelLinkMode}
                aria-label="Cancel linking"
              >
                <X
                  size={15}
                  strokeWidth={1.8}
                />
              </button>

            </div>
          )}


          {/* GRAPH FEEDBACK */}

          {graphFeedback && (
            <div
              className={`graph-feedback graph-feedback-${graphFeedback.type}`}
            >
              {graphFeedback.type === "error" ? (
                <CircleAlert
                  size={16}
                  strokeWidth={2}
                />
              ) : graphFeedback.type === "info" ? (
                <LoaderCircle
                  size={16}
                  strokeWidth={2}
                  className="graph-feedback-spinner"
                />
              ) :(
                <Check
                  size={16}
                  strokeWidth={2}
                />
              )}

              <span>
                {graphFeedback.message}
              </span>
            </div>
          )}

          {/* SEMANTIC GRAPH SEARCH */}

          <div
            ref={semanticSearchRef}
            className={`graph-semantic-search ${
              semanticSearchOpen
                ? "graph-semantic-search-open"
                : ""
            }`}
          >

            {semanticSearchOpen ? (

              <>
                <Search
                  size={17}
                  strokeWidth={1.8}
                  className="graph-semantic-search-icon"
                />


                <input
                  type="text"

                  value={semanticSearchQuery}

                  onChange={(event) =>
                    setSemanticSearchQuery(event.target.value)
                  }

                  placeholder="Search graph..."

                  autoFocus

                  onKeyDown={(event) => {

                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleSemanticSearch();
                    }

                    if (event.key === "Escape") {
                      setSemanticSearchOpen(false);
                    }

                  }}
                />

                <button
                  type="button"

                  className="graph-semantic-submit"

                  aria-label="Search graph"

                  data-tooltip="Semantic search"

                  disabled={
                    semanticSearchLoading ||
                    !semanticSearchQuery.trim()
                  }

                  onClick={handleSemanticSearch}
                >

                  <ArrowUp
                    size={17}
                    strokeWidth={2}
                  />

                </button>
              </>

            ) : (

              <button
                type="button"

                className="graph-semantic-search-toggle"

                aria-label="Semantic graph search"

                data-tooltip="Semantic search"

                onClick={() =>
                  setSemanticSearchOpen(true)
                }
              >

                <Search
                  size={18}
                  strokeWidth={1.9}
                />

              </button>

            )}

          </div>

        </div>

      </div>

    </section>
  );

  }); 
  
export default GraphPanel;