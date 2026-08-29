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
 {/* Controls whether the dashboard note list is expanded */}
       <button 
        type="button" className="sidebar-nav-item sidebar-nav-item-active" onClick={onNotesToggle}>
       <House size={18} />
        {!sidebarCollapsed && <span>Dashboard</span>}
        {!sidebarCollapsed && (
          <ChevronRight size={16} className="sidebar-arrow" />
        )}
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
        <div className="sidebar-note-list">
          {/* << TEMPORARY FRONTEND NOTE >> */}
          
          <button
            className="sidebar-note-button"
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
            className="sidebar-note-button"
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

    <button className="sidebar-nav-item">
      <NotebookText size={17} />
      {!sidebarCollapsed && <span>Notes</span>}
    </button>

    <button className="sidebar-nav-item">
      <Network size={17} />
      {!sidebarCollapsed && <span>Graphs</span>}
    </button>

    <button className="sidebar-nav-item ">
      <Tags size={17} />
      {!sidebarCollapsed && <span>Tags</span>}
    </button>

    <button className="sidebar-nav-item ">
      <Settings size={17} />
      {!sidebarCollapsed && <span>Settings</span>}
    </button>



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