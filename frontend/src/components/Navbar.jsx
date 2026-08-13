import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import treeNotesLogo from "../assets/logo.png";

function Navbar() {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const profileMenuRef = useRef(null);
  const navigate = useNavigate();

  function toggleProfileMenu() {
    setProfileMenuOpen((current) => !current);
  }

  function closeProfileMenu() {
    setProfileMenuOpen(false);
  }

  function handleLogout() {
    setProfileMenuOpen(false);

    // Later, when authentication is implemented,
    // remove the user's login token/session here.

    navigate("/");
  }

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setProfileMenuOpen(false);
      }
    }
  
      function handleEscape(event) {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

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

      <div
        className="profile-menu-container"
        ref={profileMenuRef}
      >
        <button
          className={`profile-nav-trigger ${
            profileMenuOpen ? "profile-nav-trigger-open" : ""
          }`}
          type="button"
          onClick={toggleProfileMenu}
          aria-haspopup="menu"
          aria-expanded={profileMenuOpen}
        >
          <span className="profile-nav-avatar">
            AH
          </span>

          <span className="profile-nav-name">
            Ali H
          </span>

          <span
            className={`profile-nav-chevron ${
              profileMenuOpen
                ? "profile-nav-chevron-open"
                : ""
            }`}
            aria-hidden="true"
          >
            ▾
          </span>
        </button>


        {profileMenuOpen && (
          <div
            className="profile-dropdown"
            role="menu"
          >
            <div className="profile-dropdown-header">
              <span className="profile-dropdown-avatar">
                AH
              </span>

              <div>
                <strong>Ali H</strong>
              </div>
            </div>

            <div className="profile-dropdown-divider" />

            <Link
              className="profile-dropdown-item"
              to="/profile"
              role="menuitem"
              onClick={closeProfileMenu}
            >
              <span
                className="profile-dropdown-icon"
                aria-hidden="true"
              >
                ♙
              </span>

              <span>Profile</span>
            </Link>

            <button
              className="profile-dropdown-item profile-dropdown-logout"
              type="button"
              role="menuitem"
              onClick={handleLogout}
            >
              <span
                className="profile-dropdown-icon"
                aria-hidden="true"
              >
                ↪
              </span>

              <span>Log out</span>
            </button>
          </div>
        )}

      </div>

    </header>
  );
}

export default Navbar;