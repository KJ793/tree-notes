import { useNavigate } from "react-router-dom";

function DashboardHeader() {
  const navigate = useNavigate();

  function handleNewNote() {
    navigate("/notes");
  }

  return (
    <header>
      <h1>Dashboard</h1>
      <button onClick={handleNewNote}>New Note</button>
    </header>
  );
}

export default DashboardHeader;
