function Sidebar({ expanded, onToggle, onSelectNote }) {
  return (
    <aside className="sidebar">
      <h2>TreeNotes</h2>

      <button onClick={onToggle}>
        Dashboard
      </button>

      {expanded && (
        <div>
          <button
            onClick={() =>
              onSelectNote({
                id: 1,
                title: "Introduction to TreeNotes",
                content:
                  "TreeNotes is an open-source note-taking application.",
              })
            }
          >
            Introduction to TreeNotes
          </button>

          <button
            onClick={() =>
              onSelectNote({
                id: 2,
                title: "Introduction to LLMs",
                content:
                  "Large language models can process and generate text.",
              })
            }
          >
            Introduction to LLMs
          </button>
        </div>
      )}

      <button>Notes</button>
      <button>Graph</button>
      <button>Search</button>
      <button>Tags</button>
      <button>Settings</button>
    </aside>
  );
}

export default Sidebar;
