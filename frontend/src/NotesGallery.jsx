import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import NoteCard from "./components/NoteCard";
import { deleteNote, listGroups, listNotes } from "./api";

function NotesGallery() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [groups, setGroups] = useState([]);
  const [status, setStatus] = useState("Loading notes...");
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [openGroup, setOpenGroup] = useState(null);

  const load = useCallback(async () => {
    // Notes carry only group_id, so the groups are needed to name them.
    const [noteData, groupData] = await Promise.all([listNotes(), listGroups()]);
    setNotes(noteData);
    setGroups(groupData);
    setStatus(noteData.length ? "" : "No saved notes yet");
  }, []);

  useEffect(() => {
    let cancelled = false;

    load().catch((err) => {
      if (!cancelled) setStatus(err.message);
    });

    return () => {
      cancelled = true;
    };
  }, [load]);

  // One section per group, ordered by name. Notes without a group are kept
  // separate: they are shown on the page rather than behind a tile.
  const { sections, unfiled } = useMemo(() => {
    const known = new Set(groups.map((group) => group.id));
    const byGroup = new Map();
    const loose = [];

    notes.forEach((note) => {
      // A group_id with no matching group would otherwise drop the note from
      // the page entirely, so treat it as unfiled rather than losing it.
      const filed = note.group_id != null && known.has(note.group_id);
      if (!filed) {
        loose.push(note);
        return;
      }
      if (!byGroup.has(note.group_id)) byGroup.set(note.group_id, []);
      byGroup.get(note.group_id).push(note);
    });

    return {
      sections: [...groups]
        .sort((a, b) => a.name.localeCompare(b.name))
        .filter((group) => byGroup.has(group.id))
        .map((group) => ({
          key: group.id,
          name: group.name,
          notes: byGroup.get(group.id),
        })),
      unfiled: loose,
    };
  }, [notes, groups]);

  // Looked up rather than stored: deleting the last note in a group removes its
  // section, and a stale id would leave the page rendering nothing.
  const openSection = sections.find((section) => section.key === openGroup) ?? null;

  function stopEditing() {
    setEditing(false);
    setSelected(new Set());
  }

  function toggleSelected(id) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDeleteSelected() {
    const ids = [...selected];
    if (!ids.length) return;

    const label = ids.length === 1 ? "this note" : `these ${ids.length} notes`;
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;

    setStatus("Deleting...");
    try {
      // Sequential rather than Promise.all: a partial failure part-way through
      // still leaves the earlier deletes done, and the reload below shows
      // exactly what survived instead of an ambiguous half-state.
      for (const id of ids) {
        await deleteNote(id);
      }
      stopEditing();
      await load();
    } catch (err) {
      setStatus(err.message);
      await load();
    }
  }

  return (
    <main className="dashboard-page">
      <Navbar />

      <div className="dashboard-layout">
        <Sidebar />

        <section className="dashboard-main">
          <div className="notes-gallery">
            <div className="notes-gallery-header">
              <div>
                <h1>
                  Your <span className="brand-accent">Notes</span>
                </h1>
                <p className="notes-gallery-subtitle">
                  {editing
                    ? "Select the notes you want to remove."
                    : notes.length
                      ? `${notes.length} saved ${
                          notes.length === 1 ? "note" : "notes"
                        } - open a group to see what is inside`
                      : "Notes you save will appear here"}
                </p>
              </div>

              <div className="notes-gallery-actions">
                {editing ? (
                  <>
                    <button
                      className="gallery-danger"
                      onClick={handleDeleteSelected}
                      disabled={!selected.size}
                    >
                      Delete{selected.size ? ` (${selected.size})` : ""}
                    </button>
                    <button onClick={stopEditing}>Done</button>
                  </>
                ) : (
                  <button
                    className="gallery-primary"
                    onClick={() => setEditing(true)}
                    disabled={!notes.length}
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>

            {status && <p className="notes-gallery-status">{status}</p>}

            {/* Ungrouped notes sit on the page beside the create tile rather
                than behind a tile of their own. */}
            <div className="notes-gallery-grid">
              {/* Hidden while editing: it is not something that can be selected
                  or deleted, so it would only be a target for misclicks. */}
              {!editing && (
                <button
                  className="note-card new-note-card"
                  onClick={() => navigate("/dashboard?new=1")}
                  /* The visible label is gone, so the button needs a name of its
                     own - a lone "+" tells a screen reader nothing. */
                  aria-label="Create a new note"
                >
                  <div className="new-note-preview">
                    <span className="new-note-icon">+</span>
                  </div>
                </button>
              )}

              {unfiled.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  selectable={editing}
                  selected={selected.has(note.id)}
                  onOpen={(id) =>
                    editing ? toggleSelected(id) : navigate(`/dashboard?note=${id}`)
                  }
                />
              ))}
            </div>

            <div className="group-tiles">
              {sections.map((section) => (
                <button
                  key={section.key}
                  className={
                    section.key === openGroup ? "group-tile is-open" : "group-tile"
                  }
                  onClick={() =>
                    setOpenGroup(section.key === openGroup ? null : section.key)
                  }
                  aria-expanded={section.key === openGroup}
                >
                  <span className="group-tile-name">{section.name}</span>
                  <span className="group-tile-count">{section.notes.length}</span>
                </button>
              ))}
            </div>

            {openSection && (
              <section className="notes-section">
                <h2 className="notes-section-title">
                  {openSection.name}
                  <span>{openSection.notes.length}</span>
                </h2>

                <div className="notes-gallery-grid">
                  {openSection.notes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      groupName={openSection.name}
                      selectable={editing}
                      selected={selected.has(note.id)}
                      onOpen={(id) =>
                        editing ? toggleSelected(id) : navigate(`/dashboard?note=${id}`)
                      }
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default NotesGallery;
