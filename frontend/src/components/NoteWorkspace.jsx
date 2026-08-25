import { useRef, useState} from "react";
import GraphPanel from "./GraphPanel";
import SummaryPanel from "./SummaryPanel";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link,
  Info,
} from "lucide-react";

import "./NoteWorkspace.css";

function NoteWorkspace({ note }) {
const editorRef = useRef(null);

// << frontend dev >> //
  // Stores the current note title //
  const [title, setTitle] = useState(note.title);

  // Stores the current raw note text //
  // This rawNotes value will be shared with HANS AI //
  const [rawNotes, setRawNotes] = useState(note.content);

  // Tracks the active text formatting //
  const [activeFormats, setActiveFormats] = useState({
  bold: false,
  italic: false,
  underline: false,

  heading: null,

  bulletList: false,
  numberedList: false,
  });

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

    setRawNotes(editorRef.current.innerText);
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

  return (
    <div className="note-workspace">

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
            <h2>Raw Notes</h2>
            
            <Info
              size={21}
              strokeWidth={2}
              aria-hidden="true"
            />
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
                title="Heading 1"
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
                title="Heading 2"
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
                title="Heading 3"
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
                title="Bold"
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
                title="Italic"
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
                title="Underline"
              >
                <Underline size={18} strokeWidth={2} />
              </button>
              

              <span className="toolbar-divider" />
              
              
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
                title="Bullet list"
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
                title="Numbered list"
              >
                <ListOrdered size={19} strokeWidth={1.9} />
              </button>
              
              
              <span className="toolbar-divider" />
              
              
              {/* Link */}
              
              <button
                type="button"
                className="toolbar-icon-button"
                onClick={addLink}
                title="Insert link"
              >
                <Link size={19} strokeWidth={1.9} />
              </button>
              
            </div>
            
            <div
              ref={editorRef}
              className="text-area raw-notes-content"
              contentEditable
              suppressContentEditableWarning

              onInput={() => {
                updateRawNotes();
                updateFormattingState();
              }}

              onMouseUp={updateFormattingState}
              onKeyUp={updateFormattingState}
              onFocus={updateFormattingState}
            >
              {note.content}
            </div>

          </div>

        </section>

        {/* << GRAPH / AI CONNECTION >> */}
        {/* Provides current note text to GraphPanel */}
        {/* GraphPanel sends rawNotes to backend / AI */}

        <GraphPanel rawNotes={rawNotes}/>
      </div>

      {/* << SUMMARY / AI CONNECTION >> */  }
      {/* Provides current note text to SummaryPanel */}
      {/* SummaryPanel sends rawNotes to backend / AI */}

      <SummaryPanel rawNotes={rawNotes} />
    </div>
  );
}

export default NoteWorkspace;