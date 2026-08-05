import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import Editor from "./components/Editor";
import GraphPanel from "./components/GraphPanel";

function Dashboard() {
  return (
    <main className="dashboard-page">
      <Navbar />

      <div className="dashboard-layout">
        <Sidebar />

        <section className="dashboard-main">
          <Editor />
          <GraphPanel />
        </section>
      </div>
    </main>
  );
}

export default Dashboard;