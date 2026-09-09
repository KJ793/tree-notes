import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import ProfileContent from "./components/ProfileContent";
import { useState } from "react";

function Profile() {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  return (
    <main className="dashboard-page">
      <Navbar />

      <div className="dashboard-layout">
        <Sidebar
          expanded={sidebarExpanded}
          onToggle={() => setSidebarExpanded((current) => !current)}
          onSelectNote={() => {}}
        />

        <section className="dashboard-main">
          <ProfileContent />
        </section>
      </div>
    </main>
  );
}

export default Profile;