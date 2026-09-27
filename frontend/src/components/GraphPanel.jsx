import { useRef, useEffect, useState, forwardRef, useImperativeHandle,} from "react";
import {
  ChartLine,
  Shapes,
  Circle,
  RectangleHorizontal,
  Square,
  Squircle,
  SquareDashed,
  Diamond,
  Hexagon,
  Octagon,
  Triangle,
  Trash2,
  Link2,
  Sparkles,
  ChevronDown,
  ChevronRight,
  X,
  Check,
  CircleAlert,
  LoaderCircle,
  Search,
  Plus,
  ArrowUp,
  Type,
  PaintBucket,
  MoveUpRight,
  Minus,
  ArrowRight,
  CircleX,
} from "lucide-react";
import SquareDottedIcon from "./icons/SquareDottedIcon";
import VeeIcon from "./icons/VeeIcon";
import VeeNodeIcon from "./icons/VeeNodeIcon";
import cytoscape from "cytoscape";
import { semanticSearchGraph,} from "../api/graphApi";
import TreeNotesColorPicker from "./TreeNotesColorPicker";

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
  {
    value: "vee",
    label: "Vee",
    Icon: VeeNodeIcon,
  },
  {
    value: "hexagon",
    label: "Hexagon",
    Icon: Hexagon,
    rotation: 30,
  },
  {
    value: "octagon",
    label: "Octagon",
    Icon: Octagon,
  },
];

const NODE_BORDER_STYLES = [
  {
    value: "solid",
    label: "Solid border",
    Icon: Square,
  },
  {
    value: "dashed",
    label: "Dashed border",
    Icon: SquareDashed,
  },
  {
    value: "dotted",
    label: "Dotted border",
    Icon: SquareDottedIcon,
  },
];

const EDGE_STYLES = [
  {
    value: "solid",
    label: "Solid",
  },
  {
    value: "dashed",
    label: "Dashed",
  },
  {
    value: "dotted",
    label: "Dotted",
  },
];


const ARROW_SHAPES = [
  {
    value: "triangle",
    label: "Triangle",
    Icon: Triangle,
    rotation: 90,
  },
  {
    value: "vee",
    label: "Vee",
    Icon: VeeIcon,
    rotation: 135,
  },
  {
    value: "chevron",
    label: "Chevron",
    Icon: ChevronRight,
  },
  {
    value: "tee",
    label: "Tee",
    Icon: Minus,
    rotation: 90,
  },
  {
    value: "circle",
    label: "Circle",
    Icon: Circle,
  },
  {
    value: "square",
    label: "Square",
    Icon: Square,
  },
  {
    value: "diamond",
    label: "Diamond",
    Icon: Diamond,
  },
  {
    value: "none",
    label: "No arrow",
    Icon: CircleX,
  },
];

/* =========================================================
   NODE AUTO-SIZING
   ========================================================= */

const NODE_MIN_WIDTH = 110;
const NODE_MIN_HEIGHT = 52;

const NODE_FONT_SIZE = 15;
const NODE_LINE_HEIGHT = 19;

/*
  Maximum width of the actual label text before
  Cytoscape wraps it onto another line.
*/
const NODE_TEXT_WRAP_WIDTH = 150;


/*
  Shapes have very different amounts of usable
  internal space.

  Rectangles can use almost their entire body.
  Diamond / triangle / vee need substantially more
  outer size to contain the same text comfortably.
*/
const NODE_SHAPE_SIZE_FACTORS = {

  rectangle: {
    width: 1,
    height: 1,
  },

  "round-rectangle": {
    width: 1,
    height: 1,
  },

  ellipse: {
    width: 1.2,
    height: 1.15,
  },

  diamond: {
    width: 1.6,
    height: 1.6,
  },

  triangle: {
    width: 1.8,
    height: 1.9,
  },

  vee: {
    width: 1.9,
    height: 1.9,
  },

  hexagon: {
    width: 1.2,
    height: 1.1,
  },

  octagon: {
    width: 1.15,
    height: 1.1,
  },

};

function calculateNodeSize(
  label,
  shape = "round-rectangle"
) {

  const cleanLabel =
    String(
      label || "New Node"
    ).trim();


  /*
    Canvas lets us measure approximately the same
    text dimensions Cytoscape is rendering.
  */
  const canvas =
    document.createElement(
      "canvas"
    );

  const context =
    canvas.getContext("2d");


  context.font =
    `500 ${NODE_FONT_SIZE}px Inter, system-ui, sans-serif`;


  const words =
    cleanLabel.split(/\s+/);


  const lines = [];

  let currentLine = "";

  /*
    Find the widest individual word.

    If one word is wider than our normal wrapping
    width, expand the node instead of cutting the word.
  */
  const longestWordWidth =
    Math.max(
      ...words.map(
        word =>
          context.measureText(
            word
          ).width
      ),
      1
    );


  /*
    Normally wrap around 150px.

    A single long word is allowed to make the
    text area wider so it remains intact.
  */
  const effectiveWrapWidth =
    Math.max(
      NODE_TEXT_WRAP_WIDTH,
      longestWordWidth + 4
    );

  for (const word of words) {

    const testLine =
      currentLine
        ? `${currentLine} ${word}`
        : word;


    if (
      context.measureText(
        testLine
      ).width >
        effectiveWrapWidth &&
      currentLine
    ) {

      lines.push(
        currentLine
      );

      currentLine =
        word;

    } else {

      currentLine =
        testLine;

    }

  }


  if (currentLine) {

    lines.push(
      currentLine
    );

  }

  const widestLine =
    Math.max(
      ...lines.map(
        line =>
          context.measureText(
            line
          ).width
      ),
      1
    );


  const textHeight =
    Math.max(
      lines.length,
      1
    ) *
    NODE_LINE_HEIGHT;


  /*
    Normal breathing room around the text.
  */
  const paddedWidth =
    widestLine + 34;

  const paddedHeight =
    textHeight + 22;


  const factors =
    NODE_SHAPE_SIZE_FACTORS[
      shape
    ] ??
    NODE_SHAPE_SIZE_FACTORS[
      "round-rectangle"
    ];

  const width =
    Math.max(
      NODE_MIN_WIDTH,
      Math.ceil(
        paddedWidth *
        factors.width
      )
    );

  const height =
    Math.max(
      NODE_MIN_HEIGHT,
      Math.ceil(
        paddedHeight *
        factors.height
      )
    );


  /*
    Cytoscape centres labels using the node's
    bounding box.

    A triangle's visual centre sits lower than
    its bounding-box centre, so move only triangle
    labels downward proportionally to their height.
  */
  const textMarginY =
    shape === "triangle"
      ? Math.round(
          height * 0.12
        )
      : 0;

  return {

    width,

    height,

    textMaxWidth:
      Math.ceil(
        effectiveWrapWidth
      ),

    textMarginY,

  };
}

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

    edgeLabel:
      getThemeToken(
        "--graph-edge-label",
        "#cbd5e1"
      ),
  };
}

