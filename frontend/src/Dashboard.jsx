import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import DashboardContent from "./components/DashboardContent";
import { useState } from "react";
import NoteWorkspace from "./components/NoteWorkspace"; 

function Dashboard() {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);

  return (
    <main className="dashboard-page">
      <Navbar />

      <div className="dashboard-layout">
        <Sidebar
          expanded={sidebarExpanded}
          onToggle={() => setSidebarExpanded(!sidebarExpanded)}
          onSelectNote={setSelectedNote}
        />

        <section className="dashboard-main">
          {selectedNote ? (
            <NoteWorkspace note={selectedNote} /> ) : 
            (
            <DashboardContent />
            )}
        </section>
      </div>
    </main>
  );
}

export default Dashboard;