import {
  House,
  NotebookText,
  Network,
  Search,
  Tags,
  Settings,
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
} from "lucide-react";


function Sidebar({
  notesExpanded,
  onNotesToggle,
  sidebarCollapsed,
  onSidebarToggle,
  onSelectNote,
}) {
  return (
   <aside
  className={`sidebar ${
    sidebarCollapsed
      ? "sidebar-collapsed"
      : "sidebar-expanded"
  }`}
  
>

    
    
{/* << FRONTEND DEV >> */}
      <h2>TreeNotes</h2>

 {/* << FRONTEND DEV >> */}
 {/* Controls whether the dashboard note list is expanded */}
      <button type="button" onClick={onNotesToggle}>
        Dashboard
      </button>     


    {/* << NOTES DATA CONNECTION >> */}
    {/* Backend should provide the user's saved notes */}
      {/* Expected note structure:
          {
            id: number/string,
            title: string,
            content: string
          }
      */}

      {notesExpanded && (
        <div>
          {/* << TEMPORARY FRONTEND NOTE >> */}
          
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

    {/* << FRONTEND NAVIGATION >> */}
    {/* These buttons will later connect to their pages /routes */}

      <button>Notes</button>
      <button>Graph</button>
      <button>Search</button>
      <button>Tags</button>
      <button>Settings</button>



    {/* << FRONTEND DEV >> */}
    {/* Controls the width / collapsed state of the entire sidebar */}

      <button
      className="sidebar-toggle-button"
      type="button"
      onClick={onSidebarToggle}
      >
        {sidebarCollapsed ? (
            <ChevronsRight size={20} strokeWidth={1.8} />
        ) : (
            <>
            <ChevronLeft size={19} strokeWidth={1.8} />
            <span>Collapse</span>
            </>
        )}

      </button>
    </aside>
  );
}

export default Sidebar;