const GraphPanel = forwardRef(function GraphPanel(
  {
    rawNotes,
    selectedText,
    addNodeTrigger,
    noteId,
    initialGraph,
    onNavigateLinkedText,
  },
  ref
) {
  // << frontend dev >> //
  // Stores graph JSON returned from AI/backend/database //

  /*
    Always initialise GraphPanel with a valid graph object.

    If this note already has a graph_json value from the
    database, use it immediately. Otherwise keep a real empty
    graph so users can manually create nodes before pressing
    Generate Graph.
  */
  const [graphData, setGraphData] =
    useState(() => ({
      nodes: Array.isArray(initialGraph?.nodes)
        ? initialGraph.nodes
        : [],
      edges: Array.isArray(initialGraph?.edges)
        ? initialGraph.edges
        : [],
    }));

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

  const loadedGraphNoteIdRef = useRef(null);

  // Stores the Cytoscape instance so other functions can access it //
  const cyRef = useRef(null);

  // =========================================================
  // AI GRAPH STREAMING
  // =========================================================

  // Holds streamed edges whose source/target nodes
  // have not arrived yet.
  const pendingStreamEdgesRef = useRef([]);

  // =========================================================
  // STREAM VISUAL POSITIONING
  // =========================================================

  // Temporary centre around which streamed nodes are placed.
  // The final COSE layout will replace these positions.
  const streamAnchorRef = useRef(null);

  // Counts nodes as they arrive so temporary positions
  // can be distributed around the graph canvas.
  const streamNodeIndexRef = useRef(0);

  // =========================================================
  // GRAPH STREAM REQUEST
  // =========================================================

  // Stores the currently active graph-generation request.
  // Allows us to cancel it if the note changes or the
  // component disappears.
  const graphStreamAbortRef = useRef(null);

  // =========================================================
  // EDGE LINKING
  // =========================================================

  // Stores selected edge states
  const [selectedEdge, setSelectedEdge] = useState(null);

  const linkModeRef = useRef(false);
  const firstNodeToLinkRef = useRef(null);

  // Stores currently selected node //
  const [selectedNode, setSelectedNode] = useState(null);

  // Stores an array of selected nodes/edges for multi-selection //
  const [selectionSummary, setSelectionSummary,] =
    useState({
      nodes: [],
      edges: [],
    });

  // To link nodes// 
  const [linkMode, setLinkMode] = useState(false);

  // TO save first node clicked to link to second //

  const [firstNodeToLink, setFirstNodeToLink] = useState(null);

  // =========================================================
  // Graph Toolbar
  // =========================================================

  // Hidden native colour picker
  // const nodeColorInputRef = useRef(null);

  // color picker for node text 
  // const nodeTextColorInputRef = useRef(null);

  // Node border colour picker
  // const nodeBorderColorInputRef = useRef(null);

  // Node border style popover
  const nodeBorderStyleMenuRef = useRef(null);
  const [nodeBorderStyleMenuOpen, setNodeBorderStyleMenuOpen] = useState(false);

  // Shape selector popover
  const shapeMenuRef = useRef(null);
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);

  // Custom graph colour pickers
  const nodeColorButtonRef = useRef(null);
  const nodeTextColorButtonRef = useRef(null);
  const nodeBorderColorButtonRef = useRef(null);
  const edgeColorButtonRef = useRef(null);
  const arrowColorButtonRef = useRef(null);

  const [graphColorPicker, setGraphColorPicker] = useState(null);

  function toggleGraphColorPicker(type) {
    setShapeMenuOpen(false);
    setNodeBorderStyleMenuOpen(false);
    setEdgeStyleMenuOpen(false);
    setArrowShapeMenuOpen(false);

    setGraphColorPicker(
      current =>
        current === type
          ? null
          : type
    );
  }

  // Edge style selector popover
  const edgeStyleMenuRef = useRef(null);
  const [edgeStyleMenuOpen, setEdgeStyleMenuOpen] = useState(false);

  // Arrow shape selector popover
  const arrowShapeMenuRef = useRef(null);
  const [arrowShapeMenuOpen, setArrowShapeMenuOpen] = useState(false);

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

  // =========================================================
  // Node Rename
  // =========================================================

  const [editingNodeId, setEditingNodeId] = useState(null);
  const editingNodeIdRef = useRef(null);
  const [renameValue, setRenameValue] = useState("");
  const renameOriginalValueRef = useRef("");

  const [renamePosition, setRenamePosition] = useState({
    x: 0,
    y: 0,
  });

  const [renameZoom, setRenameZoom] = useState(1);

  // =========================================================
  // Edge Relationship Editing
  // =========================================================

  const [editingEdgeId, setEditingEdgeId] = useState(null);
  const editingEdgeIdRef = useRef(null);
  const [relationshipValue, setRelationshipValue] = useState("");
  const relationshipOriginalValueRef = useRef("");

  const [relationshipPosition, setRelationshipPosition] = useState({
    x: 0,
    y: 0,
  });

  const [relationshipZoom, setRelationshipZoom] = useState(1);

  // =========================================================
  // Node Auto-Sizing / Edge Label Refresh
  // =========================================================

  function resizeNodeToLabel(
    node
  ) {

    if (
      !node ||
      node.empty()
    ) {
      return;
    }


    const label =
      node.data("label") ||
      "New Node";

    const shape =
      node.data("shape") ||
      "round-rectangle";


    const {
      width,
      height,
      textMaxWidth,
      textMarginY,
    } =
      calculateNodeSize(
        label,
        shape
      );


    /*
      Keep these as node data so the Cytoscape
      stylesheet can consume them automatically.
    */
    node.data({
      nodeWidth:
        width,

      nodeHeight:
        height,

      nodeTextMaxWidth:
        textMaxWidth,

      nodeTextMarginY:
        textMarginY,
    });

    refreshConnectedEdgeLabels(
      node
    );
  }

  function refreshConnectedEdgeLabels(
    node
  ) {

    if (
      !node ||
      node.empty()
    ) {
      return;
    }


    const cy =
      node.cy();


    const connectedEdges =
      node.connectedEdges()
        .filter(
          edge =>
            String(
              edge.data(
                "relationship"
              ) || ""
            ).trim()
        );


    if (
      connectedEdges.length === 0
    ) {
      return;
    }

    /*
      First allow Cytoscape to finish applying
      the node's new width / height.
    */
    requestAnimationFrame(() => {

      /*
        Then give the renderer one more frame to
        recalculate the new edge endpoints.
      */
      requestAnimationFrame(() => {

        connectedEdges.forEach(
          edge => {

            const relationship =
              edge.data(
                "relationship"
              ) || "";

            /*
              Force Cytoscape to rebuild the label's
              rendered bounding box.

              The zero-width character changes the
              underlying label value without creating
              any visible change on screen.
            */
            edge.style(
              "label",
              `${relationship}\u200B`
            );

          }
        );

        /*
          On the following frame, remove the temporary
          style override so the edge returns to using:

            label: data(relationship)

          from the normal Cytoscape stylesheet.
        */
        requestAnimationFrame(() => {

          connectedEdges.forEach(
            edge => {

              edge.removeStyle(
                "label"
              );

              if (
                edge.id() !==
                editingEdgeIdRef.current
              ) {

                edge.style(
                  "text-opacity",
                  1
                );

              }

            }
          );


          cy.style()
            .update();

        });

      });

    });

  }

  /*
    Keep GraphPanel synced with the graph_json belonging to the
    currently selected note.

    Important: an unsaved/empty graph remains { nodes: [], edges: [] }
    rather than null. That keeps Cytoscape alive so manual graph
    creation still works before Generate Graph is used.
  */
  useEffect(() => {

    /*
      A successful Save replaces the note object and therefore
      gives us a new initialGraph reference.

      Do NOT reload Cytoscape just because the same note was
      saved. The live Cytoscape graph is already authoritative.
    */
    if (
      loadedGraphNoteIdRef.current ===
      noteId
    ) {
      return;
    }

    loadedGraphNoteIdRef.current =
      noteId;
    
    setGraphData({
      nodes: Array.isArray(initialGraph?.nodes)
        ? initialGraph.nodes
        : [],
      edges: Array.isArray(initialGraph?.edges)
        ? initialGraph.edges
        : [],
    });

    // Clear UI state that belonged to the previously open note.
    setSelectedNode(null);
    setSelectedEdge(null);
    setSelectionSummary({
      nodes: [],
      edges: [],
    });
    setShapeMenuOpen(false);
    setNodeBorderStyleMenuOpen(false);
    setEdgeStyleMenuOpen(false);
    setArrowShapeMenuOpen(false);
    setGraphColorPicker(null);
    setGraphFeedback(null);

    // Clear UI state and references belonging to linking mode.
    linkModeRef.current = false;
    firstNodeToLinkRef.current = null;
    setLinkMode(false);
    setFirstNodeToLink(null);

    // Clear UI state belonging to previous editing node and edge.
    editingNodeIdRef.current = null;
    setEditingNodeId(null);
    editingEdgeIdRef.current = null;
    setEditingEdgeId(null);
    setRelationshipValue("");
  }, [noteId, initialGraph]);

  /* =========================================================
   CANCEL AI GRAPH STREAM WHEN NOTE CHANGES / PANEL UNMOUNTS
   ========================================================= */

useEffect(() => {

  /*
    This cleanup runs:

      - before noteId changes
      - when GraphPanel is unmounted

    If an AI graph is still being streamed, abort that
    HTTP request so it cannot continue feeding graph data
    into a different note.
  */

  return () => {

    if (graphStreamAbortRef.current) {
      graphStreamAbortRef.current.abort();
    }

  };

}, [noteId]);

  async function generateGraph() {

    // =======================================================
    // VALIDATE NOTES
    // =======================================================

    const notes = rawNotes?.trim();

    if (!notes) {
      setError("Please write some notes before generating a graph.");
      return;
    }

    // =======================================================
    // CANCEL ANY PREVIOUS STREAM
    // =======================================================

    if (graphStreamAbortRef.current) {
      graphStreamAbortRef.current.abort();
    }

    const controller = new AbortController();

    graphStreamAbortRef.current = controller;

    setLoading(true);

    setError("");

    try {

      // =====================================================
      // START STREAMING REQUEST
      // =====================================================

      const response =
        await fetch(
          "/api/graph/stream",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            credentials:
              "include",

            signal:
              controller.signal,

            body:
              JSON.stringify({
                noteId:
                  noteId ?? null,

                /*
                  IMPORTANT:

                  rawNotes should already be the plain-text
                  representation supplied by NoteWorkspace.

                  Do not send notes_section_html here.
                */
                rawNotes:
                  notes,
              }),
          }
        );

      // =====================================================
      // HTTP-LEVEL ERRORS
      // =====================================================

      if (!response.ok) {

        let message = "Graph generation failed. Please try again.";

        try {

          const contentType =
            response.headers.get(
              "content-type"
            ) || "";

          if (
            contentType.includes(
              "application/json"
            )
          ) {

            const data = await response.json();

            if (typeof data?.detail === "string") {
              message = data.detail;
            } else if (
              Array.isArray(data?.detail)
            ) {

              message =
                data.detail
                  .map(
                    (item) =>
                      String(
                        item.msg
                      )
                        .replace(
                          /^Value error, /,
                          ""
                        )
                  )
                  .join(" ");

            } else if (
              typeof data?.message === "string"
            ) {
              message = data.message;
            }

          } else {

            const text = await response.text();

            if (text.trim()) {
              message = text.trim();
            }

          }

        } catch {

          /*
            Keep the normal fallback error message
            if the server response cannot be parsed.
          */

        }

        throw new Error(
          message
        );

      }

      // =====================================================
      // MAKE SURE THE BROWSER GAVE US A STREAM
      // =====================================================

      if (!response.body) {
        throw new Error("Graph streaming is not available in this browser.");
      }

      // =====================================================
      // CREATE STREAM READER
      // =====================================================

      const reader = response.body.getReader();

      const decoder =
        new TextDecoder(
          "utf-8"
        );

      /*
        Network chunks do NOT necessarily line up with
        JSON objects.

        For example, one chunk could contain:

          {"type":"no

        and the next:

          de","data":...}\n

        So we keep incomplete text here until a newline
        tells us that one complete NDJSON event exists.
      */

      let buffer = "";

      // =====================================================
      // READ STREAM
      // =====================================================

      while (true) {

        const {value, done,} = await reader.read();

        if (done) {
          break;
        }

        /*
          Convert the Uint8Array network chunk into text.

          stream: true tells TextDecoder that the next
          chunk may continue a character from this one.
        */

        buffer +=
          decoder.decode(
            value,
            {
              stream: true,
            }
          );

        /*
          One chunk may contain:

            one event
            several events
            part of an event

          Split only on newline boundaries.
        */

        const lines = buffer.split("\n");

        /*
          The final item might be incomplete.

          Keep it in the buffer for the next read.
        */

        buffer = lines.pop() ?? "";

        for (const rawLine of lines) {

          const line = rawLine.trim();

          if (!line) {
            continue;
          }

          try {

            const event =
              JSON.parse(
                line
              );

            /*
              This is the function we already tested
              using testGraphStreaming().
            */

            handleGraphStreamEvent(event);

          } catch (
            parseError
          ) {
            console.error("Unable to parse graph stream event:", line, parseError);
          }

        }

      }

      // =====================================================
      // FLUSH TEXTDECODER
      // =====================================================

      buffer += decoder.decode();

      /*
        Usually every backend event ends in \\n.

        This fallback lets us safely process a final JSON
        event even if the final newline was omitted.
      */

      const finalLine = buffer.trim();

      if (finalLine) {

        try {

          const finalEvent =
            JSON.parse(
              finalLine
            );

          handleGraphStreamEvent(finalEvent);

        } catch (
          parseError
        ) {
          console.error("Unable to parse final graph stream event:", finalLine, parseError);
        }

      }

    } catch (error) {

      // =====================================================
      // REQUEST CANCELLED
      // =====================================================

      if (
        error?.name === "AbortError"
      ) {
        console.log("Graph generation stream cancelled.");
        return;
      }

      // =====================================================
      // REQUEST FAILED
      // =====================================================

      console.error("Graph generation error:", error);

      setError(error?.message || "Unable to generate graph. Please try again.");

    } finally {

      /*
        Only clear the ref if this is still the
        currently active request.

        This matters if another request was started
        while an older request was shutting down.
      */

      if (graphStreamAbortRef.current === controller) {
        graphStreamAbortRef.current = null;
        setLoading(false);
      }

    }

  }

  function applyGraphTheme(
    cy = cyRef.current
  ) {
    if (!cy) {
      return;
    }

    const graphTheme = getGraphThemeTokens();

    cy.style()

      // =====================================================
      // DEFAULT NODE
      // =====================================================

      .selector("node")
      .style({
        "background-color": graphTheme.nodeBg,
        "border-color": graphTheme.nodeBorder,
        color: graphTheme.nodeText,
      })

      // =====================================================
      // CUSTOM NODE APPEARANCE
      // =====================================================

      .selector("node[color]")
      .style({
        "background-color": "data(color)",
      })

      .selector("node[textColor]")
      .style({
        color: "data(textColor)",
      })

      .selector("node[shape]")
      .style({
        shape: "data(shape)",
      })

      .selector("node[borderColor]")
      .style({
        "border-color": "data(borderColor)",
      })

      .selector("node[borderStyle]")
      .style({
        "border-style": "data(borderStyle)",
      })

      // =====================================================
      // SELECTED NODE
      // =====================================================

      .selector("node:selected")
      .style({
        "underlay-color": graphTheme.selectedBorder,
        "underlay-opacity": 0.28,
        "underlay-padding": 10,
      })

      // =====================================================
      // LINKED RAW NOTES HOVER
      // =====================================================

      .selector("node.linked-text-hover")
      .style({
        "underlay-color": "data(linkColor)",
        "underlay-opacity": 0.38,
        "underlay-padding": 20,
      })

      // =====================================================
      // LINK SOURCE
      // =====================================================

      .selector("node.link-source")
      .style({
        "border-width": 4,
        "border-style": "dashed",
        "border-color": graphTheme.linkSource,
        "underlay-color": graphTheme.linkSource,
        "underlay-opacity": 0.22,
        "underlay-padding": 8,
      })

      // =====================================================
      // DEFAULT EDGE
      // =====================================================

      .selector("edge")
      .style({
        width: 2,
        "line-color": graphTheme.edge,
        "target-arrow-color": graphTheme.edgeArrow,
        "target-arrow-shape": "triangle",
        "line-style": "solid",
        color: graphTheme.edgeLabel,
        opacity: 0.8,
      })

      // =====================================================
      // CUSTOM EDGE APPEARANCE
      // =====================================================

      .selector("edge[edgeColor]")
      .style({
        "line-color": "data(edgeColor)",
      })

      .selector("edge[arrowColor]")
      .style({
        "target-arrow-color": "data(arrowColor)",
      })

      .selector("edge[arrowShape]")
      .style({
        "target-arrow-shape": "data(arrowShape)",
      })

      .selector("edge[lineStyle]")
      .style({
        "line-style": "data(lineStyle)",
      })

      // =====================================================
      // SELECTED EDGE
      // Must come AFTER custom edge styles.
      // =====================================================

      .selector("edge:selected")
      .style({
        "underlay-color": graphTheme.selectedEdge,
        "underlay-opacity": 0.32,
        "underlay-padding": 6,
      })

      .update();
  }



  function addStreamEdge(edgeData)
  {

    const cy = cyRef.current;

    if (
      !cy ||
      !edgeData
    ) {
      return false;
    }

    const sourceId =
      String(
        edgeData.source ?? ""
      );


    const targetId =
      String(
        edgeData.target ?? ""
      );

    if (
      !sourceId ||
      !targetId
    ) {

      console.warn(
        "Streamed edge is missing source/target:",
        edgeData
      );

      return false;
    }

    const sourceNode =
      cy.getElementById(
        sourceId
      );

    const targetNode =
      cy.getElementById(
        targetId
      );

    /*
      An edge cannot safely be added until both
      of its nodes exist.
    */

    if (
      sourceNode.empty() ||
      targetNode.empty()
    ) {
      return false;
    }

    /*
      Hans should ideally provide edge IDs.

      This fallback gives us something usable
      during development if he doesn't yet.
    */

    const edgeId =
      String(
        edgeData.id ||
        `ai-edge-${sourceId}-${targetId}-${edgeData.relationship || "link"}`
      );

    const existing =
      cy.getElementById(
        edgeId
      );

    /*
      If this edge already exists, update it
      instead of creating a duplicate.
    */

    if (!existing.empty()) {

      existing.data({
        ...existing.data(),
        ...edgeData,
        id: edgeId,
        source: sourceId,
        target: targetId,
      });

      return true;
    }

    cy.add({
      group: "edges",

      data: {
        ...edgeData,

        id:
          edgeId,

        source:
          sourceId,

        target:
          targetId,
      },
    });

    return true;
  }

  function getStreamNodePosition()
  {

    const cy = cyRef.current;

    if (!cy) {
      return {
        x: 0,
        y: 0,
      };
    }

    /*
      On the first streamed node, capture the centre
      of the currently visible Cytoscape viewport.

      All subsequent temporary positions are based
      around this point.
    */

    if (!streamAnchorRef.current) {

      const extent = cy.extent();

      streamAnchorRef.current = {
        x:
          (extent.x1 + extent.x2) / 2,
        y:
          (extent.y1 + extent.y2) / 2,
      };

    }

    const anchor = streamAnchorRef.current;

    const index = streamNodeIndexRef.current++;

    /*
      First node goes directly into the centre.
    */

    if (index === 0) {
      return {
        ...anchor,
      };

    }

    /*
      Place later nodes in a loose spiral.

      These are ONLY temporary positions while
      generation is underway.
    */

    const goldenAngle = 137.508 * (Math.PI / 180);
    const angle = index * goldenAngle;
    const radius = 90 + Math.sqrt(index) * 65;

    return {
      x:
        anchor.x +
        Math.cos(angle) * radius,
      y:
        anchor.y +
        Math.sin(angle) * radius,
    };
  }

  function focusStreamElements(elements)
  {

    const cy = cyRef.current;

    if (!cy || !elements || elements.empty())
    {
      return;
    }

    /*
      Stop any previous viewport animation so a newly
      streamed element immediately becomes the focus.
    */

    cy.stop();

    /*
      Keep a fairly stable viewing zoom during streaming.

      We don't want every individual node to fill the
      entire Graph View.
    */

    const focusZoom =
      Math.min(
        Math.max(
          cy.zoom(),
          0.95
        ),
        1.15
      );

    cy.animate(

      {
        center: {
          eles: elements,
        },

        zoom:
          focusZoom,
      },

      {
        duration: 350,
        easing: "ease-in-out-cubic",
      }

    );
  }

  function flushPendingStreamEdges()
  {

    const cy = cyRef.current;

    if (!cy || pendingStreamEdgesRef.current.length === 0) {
      return;
    }

    const stillPending = [];

    for (const edgeData of pendingStreamEdgesRef.current) {

      const added = addStreamEdge(edgeData);

      if (!added) {
        stillPending.push(edgeData);
      }

    }

    pendingStreamEdgesRef.current = stillPending;
  }

  function handleGraphStreamEvent(event)
  {

    const cy = cyRef.current;

    if (!cy || !event) {
      return;
    }

    console.log("Graph stream event:", event);

    switch (event.type) {

      // =====================================================
      // STREAM STARTED
      // =====================================================

      case "start": {

        /*
          Generate Graph currently replaces the existing
          generated graph, so preserve that behaviour.

          We clear the graph once when the stream begins,
          NOT every time an element arrives.
        */

        cy.elements().remove();

        pendingStreamEdgesRef.current = [];

        streamAnchorRef.current = null;

        streamNodeIndexRef.current = 0;

        cy.elements().unselect();


        setSelectedNode(null);
        setSelectedEdge(null);
        setSelectionSummary({
          nodes: [],
          edges: [],
        });

        setShapeMenuOpen(false);
        setNodeBorderStyleMenuOpen(false);
        setEdgeStyleMenuOpen(false);
        setArrowShapeMenuOpen(false);
        setGraphFeedback(null);

        console.log("AI graph stream started.");

        break;
      }

      // =====================================================
      // STREAMED NODE
      // =====================================================

      case "node": {

        const nodeData = event.data;

        if (!nodeData?.id) {
          console.warn("Streamed node has no id:", event);
          break;
        }

        const nodeId =String(nodeData.id);
        const existingNode = cy.getElementById(nodeId);

        let node;

        /*
          Update existing node if the backend repeats
          or enriches it later in the stream.
        */

        if (!existingNode.empty()) {

          existingNode.data({
            ...existingNode.data(),
            ...nodeData,
            id: nodeId,
          });

          node = existingNode;

        } else {

          node =
            cy.add({
              group: "nodes",

              data: {
                ...nodeData,

                id:
                  nodeId,

                label:
                  nodeData.label ||
                  nodeId,
              },

              /*
                Give the new node a temporary stable position.

                Existing streamed nodes are NOT rearranged.
              */

              position:
                getStreamNodePosition(),
            });

        }

        /*
          Apply TreeNotes' existing automatic node sizing.
        */

        resizeNodeToLabel(node);

        /*
          A newly arrived node might unlock an edge that
          had to wait for this endpoint.
        */
        flushPendingStreamEdges();

        cy.style().update();

        /*
          Smoothly move the viewport to the node
          that has just appeared.
        */
        focusStreamElements(node);

        break;
      }


      // =====================================================
      // STREAMED EDGE
      // =====================================================

      case "edge": {

        const edgeData = event.data;

        if (!edgeData) {
          break;
        }

        const added = addStreamEdge(edgeData);

        /*
          If the required nodes have not arrived yet,
          hold this edge temporarily.
        */

        if (!added) {

          const pendingId = edgeData.id;

          const alreadyWaiting =
            pendingStreamEdgesRef.current
              .some(
                (edge) =>
                  pendingId &&
                  edge.id === pendingId
              );

          if (!alreadyWaiting) {
            pendingStreamEdgesRef.current.push(edgeData);
          }

        } else {
          const sourceNode =
            cy.getElementById(
              String(
                edgeData.source
              )
            );

          const targetNode =
            cy.getElementById(
              String(
                edgeData.target
              )
            );

          if (
            !sourceNode.empty() &&
            !targetNode.empty()
          ) {

            /*
              A Cytoscape collection containing both
              endpoints lets the camera centre between them.
            */

            const connectedNodes =
              sourceNode.union(
                targetNode
              );

            focusStreamElements(
              connectedNodes
            );

          }
        }

        break;
      }

      // =====================================================
      // OPTIONAL STATUS MESSAGE
      // =====================================================

      case "status": {

        console.log(
          "AI graph status:",
          event.message
        );

        /*
          We can later display this beside the
          Generate Graph button.
        */

        break;
      }

      // =====================================================
      // STREAM COMPLETE
      // =====================================================

      case "done": {

        flushPendingStreamEdges();

        if (pendingStreamEdgesRef.current.length > 0) {

          console.warn(
            "Graph stream finished with unresolved edges:",
            pendingStreamEdgesRef.current
          );

        }

        /*
          Final layout now that the complete graph
          has arrived.
        */

        if (!cy.elements().empty()) {

          const finalLayout =
            cy.layout({
              name: "cose",
              animate: true,
              fit: true,
              padding: 50,
              randomize: false,
            });

          finalLayout.one(
            "layoutstop",
            () => {

              cy.resize();

              const elements = cy.elements();

              if (elements.empty()) {
                return;
              }

              cy.fit(elements, 50);

              /*
                Keep the same maximum automatic zoom
                you've already been using.
              */

              if (cy.zoom() > 1.35) {
                cy.zoom(1.35);
                cy.center(elements);
              }

            }
          );
          finalLayout.run();
        }

        showGraphFeedback(
          `Graph generated: ${cy.nodes().length} nodes, ${cy.edges().length} links`,
          "success"
        );

        console.log(
          "AI graph stream complete."
        );

        break;
      }

      // =====================================================
      // STREAM ERROR
      // =====================================================

      case "error": {

        const message =
          event.message ||
          "Unable to generate graph.";

        setError(message);

        console.error(
          "AI graph stream error:",
          message
        );

        break;
      }

      default: {

        console.warn(
          "Unknown graph stream event:",
          event
        );

      }

    }
  }

  async function testGraphStreaming() {

    const wait =
      (milliseconds) =>
        new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              milliseconds
            )
        );


    handleGraphStreamEvent({
      type: "start",
    });


    await wait(400);


    handleGraphStreamEvent({
      type: "node",

      data: {
        id: "stream-programming",
        label: "Programming",
      },
    });


    await wait(400);


    /*
      Deliberately send this edge BEFORE Java exists.

      This tests our pending-edge system.
    */

    handleGraphStreamEvent({
      type: "edge",

      data: {
        id: "stream-programming-java",

        source:
          "stream-programming",

        target:
          "stream-java",

        relationship:
          "includes",
      },
    });


    await wait(400);


    handleGraphStreamEvent({
      type: "node",

      data: {
        id: "stream-java",
        label: "Java",
      },
    });


    await wait(400);


    handleGraphStreamEvent({
      type: "node",

      data: {
        id: "stream-csharp",
        label: "C#",
      },
    });


    await wait(400);


    handleGraphStreamEvent({
      type: "edge",

      data: {
        id: "stream-programming-csharp",

        source:
          "stream-programming",

        target:
          "stream-csharp",

        relationship:
          "includes",
      },
    });


    await wait(400);


    handleGraphStreamEvent({
      type: "done",
    });

  }

  // =========================================================
  // CYTOSCAPE INITIALISATION
  // Create Cytoscape once and keep the instance alive.
  // =========================================================

  useEffect(() => {

    if (
      !graphContainerRef.current ||
      cyRef.current
    ) {
      return;
    }

    const graphTheme =
      getGraphThemeTokens();

    const cy = cytoscape({

      container: graphContainerRef.current,

      elements: [],

      /*
        Start with an empty graph.

        Saved graphs, AI graphs and streamed graph
        elements will be inserted separately.
      */

      selectionType: "additive",

      minZoom: 0.25,
      maxZoom: 1.5,

      /*
        There is nothing to arrange yet.

        A layout will be run after graph elements
        are loaded or streamed.
      */
      layout: {
        name: "preset",
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
            "font-size": "15px",
            "font-weight": "500",
            "font-family": "Inter, system-ui, sans-serif",

            "text-valign": "center",
            "text-halign": "center",

            "text-wrap": "wrap",
            "text-max-width": "75px",

            "text-overflow-wrap": "whitespace",
            "text-justification": "center",
            "line-height": 1.15,

            "border-width": 2,
            "border-color": graphTheme.nodeBorder,

            "overlay-opacity": 0,
          },
        },

        /* =====================================================
          DYNAMIC NODE SIZE
          ===================================================== */

        {
          selector: "node[nodeWidth][nodeHeight]",
          style: {
            width:
              "data(nodeWidth)",
            height:
              "data(nodeHeight)",
            "text-max-width":
              "data(nodeTextMaxWidth)",
            "text-margin-y":
              "data(nodeTextMarginY)",
          },
        },

        /* =====================================================
          SAVED NODE BORDER COLOUR
          ===================================================== */

        {
          selector: "node[borderColor]",
          style: {
            "border-color":
              "data(borderColor)",
          },
        },

        /* =====================================================
          SAVED NODE BORDER STYLE
          ===================================================== */

        {
          selector: "node[borderStyle]",
          style: {
            "border-style":
              "data(borderStyle)",
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
            "underlay-color": graphTheme.selectedBorder,
            "underlay-opacity": 0.28,
            "underlay-padding": 10,
          },
        },

        /* =========================================================
          LINKED RAW NOTES HOVER
          ========================================================= */

        {
          selector: "node.linked-text-hover",
          style: {
            "underlay-color": "data(linkColor)",
            "underlay-opacity": 0.38,
            "underlay-padding": 20,
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
            "background-color":
              "data(color)",
          },
        },

        {
          selector: "node[textColor]",
          style: {
            color:
              "data(textColor)",
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
            "target-arrow-color": graphTheme.edgeArrow,
            "target-arrow-shape": "triangle",

            "curve-style": "bezier",

            opacity: 0.8,

            "arrow-scale": 1.1,

            /*
              Relationship label
            */
            label:
              "data(relationship)",

            color:
              graphTheme.edgeLabel,

            "font-size":
              "12px",

            "font-weight":
              "500",
            
            "text-wrap":
              "none",

            "text-overflow-wrap":
              "whitespace",

            /*
              Lift the label slightly above the edge
              rather than drawing the line through it.
            */
            "text-margin-y":
              -9,

            /*
              Allows clicking/double-clicking the
              label itself to count as interacting
              with the edge.
            */
            "text-events":
              "yes",
          },
        },

        /*
          =========================================================
          CUSTOM EDGE COLOUR
          =========================================================
        */

        {
          selector:
            "edge[edgeColor]",

          style: {
            "line-color":
              "data(edgeColor)",
          },
        },

        /*
          =========================================================
          CUSTOM ARROW COLOUR
          =========================================================
        */

        {
          selector:
            "edge[arrowColor]",

          style: {
            "target-arrow-color":
              "data(arrowColor)",
          },
        },

        /*
          =========================================================
          CUSTOM ARROW SHAPE
          =========================================================
        */

        {
          selector:
            "edge[arrowShape]",

          style: {
            "target-arrow-shape":
              "data(arrowShape)",
          },
        },

        /*
          =========================================================
          CUSTOM EDGE STYLE
          =========================================================
        */

        {
          selector:
            "edge[lineStyle]",

          style: {
            "line-style":
              "data(lineStyle)",
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
            "underlay-color": graphTheme.selectedEdge,
            "underlay-opacity": 0.32,
            "underlay-padding": 6,
          },
        },
      ],
    });
    cyRef.current = cy;

    /*
      Size every node after the graph has been
      created or loaded.
    */
    cy.nodes().forEach(
      node => {
        resizeNodeToLabel(
          node
        );
      }
    );

    cy.style().update();

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

          applyGraphTheme(cy);

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

  // =========================================================
  // DOUBLE CLICK NODE = RENAME NODE
  // =========================================================

  cy.on(
    "dbltap",
    "node",
    (event) => {

      const node =
        event.target;


      const position =
        node.renderedPosition();

      const zoom = cy.zoom();

      cy.elements().unselect();

      node.select();


      setSelectedNode({
        ...node.data(),

        color:
          node.data("color") ||
          getThemeColour(
            "--graph-node-bg",
            "#6366F1"
          ),

        textColor:
          node.data("textColor") ||
          getThemeColour(
            "--graph-node-text",
            "#ffffff"
          ),

        shape:
          node.data("shape") ||
          "round-rectangle",
      });


      setSelectedEdge(null);


      const currentLabel =
        node.data("label") ||
        "";


      renameOriginalValueRef.current =
        currentLabel;


      setRenameValue(
        currentLabel
      );

      const textMarginY =
        Number(
          node.data(
            "nodeTextMarginY"
          )
        ) || 0;

      setRenamePosition({
        x:
          position.x,

        /*
          renderedPosition() is already in screen
          coordinates, while nodeTextMarginY is in
          graph coordinates, so scale it by zoom.
        */
        y:
          position.y +
          textMarginY * zoom,
      });

      setRenameZoom(
        zoom
      );

      /*
        Hide Cytoscape's painted text while
        the HTML text field sits over it.
      */
      node.style(
        "text-opacity",
        0
      );

      editingNodeIdRef.current = node.id();

      setEditingNodeId(
        node.id()
      );

    }
  );

  // =========================================================
  // DOUBLE CLICK EDGE = EDIT RELATIONSHIP
  // =========================================================

  cy.on(
    "dbltap",
    "edge",
    (event) => {

      /*
        Don't start relationship editing while
        the user is actively creating a link.
      */
      if (linkModeRef.current) {
        return;
      }

      const edge = event.target;

      const sourceNode = edge.source();

      const targetNode = edge.target();

      const midpoint = edge.renderedMidpoint();

      const currentRelationship =
        edge.data("relationship") ||
        "";
      
      /*
        Keep normal graph selection synchronised.
      */
      cy.elements().unselect();

      edge.select();

      setSelectedEdge({
        ...edge.data(),

        sourceLabel:
          sourceNode.data("label") ||
          sourceNode.id(),

        targetLabel:
          targetNode.data("label") ||
          targetNode.id(),
      });

      setSelectedNode(null);
      setShapeMenuOpen(false);
      setNodeBorderStyleMenuOpen(false);
      setEdgeStyleMenuOpen(false);
      setArrowShapeMenuOpen(false);
      setGraphColorPicker(null);

      /*
        Store existing value so Escape can
        effectively leave it unchanged.
      */
      relationshipOriginalValueRef.current = currentRelationship;

      setRelationshipValue(currentRelationship);

      setRelationshipPosition({
        x:
          midpoint.x,

        y:
          midpoint.y,
      });

      setRelationshipZoom(cy.zoom());

      /*
        Hide Cytoscape's normal painted label
        while our editable field is on top.
      */
      edge.style(
        "text-opacity",
        0
      );

      editingEdgeIdRef.current = edge.id();

      setEditingEdgeId(edge.id());

    }
  );

    // =========================================================
    // NODE SELECTION
    // =========================================================

    cy.on("tap", "node", (event) => {

      const clickedNode = event.target;

      const shiftPressed =
        Boolean(
          event.originalEvent?.shiftKey
        );

      /*
        SHIFT + click toggles this node while preserving
        the rest of the current selection.

        Normal click returns to single-selection behaviour.
      */

      if (
        shiftPressed &&
        !linkModeRef.current
      ) {

        /*
          selectionType: "additive" has already toggled
          the Cytoscape selection for us.

          Wait until Cytoscape has fully settled the
          selection, then synchronise React state.
        */

        requestAnimationFrame(
          () => {

            syncGraphSelectionState(clickedNode);

            console.log(
              "Graph multi-selection:",
              cy.$(":selected").length,
              "elements"
            );

          }
        );

        setShapeMenuOpen(false);

        setNodeBorderStyleMenuOpen(false);

        setEdgeStyleMenuOpen(false);

        setArrowShapeMenuOpen(false);

        setGraphColorPicker(null);

        return;
      }

      /*
        Cytoscape now uses additive selection.

        Wait until its own click handling has completed,
        then deliberately normalise a plain click back to
        exactly one selected element.
      */

      requestAnimationFrame(
        () => {

          /*
            The element might theoretically have disappeared
            before this frame, so guard against that.
          */

          if (!cyRef.current || clickedNode.removed()) {
            return;
          }

          cy.elements().unselect();

          clickedNode.select();

          /*
            React state + selectionSummary are now built
            from Cytoscape's final selection state.
          */

          syncGraphSelectionState(clickedNode);

        }
      );

      setShapeMenuOpen(false);

      setNodeBorderStyleMenuOpen(false);

      setEdgeStyleMenuOpen(false);

      setArrowShapeMenuOpen(false);

      setGraphColorPicker(null);

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


      sourceNode.removeClass(
        "link-source"
      );


      linkModeRef.current =
        false;

      firstNodeToLinkRef.current =
        null;


      setLinkMode(false);

      setFirstNodeToLink(null);


      showGraphFeedback(
        `Link created: ${sourceLabel} → ${targetLabel}`,
        "success"
      );

    });


    // =========================================================
    // EDGE SELECTION
    // =========================================================

    cy.on("tap", "edge", (event) => {

      const clickedEdge = event.target;

      const shiftPressed =
      Boolean(
        event.originalEvent?.shiftKey
      );

      /*
        SHIFT + click toggles this edge without
        disturbing nodes or other selected edges.
      */

      if (shiftPressed) {

        requestAnimationFrame(
          () => {

            syncGraphSelectionState(clickedEdge);

            console.log(
              "Graph multi-selection:",
              cy.$(":selected").length,
              "elements"
            );

          }
        );

        setShapeMenuOpen(false);

        setNodeBorderStyleMenuOpen(false);

        setEdgeStyleMenuOpen(false);

        setArrowShapeMenuOpen(false);

        setGraphColorPicker(null);

        return;
      }

      requestAnimationFrame(
        () => {

          if (!cyRef.current || clickedEdge.removed()) {
            return;
          }

          cy.elements().unselect();

          clickedEdge.select();

          syncGraphSelectionState(clickedEdge);

        }
      );

      setShapeMenuOpen(false);

      setNodeBorderStyleMenuOpen(false);

      setEdgeStyleMenuOpen(false);

      setArrowShapeMenuOpen(false);

      setGraphColorPicker(null);

      console.log(
        "Selected edge:",
        clickedEdge.data()
      );

    });


    // =========================================================
    // BACKGROUND CLICK = DESELECT EVERYTHING
    // =========================================================

    cy.on("tap", (event) => {

      /*
        Cytoscape core itself is the event target
        when the empty graph background is clicked.

        Node and edge taps also bubble through here,
        so only clear selection when target === cy.
      */

      if (event.target !== cy) {
        return;
      }


      cy.elements().unselect();


      setSelectedNode(null);

      setSelectedEdge(null);

      setSelectionSummary({
        nodes: [],
        edges: [],
      });

      setShapeMenuOpen(false);

      setNodeBorderStyleMenuOpen(false);

      setEdgeStyleMenuOpen(false);

      setArrowShapeMenuOpen(false);

      setGraphColorPicker(null);

      console.log(
        "Graph selection cleared"
      );

    });

