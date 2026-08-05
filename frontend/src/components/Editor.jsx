import { useEffect, useRef } from "react";

import {
  createLink,
  createNote,
  deleteNote,
  fetchGraph,
  listNotes,
  updateNote,
} from "../api";

// The prototype is served from public/ so it stays a classic script. Loading it
// as an ES module would put it in strict mode, where its undeclared globals
// (x1, y1) throw a ReferenceError.
// The heading starts out holding this text rather than being empty, so it has
// to be treated as "unfilled" when saving - otherwise notes get saved literally
// titled "Enter your heading".
const PLACEHOLDER_HEADING = "Enter your heading";

// Built with DOM calls rather than rendered as JSX: this component never
// re-renders, because doing so would reconcile away the canvas the prototype
// script owns. Appending to document.body keeps the dialog outside that.
function showError(message, onClose) {
  document.querySelector(".app-modal")?.remove();

  const overlay = document.createElement("div");
  overlay.className = "app-modal";

  const card = document.createElement("div");
  card.className = "app-modal-card";
  card.setAttribute("role", "alertdialog");
  card.setAttribute("aria-modal", "true");

  const title = document.createElement("h2");
  title.textContent = "Error!";

  const body = document.createElement("p");
  // textContent, not innerHTML - the message is never treated as markup.
  body.textContent = message;

  const close = document.createElement("button");
  close.textContent = "Close";

  card.append(title, body, close);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  close.focus();

  function dismiss() {
    overlay.remove();
    document.removeEventListener("keydown", onKeyDown);
    onClose?.();
  }

  function onKeyDown(event) {
    if (event.key === "Escape") dismiss();
  }

  close.addEventListener("click", dismiss);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) dismiss();
  });
  document.addEventListener("keydown", onKeyDown);
}

let scriptPromise = null;

function loadPrototypeScript() {
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/legacy-prototype/script.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Could not load the editor"));
      document.body.appendChild(script);
    });
  }
  return scriptPromise;
}

