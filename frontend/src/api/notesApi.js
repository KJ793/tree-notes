const USE_MOCK_NOTES = true;

const STORAGE_KEY = "treenotes-dev-notes";

const MOCK_DEFAULT_NOTES = [
  {
    id: "note-treenotes-intro",

    title:
      "Introduction to TreeNotes",

    content:
      "TreeNotes is an open-source note-taking application.",

    notes_section:
      "TreeNotes is an open-source note-taking application.",

    notes_section_html:
      "<p>TreeNotes is an open-source note-taking application.</p>",

    summary: "",

    created_at:
      "2026-09-08T00:00:00.000Z",

    updated_at:
      "2026-09-08T00:00:00.000Z",
  },

  {
    id: "note-llms-intro",

    title:
      "Introduction to LLMs",

    content:
      "Large language models can process and generate text.",

    notes_section:
      "Large language models can process and generate text.",

    notes_section_html:
      "<p>Large language models can process and generate text.</p>",

    summary: "",

    created_at:
      "2026-09-08T00:00:00.000Z",

    updated_at:
      "2026-09-08T00:00:00.000Z",
  },
];

function normaliseNote(note) {
  const plainText =
    note.notes_section ??
    note.content ??
    "";

  return {
    ...note,

    title:
      note.title ||
      "Untitled Note",

    content: plainText,
    notes_section: plainText,

    notes_section_html:
      note.notes_section_html ??
      "",

    summary:
      note.summary ??
      "",
  };
}


/* =========================================================
   MOCK STORAGE
   ========================================================= */

function readMockNotes() {

  const stored =
    localStorage.getItem(
      STORAGE_KEY
    );


  /*
    If this key has NEVER existed,
    initialise the mock database using
    our two template notes.
  */
  if (stored === null) {

    const initialNotes =
      MOCK_DEFAULT_NOTES.map(
        normaliseNote
      );


    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        initialNotes
      )
    );


    return initialNotes;
  }


  /*
    Otherwise load whatever the user
    currently has saved.

    This includes an empty array.
    We must NOT recreate templates just
    because all notes were deleted.
  */
  try {

    return JSON
      .parse(stored)
      .map(normaliseNote);

  } catch (error) {

    console.error(
      "Unable to read mock notes:",
      error
    );


    return [];
  }
}


function writeMockNotes(notes) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(notes)
  );
}


/* =========================================================
   LIST NOTES
   ========================================================= */

export async function getNotes() {

  if (USE_MOCK_NOTES) {
    return readMockNotes();
  }


  const response =
    await fetch("/api/notes", {
      credentials: "include",
    });


  if (!response.ok) {
    throw new Error(
      "Unable to load notes."
    );
  }


  const data =
    await response.json();


  return (
    data.notes ??
    data
  ).map(normaliseNote);
}


/* =========================================================
   CREATE NOTE
   ========================================================= */

export async function createNote() {

  if (USE_MOCK_NOTES) {

    const note = normaliseNote({
      id:
        crypto.randomUUID?.() ??
        `local-${Date.now()}`,

      title: "Untitled Note",

      notes_section: "",
      notes_section_html: "",

      summary: "",

      created_at:
        new Date().toISOString(),

      updated_at:
        new Date().toISOString(),
    });


    const notes =
      readMockNotes();


    writeMockNotes([
      ...notes,
      note,
    ]);


    return note;
  }


  const response =
    await fetch("/api/notes", {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      credentials: "include",

      body: JSON.stringify({
        title: "Untitled Note",
        notes_section: "",
        notes_section_html: "",
      }),
    });


  if (!response.ok) {
    throw new Error(
      "Unable to create note."
    );
  }


  const data =
    await response.json();


  return normaliseNote(
    data.note ?? data
  );
}


/* =========================================================
   UPDATE NOTE
   ========================================================= */

export async function updateNote(
  noteId,
  updates
) {

  if (USE_MOCK_NOTES) {

    let updatedNote = null;


    const notes =
      readMockNotes().map((note) => {

        if (note.id !== noteId) {
          return note;
        }


        updatedNote =
          normaliseNote({
            ...note,
            ...updates,

            updated_at:
              new Date().toISOString(),
          });


        return updatedNote;
      });


    writeMockNotes(notes);

    return updatedNote;
  }


  const response =
    await fetch(
      `/api/notes/${noteId}`,
      {
        method: "PATCH",

        headers: {
          "Content-Type":
            "application/json",
        },

        credentials: "include",

        body:
          JSON.stringify(updates),
      }
    );


  if (!response.ok) {
    throw new Error(
      "Unable to save note."
    );
  }


  const data =
    await response.json();


  return normaliseNote(
    data.note ?? data
  );
}


/* =========================================================
   DELETE NOTE
   ========================================================= */

export async function deleteNote(noteId) {

  if (USE_MOCK_NOTES) {

    const notes =
      readMockNotes().filter(
        (note) =>
          note.id !== noteId
      );


    writeMockNotes(notes);

    return;
  }


  const response =
    await fetch(
      `/api/notes/${noteId}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );


  if (!response.ok) {
    throw new Error(
      "Unable to delete note."
    );
  }
}