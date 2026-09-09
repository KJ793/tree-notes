import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import DashboardContent from "./components/DashboardContent";
import NoteWorkspace from "./components/NoteWorkspace";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  getNotes,
  createNote,
  deleteNote,
} from "./api/notesApi";


function Dashboard() {

  // =========================================================
  // SIDEBAR STATE
  // =========================================================

  const [notesExpanded, setNotesExpanded] =
    useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);


  // =========================================================
  // NOTES STATE
  // =========================================================

  // Stores all notes belonging to the user
  const [notes, setNotes] =
    useState([]);

  // Stores the ID of the note currently being viewed
  const [selectedNoteId, setSelectedNoteId] =
    useState(null);

  // Optional loading state while notes are being retrieved
  const [notesLoading, setNotesLoading] =
    useState(true);


  /*
    Find the complete selected note object
    from its ID.

    This means if the note is renamed/saved,
    Dashboard always gets the newest version
    from the notes array.
  */
  const selectedNote =
    notes.find(
      (note) =>
        note.id === selectedNoteId
    ) ?? null;


  // =========================================================
  // WORKSPACE REFERENCE
  // =========================================================

  // Workspace reference used by Navbar Save button
  const noteWorkspaceRef =
    useRef(null);


  // =========================================================
  // LOAD NOTES
  // =========================================================

  useEffect(() => {

    async function loadNotes() {

      try {

        const loadedNotes =
          await getNotes();


        setNotes(
          loadedNotes
        );


        /*
          Do not automatically open the first note.

          This preserves your current behaviour where
          DashboardContent is shown until the user
          chooses a note.

          If you later want the first note to open
          automatically, we can change this.
        */

      } catch (error) {

        console.error(
          "Unable to load notes:",
          error
        );

      } finally {

        setNotesLoading(false);

      }
    }


    loadNotes();

  }, []);


  // =========================================================
  // SELECT NOTE
  // =========================================================

  function handleSelectNote(noteId) {

    setSelectedNoteId(
      noteId
    );

  }


  // =========================================================
  // CREATE NOTE
  // =========================================================

  async function handleCreateNote() {

    try {

      const newNote =
        await createNote();


      /*
        Add the new note to the sidebar list.
      */
      setNotes((currentNotes) => [
        ...currentNotes,
        newNote,
      ]);


      /*
        Automatically open the new note.
      */
      setSelectedNoteId(
        newNote.id
      );


      /*
        Make sure the notes dropdown is visible.
      */
      setNotesExpanded(true);

    } catch (error) {

      console.error(
        "Unable to create note:",
        error
      );

    }
  }


  // =========================================================
  // DELETE NOTE
  // =========================================================

  async function handleDeleteNote(noteId) {

    try {

      /*
        Delete from mock storage / future backend first.
      */
      await deleteNote(
        noteId
      );


      /*
        Work out which note should be selected afterwards.
      */
      const deletedIndex =
        notes.findIndex(
          (note) =>
            note.id === noteId
        );


      const remainingNotes =
        notes.filter(
          (note) =>
            note.id !== noteId
        );


      setNotes(
        remainingNotes
      );


      /*
        Only change the selected note if
        the user deleted the note currently open.
      */
      if (
        selectedNoteId === noteId
      ) {

        /*
          Prefer the note that came after the deleted
          note. If none exists, use the previous note.

          If no notes remain, selectedNote becomes null
          and DashboardContent appears again.
        */
        const nextNote =
          remainingNotes[deletedIndex] ??
          remainingNotes[deletedIndex - 1] ??
          null;


        setSelectedNoteId(
          nextNote?.id ?? null
        );
      }

    } catch (error) {

      console.error(
        "Unable to delete note:",
        error
      );


      /*
        Important:

        Let Sidebar know the deletion failed so
        its confirmation modal can display an error.
      */
      throw error;

    }
  }


  // =========================================================
  // NOTE SAVED
  // =========================================================

  function handleNoteSaved(savedNote) {

    /*
      Replace the old note in Dashboard state with
      the version returned by notesApi.

      This means title changes immediately appear
      in the Sidebar after pressing Save.
    */
    setNotes((currentNotes) =>
      currentNotes.map(
        (note) =>
          note.id === savedNote.id
            ? savedNote
            : note
      )
    );

  }


  // =========================================================
  // PAGE
  // =========================================================

  return (

    <main className="dashboard-page">

      <Navbar
        onSave={() => {
          noteWorkspaceRef.current
            ?.saveEverything();
        }}
      />


      <div className="dashboard-layout">

        <Sidebar

          // Notes dropdown
          notesExpanded={notesExpanded}

          onNotesToggle={() =>
            setNotesExpanded(
              (current) =>
                !current
            )
          }


          // Dynamic notes
          notes={notes}

          selectedNoteId={
            selectedNoteId
          }

          onSelectNote={
            handleSelectNote
          }

          onCreateNote={
            handleCreateNote
          }

          onDeleteNote={
            handleDeleteNote
          }


          // Sidebar collapse
          sidebarCollapsed={
            sidebarCollapsed
          }

          onSidebarToggle={() =>
            setSidebarCollapsed(
              (current) =>
                !current
            )
          }

        />


        <section className="dashboard-main">

          {notesLoading ? (

            <div className="dashboard-loading">
              Loading notes...
            </div>

          ) : selectedNote ? (

            <NoteWorkspace

              /*
                Force React to initialise a fresh
                workspace when switching notes.
              */
              key={selectedNote.id}

              note={
                selectedNote
              }

              ref={
                noteWorkspaceRef
              }

              onNoteSaved={
                handleNoteSaved
              }

            />

          ) : (

            <DashboardContent />

          )}

        </section>

      </div>

    </main>

  );

}


export default Dashboard;