function Editor() {
  // Held in refs rather than state: the prototype mutates the canvas DOM
  // directly, so this component must never re-render and reconcile it away.
  const noteIdRef = useRef(null);
  const statusRef = useRef(null);
  const groupIdRef = useRef(null);
  const groupPickerRef = useRef(null);
  const linkPickerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/legacy-prototype/style.css";
    document.head.appendChild(link);

    loadPrototypeScript()
      .then(async () => {
        if (cancelled) return;
        window.initPrototype();

        // ?new opens a blank note: the markup already renders an empty canvas,
        // so only the group controls need filling in.
        if (new URLSearchParams(window.location.search).has("new")) {
          await refreshGroupControls();
          return;
        }

        await loadLatestNote();
      })
      .catch((err) => setStatus(err.message));

    return () => {
      cancelled = true;
      link.remove();
    };
  }, []);

  function setStatus(message) {
    if (statusRef.current) statusRef.current.textContent = message;
  }

  // Options are set imperatively for the same reason state is avoided above:
  // re-rendering this component would reconcile away the script-built canvas.
  //
  // Both controls come from one /groups/graph call: it already returns the
  // groups and every note's group, which is all these need.
  async function refreshGroupControls() {
    const graph = await fetchGraph();

    const groupPicker = groupPickerRef.current;
    groupPicker.innerHTML = "";
    groupPicker.appendChild(new Option("Link to a group", ""));
    graph.groups.forEach((group) => {
      const option = new Option(group.name, group.id);
      option.selected = group.id === groupIdRef.current;
      groupPicker.appendChild(option);
    });

    refreshLinkTargets(graph);
  }

  // Only notes sharing this note's group can be linked, which is also the rule
  // the API enforces - so an invalid choice is never offered in the first place.
  function refreshLinkTargets(graph) {
    const picker = linkPickerRef.current;
    picker.innerHTML = "";

    const targets = graph.notes.filter(
      (note) =>
        note.group_id != null &&
        note.group_id === groupIdRef.current &&
        note.id !== noteIdRef.current
    );

    picker.appendChild(new Option("Link a note", ""));
    targets.forEach((note) => picker.appendChild(new Option(note.title, note.id)));
  }

  async function handleGroupChange(event) {
    groupIdRef.current = event.target.value ? Number(event.target.value) : null;

    // Persist immediately for a saved note; an unsaved one picks it up on save.
    if (noteIdRef.current) {
      try {
        await updateNote(noteIdRef.current, { group_id: groupIdRef.current });
      } catch (err) {
        setStatus(err.message);
        return;
      }
    }

    await refreshGroupControls();
  }

  async function handleLink(event) {
    const targetId = Number(event.target.value);
    event.target.value = "";
    if (!targetId) return;

    if (!noteIdRef.current) {
      setStatus("Save this note before linking it");
      return;
    }

    try {
      await createLink(noteIdRef.current, targetId);
      setStatus("Linked");
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function applyNote(note) {
    noteIdRef.current = note.id;
    groupIdRef.current = note.group_id ?? null;
    document.querySelector("#heading div").innerText = note.title;
    document.querySelector("#text .container").innerHTML = note.notes_section ?? "";
    document.getElementById("notesText").innerHTML = note.summary_section ?? "";

    if (note.cue_section) {
      window.restoreCanvas(JSON.parse(note.cue_section));
    } else {
      window.resetCanvas();
    }

    await refreshGroupControls();
    setStatus("");
  }

  // Opens the note named by ?note=<id>, falling back to the most recent one.
  // Read from window.location rather than useSearchParams so this component
  // never subscribes to router state and re-renders.
  async function loadLatestNote() {
    const notes = await listNotes();
    if (!notes.length) {
      await refreshGroupControls();
      setStatus("");
      return;
    }

    const requested = Number(new URLSearchParams(window.location.search).get("note"));
    const note = notes.find((item) => item.id === requested) ?? notes[0];

    await applyNote(note);
  }

  function clearEditor() {
    noteIdRef.current = null;
    groupIdRef.current = null;
    document.querySelector("#heading div").innerText = PLACEHOLDER_HEADING;
    document.querySelector("#text .container").innerHTML = "<p>Text area....</p>";
    document.getElementById("notesText").innerHTML = "";
    window.resetCanvas();
  }

  async function handleNew() {
    clearEditor();
    await refreshGroupControls();
    setStatus("New note - press save to store it");
  }

  async function handleDelete() {
    const id = noteIdRef.current;
    if (!id) {
      setStatus("Nothing to delete - this note isn't saved yet");
      return;
    }

    const heading = document.querySelector("#heading div").innerText.trim();
    if (!window.confirm(`Delete note #${id} "${heading}"? This cannot be undone.`)) {
      return;
    }

    setStatus("Deleting...");
    try {
      await deleteNote(id);
      clearEditor();
      await refreshGroupControls();
      setStatus("Deleted - starting a fresh note");
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function handleSave() {
    const headingEl = document.querySelector("#heading div");
    const heading = headingEl.innerText.trim();

    if (!heading || heading === PLACEHOLDER_HEADING) {
      // Focus moves to the heading only once the dialog is dismissed, so the
      // two do not fight over it.
      showError("You must input a heading", () => headingEl.focus());
      return;
    }

    setStatus("Saving note");
    try {
      const payload = {
        title: heading.slice(0, 255),
        notes_section: document.querySelector("#text .container").innerHTML,
        summary_section: document.getElementById("notesText").innerHTML,
        cue_section: JSON.stringify(window.serializeCanvas()),
        group_id: groupIdRef.current,
      };

      const saved = noteIdRef.current
        ? await updateNote(noteIdRef.current, payload)
        : await createNote(payload);

      noteIdRef.current = saved.id;
      // A newly saved note becomes a link target for its siblings.
      await refreshGroupControls();
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function handleLoad() {
    try {
      await loadLatestNote();
    } catch (err) {
      setStatus(err.message);
    }
  }

  return (
    <>
      <table id="content">
        <tbody>
          <tr>
            <td colSpan="2" id="heading">
              <div contentEditable suppressContentEditableWarning>
                {PLACEHOLDER_HEADING}
              </div>
            </td>
          </tr>
          <tr>
            <td id="text">
              <div className="container" contentEditable suppressContentEditableWarning>
                <p>Text area....</p>
              </div>
            </td>
            <td id="tree">
              {/* A plain div rather than the <td> anchors .canvas-tools: table
                  cells are unreliable as positioned containing blocks. */}
              <div className="canvas-cell">
                {/* Deliberately a sibling of .container, not a child: anything
                    inside the scroll container pans away with the canvas. */}
                <div className="canvas-tools">
                  <button onClick={() => window.createBlockInView()}>➕</button>
                  <button title="Zoom In" onClick={() => window.zoom(1.1)}>🔍</button>
                  <button title="Zoom Out" onClick={() => window.zoom(0.9)}>🔎</button>
                  <button title="Save" onClick={handleSave}>💾</button>
                  <button title="Reload from database" onClick={handleLoad}>⬆️</button>
                  <button title="New note" onClick={handleNew}>📄</button>
                  <button title="Delete this note" onClick={handleDelete}>❌</button>
                  <select
                    ref={groupPickerRef}
                    title="Group this note belongs to"
                    onChange={handleGroupChange}
                    className="note-picker editor-select"
                  ></select>
                  <select
                    ref={linkPickerRef}
                    title="Link to another note in this group"
                    onChange={handleLink}
                    className="note-picker editor-select"
                  ></select>
                  <span ref={statusRef} className="editor-status"></span>
                </div>

                <div className="container">
                  <div id="zoom" className="zoom">
                    <div id="boxes">
                      <div id="1" className="box" contentEditable suppressContentEditableWarning
                        style={{ backgroundColor: "#f1f1f1" }}>
                        Seed
                      </div>
                    </div>

                    <svg id="lines" width="3000px" height="3000px"></svg>
                  </div>
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td id="notes" colSpan="2">
              <div id="notesText" contentEditable suppressContentEditableWarning></div>
            </td>
          </tr>
        </tbody>
      </table>

      <div id="toolbar" className="toolbar">
        <input id="boxColor" type="color" aria-label="Box Color" />
        <button id="addBox">+</button>
        <button id="deleteBox">🗑️</button>
        <div id="link" className="dropdown">
          <button className="dropdown-button">🖇️</button>
          <div className="dropdown-content"></div>
        </div>
      </div>

      <div id="textToolbar" className="toolbar">
        <input id="t_boxColor" type="color" defaultValue="#ffffff" aria-label="Highlight Color" />
        <select id="t_dropdown"></select>
        <button id="t_remove">-</button>
      </div>
    </>
  );
}

export default Editor;
