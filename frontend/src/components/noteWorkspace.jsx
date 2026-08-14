import {useState} from "react";
import GraphPanel from "./GraphPanel";
import SummaryPanel from "./SummaryPanel";

function NoteWorkspace({ note }) {


// << frontend dev >> //
  // Stores the current note title //
  const [title, setTitle] = useState(note.title);

  // Stores the current raw note text //
  // This rawNotes value will be shared with HANS AI //
  const [rawNotes, setRawNotes] = useState(note.content);

  return (
    <div className="note-workspace">

    {/* << frontend dev >> */}
    {/* Note title input */}

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="no