/* =========================================================
   KEEP INLINE NODE RENAME SYNCED WITH GRAPH
   ========================================================= */

function syncRenameOverlay() {

  const nodeId =
    editingNodeIdRef.current;

  if (!nodeId) {
    return;
  }

  const node =
    cy.getElementById(
      nodeId
    );

  if (
    !node ||
    node.empty()
  ) {
    return;
  }

  const position =
    node.renderedPosition();

  const zoom =
    cy.zoom();


  const textMarginY =
    Number(
      node.data(
        "nodeTextMarginY"
      )
    ) || 0;

  setRenamePosition({
    x: position.x,
    y:
      position.y +
      textMarginY * zoom,
  });

  setRenameZoom(
    cy.zoom()
  );
}

/* =========================================================
   KEEP EDGE RELATIONSHIP EDITOR SYNCED WITH GRAPH
   ========================================================= */

function syncRelationshipOverlay() {

  const edgeId =
    editingEdgeIdRef.current;


  if (!edgeId) {
    return;
  }


  const edge =
    cy.getElementById(
      edgeId
    );


  if (
    !edge ||
    edge.empty()
  ) {
    return;
  }


  const midpoint =
    edge.renderedMidpoint();


  setRelationshipPosition({
    x:
      midpoint.x,

    y:
      midpoint.y,
  });


  setRelationshipZoom(
    cy.zoom()
  );

}

