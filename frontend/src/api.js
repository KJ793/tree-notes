const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function login(email, password) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error("Invalid email or password");
  }

  return response.json();
}

export async function listNotes() {
  const response = await fetch(`${API_URL}/notes/`);

  if (!response.ok) {
    throw new Error("Could not load notes");
  }

  return response.json();
}

export async function createNote(payload) {
  const response = await fetch(`${API_URL}/notes/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Could not save note");
  }

  return response.json();
}

export async function deleteNote(id) {
  const response = await fetch(`${API_URL}/notes/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Could not delete note");
  }
}

export async function fetchGraph() {
  const response = await fetch(`${API_URL}/groups/graph`);

  if (!response.ok) {
    throw new Error("Could not load the graph");
  }

  return response.json();
}

export async function listGroups() {
  const response = await fetch(`${API_URL}/groups/`);

  if (!response.ok) {
    throw new Error("Could not load groups");
  }

  return response.json();
}

export async function createGroup(name, parentId = null) {
  const response = await fetch(`${API_URL}/groups/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, parent_id: parentId }),
  });

  // The API explains why a group was rejected - a duplicate name, an empty
  // one - and that message is more useful than a generic failure.
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? "Could not create the group");
  }

  return response.json();
}

export async function deleteGroup(id) {
  const response = await fetch(`${API_URL}/groups/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? "Could not delete the group");
  }
}

export async function createLink(noteAId, noteBId) {
  const response = await fetch(`${API_URL}/groups/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note_a_id: noteAId, note_b_id: noteBId }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? "Could not link the notes");
  }

  return response.json();
}

export async function updateNote(id, payload) {
  const response = await fetch(`${API_URL}/notes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Could not save note");
  }

  return response.json();
}
