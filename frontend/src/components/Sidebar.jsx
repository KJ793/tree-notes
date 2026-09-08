import {
  House,
  NotebookText,
  Network,
  Tags,
  Settings,
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { useState } from "react";


function Sidebar({
  notesExpanded,
  onNotesToggle,

  notes,
  selectedNoteId,
  onSelectNote,
  onCreateNote,
  onDeleteNote,

  sidebarCollapsed,
  onSidebarToggle,
}) {

  const [noteToDelete, setNoteToDelete] =
    useState(null);

  const [deleteLoading, setDeleteLoading] =
    useState(false);

  const [deleteError, setDeleteError] =
    useState("");


  async function handleConfirmDelete() {

    if (!noteToDelete) {
      return;
    }

    setDeleteLoading(true);
    setDeleteError("");

    try {

      await onDeleteNote(
        noteToDelete.id
      );

      setNoteToDelete(null);

    } catch (error) {

      console.error(
        "Unable to delete note:",
        error
      );

      setDeleteError(
        "Unable to delete this note. Please try again."
      );

    } finally {

      setDeleteLoading(false);

    }

  }


  return (

    <>
      {/* ==================================================
          SIDEBAR
          ================================================== */}

      <aside
        className={`sidebar ${
          sidebarCollapsed
            ? "sidebar-collapsed"
            : "sidebar-expanded"
        }`}
      >


        {/* ==================================================
            DASHBOARD
            ================================================== */}

        <button
          type="button"
          className="sidebar-nav-item sidebar-nav-item-active"
          onClick={onNotesToggle}
        >

          <House
            size={18}
            strokeWidth={1.8}
          />


          {!sidebarCollapsed && (
            <>
              <span>
                Dashboard
              </span>

              <ChevronRight
                size={16}
                strokeWidth={1.8}
                className={`sidebar-arrow ${
                  notesExpanded
                    ? "sidebar-arrow-expanded"
                    : ""
                }`}
              />
            </>
          )}

        </button>



        {/* ==================================================
            NOTES LIST
            ================================================== */}

        {notesExpanded &&
          !sidebarCollapsed && (

          <div className="sidebar-note-list">

            <div className="sidebar-note-scroll">

              {notes.length > 0 ? (

                notes.map((note) => {

                  const isSelected =
                    note.id === selectedNoteId;


                  return (

                    <div
                      key={note.id}
                      className={`sidebar-note-row ${
                        isSelected
                          ? "sidebar-note-row-active"
                          : ""
                      }`}
                    >

                      <button
                        type="button"

                        className={`sidebar-note-button ${
                          isSelected
                            ? "sidebar-note-button-active"
                            : ""
                        }`}

                        onClick={() =>
                          onSelectNote(note.id)
                        }

                        title={
                          note.title ||
                          "Untitled Note"
                        }
                      >

                        <span className="sidebar-note-title">

                          {note.title ||
                            "Untitled Note"}

                        </span>

                      </button>


                      <button
                        type="button"

                        className="sidebar-note-delete-button"

                        aria-label={`Delete ${
                          note.title ||
                          "Untitled Note"
                        }`}

                        data-tooltip="Delete note"

                        onClick={(event) => {

                          event.stopPropagation();

                          setDeleteError("");

                          setNoteToDelete(
                            note
                          );

                        }}
                      >

                        <Trash2
                          size={14}
                          strokeWidth={1.8}
                        />

                      </button>

                    </div>

                  );

                })

              ) : (

                <div className="sidebar-note-empty">

                  No notes yet

                </div>

              )}

            </div>



            {/* ==================================================
                CREATE NOTE
                ================================================== */}

            <button
              type="button"
              className="sidebar-new-note-button"
              onClick={onCreateNote}
            >

              <Plus
                size={15}
                strokeWidth={2}
              />

              <span>
                New Note
              </span>

            </button>

          </div>

        )}



        {/* ==================================================
            FRONTEND NAVIGATION
            ================================================== */}

        <button
          type="button"
          className="sidebar-nav-item"
        >

          <NotebookText
            size={17}
            strokeWidth={1.8}
          />

          {!sidebarCollapsed && (
            <span>
              Notes
            </span>
          )}

        </button>


        <button
          type="button"
          className="sidebar-nav-item"
        >

          <Network
            size={17}
            strokeWidth={1.8}
          />

          {!sidebarCollapsed && (
            <span>
              Graphs
            </span>
          )}

        </button>


        <button
          type="button"
          className="sidebar-nav-item"
        >

          <Tags
            size={17}
            strokeWidth={1.8}
          />

          {!sidebarCollapsed && (
            <span>
              Tags
            </span>
          )}

        </button>


        <button
          type="button"
          className="sidebar-nav-item"
        >

          <Settings
            size={17}
            strokeWidth={1.8}
          />

          {!sidebarCollapsed && (
            <span>
              Settings
            </span>
          )}

        </button>



        {/* ==================================================
            COLLAPSE SIDEBAR
            ================================================== */}

        <button
          className="sidebar-toggle-button"
          type="button"
          onClick={onSidebarToggle}
        >

          {sidebarCollapsed ? (

            <ChevronsRight
              size={20}
              strokeWidth={1.8}
            />

          ) : (

            <>
              <ChevronLeft
                size={19}
                strokeWidth={1.8}
              />

              <span>
                Collapse
              </span>
            </>

          )}

        </button>

      </aside>



      {/* ==================================================
          DELETE NOTE CONFIRMATION MODAL
          ================================================== */}

      {noteToDelete && (

        <div
          className="note-delete-backdrop"

          onMouseDown={() => {

            if (!deleteLoading) {
              setNoteToDelete(null);
            }

          }}
        >

          <section
            className="note-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-note-title"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            {/* ==============================
                MODAL HEADER
                ============================== */}

            <div className="note-delete-modal-header">

              <div className="note-delete-modal-heading">

                <span className="note-delete-eyebrow">
                  DELETE NOTE
                </span>

                <h2 id="delete-note-title">
                  Delete note
                </h2>

                <p className="note-delete-subtitle">
                  Permanently remove this note from your
                  TreeNotes account.
                </p>

              </div>


              <button
                type="button"
                className="secondary-action modal-close-button"
                aria-label="Close delete note dialog"
                disabled={deleteLoading}
                onClick={() =>
                  setNoteToDelete(null)
                }
              >
                <X
                  size={18}
                  strokeWidth={1.8}
                />
              </button>

            </div>


            {/* ==============================
                MODAL BODY
                ============================== */}

            <div className="note-delete-modal-body">

              <p>
                Are you sure you want to delete{" "}
                <strong>
                  {noteToDelete.title ||
                    "Untitled Note"}
                </strong>
                ?
              </p>

              <p className="note-delete-warning">
                Its saved notes, graph and summary will
                also be permanently deleted. This action
                cannot be undone.
              </p>


              {deleteError && (

                <p className="note-delete-error">
                  {deleteError}
                </p>

              )}

            </div>


            {/* ==============================
                MODAL ACTIONS
                ============================== */}

            <div className="note-delete-modal-actions">

              <button
                type="button"
                className="secondary-action"
                disabled={deleteLoading}
                onClick={() =>
                  setNoteToDelete(null)
                }
              >
                Cancel
              </button>


              <button
                type="button"
                className="danger-action"
                disabled={deleteLoading}
                onClick={handleConfirmDelete}
              >
                {deleteLoading
                  ? "Deleting..."
                  : "Delete note"}
              </button>

            </div>

          </section>

        </div>

      )}

    </>

  );

}


export default Sidebar;