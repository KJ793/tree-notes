import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import DashboardContent from "./components/DashboardContent";

function Dashboard() {
  return (
    <main className="dashboard-page">
      <Navbar />

      <div className="dashboard-layout">
        <Sidebar />

        <section className="dashboard-main">
          <DashboardContent />
        </section>
      </div>
    </main>
  );
}

export default Dashboard;