/*
  Keep the HTML rename field aligned with the
  Cytoscape node while zooming or panning.
*/
cy.on(
  "zoom pan",
  syncRenameOverlay
);

cy.on(
  "zoom pan",
  syncRelationshipOverlay
);

cy.on(
  "drag position",
  "node",
  () => {
    syncRelationshipOverlay();
  }
);

/*
  Keep it aligned if the node itself is dragged
  while it is being renamed.
*/
cy.on(
  "drag",
  "node",
  (event) => {

    if (
      event.target.id() ===
      editingNodeIdRef.current
    ) {
      syncRenameOverlay();
    }

  }
);

return () => {
  themeObserver.disconnect();

  cy.destroy();
  cyRef.current = null;
};

}, []);

// =========================================================
// LOAD GRAPH DATA INTO EXISTING CYTOSCAPE INSTANCE
// =========================================================

useEffect(() => {

  const cy = cyRef.current;


  if (!cy) {
    return;
  }


  const nodes =
    Array.isArray(graphData?.nodes)
      ? graphData.nodes
      : [];


  const edges =
    Array.isArray(graphData?.edges)
      ? graphData.edges
      : [];


  /*
    Determine whether this graph came from the database
    with saved node positions.
  */

  const hasSavedPositions =
    nodes.length > 0 &&
    nodes.every(
      (node) =>
        Number.isFinite(
          node?.position?.x
        ) &&
        Number.isFinite(
          node?.position?.y
        )
    );


  /*
    Replace the currently displayed graph without
    destroying Cytoscape itself.
  */

  cy.batch(() => {

    cy.elements().remove();


    if (
      nodes.length > 0 ||
      edges.length > 0
    ) {

      cy.add([
        ...nodes,
        ...edges,
      ]);

    }

  });


  /*
    Apply TreeNotes node auto-sizing to newly
    inserted nodes.
  */

  cy.nodes().forEach(
    (node) => {

      resizeNodeToLabel(
        node
      );

    }
  );


  applyGraphTheme(cy);

  cy.style().update();


  /*
    Nothing else needs doing for an empty graph.
  */

  if (cy.elements().empty()) {
    return;
  }


  /*
    Saved graphs retain their positions.

    Fresh AI graphs get automatically arranged.
  */

  const layout =
    cy.layout(
      hasSavedPositions
        ? {
            name: "preset",
            fit: true,
            padding: 50,
          }
        : {
            name: "cose",
            animate: true,
            fit: true,
            padding: 50,
          }
    );


  layout.one(
    "layoutstop",
    () => {

      cy.resize();


      const elements =
        cy.elements();


      if (elements.empty()) {
        return;
      }


      cy.fit(
        elements,
        50
      );


      /*
        Preserve your existing protection against
        tiny graphs being zoomed ridiculously large.
      */

      if (cy.zoom() > 1.35) {

        cy.zoom(
          1.35
        );

        cy.center(
          elements
        );

      }

    }
  );


  layout.run();


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

  const newNodeId =
    typeof crypto.randomUUID === "function"
      ? `manual-${crypto.randomUUID()}`
      : `manual-${Date.now()}-${Math.random()}`;

  const extent = cy.extent();

  const centreX = (extent.x1 + extent.x2) / 2;
  const centreY = (extent.y1 + extent.y2) / 2;

  const newNode =
    cy.add({
      group: "nodes",

      data: {
        id:
          newNodeId,

        label:
          selectedText,
      },

      position: {
        x:
          centreX + 60,

        y:
          centreY + 60,
      },
    });

  resizeNodeToLabel(
    newNode
  );
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
/*
  Graph persistence is handled by NoteWorkspace.saveEverything().
  That keeps title, Raw Notes, rich HTML, summary and graph_json
  inside one atomic PATCH request.
*/

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


  const newNode =
    cy.add({
      group: "nodes",

      data: {
        id:
          newNodeId,

        label:
          selectedText,
      },

      position: {
        x:
          centreX + 60,

        y:
          centreY + 60,
      },
    });

  resizeNodeToLabel(
    newNode
  );

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

  setSelectedEdge(null);

  setShapeMenuOpen(false);

  setNodeBorderStyleMenuOpen(false);

  setEdgeStyleMenuOpen(false);

  setArrowShapeMenuOpen(false);

  setGraphColorPicker(null);

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

    /*
      Use a class instead of direct style overrides.

      This allows normal selected styling to return
      automatically after hover ends.
    */
    node.addClass("linked-text-hover");
  } else {

    node.removeClass("linked-text-hover");
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
    If the node is currently being hovered,
    Cytoscape automatically refreshes the
    linked-text-hover halo from data(linkColor).
  */
  node.updateStyle();
}

function getSelectedCyNodes() {

  if (!cyRef.current) {
    return null;
  }


  const nodes =
    cyRef.current.nodes(
      ":selected"
    );


  return (
    nodes.length > 0
      ? nodes
      : null
  );
}


function getSelectedCyEdges() {

  if (!cyRef.current) {
    return null;
  }


  const edges =
    cyRef.current.edges(
      ":selected"
    );


  return (
    edges.length > 0
      ? edges
      : null
  );
}

function buildSelectedNodeData(node) {

  if (!node || node.empty()) {
    return null;
  }


  return {

    ...node.data(),

    color:
      node.data("color") ||
      getThemeColour(
        "--graph-node-bg",
        "#6366F1"
      ),

    textColor:
      node.data("textColor") ||
      getThemeColour(
        "--graph-node-text",
        "#ffffff"
      ),

    shape:
      node.data("shape") ||
      "round-rectangle",

  };
}

function buildSelectedEdgeData(edge) {

  if (!edge || edge.empty()) {
    return null;
  }

  const sourceNode = edge.source();
  const targetNode = edge.target();

  return {
    ...edge.data(),

    sourceLabel: sourceNode.data("label") || sourceNode.id(),
    targetLabel: targetNode.data("label") || targetNode.id(),
  };
}

function syncGraphSelectionState(preferredElement = null) {

  const cy = cyRef.current;

  if (!cy) {
    return;
  }

  const selectedNodes = cy.nodes(":selected");
  const selectedEdges = cy.edges(":selected");

  /*
    Keep a React-friendly summary of the entire
    Cytoscape selection.

    selectedNode / selectedEdge remain representative
    items for toolbar controls.
  */

  setSelectionSummary({

    nodes:
      selectedNodes.map(
        node => ({
          id:
            node.id(),

          label:
            node.data("label") ||
            node.id(),
        })
      ),

    edges:
      selectedEdges.map(
        edge => ({
          id:
            edge.id(),

          sourceLabel:
            edge.source().data("label") ||
            edge.source().id(),

          targetLabel:
            edge.target().data("label") ||
            edge.target().id(),

          relationship:
            edge.data("relationship") ||
            "",
        })
      ),

  });

  /*
    For toolbar indicators, use the element most
    recently clicked when possible.

    Otherwise use the final selected element.
  */

  let representativeNode = null;

  if (
    preferredElement?.isNode?.() &&
    preferredElement.selected()
  ) {

    representativeNode =
      preferredElement;

  } else if (
    selectedNodes.length > 0
  ) {

    representativeNode =
      selectedNodes[
        selectedNodes.length - 1
      ];

  }

  let representativeEdge = null;

  if (
    preferredElement?.isEdge?.() &&
    preferredElement.selected()
  ) {

    representativeEdge =
      preferredElement;

  } else if (
    selectedEdges.length > 0
  ) {

    representativeEdge =
      selectedEdges[
        selectedEdges.length - 1
      ];

  }

  setSelectedNode(
    representativeNode
      ? buildSelectedNodeData(
          representativeNode
        )
      : null
  );

  setSelectedEdge(
    representativeEdge
      ? buildSelectedEdgeData(
          representativeEdge
        )
      : null
  );

}

function changeSelectedNodeColor(newColor) {

  const nodes = getSelectedCyNodes();

  if (!nodes) {
    return;
  }

  nodes.forEach(
    node => {

      node.data(
        "color",
        newColor
      );

      node.updateStyle();
    }
  );

  /*
    Keep the toolbar representative in sync.
  */

  setSelectedNode(
    current =>
      current
        ? {
            ...current,
            color:
              newColor,
          }
        : current
  );

}

function changeSelectedNodeShape(newShape) {

  const nodes = getSelectedCyNodes();

  if (!nodes) {
    return;
  }

  nodes.forEach(
    node => {

      node.data(
        "shape",
        newShape
      );

      node.updateStyle();

      /*
        Different shapes require different dimensions.
      */

      resizeNodeToLabel(node);

    }
  );

  setSelectedNode(
    current =>
      current
        ? {
            ...current,
            shape:
              newShape,
          }
        : current
  );


  setShapeMenuOpen(false);

  setNodeBorderStyleMenuOpen(false);

  setEdgeStyleMenuOpen(false);

  setArrowShapeMenuOpen(false);

  setGraphColorPicker(null);

}

function changeSelectedNodeBorderColor(newColor) {

  const nodes = getSelectedCyNodes();

  if (!nodes) {
    return;
  }

  nodes.forEach(
    node => {

      node.data(
        "borderColor",
        newColor
      );

      node.updateStyle();

    }
  );

  setSelectedNode(
    current =>
      current
        ? {
            ...current,
            borderColor:
              newColor,
          }
        : current
  );

}

function changeSelectedNodeBorderStyle(
  newStyle
) {

  const nodes =
    getSelectedCyNodes();


  if (!nodes) {
    return;
  }


  nodes.forEach(
    node => {

      node.data(
        "borderStyle",
        newStyle
      );

      node.updateStyle();

    }
  );


  setSelectedNode(
    current =>
      current
        ? {
            ...current,
            borderStyle:
              newStyle,
          }
        : current
  );

  setNodeBorderStyleMenuOpen(false);

}

function changeSelectedEdgeColor(colour) {

  const edges = getSelectedCyEdges();

  if (!edges) {
    return;
  }

  edges.forEach(
    edge => {

      edge.data(
        "edgeColor",
        colour
      );

      edge.updateStyle();

    }
  );

  setSelectedEdge(
    current =>
      current
        ? {
            ...current,
            edgeColor:
              colour,
          }
        : current
  );

}

function changeSelectedEdgeStyle(lineStyle) {

  const edges = getSelectedCyEdges();

  if (!edges) {
    return;
  }

  edges.forEach(
    edge => {

      edge.data(
        "lineStyle",
        lineStyle
      );

      edge.updateStyle();

    }
  );

  setSelectedEdge(
    current =>
      current
        ? {
            ...current,
            lineStyle,
          }
        : current
  );

  setEdgeStyleMenuOpen(false);

}

function changeSelectedArrowColor(colour) {

  const edges = getSelectedCyEdges();


  if (!edges) {
    return;
  }

  edges.forEach(
    edge => {

      edge.data(
        "arrowColor",
        colour
      );

      edge.updateStyle();

    }
  );

  /*
    Keep the toolbar indicator synced with
    the most recently selected / representative edge.
  */

  setSelectedEdge(
    current =>
      current
        ? {
            ...current,
            arrowColor:
              colour,
          }
        : current
  );

}

function changeSelectedArrowShape(shape) {

  const edges = getSelectedCyEdges();

  if (!edges) {
    return;
  }

  edges.forEach(
    edge => {

      edge.data(
        "arrowShape",
        shape
      );

      edge.updateStyle();

    }
  );

  setSelectedEdge(
    current =>
      current
        ? {
            ...current,
            arrowShape:
              shape,
          }
        : current
  );

  setArrowShapeMenuOpen(
    false
  );

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

  const cy = cyRef.current;

  if (!cy) {
    return;
  }

  const selected = cy.$(":selected");

  if (selected.empty()) {
    return;
  }

  const nodeCount = selected.nodes().length;

  const edgeCount = selected.edges().length;

  /*
    Removing selected nodes also removes their connected
    Cytoscape edges automatically.
  */

  selected.remove();

  setSelectedNode(null);

  setSelectedEdge(null);

  setSelectionSummary({
    nodes: [],
    edges: [],
  });

  if (
    nodeCount > 0 &&
    edgeCount > 0
  ) {

    showGraphFeedback(
      `Deleted ${nodeCount} node${
        nodeCount === 1 ? "" : "s"
      } and ${edgeCount} selected link${
        edgeCount === 1 ? "" : "s"
      }`,
      "success"
    );

  } else if (
    nodeCount > 0
  ) {

    showGraphFeedback(
      `Deleted ${nodeCount} node${
        nodeCount === 1 ? "" : "s"
      }`,
      "success"
    );

  } else {

    showGraphFeedback(
      `Deleted ${edgeCount} link${
        edgeCount === 1 ? "" : "s"
      }`,
      "success"
    );

  }

}

function createManualNode() {
  const cy = cyRef.current;

  if (!cy) return;

  const nodeId = `manual-node-${Date.now()}`;

  const extent = cy.extent();

  const newNode = cy.add({
    group: "nodes",
    data: {
      id: nodeId,
      label: "New Node",
      color: 
        getThemeColour(
          "--graph-node-bg",
          "#6366F1"
        ),
      textColor:
      getThemeColour(
        "--graph-node-text",
        "#ffffff"
      ),
      shape: "round-rectangle",
    },
    position: {
      x: (extent.x1 + extent.x2) / 2,
      y: (extent.y1 + extent.y2) / 2,
    },
  });

  resizeNodeToLabel(
    newNode
  );

  cy.elements().unselect();
  newNode.select();

  setSelectedEdge(null);

  setSelectedNode({
    ...newNode.data(),
  });

  showGraphFeedback(
    "New node created",
    "success"
  );
}

function finishNodeRename({
  cancel = false,
} = {}) {

  if (
    !cyRef.current ||
    !editingNodeId
  ) {
    return;
  }


  const node =
    cyRef.current.getElementById(
      editingNodeId
    );

  if (!node || node.empty()) {

    editingNodeIdRef.current = null;

    setEditingNodeId(null);

    return;
  }

  if (!cancel) {

    const cleanLabel = renameValue.trim();

    if (cleanLabel) {
      node.data(
        "label",
        cleanLabel
      );

      /*
        Label changed, so recompute the node body.
      */
      resizeNodeToLabel(node);

      setSelectedNode(
        (current) => {

          if (
            !current ||
            current.id !==
              editingNodeId
          ) {
            return current;
          }

          return {
            ...current,
            label:
              cleanLabel,
          };

        }
      );

      showGraphFeedback(
        `Renamed node to: ${cleanLabel}`,
        "success"
      );

    }

  }

  /*
    Restore Cytoscape's own label.
  */
  node.style(
    "text-opacity", 1
  );

  setEditingNodeId(null);

}

function finishEdgeRelationship({
  cancel = false,
} = {}) {

  if (!cyRef.current) {
    return;
  }

  const edgeId = editingEdgeIdRef.current;

  if (!edgeId) {
    return;
  }

  const edge =
    cyRef.current.getElementById(
      edgeId
    );

  if (!edge || edge.empty()) {
    editingEdgeIdRef.current = null;

    setEditingEdgeId(null);

    return;
  }

  /*
    ESCAPE:
    Nothing has been written into Cytoscape yet,
    so simply restore the old painted label.
  */
  if (cancel) {

    setRelationshipValue(relationshipOriginalValueRef.current);

    edge.style(
      "text-opacity",
      1
    );

    editingEdgeIdRef.current = null;

    setEditingEdgeId(null);

    return;
  }

  const cleanRelationship = relationshipValue.trim();

  const oldRelationship =
    relationshipOriginalValueRef.current
      .trim();

  /*
    Empty value means remove the relationship.
  */
  if (cleanRelationship) {

    edge.data(
      "relationship",
      cleanRelationship
    );

  } else {

    edge.data(
      "relationship",
      ""
    );

    cyRef.current
      .style()
      .update();

  }

  /*
    Keep React's Selected Edge card in sync.
  */
  setSelectedEdge(
    current => {

      if (!current || current.id !== edgeId
      ) {
        return current;
      }

      return {
        ...current,

        relationship: cleanRelationship,
      };

    }
  );

  edge.style(
    "text-opacity",
    1
  );

  relationshipOriginalValueRef.current = cleanRelationship;

  editingEdgeIdRef.current = null;

  setEditingEdgeId(null);

  /*
    Avoid firing feedback if nothing actually changed.
  */
  if (cleanRelationship !== oldRelationship) {

    showGraphFeedback(
      cleanRelationship
        ? `Relationship updated: ${cleanRelationship}`
        : "Relationship removed",
      "success"
    );

  }

}

function changeSelectedNodeTextColor(newColor) {

  const nodes = getSelectedCyNodes();


  if (!nodes) {
    return;
  }

  nodes.forEach(
    node => {

      node.data(
        "textColor",
        newColor
      );

      node.updateStyle();

    }
  );

  setSelectedNode(
    current =>
      current
        ? {
            ...current,
            textColor:
              newColor,
          }
        : current
  );

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
        getEditedGraphData() ??
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

/* =========================================================
   KEYBOARD DELETE
   Delete the currently selected graph node / edge.
   ========================================================= */

useEffect(() => {

  function handleGraphDeleteKey(
    event
  ) {

    /*
      Only respond while the Graph Editor is active.
      This prevents Delete from affecting the graph
      while the user is working in Raw Notes, Summary,
      or somewhere else on the page.
    */

    if (!graphEditorActive) {
      return;
    }

    /*
      For now we use the physical Delete key only.

      Backspace is deliberately excluded because it is
      commonly used while editing text.
    */

    if (event.key !== "Delete") {
      return;
    }

    /*
      Never delete a graph element while the user is
      typing into an input, textarea, select, or
      contentEditable element.
    */

    const target = event.target;

    const isTypingTarget =
      target instanceof HTMLElement &&
      (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      );

    if (isTypingTarget) {
      return;
    }

    /*
      Also protect Cytoscape's inline editing modes.

      These checks are useful even if focus handling
      changes later.
    */

    if (editingNodeId || editingEdgeId) {
      return;
    }

    /*
      Nothing selected, nothing to delete.
    */

    if (!selectedNode && !selectedEdge) {
      return;
    }

    /*
      Stop the browser / another handler from
      interpreting this Delete press.
    */

    event.preventDefault();

    /*
      Use the SAME deletion logic as the toolbar
      trash button.
    */

    deleteSelectedElement();

  }

  document.addEventListener("keydown",handleGraphDeleteKey);

  return () => {
    document.removeEventListener("keydown", handleGraphDeleteKey);
  };

}, [
  graphEditorActive,
  selectedNode,
  selectedEdge,
  editingNodeId,
  editingEdgeId,
]);

useEffect(() => {

  function handlePopoverPointerDown(
    event
  ) {

    const clickedInsideShape =
      shapeMenuRef.current?.contains(
        event.target
      );
    
    const clickedInsideNodeBorderStyle =
      nodeBorderStyleMenuRef.current &&
      nodeBorderStyleMenuRef.current.contains(
        event.target
      );


    const clickedInsideEdgeStyle =
      edgeStyleMenuRef.current?.contains(
        event.target
      );


    const clickedInsideArrowShape =
      arrowShapeMenuRef.current?.contains(
        event.target
      );


    /*
      Close each menu when the click occurs
      outside its own wrapper.

      Capture mode means this runs before
      Cytoscape or another control can consume
      the pointer event.
    */

    if (!clickedInsideShape) {
      setShapeMenuOpen(false);
    }

    if (!clickedInsideNodeBorderStyle) {
      setNodeBorderStyleMenuOpen(false);
    }


    if (!clickedInsideEdgeStyle) {
      setEdgeStyleMenuOpen(false);
    }


    if (!clickedInsideArrowShape) {
      setArrowShapeMenuOpen(false);
    }

  }


  function handleEscape(event) {

    if (event.key !== "Escape") {
      return;
    }


    setShapeMenuOpen(false);

    setNodeBorderStyleMenuOpen(false);

    setEdgeStyleMenuOpen(false);

    setArrowShapeMenuOpen(false);


    if (linkModeRef.current) {
      cancelLinkMode();
    }

  }


  document.addEventListener(
    "pointerdown",
    handlePopoverPointerDown,
    true
  );


  document.addEventListener(
    "keydown",
    handleEscape
  );


  return () => {

    document.removeEventListener(
      "pointerdown",
      handlePopoverPointerDown,
      true
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


/* =========================================================
   CURRENT TOOLBAR ICONS
   ========================================================= */

const currentNodeShape =
  selectedNode
    ? NODE_SHAPES.find(
        option =>
          option.value ===
          (
            selectedNode.shape ||
            "round-rectangle"
          )
      )
    : null;

const CurrentNodeShapeIcon =
  selectedNode
    ? (
        currentNodeShape?.Icon ||
        Squircle
      )
    : Shapes;


const currentNodeBorderStyle =
  NODE_BORDER_STYLES.find(
    option =>
      option.value ===
      (
        selectedNode?.borderStyle ||
        "solid"
      )
  ) ||
  NODE_BORDER_STYLES.find(
    option =>
      option.value ===
      "solid"
  );

const CurrentNodeBorderStyleIcon =
  currentNodeBorderStyle?.Icon ||
  Square;


const currentArrowShape =
  ARROW_SHAPES.find(
    option =>
      option.value ===
      (
        selectedEdge?.arrowShape ||
        "triangle"
      )
  ) ||
  ARROW_SHAPES.find(
    option =>
      option.value ===
      "triangle"
  );

const CurrentArrowShapeIcon =
  currentArrowShape?.Icon ||
  Triangle;


/* =========================================================
   RENDER
   ========================================================= */

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
          {/* ================================================= */}
          {/* NODE TOOLS                                        */}
          {/* ================================================= */}

          {/* CREATE NODE */}

          <button
            type="button"
            className="graph-toolbar-button"
            onClick={createManualNode}
            data-tooltip="Create node"
            aria-label="Create node"
          >
            <span className="graph-create-action-icon">

              <Squircle
                size={18}
                strokeWidth={1.8}
              />

              <Plus
                className="graph-create-action-plus"
                size={9}
                strokeWidth={2.5}
              />

            </span>
          </button>

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

              onClick={() => {
                setShapeMenuOpen(
                  current => !current
                );
                setEdgeStyleMenuOpen(
                  false
                );
                setArrowShapeMenuOpen(
                  false
                );
              }}

              data-tooltip={
                selectedNode
                  ? "Node shape"
                  : "Select a node first"
              }

              aria-label="Node shape"
              aria-haspopup="true"
              aria-expanded={shapeMenuOpen}
            >
              <CurrentNodeShapeIcon
                size={19}
                strokeWidth={1.8}
                style={
                  currentNodeShape?.rotation
                    ? {
                        transform:
                          `rotate(${currentNodeShape.rotation}deg)`,
                      }
                    : undefined
                }
              />

              <ChevronDown
                size={12}
                strokeWidth={1.8}
              />
            </button>


            {shapeMenuOpen && (
              <div
                className="
                  graph-shape-popover
                  graph-icon-grid-popover
                "
              >

                {NODE_SHAPES.map(
                  ({
                    value,
                    label,
                    Icon,
                    rotation,
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
                        style={
                          rotation
                            ? {
                                transform:
                                  `rotate(${rotation}deg)`,
                              }
                            : undefined
                        }
                      />
                    </button>

                  )
                )}

              </div>
            )}

          </div>

          {/* NODE FILL COLOUR */}

          <div className="graph-toolbar-popover-wrapper">

            <button
              ref={nodeColorButtonRef}
              type="button"

              className={`graph-toolbar-button tooltip-align-left ${
                graphColorPicker === "node-fill"
                  ? "graph-toolbar-button-active"
                  : ""
              }`}

              disabled={!selectedNode}

              onClick={() =>
                toggleGraphColorPicker(
                  "node-fill"
                )
              }

              data-tooltip={
                selectedNode
                  ? "Node colour"
                  : "Select a node first"
              }

              aria-label="Node colour"
              aria-haspopup="dialog"
              aria-expanded={
                graphColorPicker === "node-fill"
              }
            >
              <span className="graph-toolbar-color-icon">

                <PaintBucket
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

            <TreeNotesColorPicker
              open={
                graphColorPicker === "node-fill"
              }

              anchorRef={
                nodeColorButtonRef
              }

              value={
                selectedNode?.color ||
                getThemeColour(
                  "--graph-node-bg",
                  "#6366F1"
                )
              }

              onChange={
                changeSelectedNodeColor
              }

              onClose={() =>
                setGraphColorPicker(null)
              }
            />

          </div>

          {/* NODE TEXT COLOUR */}

          <div className="graph-toolbar-popover-wrapper">

            <button
              ref={nodeTextColorButtonRef}
              type="button"

              className={`graph-toolbar-button ${
                graphColorPicker === "node-text"
                  ? "graph-toolbar-button-active"
                  : ""
              }`}

              disabled={!selectedNode}

              onClick={() =>
                toggleGraphColorPicker(
                  "node-text"
                )
              }

              data-tooltip={
                selectedNode
                  ? "Text colour"
                  : "Select a node first"
              }

              aria-label="Text colour"
              aria-haspopup="dialog"
              aria-expanded={
                graphColorPicker === "node-text"
              }
            >
              <span className="graph-toolbar-color-icon">

                <Type
                  size={19}
                  strokeWidth={1.8}
                />

                <span
                  className="graph-toolbar-color-indicator"
                  style={{
                    backgroundColor:
                      selectedNode?.textColor ||
                      getThemeColour(
                        "--graph-node-text",
                        "#ffffff"
                      ),
                  }}
                />

              </span>
            </button>

            <TreeNotesColorPicker
              open={
                graphColorPicker === "node-text"
              }

              anchorRef={
                nodeTextColorButtonRef
              }

              value={
                selectedNode?.textColor ||
                getThemeColour(
                  "--graph-node-text",
                  "#ffffff"
                )
              }

              onChange={
                changeSelectedNodeTextColor
              }

              onClose={() =>
                setGraphColorPicker(null)
              }
            />

          </div>

          {/* NODE BORDER STYLE */}

          <div
            className="graph-toolbar-popover-wrapper"
            ref={nodeBorderStyleMenuRef}
          >
            <button
              type="button"

              className={`graph-toolbar-button ${
                nodeBorderStyleMenuOpen
                  ? "graph-toolbar-button-active"
                  : ""
              }`}

              disabled={!selectedNode}

              onClick={() => {
                setNodeBorderStyleMenuOpen(
                  current => !current
                );

                setShapeMenuOpen(false);
                setEdgeStyleMenuOpen(false);
                setArrowShapeMenuOpen(false);
              }}

              data-tooltip={
                selectedNode
                  ? "Node border style"
                  : "Select a node first"
              }

              aria-label="Node border style"
              aria-haspopup="true"
              aria-expanded={
                nodeBorderStyleMenuOpen
              }
            >
              <CurrentNodeBorderStyleIcon
                size={19}
                strokeWidth={1.8}
              />

              <ChevronDown
                size={11}
                strokeWidth={1.8}
              />
            </button>


            {nodeBorderStyleMenuOpen && (
              <div className="graph-shape-popover">

                {NODE_BORDER_STYLES.map(
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
                          selectedNode
                            ?.borderStyle ||
                          "solid"
                        ) === value
                          ? "graph-shape-option-active"
                          : ""
                      }`}

                      onClick={() =>
                        changeSelectedNodeBorderStyle(
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

          {/* NODE BORDER COLOUR */}

          <div className="graph-toolbar-popover-wrapper">

            <button
              ref={nodeBorderColorButtonRef}
              type="button"

              className={`graph-toolbar-button ${
                graphColorPicker === "node-border"
                  ? "graph-toolbar-button-active"
                  : ""
              }`}

              disabled={!selectedNode}

              onClick={() =>
                toggleGraphColorPicker(
                  "node-border"
                )
              }

              data-tooltip={
                selectedNode
                  ? "Node border colour"
                  : "Select a node first"
              }

              aria-label="Node border colour"
              aria-haspopup="dialog"
              aria-expanded={
                graphColorPicker === "node-border"
              }
            >
              <span className="graph-toolbar-color-icon">

                <SquareDashed
                  size={19}
                  strokeWidth={1.8}
                />

                <span
                  className="graph-toolbar-color-indicator"
                  style={{
                    backgroundColor:
                      selectedNode?.borderColor ||
                      getThemeColour(
                        "--graph-node-border",
                        "#818CF8"
                      ),
                  }}
                />

              </span>
            </button>

            <TreeNotesColorPicker
              open={
                graphColorPicker === "node-border"
              }

              anchorRef={
                nodeBorderColorButtonRef
              }

              value={
                selectedNode?.borderColor ||
                getThemeColour(
                  "--graph-node-border",
                  "#818CF8"
                )
              }

              onChange={
                changeSelectedNodeBorderColor
              }

              onClose={() =>
                setGraphColorPicker(null)
              }
            />

          </div>

          <span className="graph-toolbar-divider" />

          {/* ================================================= */}
          {/* EDGE / RELATIONSHIP TOOLS                         */}
          {/* ================================================= */}

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
                ? "Cancel linking"
                : "Create link"
            }

            aria-label={
              linkMode
                ? "Cancel linking"
                : "Create link"
            }
            aria-pressed={linkMode}
          >
            <span className="graph-create-action-icon">

              <MoveUpRight
                size={18}
                strokeWidth={1.8}
              />

              <Plus
                className="graph-create-action-plus"
                size={9}
                strokeWidth={2.5}
              />

            </span>
          </button>

          {/* EDGE STYLE */}

          <div
            className="graph-toolbar-popover-wrapper"
            ref={edgeStyleMenuRef}
          >

            <button
              type="button"

              className={`graph-toolbar-button ${
                edgeStyleMenuOpen
                  ? "graph-toolbar-button-active"
                  : ""
              }`}

              disabled={
                !selectedEdge
              }

              onClick={() => {
                setEdgeStyleMenuOpen(
                  current => !current
                );
                setShapeMenuOpen(
                  false
                );
                setArrowShapeMenuOpen(
                  false
                );
              }}

              data-tooltip={
                selectedEdge
                  ? "Edge style"
                  : "Select an edge first"
              }

              aria-label="Edge style"
            >

              <span
                className={`
                  graph-edge-style-preview
                  graph-edge-style-${
                    selectedEdge?.lineStyle ||
                    "solid"
                  }
                `}
              />

              <ChevronDown
                size={11}
                strokeWidth={1.8}
              />

            </button>


            {edgeStyleMenuOpen && (

              <div className="graph-shape-popover">

                {EDGE_STYLES.map(
                  ({ value, label }) => (

                    <button
                      key={value}
                      type="button"

                      className={`graph-shape-option ${
                        (
                          selectedEdge?.lineStyle ||
                          "solid"
                        ) === value
                          ? "graph-shape-option-active"
                          : ""
                      }`}

                      onClick={() =>
                        changeSelectedEdgeStyle(
                          value
                        )
                      }

                      data-tooltip={label}
                      aria-label={label}
                    >

                      <span
                        className={`
                          graph-edge-style-preview
                          graph-edge-style-${value}
                        `}
                      />

                    </button>

                  )
                )}

              </div>

            )}

          </div>

          {/* EDGE COLOUR */}

          <div className="graph-toolbar-popover-wrapper">

            <button
              ref={edgeColorButtonRef}
              type="button"

              className={`graph-toolbar-button ${
                graphColorPicker === "edge"
                  ? "graph-toolbar-button-active"
                  : ""
              }`}

              disabled={!selectedEdge}

              onClick={() =>
                toggleGraphColorPicker(
                  "edge"
                )
              }

              data-tooltip={
                selectedEdge
                  ? "Edge colour"
                  : "Select an edge first"
              }

              aria-label="Edge colour"
              aria-haspopup="dialog"
              aria-expanded={
                graphColorPicker === "edge"
              }
            >
              <span className="graph-toolbar-color-icon">

                <Minus
                  size={20}
                  strokeWidth={2}
                />

                <span
                  className="graph-toolbar-color-indicator"
                  style={{
                    backgroundColor:
                      selectedEdge?.edgeColor ||
                      getThemeColour(
                        "--graph-edge",
                        "#465873"
                      ),
                  }}
                />

              </span>
            </button>

            <TreeNotesColorPicker
              open={
                graphColorPicker === "edge"
              }

              anchorRef={
                edgeColorButtonRef
              }

              value={
                selectedEdge?.edgeColor ||
                getThemeColour(
                  "--graph-edge",
                  "#465873"
                )
              }

              onChange={
                changeSelectedEdgeColor
              }

              onClose={() =>
                setGraphColorPicker(null)
              }
            />

          </div>

          {/* ARROW SHAPE */}

          <div
            className="graph-toolbar-popover-wrapper"
            ref={arrowShapeMenuRef}
          >

            <button
              type="button"

              className={`graph-toolbar-button ${
                arrowShapeMenuOpen
                  ? "graph-toolbar-button-active"
                  : ""
              }`}

              disabled={
                !selectedEdge
              }

              onClick={() => {
                setArrowShapeMenuOpen(
                  current => !current
                );
                setShapeMenuOpen(
                  false
                );
                setEdgeStyleMenuOpen(
                  false
                );
              }}

              data-tooltip={
                selectedEdge
                  ? "Arrow shape"
                  : "Select an edge first"
              }

              aria-label="Arrow shape"
            >

              <CurrentArrowShapeIcon
                size={19}
                strokeWidth={1.8}

                style={
                  currentArrowShape?.rotation
                    ? {
                        transform:
                          `rotate(${currentArrowShape.rotation}deg)`,
                      }
                    : undefined
                }
              />

              <ChevronDown
                size={11}
                strokeWidth={1.8}
              />

            </button>

            {arrowShapeMenuOpen && (

              <div
                className="
                  graph-shape-popover
                  graph-icon-grid-popover
                "
              >

                {ARROW_SHAPES.map(
                  ({
                    value,
                    label,
                    Icon,
                    rotation,
                  }) => (

                    <button
                      key={value}
                      type="button"

                      className={`graph-shape-option ${
                        (
                          selectedEdge?.arrowShape ||
                          "triangle"
                        ) === value
                          ? "graph-shape-option-active"
                          : ""
                      }`}

                      onClick={() =>
                        changeSelectedArrowShape(
                          value
                        )
                      }

                      data-tooltip={label}
                      aria-label={label}
                    >

                      <Icon
                        size={18}
                        strokeWidth={1.8}

                        style={
                          rotation
                            ? {
                                transform:
                                  `rotate(${rotation}deg)`,
                              }
                            : undefined
                        }
                      />

                    </button>

                  )
                )}

              </div>

            )}

          </div>

          {/* ARROW COLOUR */}

          <div className="graph-toolbar-popover-wrapper">

            <button
              ref={arrowColorButtonRef}
              type="button"

              className={`graph-toolbar-button ${
                graphColorPicker === "arrow"
                  ? "graph-toolbar-button-active"
                  : ""
              }`}

              disabled={!selectedEdge}

              onClick={() =>
                toggleGraphColorPicker(
                  "arrow"
                )
              }

              data-tooltip={
                selectedEdge
                  ? "Arrow colour"
                  : "Select an edge first"
              }

              aria-label="Arrow colour"
              aria-haspopup="dialog"
              aria-expanded={
                graphColorPicker === "arrow"
              }
            >
              <span className="graph-toolbar-color-icon">

                <ArrowRight
                  size={19}
                  strokeWidth={1.8}
                />

                <span
                  className="graph-toolbar-color-indicator"
                  style={{
                    backgroundColor:
                      selectedEdge?.arrowColor ||
                      getThemeColour(
                        "--graph-edge-arrow",
                        "#7772ff"
                      ),
                  }}
                />

              </span>
            </button>

            <TreeNotesColorPicker
              open={
                graphColorPicker === "arrow"
              }

              anchorRef={
                arrowColorButtonRef
              }

              value={
                selectedEdge?.arrowColor ||
                getThemeColour(
                  "--graph-edge-arrow",
                  "#7772ff"
                )
              }

              onChange={
                changeSelectedArrowColor
              }

              onClose={() =>
                setGraphColorPicker(null)
              }
            />

          </div>

          <span className="graph-toolbar-divider" />

          {/* ================================================= */}
          {/* GENERAL TOOLS                                     */}
          {/* ================================================= */}

          {/* FIND LINKED TEXT */}

          <button
            type="button"
            className="graph-toolbar-button"
            disabled={!selectedNode}
            onClick={() => {
              if (!selectedNode) {
                return;
              }

              onNavigateLinkedText?.(
                selectedNode.id,
                selectedNode.label
              );
            }}
            data-tooltip={
              selectedNode
                ? "Find linked references"
                : "Select a node first"
            }
            aria-label="Find linked references"
          >
            <Search
              size={19}
              strokeWidth={1.8}
            />
          </button>

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

        </div>

        {/* =============================================== */}
        {/* GRAPH CANVAS                                    */}
        {/* =============================================== */}

        <div
          className={`graph-canvas-shell ${
            loading ? "graph-generating" : ""
          }`}
>

          <div
            ref={graphContainerRef}
            className="graph-container"
          />

          {loading && (
            <div className="graph-generation-overlay">
              <div className="graph-generation-glow" />

              <div className="graph-generation-content">
                <span className="graph-generation-label">
                  Generating graph
                </span>

                <span className="graph-generation-dots">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            </div>
          )}

          {editingNodeId && (
            <input
              className="graph-inline-rename"
              type="text"
              value={renameValue}
              autoFocus
              style={{
                left: `${renamePosition.x}px`,
                top: `${renamePosition.y}px`,
                width: `${
                  (
                    selectedNode?.nodeWidth ||
                    110
                  ) * renameZoom
                }px`,

                height: `${
                  (
                    selectedNode?.nodeHeight ||
                    52
                  ) * renameZoom
                }px`,
                fontSize: `${15 * renameZoom}px`,
                lineHeight: `${52 * renameZoom}px`,
                color:
                  selectedNode?.textColor ||
                  getThemeColour(
                    "--graph-node-text",
                    "#ffffff"
                  ),
              }}
              onChange={(event) =>
                setRenameValue(event.target.value)
              }
              onBlur={() =>
                finishNodeRename()
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();

                  finishNodeRename();
                }

                if (event.key === "Escape") {
                  event.preventDefault();

                  finishNodeRename({
                    cancel: true,
                  });
                }
              }}
            />
          )}

          {editingEdgeId && (
            <input
              className="graph-inline-edge-relationship"

              type="text"

              value={
                relationshipValue
              }

              autoFocus

              spellCheck={false}

              placeholder="Relationship"

              style={{
                left:
                  `${relationshipPosition.x}px`,

                top:
                  `${relationshipPosition.y}px`,

                width:
                  `${
                    Math.max(
                      90,
                      Math.min(
                        220,
                        relationshipValue.length * 7 +
                          36
                      )
                    ) *
                    relationshipZoom
                  }px`,

                height:
                  `${
                    28 *
                    relationshipZoom
                  }px`,

                fontSize:
                  `${
                    12 *
                    relationshipZoom
                  }px`,

                lineHeight:
                  `${
                    26 *
                    relationshipZoom
                  }px`,
              }}

              onChange={
                event =>
                  setRelationshipValue(
                    event.target.value
                  )
              }

              onBlur={() =>
                finishEdgeRelationship()
              }

              onKeyDown={
                event => {

                  if (
                    event.key ===
                    "Enter"
                  ) {

                    event.preventDefault();

                    finishEdgeRelationship();

                  }


                  if (
                    event.key ===
                    "Escape"
                  ) {

                    event.preventDefault();

                    finishEdgeRelationship({
                      cancel: true,
                    });

                  }

                }
              }
            />

          )}

          {/* CURRENT GRAPH SELECTION */}

          {(
            selectionSummary.nodes.length > 0 ||
            selectionSummary.edges.length > 0
          ) && (

            <div 
              className="graph-selected-node-overlay"
              
              /*
                Never let wheel input over this panel reach
                Cytoscape's zoom handling.
              */
              onWheel={(event) => {
                event.stopPropagation();
              }}
              
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
            >

              <span>

                {(
                  selectionSummary.nodes.length +
                  selectionSummary.edges.length
                ) === 1

                  ? (
                      selectionSummary.nodes.length === 1
                        ? "Selected node"
                        : "Selected edge"
                    )

                  : `Selected ${
                      selectionSummary.nodes.length +
                      selectionSummary.edges.length
                    } items`
                }

              </span>

              {/* SELECTED NODES */}

              {selectionSummary.nodes.length > 0 && (

                <div className="graph-selection-group">

                  {selectionSummary.nodes.length > 1 && (

                    <div className="graph-selection-group-title">
                      {selectionSummary.nodes.length} nodes
                    </div>

                  )}

                  {selectionSummary.nodes.map(
                    node => (

                      <strong
                        key={node.id}
                        className="graph-selection-item"
                      >
                        {node.label}
                      </strong>

                    )
                  )}

                </div>

              )}

              {/* SELECTED EDGES */}

              {selectionSummary.edges.length > 0 && (

                <div className="graph-selection-group">

                  {selectionSummary.edges.length > 1 && (

                    <div className="graph-selection-group-title">
                      {selectionSummary.edges.length} edges
                    </div>

                  )}

                  {selectionSummary.edges.map(
                    edge => (

                      <div
                        key={edge.id}
                        className="graph-selection-item"
                      >

                        <strong>
                          {edge.sourceLabel}
                          {" → "}
                          {edge.targetLabel}
                        </strong>

                        {edge.relationship?.trim() && (

                          <span className="graph-selected-edge-relationship">
                            {edge.relationship}
                          </span>

                        )}

                      </div>

                    )
                  )}

                </div>

              )}

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
