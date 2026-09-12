import { 
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState, 
} from "react";
import GraphPanel from "./GraphPanel";
import SummaryPanel from "./SummaryPanel";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link,
  Link2,
  Info,
  CirclePlus,
  Palette,
  Highlighter,
  Unlink,
  Eraser,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  IndentIncrease,
  IndentDecrease,
  ChevronDown,
  ChevronRight,
  Replace,
} from "lucide-react";

import "./NoteWorkspace.css";

const NoteWorkspace = forwardRef(function NoteWorkspace(
  { note },
  ref
) {
// text editor refrence for saving
const editorRef = useRef(null);
// graph panel refrence for saving 
const graphPanelRef = useRef(null);

// Stores the current text selection while using colour pickers
const savedSelectionRef = useRef(null);

// Hidden colour picker references
const textColorInputRef = useRef(null);
const highlightColorInputRef = useRef(null);
const linkHighlightInputRef = useRef(null);

// Current selected toolbar colours
const [textColor, setTextColor] = useState("#eef1f7");
const [highlightColor, setHighlightColor] = useState("#625df0");

// Current formatting colours at the editor cursor
const [activeTextColor, setActiveTextColor] = useState("#eef1f7");
const [activeHighlightColor, setActiveHighlightColor] = useState(null);

// Controls alignment / indent popover
const [paragraphMenuOpen, setParagraphMenuOpen] = useState(false);

// Used for detecting clicks outside the popover
const paragraphMenuRef = useRef(null);

// Stores current paragraph alignment
const [activeAlignment, setActiveAlignment] = useState("left");

const selectedRangeRef = useRef(null);
const graphLinkColourIndexRef = useRef(0);

const GRAPH_LINK_COLORS = [
  "#f2c94c",
  "#56ccf2",
  "#9b7df5",
  "#4fd1a1",
  "#f58b8b",
  "#f2994a",
  "#bb6bd9",
  "#60a5fa",
];

// << RAW NOTES SEARCH >> //

// << frontend dev >> //
  // Stores the current note title //
  const [title, setTitle] = useState(note.title);

  // Stores the current raw note text //
  // This rawNotes value will be shared with HANS AI //
  const [rawNotes, setRawNotes] = useState(note.content);

  // Stores the current raw note text in HTML format //
  const [rawNotesHtml, setRawNotesHtml] =
  useState("");

  // Selected text for manually adding to graph //
  const [selectedText, setSelectedText] = useState("");

  // Initialising Context menu on right click //
  const [contextMenu, setContextMenu] = useState(null);

  // Current live graph nodes shown in the
  // "Link to existing node" submenu.
  const [graphNodeOptions, setGraphNodeOptions] = useState([]);

  // Controls whether the secondary graph-node
  // picker menu is visible.
  const [graphNodeMenuOpen, setGraphNodeMenuOpen] = useState(false);

  const [addNodeTrigger, setAddNodeTrigger] = useState(0);


  // Tracks the active text formatting //
  const [activeFormats, setActiveFormats] = useState({
  bold: false,
  italic: false,
  underline: false,

  heading: null,

  bulletList: false,
  numberedList: false,
  });

  const alignmentIcons = {
    left: AlignLeft,
    center: AlignCenter,
    right: AlignRight,
    justify: AlignJustify,
  };

  const ActiveAlignmentIcon = alignmentIcons[activeAlignment] || AlignLeft;

  /* ---------------------------------------------------------
   Raw Notes Formatting
   --------------------------------------------------------- */

  function runFormat(command, value = null) {
    editorRef.current?.focus();

    document.execCommand(command, false, value);

    updateRawNotes();
    updateFormattingState();
  }

  function updateFormattingState() {
  let currentBlock = document.queryCommandValue("formatBlock");

  if (currentBlock) {
    currentBlock = currentBlock
      .toLowerCase()
      .replace("<", "")
      .replace(">", "");
  }

  setActiveFormats({
    bold: document.queryCommandState("bold"),
    italic: document.queryCommandState("italic"),
    underline: document.queryCommandState("underline"),

    heading:
      currentBlock === "h1" ||
      currentBlock === "h2" ||
      currentBlock === "h3"
        ? currentBlock
        : null,

    bulletList:
      document.queryCommandState("insertUnorderedList"),

    numberedList:
      document.queryCommandState("insertOrderedList"),
    });

    // Update alignment state
    updateAlignmentState();

    // Update text/highlight colour indicators
    updateActiveColors();
  }

  function toggleHeading(heading) {
    const currentBlock = document
      .queryCommandValue("formatBlock")
      .toLowerCase()
      .replace("<", "")
      .replace(">", "");

    if (currentBlock === heading) {
      runFormat("formatBlock", "p");
    } else {
      runFormat("formatBlock", heading);
    }
  }

  function updateRawNotes() {
    if (!editorRef.current) {
      return;
    }

    // Plain text for Hans / AI
    setRawNotes(
      editorRef.current.innerText
    );

    // Rich content for saving formatting + graph links
    setRawNotesHtml(
      editorRef.current.innerHTML
    );
  }

  function addLink() {
    const url = window.prompt("Enter a URL:");

    if (!url) {
      return;
    }

    editorRef.current?.focus();

    document.execCommand("createLink", false, url);

    updateRawNotes();
  }

  function hexToRgba(
    hex,
    alpha = 1
  ) {
    let cleanHex =
      hex.replace("#", "");


    if (cleanHex.length === 3) {
      cleanHex =
        cleanHex
          .split("")
          .map(
            (character) =>
              character + character
          )
          .join("");
    }


    const red =
      parseInt(
        cleanHex.substring(0, 2),
        16
      );

    const green =
      parseInt(
        cleanHex.substring(2, 4),
        16
      );

    const blue =
      parseInt(
        cleanHex.substring(4, 6),
        16
      );


    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  function cssColorToHex(color, fallback = "#eef1f7") {
    if (!color) {
      return fallback;
    }

    if (color.startsWith("#")) {
      return color;
    }

    const rgbMatch = color.match(
      /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/
    );

    if (!rgbMatch) {
      return fallback;
    }

    // Transparent colour
    if (
      rgbMatch[4] !== undefined &&
      Number(rgbMatch[4]) === 0
    ) {
      return null;
    }

    const red = Number(rgbMatch[1]);
    const green = Number(rgbMatch[2]);
    const blue = Number(rgbMatch[3]);

    return (
      "#" +
      [red, green, blue]
        .map((value) =>
          value
            .toString(16)
            .padStart(2, "0")
        )
        .join("")
    );
  }

  function updateActiveColors() {
    const selection =
      window.getSelection();

    if (
      !selection ||
      selection.rangeCount === 0 ||
      !editorRef.current
    ) {
      return;
    }


    let currentNode =
      selection.anchorNode;


    if (!currentNode) {
      return;
    }


    // If the cursor is inside a text node,
    // use its parent HTML element.
    let currentElement =
      currentNode.nodeType === Node.TEXT_NODE
        ? currentNode.parentElement
        : currentNode;


    if (
      !currentElement ||
      !editorRef.current.contains(
        currentElement
      )
    ) {
      return;
    }


    // =====================================================
    // TEXT COLOUR
    // =====================================================

    const computedStyle =
      window.getComputedStyle(
        currentElement
      );


    const currentTextColor =
      cssColorToHex(
        computedStyle.color,
        "#eef1f7"
      );


    if (currentTextColor) {
      setActiveTextColor(
        currentTextColor
      );

      setTextColor(
        currentTextColor
      );
    }


    // =====================================================
    // HIGHLIGHT COLOUR
    // =====================================================

    /*
      execCommand("hiliteColor") normally creates
      a span with an inline background colour.

      Walk upward from the cursor until we either find
      one or reach the editor itself.
    */

    const graphLinkedText =
      currentElement?.closest?.(
        ".graph-linked-text"
      );


    if (
      graphLinkedText &&
      editorRef.current.contains(
        graphLinkedText
      )
    ) {

      const graphLinkColor =
        graphLinkedText.dataset
          .graphLinkColor;


      if (graphLinkColor) {

        setActiveHighlightColor(
          graphLinkColor
        );

        setHighlightColor(
          graphLinkColor
        );

        return;

      }

    }

    let highlightElement =
      currentElement;

    let foundHighlight = null;


    while (
      highlightElement &&
      highlightElement !==
        editorRef.current
    ) {

      const inlineBackground =
        highlightElement.style
          ?.backgroundColor;


      if (
        inlineBackground &&
        inlineBackground !==
          "transparent"
      ) {

        foundHighlight =
          cssColorToHex(
            inlineBackground,
            null
          );

        break;
      }


      highlightElement =
        highlightElement.parentElement;
    }


    setActiveHighlightColor(
      foundHighlight
    );

    setHighlightColor(
      foundHighlight
    );
  }

  function saveEditorSelection() {
    const selection = window.getSelection();

    if (
      !selection ||
      selection.rangeCount === 0 ||
      !editorRef.current
    ) {
      return;
    }

    const range = selection.getRangeAt(0);

    // Only save selections that actually belong to Raw Notes
    if (
      editorRef.current.contains(
        range.commonAncestorContainer
      )
    ) {
      savedSelectionRef.current =
        range.cloneRange();
    }
  }


  function restoreEditorSelection() {
    if (!savedSelectionRef.current) {
      return false;
    }

    const selection = window.getSelection();

    selection.removeAllRanges();
    selection.addRange(
      savedSelectionRef.current
    );

    return true;
  }


  function applyEditorColor(command, color) {
    editorRef.current?.focus();

    restoreEditorSelection();

    /*
      foreColor  = text colour
      hiliteColor = background/highlight colour
    */
    const applied = document.execCommand(
      command,
      false,
      color
    );

    /*
      Fallback for highlight colour if hiliteColor
      isn't accepted by the browser.
    */
    if (
      command === "hiliteColor" &&
      !applied
    ) {
      document.execCommand(
        "backColor",
        false,
        color
      );
    }

    updateRawNotes();

    updateFormattingState();

    saveEditorSelection();
  }

  function applyHighlightColor(color) {

    editorRef.current?.focus();

    restoreEditorSelection();


    // =====================================================
    // CHECK FOR GRAPH-LINKED TEXT
    // =====================================================

    const linkedSpans =
      getGraphLinksInSelection();


    if (linkedSpans.length > 0) {

      /*
        IMPORTANT:

        Do NOT use execCommand here.

        That would create nested/split formatting spans
        inside graph-linked text.
      */


      const processedNodeIds =
        new Set();


      linkedSpans.forEach((span) => {

        const nodeId =
          span.dataset.graphNodeId;


        if (!nodeId) {
          return;
        }


        /*
          If multiple Raw Notes references point to
          the same graph node, only process that node
          once.
        */

        if (
          processedNodeIds.has(
            nodeId
          )
        ) {
          return;
        }


        processedNodeIds.add(
          nodeId
        );


        /*
          Use the SAME function as the right-click
          Graph Link colour picker.

          This guarantees both interfaces behave
          identically.
        */

        handleGraphLinkColorChange(
          nodeId,
          span.dataset.graphLinkId,
          color
        );

      });


      setHighlightColor(
        color
      );

      setActiveHighlightColor(
        color
      );


      /*
        Keep the graph link structurally intact.
      */

      saveEditorSelection();


      return;
    }


    // =====================================================
    // NORMAL TEXT HIGHLIGHT
    // =====================================================

    const applied =
      document.execCommand(
        "hiliteColor",
        false,
        color
      );


    if (!applied) {

      document.execCommand(
        "backColor",
        false,
        color
      );

    }


    setHighlightColor(
      color
    );

    setActiveHighlightColor(
      color
    );


    updateRawNotes();

    updateFormattingState();

    saveEditorSelection();
  }

  function removeManualHighlight() {

    editorRef.current?.focus();

    restoreEditorSelection();


    const selection =
      window.getSelection();


    if (
      !selection ||
      selection.rangeCount === 0
    ) {
      return;
    }


    const range =
      selection.getRangeAt(0);


    /*
      Nothing selected.

      We don't want the eraser to change the
      formatting mode for future typing.
    */
    if (range.collapsed) {
      return;
    }


    // =====================================================
    // PROTECT GRAPH-LINKED TEXT
    // =====================================================

    const linkedSpans =
      getGraphLinksInSelection();


    if (linkedSpans.length > 0) {

      console.log(
        "Graph-linked highlights cannot be removed with the toolbar."
      );

      /*
        Graph-linked highlighting is structural.

        To remove it, the user must:
        Right click → Remove graph link.
      */

      return;
    }


    // =====================================================
    // REMOVE NORMAL HIGHLIGHT
    // =====================================================

    /*
      Different browsers may use either command,
      so try hiliteColor first and backColor second.
    */

    const removed =
      document.execCommand(
        "hiliteColor",
        false,
        "transparent"
      );


    if (!removed) {

      document.execCommand(
        "backColor",
        false,
        "transparent"
      );

    }


    setActiveHighlightColor(null);


    updateRawNotes();

    updateFormattingState();

    saveEditorSelection();
  }

  function applyAlignment(alignment) {

    editorRef.current?.focus();

    restoreEditorSelection();


    const commandMap = {
      left: "justifyLeft",
      center: "justifyCenter",
      right: "justifyRight",
      justify: "justifyFull",
    };


    const command =
      commandMap[alignment];


    if (!command) {
      return;
    }


    document.execCommand(
      command,
      false,
      null
    );


    /*
      Update immediately rather than waiting
      for another cursor event.
    */

    setActiveAlignment(
      alignment
    );


    updateRawNotes();

    saveEditorSelection();


    /*
      Re-read all toolbar formatting after
      the browser has applied the command.
    */

    requestAnimationFrame(() => {
      updateFormattingState();
    });
  }

  function applyIndent(direction) {

    editorRef.current?.focus();

    restoreEditorSelection();


    const command =
      direction === "increase"
        ? "indent"
        : "outdent";


    document.execCommand(
      command,
      false,
      null
    );


    updateRawNotes();

    updateFormattingState();

    saveEditorSelection();
  }

  function updateAlignmentState() {
    const selection =
      window.getSelection();

    if (
      !selection ||
      selection.rangeCount === 0 ||
      !editorRef.current
    ) {
      return;
    }


    let currentNode =
      selection.anchorNode;


    if (!currentNode) {
      return;
    }


    let currentElement =
      currentNode.nodeType === Node.TEXT_NODE
        ? currentNode.parentElement
        : currentNode;


    if (
      !currentElement ||
      !editorRef.current.contains(
        currentElement
      )
    ) {
      return;
    }


    /*
      Find the paragraph/block that actually
      owns the alignment.
    */

    const blockElement =
      currentElement.closest(
        "p, div, h1, h2, h3, h4, h5, h6, li"
      ) || currentElement;


    const alignment =
      window
        .getComputedStyle(blockElement)
        .textAlign;


    switch (alignment) {

      case "center":
        setActiveAlignment("center");
        break;


      case "right":
        setActiveAlignment("right");
        break;


      case "justify":
        setActiveAlignment("justify");
        break;


      default:
        setActiveAlignment("left");
        break;

    }
  }

  function getCurrentGraphNodes() {

    /*
      Ask GraphPanel for the LIVE Cytoscape graph.

      This includes unsaved frontend changes such as:
      - newly added nodes
      - deleted nodes
      - renamed/edited node data
      - manually generated nodes

      We deliberately do not use GraphPanel's original
      graphData state here because Cytoscape may have been
      modified since that state was created.
    */
    const currentGraph =
      graphPanelRef.current
        ?.getGraphData();


    if (!currentGraph?.nodes) {
      return [];
    }


    return currentGraph.nodes
      .map((node) => {

        const data =
          node.data ?? node;


        return {
          id:
            String(data.id),

          label:
            data.label ||
            "Untitled Node",

          /*
            Keep these available because they may
            be useful later in the menu.
          */
          color:
            data.color ??
            null,

          shape:
            data.shape ??
            null,

          linkColor:
            data.linkColor ??
            null,
        };

      });
  }

  function toggleGraphNodeMenu() {

    if (graphNodeMenuOpen) {
      setGraphNodeMenuOpen(false);
      return;
    }

    const currentNodes =
      getCurrentGraphNodes();

    setGraphNodeOptions(
      currentNodes
    );

    setGraphNodeMenuOpen(true);
  }

  function handleLinkSelectedTextToExistingNode(node) {

    const range =
      selectedRangeRef.current;

    if (!range || !node?.id) {
      console.warn(
        "No selected text range or graph node available."
      );

      return;
    }


    /*
      Reuse the node's existing graph-link colour
      when possible.

      If this node has never been linked from Raw Notes
      before, give it the next available link colour.
    */
    const linkColor =
      node.linkColor ||
      getNextGraphLinkColor();


    /*
      If this was the first Raw Notes link to this node,
      tell GraphPanel about its new intrinsic link colour.
    */
    if (!node.linkColor) {

      graphPanelRef.current
        ?.setLinkedNodeColor(
          node.id,
          linkColor
        );

    }


    /*
      Wrap the currently selected Raw Notes text
      and point it at the EXISTING graph node.
    */
    createGraphLinkedText(
      range,
      node.id,
      linkColor
    );


    console.log(
      "Linked selected Raw Notes text to existing node:",
      {
        nodeId: node.id,
        label: node.label,
        color: linkColor,
      }
    );


    selectedRangeRef.current = null;

    setGraphNodeMenuOpen(false);

    setContextMenu(null);
  }

  function handleChangeLinkedNode(node) {

    if (
      !editorRef.current ||
      !contextMenu ||
      contextMenu.type !== "linked" ||
      !node?.id
    ) {
      return;
    }


    const currentNodeId =
      String(contextMenu.nodeId);

    const newNodeId =
      String(node.id);


    if (currentNodeId === newNodeId) {
      return;
    }


    const linkedSpan =
      Array.from(
        editorRef.current.querySelectorAll(
          ".graph-linked-text"
        )
      ).find(
        (span) =>
          span.dataset.graphLinkId ===
          String(contextMenu.linkId)
      );


    if (!linkedSpan) {
      console.warn(
        "Unable to find linked Raw Notes text."
      );

      return;
    }


    /*
      IMPORTANT:
      Keep the existing colour.

      Changing the destination node should NOT
      change the appearance of the text link.
    */
    const linkColor =
      linkedSpan.dataset.graphLinkColor ||
      contextMenu.color ||
      "#f2c94c";


    /*
      Only change where the link points.
    */
    linkedSpan.dataset.graphNodeId =
      newNodeId;


    /*
      Preserve the existing colour explicitly.
    */
    linkedSpan.dataset.graphLinkColor =
      linkColor;


    linkedSpan.style.setProperty(
      "--graph-link-color",
      linkColor
    );


    linkedSpan.style.backgroundColor =
      hexToRgba(
        linkColor,
        0.38
      );


    /*
      Update the open menu so the purple
      selected-node outline moves immediately.
    */
    setContextMenu((current) => {

      if (
        !current ||
        current.type !== "linked"
      ) {
        return current;
      }


      return {
        ...current,

        nodeId:
          newNodeId,

        color:
          linkColor,
      };

    });


    updateRawNotes();


    console.log(
      "Changed linked graph node:",
      {
        from: currentNodeId,
        to: newNodeId,
        label: node.label,
        preservedColor:
          linkColor,
      }
    );
  }

  function getNextGraphLinkColor() {
    const color =
      GRAPH_LINK_COLORS[
        graphLinkColourIndexRef.current %
        GRAPH_LINK_COLORS.length
      ];

    graphLinkColourIndexRef.current += 1;

    return color;
  }

  function getGraphLinksInSelection() {
    if (
      !editorRef.current ||
      !savedSelectionRef.current
    ) {
      return [];
    }


    const range =
      savedSelectionRef.current;


    const linkedSpans =
      Array.from(
        editorRef.current.querySelectorAll(
          ".graph-linked-text"
        )
      );


    const matchedLinks =
      linkedSpans.filter((span) => {

        try {

          /*
            range.intersectsNode() catches:
            - full selection of linked text
            - partial selection of linked text
            - selection crossing linked text
          */

          return range.intersectsNode(span);

        } catch {

          return false;

        }

      });


    /*
      A collapsed caret doesn't always behave quite
      how we want with intersectsNode(), so explicitly
      check what element the caret currently sits inside.
    */

    if (
      range.collapsed &&
      range.startContainer
    ) {

      const startElement =
        range.startContainer.nodeType === Node.TEXT_NODE
          ? range.startContainer.parentElement
          : range.startContainer;


      const linkedParent =
        startElement?.closest?.(
          ".graph-linked-text"
        );


      if (
        linkedParent &&
        editorRef.current.contains(
          linkedParent
        ) &&
        !matchedLinks.includes(
          linkedParent
        )
      ) {

        matchedLinks.push(
          linkedParent
        );

      }

    }


    return matchedLinks;
  }

  function createGraphLinkedText(
    range,
    nodeId,
    color
  ) {
    if (!range) {
      return;
    }


    const linkId =
      typeof crypto.randomUUID === "function"
        ? `link-${crypto.randomUUID()}`
        : `link-${Date.now()}`;


    const span =
      document.createElement("span");


    span.className =
      "graph-linked-text";


    span.dataset.graphNodeId =
      nodeId;

    span.dataset.graphLinkId =
      linkId;

    span.dataset.graphLinkColor =
      color;


    span.style.setProperty(
      "--graph-link-color",
      color
    );


    /*
      Preserve formatting that already exists
      inside the selection.
    */
    const contents =
      range.extractContents();

    span.appendChild(contents);

    range.insertNode(span);


    /*
      Collapse selection after newly linked text.
    */
    const selection =
      window.getSelection();

    selection.removeAllRanges();


    updateRawNotes();


    console.log(
      "Created Raw Notes graph link:",
      {
        nodeId,
        linkId,
        color,
      }
    );
  }

  function removeGraphTextLink(linkId) {

    if (
      !editorRef.current ||
      !linkId
    ) {
      return;
    }


    const linkedSpan =
      Array.from(
        editorRef.current.querySelectorAll(
          ".graph-linked-text"
        )
      ).find(
        (span) =>
          span.dataset.graphLinkId ===
          String(linkId)
      );


    if (!linkedSpan) {
      console.warn(
        "Unable to find graph link to remove:",
        linkId
      );

      return;
    }


    const nodeId =
      linkedSpan.dataset.graphNodeId;

    const linkColor =
      linkedSpan.dataset.graphLinkColor;


    /*
      Make sure GraphPanel isn't temporarily
      showing a hover state for this text link.
    */
    if (nodeId) {

      graphPanelRef.current
        ?.setLinkedNodeHover(
          nodeId,
          linkColor,
          false
        );

    }


    /*
      UNWRAP the graph-linked span.

      We do NOT delete its contents.

      Example:

        <span class="graph-linked-text">
          application
        </span>

      becomes simply:

        application

      Any formatting nested inside the span is
      preserved too.
    */
    const parent =
      linkedSpan.parentNode;


    if (!parent) {
      return;
    }


    while (linkedSpan.firstChild) {

      parent.insertBefore(
        linkedSpan.firstChild,
        linkedSpan
      );

    }


    linkedSpan.remove();


    /*
      Merge adjacent text nodes that may have
      been created by removing the wrapper.
    */
    parent.normalize();


    /*
      Store the now-unlinked rich HTML.
    */
    updateRawNotes();


    /*
      Close both context menus.
    */
    setGraphNodeMenuOpen(false);

    setContextMenu(null);


    console.log(
      "Removed Raw Notes graph link:",
      {
        linkId,
        nodeId,
      }
    );
  }

  function handleAddSelectedTextToGraph() {
    const textToAdd =
      contextMenu?.text;

    const range =
      selectedRangeRef.current;


    if (
      !textToAdd ||
      !range
    ) {
      console.warn(
        "No selected text/range available."
      );

      return;
    }


    const linkColor =
      getNextGraphLinkColor();


    /*
      Ask GraphPanel to create the node.

      IMPORTANT:
      createLinkedTextNode must RETURN its node ID.
    */
    const nodeId =
      graphPanelRef.current
        ?.createLinkedTextNode(
          textToAdd,
          linkColor
        );


    console.log(
      "Created graph node:",
      nodeId
    );


    if (!nodeId) {
      console.warn(
        "GraphPanel did not return a node ID."
      );

      return;
    }


    /*
      Wrap the selected Raw Notes text and
      embed that node ID into it.
    */
    createGraphLinkedText(
      range,
      nodeId,
      linkColor
    );


    selectedRangeRef.current =
      null;


    setContextMenu(null);
  }

  function handleGraphLinkColorChange(
    nodeId,
    linkId,
    color
  ) {
    if (!editorRef.current) {
      return;
    }


    console.log(
      "Changing graph text link colour:",
      {
        nodeId,
        linkId,
        color,
      }
    );


    /*
      Find this exact Raw Notes graph link.

      Colour now belongs to the individual text link,
      rather than every piece of text pointing at the
      same graph node.
    */
    const linkedSpan =
      Array.from(
        editorRef.current.querySelectorAll(
          ".graph-linked-text"
        )
      ).find(
        (span) =>
          span.dataset.graphLinkId ===
          String(linkId)
      );


    if (!linkedSpan) {
      console.warn(
        "Unable to find graph-linked text:",
        linkId
      );

      return;
    }


    linkedSpan.dataset.graphLinkColor =
      color;


    linkedSpan.style.setProperty(
      "--graph-link-color",
      color
    );


    linkedSpan.style.backgroundColor =
      hexToRgba(
        color,
        0.38
      );


    /*
      Keep the open Graph Link context menu
      synchronised with the new colour.
    */
    setContextMenu((current) => {

      if (
        !current ||
        current.linkId !== linkId
      ) {
        return current;
      }


      return {
        ...current,
        color,
      };

    });


    updateRawNotes();
  }

  // =========================================================
  // Load Raw Notes content
  // =========================================================

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    /*
      Initialise editor content only when
      switching to a different note.

      Later, if backend stores rich HTML,
      prefer note.notes_section_html here.
    */
    editorRef.current.innerHTML =
      note.notes_section_html ||
      note.content ||
      "";

  }, [note.id]);

  // =========================================================
  // Paragraph formatting popover
  // =========================================================

  useEffect(() => {

    function handleParagraphMenuOutside(event) {

      if (
        paragraphMenuRef.current &&
        !paragraphMenuRef.current.contains(
          event.target
        )
      ) {
        setParagraphMenuOpen(false);
      }

    }


    function handleParagraphMenuEscape(event) {

      if (event.key === "Escape") {
        setParagraphMenuOpen(false);
      }

    }


    document.addEventListener(
      "mousedown",
      handleParagraphMenuOutside
    );

    document.addEventListener(
      "keydown",
      handleParagraphMenuEscape
    );


    return () => {

      document.removeEventListener(
        "mousedown",
        handleParagraphMenuOutside
      );

      document.removeEventListener(
        "keydown",
        handleParagraphMenuEscape
      );

    };

  }, []);

  useImperativeHandle(ref, () => ({
  async saveEverything() {
    if (!note?.id) {
      console.log("No note ID available");
      return;
    }

    const graphData = graphPanelRef.current?.getGraphData();

    const response = await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        title: title,
        notes_section: rawNotes,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to save note");
    }

    const savedNote = await response.json();

    console.log("Note saved:", savedNote);
    console.log("Graph ready to save:", graphData);
  },

}));

  return (
    <div 
      className="note-workspace"
      onClick={() => {
        setContextMenu(null);
        setGraphNodeMenuOpen(false);
      }}
    >

    {/* << frontend dev >> */}
    {/* Note title input */}

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="note-title"
      />

      <div className="notes-layout">
        <section className="raw-notes">
          
          <div className="raw-notes-heading">

            <div className="raw-notes-heading-title">
              <h2>Raw Notes</h2>

              <Info
                size={21}
                strokeWidth={2}
                aria-hidden="true"
              />
            </div>

          </div>
          
          <div className="raw-notes-editor">
            
            <div
              className="raw-notes-toolbar"
              role="toolbar"
              aria-label="Text formatting"
            >
              {/* Headings */}
              
              <button
                type="button"
                className={`toolbar-text-button ${
                  activeFormats.heading === "h1"
                    ? "toolbar-button-active"
                    : ""
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => toggleHeading("h1")}
                aria-pressed={activeFormats.heading === "h1"}
                data-tooltip="Heading 1"
                aria-label="Heading 1"
              >
                H1
              </button>
              
              <button
                type="button"
                className={`toolbar-text-button ${
                  activeFormats.heading === "h2"
                    ? "toolbar-button-active"
                    : ""
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => toggleHeading("h2")}
                aria-pressed={activeFormats.heading === "h2"}
                data-tooltip="Heading 2"
                aria-label="Heading 2"
              >
                H2
              </button>
              
              <button
                type="button"
                className={`toolbar-text-button ${
                  activeFormats.heading === "h3"
                    ? "toolbar-button-active"
                    : ""
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => toggleHeading("h3")}
                aria-pressed={activeFormats.heading === "h3"}
                data-tooltip="Heading 3"
                aria-label="Heading 3"
              >
                H3
              </button>
              

              <span className="toolbar-divider" />
              
              {/* Font formatting */}
              
              <button
                type="button"
                className={`toolbar-icon-button ${
                  activeFormats.bold
                    ? "toolbar-button-active"
                    : ""
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runFormat("bold")}
                aria-pressed={activeFormats.bold}
                data-tooltip="Bold"
                aria-label="Bold"
              >
                <Bold size={18} strokeWidth={2.2} />
              </button>
              
              <button
                type="button"
                className={`toolbar-icon-button ${
                  activeFormats.italic
                    ? "toolbar-button-active"
                    : ""
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runFormat("italic")}
                aria-pressed={activeFormats.italic}
                data-tooltip="Italic"
                aria-label="Italic"
              >
                <Italic size={18} strokeWidth={2} />
              </button>
              
              <button
                type="button"
                className={`toolbar-icon-button ${
                  activeFormats.underline
                    ? "toolbar-button-active"
                    : ""
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runFormat("underline")}
                aria-pressed={activeFormats.underline}
                data-tooltip="Underline"
                aria-label="Underline"
              >
                <Underline size={18} strokeWidth={2} />
              </button>
              
              {/* Text Colour */}

              <div className="toolbar-color-wrapper">

                <button
                  type="button"
                  className="toolbar-icon-button toolbar-color-button"

                  onMouseDown={(event) => {
                    saveEditorSelection();
                    event.preventDefault();
                  }}

                  onClick={() =>
                    textColorInputRef.current?.click()
                  }

                  data-tooltip="Text colour"
                  aria-label="Text colour"
                >
                  <Palette
                    size={18}
                    strokeWidth={1.9}
                  />

                  <span
                    className="toolbar-color-indicator"
                    style={{
                      backgroundColor: activeTextColor,
                    }}
                  />
                </button>


                <input
                  ref={textColorInputRef}
                  className="toolbar-hidden-color-input"
                  type="color"
                  value={textColor}

                  onChange={(event) => {
                    const color = event.target.value;

                    setTextColor(color);

                    applyEditorColor(
                      "foreColor",
                      color
                    );
                  }}
                />

              </div>


              {/* Highlight Colour */}

              <div className="toolbar-color-wrapper">

                <button
                  type="button"
                  className="toolbar-icon-button toolbar-color-button"

                  onMouseDown={(event) => {
                    saveEditorSelection();
                    event.preventDefault();
                  }}

                  onClick={() =>
                    highlightColorInputRef.current?.click()
                  }

                  data-tooltip="Highlight colour"
                  aria-label="Highlight colour"
                >
                  <Highlighter
                    size={18}
                    strokeWidth={1.9}
                  />

                  <span
                    className="toolbar-color-indicator"
                    style={{
                      backgroundColor:
                        activeHighlightColor,
                    }}
                  />
                </button>


                <input
                  ref={highlightColorInputRef}
                  className="toolbar-hidden-color-input"
                  type="color"
                  value={highlightColor}

                  onChange={(event) => {
                    const color = event.target.value;

                    applyHighlightColor(
                      color
                    );

                  }}
                />

              </div>

              {/* Remove Highlight */}

              <button
                type="button"

                className="toolbar-icon-button"

                onMouseDown={(event) => {
                  saveEditorSelection();

                  event.preventDefault();
                }}

                onClick={removeManualHighlight}

                data-tooltip="Remove highlight"

                aria-label="Remove highlight"
              >
                <Eraser
                  size={18}
                  strokeWidth={1.9}
                />
              </button>

              <span className="toolbar-divider" />
              
              {/* Paragraph Formatting */}

              <div
                className="toolbar-popover-wrapper"
                ref={paragraphMenuRef}
              >

                <button
                  type="button"

                  className={`toolbar-icon-button ${
                    paragraphMenuOpen
                      ? "toolbar-button-active"
                      : ""
                  }`}

                  onMouseDown={(event) => {

                    /*
                      Preserve the editor selection before
                      interacting with the toolbar.
                    */

                    saveEditorSelection();

                    event.preventDefault();

                  }}

                  onClick={() => {

                    setParagraphMenuOpen(
                      (current) => {

                        const nextOpen =
                          !current;


                        /*
                          When opening the popover,
                          restore the editor selection and
                          check the paragraph's current alignment.
                        */

                        if (nextOpen) {

                          restoreEditorSelection();


                          requestAnimationFrame(() => {
                            updateAlignmentState();
                          });

                        }


                        return nextOpen;
                      }
                    );

                  }}

                  data-tooltip="Alignment and indent"

                  aria-label="Alignment and indent"

                  aria-expanded={
                    paragraphMenuOpen
                  }

                  aria-haspopup="true"
                >
                  <span className="alignment-toolbar-icon">
                    <ActiveAlignmentIcon
                      size={19}
                      strokeWidth={1.9}
                    />

                    <ChevronDown
                      className="alignment-toolbar-chevron"
                      size={12}
                      strokeWidth={2}
                    />
                  </span>
                </button>


                {paragraphMenuOpen && (

                  <div
                    className="paragraph-format-popover"
                    contentEditable={false}
                  >

                    {/* Alignment */}

                    <div className="paragraph-format-row">

                      <button
                        type="button"

                        className={`paragraph-format-button ${
                          activeAlignment === "left"
                            ? "paragraph-format-button-active"
                            : ""
                        }`}

                        onMouseDown={(event) =>
                          event.preventDefault()
                        }

                        onClick={() =>
                          applyAlignment("left")
                        }

                        aria-label="Align left"
                        data-tooltip="Align left"
                      >
                        <AlignLeft
                          size={18}
                          strokeWidth={1.8}
                        />
                      </button>


                      <button
                        type="button"

                        className={`paragraph-format-button ${
                          activeAlignment === "center"
                            ? "paragraph-format-button-active"
                            : ""
                        }`}

                        onMouseDown={(event) =>
                          event.preventDefault()
                        }

                        onClick={() =>
                          applyAlignment("center")
                        }

                        aria-label="Align centre"
                        data-tooltip="Align centre"
                      >
                        <AlignCenter
                          size={18}
                          strokeWidth={1.8}
                        />
                      </button>


                      <button
                        type="button"

                        className={`paragraph-format-button ${
                          activeAlignment === "right"
                            ? "paragraph-format-button-active"
                            : ""
                        }`}

                        onMouseDown={(event) =>
                          event.preventDefault()
                        }

                        onClick={() =>
                          applyAlignment("right")
                        }

                        aria-label="Align right"
                        data-tooltip="Align right"
                      >
                        <AlignRight
                          size={18}
                          strokeWidth={1.8}
                        />
                      </button>


                      <button
                        type="button"

                        className={`paragraph-format-button ${
                          activeAlignment === "justify"
                            ? "paragraph-format-button-active"
                            : ""
                        }`}

                        onMouseDown={(event) =>
                          event.preventDefault()
                        }

                        onClick={() =>
                          applyAlignment("justify")
                        }

                        aria-label="Justify"
                        data-tooltip="Justify"
                      >
                        <AlignJustify
                          size={18}
                          strokeWidth={1.8}
                        />
                      </button>

                    </div>


                    <div className="paragraph-popover-divider" />


                    {/* Indentation */}

                    <div className="paragraph-format-row">

                      <button
                        type="button"
                        className="paragraph-format-button"

                        onMouseDown={(event) =>
                          event.preventDefault()
                        }

                        onClick={() =>
                          applyIndent("decrease")
                        }

                        aria-label="Decrease indent"
                        data-tooltip="Decrease indent"
                      >
                        <IndentDecrease
                          size={18}
                          strokeWidth={1.8}
                        />
                      </button>


                      <button
                        type="button"
                        className="paragraph-format-button"

                        onMouseDown={(event) =>
                          event.preventDefault()
                        }

                        onClick={() =>
                          applyIndent("increase")
                        }

                        aria-label="Increase indent"
                        data-tooltip="Increase indent"
                      >
                        <IndentIncrease
                          size={18}
                          strokeWidth={1.8}
                        />
                      </button>

                    </div>

                  </div>

                )}

              </div>
              
              {/* Lists */}
              
              <button
                type="button"
                className={`toolbar-icon-button ${
                  activeFormats.bulletList
                    ? "toolbar-button-active"
                    : ""
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runFormat("insertUnorderedList")}
                aria-pressed={activeFormats.bulletList}
                data-tooltip="Bullet list"
                aria-label="Bullet list"
              >
                <List size={19} strokeWidth={1.9} />
              </button>
              
              <button
                type="button"
                className={`toolbar-icon-button ${
                  activeFormats.numberedList
                    ? "toolbar-button-active"
                    : ""
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runFormat("insertOrderedList")}
                aria-pressed={activeFormats.numberedList}
                data-tooltip="Numbered list"
                aria-label="Numbered list"
              >
                <ListOrdered size={19} strokeWidth={1.9} />
              </button>
              
              
              <span className="toolbar-divider" />
              
              
              {/* Link */}
              
              <button
                type="button"
                className="toolbar-icon-button"
                onClick={addLink}
                data-tooltip="Insert link"
                aria-label="Insert link"
              >
                <Link size={19} strokeWidth={1.9} />
              </button>
              
            </div>
            
            <div
              ref={editorRef}
              className="text-area raw-notes-content"
              contentEditable
              suppressContentEditableWarning

              onContextMenu={(event) => {

                // =====================================================
                // 1. CHECK IF USER RIGHT-CLICKED LINKED GRAPH TEXT
                // =====================================================

                const targetElement =
                  event.target instanceof Element
                    ? event.target
                    : event.target?.parentElement;


                const linkedText =
                  targetElement?.closest(
                    ".graph-linked-text"
                  );


                if (
                  linkedText &&
                  editorRef.current?.contains(
                    linkedText
                  )
                ) {
                  event.preventDefault();


                  /*
                    We do NOT need a text selection here.

                    Everything needed is already stored directly
                    on the graph-linked span.
                  */

                  selectedRangeRef.current = null;

                  setGraphNodeMenuOpen(false);

                  setContextMenu({
                    type: "linked",

                    x: event.clientX,
                    y: event.clientY,

                    text:
                      linkedText.textContent || "",

                    nodeId:
                      linkedText.dataset.graphNodeId,

                    linkId:
                      linkedText.dataset.graphLinkId,

                    color:
                      linkedText.dataset.graphLinkColor ||
                      "#f2c94c",
                  });


                  return;
                }


                // =====================================================
                // 2. OTHERWISE CHECK ORDINARY SELECTED TEXT
                // =====================================================

                const selection =
                  window.getSelection();


                const text =
                  selection
                    ?.toString()
                    .trim() || "";


                if (
                  !text ||
                  !selection ||
                  selection.rangeCount === 0
                ) {
                  /*
                    Nothing special was clicked.

                    Do NOT preventDefault here so the normal
                    browser right-click menu still works.
                  */

                  setContextMenu(null);

                  return;
                }


                // =====================================================
                // 3. NEW TEXT → ADD TO GRAPH MENU
                // =====================================================

                event.preventDefault();


                const range =
                  selection.getRangeAt(0);


                /*
                  Make sure the selection actually belongs to
                  the Raw Notes editor.
                */

                if (
                  !editorRef.current?.contains(
                    range.commonAncestorContainer
                  )
                ) {
                  return;
                }


                selectedRangeRef.current = range.cloneRange();

                setGraphNodeMenuOpen(false);

                setContextMenu({
                  type: "new",

                  x: event.clientX,
                  y: event.clientY,

                  text: text,
                });

              }}
              
              onClick={(event) => {

                const linkedText =
                  event.target.closest?.(
                    ".graph-linked-text"
                  );


                if (!linkedText) {
                  return;
                }


                const nodeId =
                  linkedText.dataset.graphNodeId;


                console.log(
                  "Clicked linked text:",
                  nodeId
                );


                graphPanelRef.current
                  ?.focusNode(
                    nodeId
                  );

              }}

              onMouseOver={(event) => {

                const linkedText =
                  event.target.closest?.(
                    ".graph-linked-text"
                  );


                if (!linkedText) {
                  return;
                }


                /*
                  Prevent repeated events while moving
                  between descendants of the same span.
                */
                if (
                  event.relatedTarget &&
                  linkedText.contains(
                    event.relatedTarget
                  )
                ) {
                  return;
                }


                graphPanelRef.current
                  ?.setLinkedNodeHover(
                    linkedText.dataset.graphNodeId,

                    linkedText.dataset.graphLinkColor,

                    true
                  );

              }}

              onMouseOut={(event) => {

                const linkedText =
                  event.target.closest?.(
                    ".graph-linked-text"
                  );


                if (!linkedText) {
                  return;
                }


                if (
                  event.relatedTarget &&
                  linkedText.contains(
                    event.relatedTarget
                  )
                ) {
                  return;
                }


                graphPanelRef.current
                  ?.setLinkedNodeHover(
                    linkedText.dataset.graphNodeId,

                    linkedText.dataset.graphLinkColor,

                    false
                  );

              }}

              onInput={() => {
                updateRawNotes();
                updateFormattingState();
              }}

              onMouseUp={() => {
                            updateFormattingState();

                            const selection = window.getSelection();
                            const text = selection?.toString().trim() || "";

                            setSelectedText(text);

                            console.log("Selected text:", text);
                          }}
              onKeyUp={updateFormattingState}
              onFocus={updateFormattingState}
            >


              {contextMenu && (
                <div
                  className="notes-context-menu"

                  contentEditable={false}

                  style={{
                    left: contextMenu.x,
                    top: contextMenu.y,
                  }}

                  onClick={(event) =>
                    event.stopPropagation()
                  }
                >

                  <div className="notes-context-menu-preview">

                    <span>
                      {contextMenu.type === "linked"
                        ? "Graph Link"
                        : "Selected Text"}
                    </span>

                    <strong>
                      {contextMenu.text}
                    </strong>

                  </div>


                  <div className="notes-context-menu-divider" />


                  {contextMenu.type === "new" ? (

                    <>

                      <button
                        type="button"
                        className="notes-context-menu-item"

                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}

                        onClick={(event) => {
                          event.stopPropagation();

                          handleAddSelectedTextToGraph();
                        }}
                      >
                        <CirclePlus
                          size={17}
                          strokeWidth={1.8}
                        />

                        <span>
                          Create as a new node
                        </span>
                      </button>

                      <div className="notes-context-submenu-anchor">

                        <button
                          type="button"

                          className={`notes-context-menu-item ${
                            graphNodeMenuOpen
                              ? "notes-context-menu-item-active"
                              : ""
                          }`}

                          aria-haspopup="menu"
                          aria-expanded={graphNodeMenuOpen}

                          onMouseDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}

                          onClick={(event) => {
                            event.stopPropagation();

                            toggleGraphNodeMenu();
                          }}
                        >
                          <Link
                            size={17}
                            strokeWidth={1.8}
                          />

                          <span>
                            Link to existing node
                          </span>

                          <ChevronRight
                            size={15}
                            strokeWidth={1.8}

                            className={`notes-context-submenu-chevron ${
                              graphNodeMenuOpen
                                ? "notes-context-submenu-chevron-open"
                                : ""
                            }`}
                          />
                        </button>


                        {graphNodeMenuOpen && (

                          <div
                            className="notes-graph-node-menu"

                            contentEditable={false}

                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                            }}

                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                          >

                            <div className="notes-graph-node-menu-heading">
                              Graph Nodes
                            </div>


                            <div className="notes-graph-node-menu-divider" />


                            <div className="notes-graph-node-menu-list">

                              {graphNodeOptions.length > 0 ? (

                                graphNodeOptions.map((node) => (

                                  <button
                                    key={node.id}
                                    type="button"

                                    className="notes-graph-node-menu-item"

                                    onMouseDown={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                    }}

                                    onClick={(event) => {
                                      event.stopPropagation();

                                      handleLinkSelectedTextToExistingNode(
                                        node
                                      );
                                    }}
                                  >

                                    <span>
                                      {node.label}
                                    </span>

                                  </button>

                                ))

                              ) : (

                                <div className="notes-graph-node-menu-empty">
                                  No graph nodes available
                                </div>

                              )}

                            </div>

                          </div>

                        )}

                      </div>

                    </>

                  ) : (

                    <>
                      {/* Linked-text options go here */}

                      <div className="notes-context-color-wrapper">

                        <button
                          type="button"
                          className="notes-context-menu-item"

                          onMouseDown={(event) => {
                            /*
                              Keep the Raw Notes editor from trying
                              to change its selection.
                            */
                            event.preventDefault();
                            event.stopPropagation();
                          }}

                          onClick={(event) => {
                            event.stopPropagation();

                            linkHighlightInputRef.current?.click();
                          }}
                        >

                          <span className="notes-context-highlight-icon">

                            <Highlighter
                              size={17}
                              strokeWidth={1.8}
                            />

                            <span
                              className="notes-context-color-indicator"
                              style={{
                                backgroundColor:
                                  contextMenu.color ||
                                  "#f2c94c",
                              }}
                            />

                          </span>


                          <span>
                            Link highlight
                          </span>

                        </button>


                        <input
                          ref={linkHighlightInputRef}
                          className="notes-context-hidden-color-input"

                          type="color"

                          value={
                            contextMenu.color ||
                            "#f2c94c"
                          }

                          onChange={(event) => {

                            handleGraphLinkColorChange(
                              contextMenu.nodeId,
                              contextMenu.linkId,
                              event.target.value
                            );

                          }}
                        />

                      </div>

                      <div className="notes-context-submenu-anchor">

                        <button
                          type="button"

                          className={`notes-context-menu-item ${
                            graphNodeMenuOpen
                              ? "notes-context-menu-item-active"
                              : ""
                          }`}

                          aria-haspopup="menu"
                          aria-expanded={graphNodeMenuOpen}

                          onMouseDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}

                          onClick={(event) => {
                            event.stopPropagation();

                            toggleGraphNodeMenu();
                          }}
                        >

                          <Replace
                            size={17}
                            strokeWidth={1.8}
                          />

                          <span>
                            Change linked node
                          </span>

                          <ChevronRight
                            size={15}
                            strokeWidth={1.8}

                            className={`notes-context-submenu-chevron ${
                              graphNodeMenuOpen
                                ? "notes-context-submenu-chevron-open"
                                : ""
                            }`}
                          />

                        </button>


                        {graphNodeMenuOpen && (

                          <div
                            className="notes-graph-node-menu"
                            contentEditable={false}

                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                            }}

                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                          >

                            <div className="notes-graph-node-menu-heading">
                              Graph Nodes
                            </div>

                            <div className="notes-graph-node-menu-divider" />


                            <div className="notes-graph-node-menu-list">

                              {graphNodeOptions.length > 0 ? (

                                graphNodeOptions.map((node) => {

                                  const isCurrentNode =
                                    String(node.id) ===
                                    String(contextMenu.nodeId);


                                  return (

                                    <button
                                      key={node.id}
                                      type="button"

                                      className={`notes-graph-node-menu-item ${
                                        isCurrentNode
                                          ? "notes-graph-node-menu-item-current"
                                          : ""
                                      }`}

                                      aria-current={
                                        isCurrentNode
                                          ? "true"
                                          : undefined
                                      }

                                      onMouseDown={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                      }}

                                      onClick={(event) => {
                                        event.stopPropagation();

                                        handleChangeLinkedNode(
                                          node
                                        );
                                      }}
                                    >

                                      <span className="notes-graph-node-menu-item-content">

                                        <span className="notes-graph-node-linked-icon">

                                          {isCurrentNode && (
                                            <Link
                                              size={13}
                                              strokeWidth={2}
                                            />
                                          )}

                                        </span>

                                        <span className="notes-graph-node-menu-label">
                                          {node.label}
                                        </span>

                                      </span>

                                    </button>

                                  );

                                })

                              ) : (

                                <div className="notes-graph-node-menu-empty">
                                  No graph nodes available
                                </div>

                              )}

                            </div>

                          </div>

                        )}

                      </div>

                      <button
                        type="button"

                        className="
                          notes-context-menu-item
                          notes-context-menu-danger
                        "

                        onClick={(event) => {
                          event.stopPropagation();

                          removeGraphTextLink(
                            contextMenu.linkId
                          );
                        }}
                      >
                        <Unlink
                          size={17}
                          strokeWidth={1.8}
                        />

                        <span>
                          Remove graph link
                        </span>
                      </button>

                    </>

                  )}

                </div>
              )}
            </div>

          </div>

        </section>

        {/* << GRAPH / AI CONNECTION >> */}
        {/* Provides current note text to GraphPanel */}
        {/* GraphPanel sends rawNotes to backend / AI */}

        <GraphPanel 
        rawNotes={rawNotes}
        selectedText={selectedText}
        addNodeTrigger={addNodeTrigger}
        noteId={note.id}
        ref={graphPanelRef}


        />
      </div>

      {/* << SUMMARY / AI CONNECTION >> */  }
      {/* Provides current note text to SummaryPanel */}
      {/* SummaryPanel sends rawNotes to backend / AI */}

      <SummaryPanel rawNotes={rawNotes} />
    </div>
  );
});

export default NoteWorkspace;