import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function Sidebar() {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;

    function onKeyDown(event) {
      if (event.key === "Escape") setConfirming(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirming]);

  function handleLogout() {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("user");
    // replace: the back button would otherwise return to a page that only
    // bounces straight back to the login screen.
    navigate("/", { replace: true });
  }

  return (
    <>
      <aside className="sidebar">
        <h2 className="sidebar-brand">
          {/* Served from public/ rather than imported: a missing file renders as
              a broken image instead of failing the build. alt is empty because
              the wordmark beside it already names the app. */}
          <img src="/logo.png" alt="" className="brand-logo" />
          <span className="brand-text">
            Tree<span className="brand-accent">Notes</span>
          </span>
        </h2>

        <button onClick={() => navigate("/notes")}>Notes</button>
        <button onClick={() => navigate("/graph")}>Groups</button>
        <button>Search</button>
        <button>Tags</button>
        <button>Settings</button>

        <button className="sidebar-logout" onClick={() => setConfirming(true)}>
          Log out
        </button>
      </aside>

      {/* A sibling of the sidebar rather than a child: the overlay is fixed, so
          it must not be confined by the sidebar's own scrolling. */}
      {confirming && (
        <div
          className="app-modal"
          onClick={(event) => {
            if (event.target === event.currentTarget) setConfirming(false);
          }}
        >
          <div
            className="app-modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Log out?"
          >
            <h2 className="app-modal-question">Are you sure you want to logout?</h2>

            <div className="app-modal-actions">
              <button onClick={handleLogout}>Yes</button>
              <button className="modal-secondary" onClick={() => setConfirming(false)}>
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Sidebar;
