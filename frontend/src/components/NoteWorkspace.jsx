import { 
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState, 
} from "react";
import GraphPanel from "./GraphPanel";
import SummaryPanel from "./SummaryPanel";
import SearchBar from "./SearchBar";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link,
  Info,
  Network,
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
} from "lucide-react";

import "./NoteWorkspace.css";

/* =========================================================
   BACKEND / AI INTEGRATION
   ========================================================= */


// Backend / AI
// Function for semantic/fuzzy searching Raw Notes
async function semanticSearchRawNotes(
  searchTerm,
  rawNotes
) {
  /*
    HANS / BACKEND TODO:

    Send the user's semantic search query together with
    the current Raw Notes to the AI/backend.

    Frontend provides:

    {
      searchTerm: string,
      rawNotes: string
    }


    Example future API request:

    const response = await fetch(
      "/api/ai/semantic-search",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          search_input: searchTerm,
          rawNotes: rawNotes,
        }),
      }
    );


    if (!response.ok) {
      throw new Error(
        "Semantic search failed."
      );
    }


    return await response.json();


    Suggested backend response:

    {
      result:
        "Python functions are described in the section about reusable blocks of code."
    }
  */


  // Temporary frontend mock response
  // until Hans connects the AI/backend.
  return {
    backendConnected: false,

    result:
      `Semantic search requested for "${searchTerm}". AI backend still needs to be connected.`,
  };
}

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

// << AI SEMANTIC SEARCH >> //

// Text returned from semantic search
const [semanticSearchResult, setSemanticSearchResult] =
  useState("");

// Shows whether AI search is currently running
const [semanticSearchLoading, setSemanticSearchLoading] =
  useState(false);

// Stores errors returned from semantic search
const [semanticSearchError, setSemanticSearchError] =
  useState("");

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
   Semantic Search
   --------------------------------------------------------- */

  async function handleSemanticSearch(
      searchTerm
    ) {
      setSemanticSearchLoading(true);
      setSemanticSearchError("");
      setSemanticSearchResult("");


      try {

        const response =
          await semanticSearchRawNotes(
            searchTerm,
            rawNotes
          );


        if (response?.result) {
          setSemanticSearchResult(
            response.result
          );
        }


      } catch (error) {

        console.error(
          "Semantic search error:",
          error
        );


        setSemanticSearchError(
          "Unable to complete semantic search."
        );


      } finally {

        setSemanticSearchLoading(false);

      }
    }

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
      "Changing graph link colour:",
      {
        nodeId,
        linkId,
        color,
      }
    );


    // =====================================================
    // UPDATE RAW NOTES LINK
    // =====================================================

    const linkedSpans =
      editorRef.current.querySelectorAll(
        ".graph-linked-text"
      );


    linkedSpans.forEach((span) => {

      /*
        Update everything connected to this graph node.

        This means if the same node is referenced more
        than once in Raw Notes, they all keep the same
        intrinsic link colour.
      */

      if (
        span.dataset.graphNodeId !==
        String(nodeId)
      ) {
        return;
      }


      span.dataset.graphLinkColor =
        color;


      span.style.setProperty(
        "--graph-link-color",
        color
      );


      /*
        Also set a concrete fallback background.

        This makes the colour visibly update even if
        color-mix() behaves unexpectedly.
      */
      span.style.backgroundColor =
        hexToRgba(
          color,
          0.38
        );
    });


    // =====================================================
    // UPDATE GRAPH NODE LINK COLOUR
    // =====================================================

    graphPanelRef.current
      ?.setLinkedNodeColor(
        nodeId,
        color
      );


    // =====================================================
    // UPDATE OPEN CONTEXT MENU
    // =====================================================

    setContextMenu((current) => {

      if (!current) {
        return current;
      }


      return {
        ...current,
        color: color,
      };

    });


    // Preserve rich-note data
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
      onClick={() => setContextMenu(null)}
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


            <div className="semantic-search-area">

              {semanticSearchLoading && (
                <span className="semantic-search-status">
                  Searching...
                </span>
              )}


              {!semanticSearchLoading &&
                semanticSearchResult && (
                  <span className="semantic-search-result">
                    {semanticSearchResult}
                  </span>
                )}


              {!semanticSearchLoading &&
                semanticSearchError && (
                  <span className="semantic-search-error">
                    {semanticSearchError}
                  </span>
                )}


              <SearchBar
                placeholder="Semantic search..."
                ariaLabel="Semantic search raw notes"
                onSearch={handleSemanticSearch}
                loading={semanticSearchLoading}
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


                selectedRangeRef.current =
                  range.cloneRange();


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
                      <Network
                        size={17}
                        strokeWidth={1.8}
                      />

                      <span>
                        Add to Graph
                      </span>
                    </button>

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