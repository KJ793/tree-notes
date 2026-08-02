import GraphPanel from "./GraphPanel";
import SummaryPanel from "./SummaryPanel";

function NoteWorkspace({ note }) {
  return (
    <div className="note-workspace">
      <input
        type="text"
        defaultValue={note.title}
        className="note-title"
      />

      <div className="notes-layout">
        <section className="raw-notes">
          <h2>Raw Notes</h2>

          <textarea
            className="text-area"
            defaultValue={note.content}
            placeholder="Start writing..."
          />
        </section>

        <GraphPanel />
      </div>

      <SummaryPanel />
    </div>
  );
}

export default NoteWorkspace;