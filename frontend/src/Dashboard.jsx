import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import DashboardHeader from "./components/DashboardHeader";
import DashboardContent from "./components/DashboardContent";

function Dashboard() {
  return (
    <main className="dashboard-page">
      <Navbar />

      <div className="dashboard-layout">
        <Sidebar />

        <section className="dashboard-main">
          <DashboardHeader />

          <p className="dashboard-welcome">Welcome back!</p>

          <DashboardContent />
        </section>
      </div>
    </main>
  );
}

export default Dashboard;