import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User,
  LogOut,
  Save,
  FileOutput,
} from "lucide-react";

import treeNotesLogo from "../assets/logo.png";


const initialNavbarUser = {
  displayName: "Ali H",
  initials: "AH",
  profileImage: null,
};

/* =========================================================
   BACKEND INTEGRATION
   ========================================================= */

// Function for retrieving logged-in user's navbar details
async function getLoggedInUserNavbarDetails() {
  /*
    BACKEND TODO:

    Replace the mock return below with an authenticated API
    request for the currently logged-in user.

    The backend should return only the information required
    by the navbar, for example:

    {
      displayName: "Ali H",
      initials: "AH",
      profileImage: "https://..."
    }

    Example:

    const response = await fetch("/api/user/navbar", {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Unable to retrieve logged-in user.");
    }

    return await response.json();
  */

  // Frontend mock data until backend is connected.
  return initialNavbarUser;
}

// Backend
// Function for logging out the currently logged-in user
async function logoutLoggedInUser() {
  /*
    BACKEND TODO:

    Replace the mock return below with a request to the
    backend logout endpoint.

    The backend should invalidate/delete the current user's
    session or authentication cookie.

    Example:

    const response = await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Unable to log out.");
    }

    return {
      backendConnected: true,
      success: true,
    };
  */

  // Frontend placeholder until authentication is connected.
  return {
    backendConnected: false,
    success: true,
  };
}

// Backend
// Function for retrieving the user's profile image
async function getLoggedInUserProfileImage() {
  /*
    BACKEND TODO:

    This may not need its own API endpoint if profileImage
    is already returned by getLoggedInUserNavbarDetails().

    Keep this function only if profile images are retrieved
    separately from the backend.
  */

  return null;
}

// Backend
// Function for saving the currently open note
async function saveCurrentNote() {
  /*
    BACKEND TODO:

    This function should send the currently open note
    to the backend so it can be saved to the database.

    The backend will eventually need information such as:

    {
      noteId,
      title,
      rawNotes,
      userSummary
    }

    Example:

    const response = await fetch("/api/notes/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        noteId,
        title,
        rawNotes,
        userSummary,
      }),
    });

    if (!response.ok) {
      throw new Error("Unable to save note.");
    }

    return await response.json();
  */

  // Frontend placeholder
  return {
    backendConnected: false,
    success: true,
  };
}

// Backend
// Function for exporting the currently open note
async function exportCurrentNote() {
  /*
    BACKEND TODO:

    Depending on how export is implemented, this could:

      1. Ask the backend to generate a PDF / DOCX / text file
      2. Return a downloadable file
      3. Export the note locally from the frontend

    Example:

    const response = await fetch("/api/notes/export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        noteId,
      }),
    });

    if (!response.ok) {
      throw new Error("Unable to export note.");
    }

    return response;
  */

  // Frontend placeholder
  return {
    backendConnected: false,
    success: true,
  };
}

function Navbar({onSave}) {
  const [saving, setSaving] = useState(false);

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const [navbarUser, setNavbarUser] = useState(initialNavbarUser);

  const profileMenuRef = useRef(null);
  const navigate = useNavigate();

  // Load the logged-in user's navbar information.
  useEffect(() => {
    let cancelled = false;

    async function loadNavbarUser() {
      try {
        const userDetails =
          await getLoggedInUserNavbarDetails();

        if (!cancelled && userDetails) {
          setNavbarUser(userDetails);
        }
      } catch (error) {
        console.error(
          "Unable to load navbar user details:",
          error
        );
      }
    }

    loadNavbarUser();

    return () => {
      cancelled = true;
    };
  }, []);

  function toggleProfileMenu() {
    setProfileMenuOpen((current) => !current);
  }

  function closeProfileMenu() {
    setProfileMenuOpen(false);
  }

  async function handleLogout() {
    try {
      const result = await logoutLoggedInUser();

      /*
        Until the backend is connected, the mock function
        still allows us to demonstrate logout navigation.
      */
      if (result?.success) {
        setProfileMenuOpen(false);

        navigate("/");
      }
    } catch (error) {
      console.error("Unable to log out:", error);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      if (onSave) {
      await onSave();
    }

      window.setTimeout(() => {
        setSaving(false);
      }, 1200);
    } catch (error) {
      console.error("Unable to save note:", error);
      setSaving(false);
    }
  }

  async function handleExport() {
    try {
      const result = await exportCurrentNote();

      if (result?.success) {
        console.log("Export request successful.");
      }
    } catch (error) {
      console.error("Unable to export note:", error);
    }
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

      <div className="navbar-note-actions">

        <button
          className="navbar-action-button"
          type="button"
          onClick={handleSave}
        >
          <Save
            size={24}
            strokeWidth={1.8}
          />

          <span>
            {saving ? "Saved" : "Save"}
          </span>
        </button>

        <button
          className="navbar-action-button"
          type="button"
          onClick={handleExport}
        >
          <FileOutput
            size={24}
            strokeWidth={1.8}
          />

          <span>Export</span>
        </button>

      </div>

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
            {navbarUser.profileImage ? (
              <img
                src={navbarUser.profileImage}
                alt=""
                className="profile-nav-avatar-image"
              />
            ) : (
              navbarUser.initials
            )}
          </span>

          <span className="profile-nav-name">
            {navbarUser.displayName}
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
                {navbarUser.profileImage ? (
                  <img
                    src={navbarUser.profileImage}
                    alt=""
                    className="profile-dropdown-avatar-image"
                  />
                ) : (
                  navbarUser.initials
                )}
              </span>

              <div>
                <strong>
                  {navbarUser.displayName}
                </strong>
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
                <User size={18} strokeWidth={1.8} />
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
                <LogOut size={18} strokeWidth={1.8} />
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