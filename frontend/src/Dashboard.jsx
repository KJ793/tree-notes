import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import DashboardContent from "./components/DashboardContent";
import { useState, useRef} from "react";
import NoteWorkspace from "./components/NoteWorkspace"; 

function Dashboard() {
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
// workspace refrence for save button
  const noteWorkspaceRef = useRef(null);

  return (
    <main className="dashboard-page">
      <Navbar
      onSave={() => {
      noteWorkspaceRef.current?.saveEverything();
      }}
      />

      <div className="dashboard-layout">
        <Sidebar
        notesExpanded={notesExpanded}
        onNotesToggle={() =>
            setNotesExpanded((current) => !current)
        }
        onSelectNote={setSelectedNote}

        sidebarCollapsed={sidebarCollapsed}
        onSidebarToggle={() =>
            setSidebarCollapsed((current) => !current)
        }

        />

        <section className="dashboard-main">
          {selectedNote ? (
            <NoteWorkspace 
            note={selectedNote}
            ref={noteWorkspaceRef}
            /> ) : 
            (
            <DashboardContent />
            )}
        </section>
      </div>
    </main>
  );
}

export default Dashboard;