import { Link } from "react-router-dom";
import treeNotesLogo from "../assets/logo.png";

function Navbar() {
  return (
    <header className="dashboard-navbar">

      <Link
        className="dashboard-brand"
        to="/dashboard"
        aria-label="Go to dashboard"
      >
        <img
          className="dashboard-brand-logo"
          src={treeNotesLogo}
          alt="TreeNotes Logo"
        />

        <div className="dashboard-brand-text">
          <strong>TreeNotes</strong>
          <small>Organise. connect. remember</small>
        </div>
      </Link>

      <Link
        className="profile-nav-link"
        to="/profile"
        aria-label="Open profile"
      >
        <span className="profile-nav-avatar">
          AH
        </span>

        <span className="profile-nav-name">
          Ali H
        </span>
      </Link>

    </header>
  );
}

export default Navbar;