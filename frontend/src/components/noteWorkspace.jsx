import {useState} from "react";
import GraphPanel from "./GraphPanel";
import SummaryPanel from "./SummaryPanel";
import "./NoteWorkspace.css";

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
        className="note-title"
      />

      <div className="notes-layout">
        <section className="raw-notes">
          <h2>Raw Notes</h2>

        {/* << frontend dev >> */}
        {/* Stores everything user types into rawnotes state */}
        {/* rawNotes is then provided to Graphpanel and Summarypanel */}


          <textarea
            className="text-area"
            value={rawNotes}
            onChange={(e) => setRawNotes(e.target.value)}
            placeholder="Start writing..."
          />
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