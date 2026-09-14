import {
  useEffect,
  useState,
} from "react";

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Login from "./Login";
import Dashboard from "./Dashboard";
import Profile from "./Profile";


function RequireAuth({ children }) {
  const [authState, setAuthState] =
    useState("checking");

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const response =
          await fetch(
            "/api/user/navbar",
            {
              method: "GET",
              credentials: "include",
            }
          );

        if (cancelled) {
          return;
        }

        if (response.status === 401) {
          setAuthState("denied");
          return;
        }

        if (!response.ok) {
          throw new Error(
            "Unable to verify your session."
          );
        }

        setAuthState("allowed");

      } catch (error) {
        console.error(
          "Session check failed:",
          error
        );

        if (!cancelled) {
          setAuthState("error");
        }
      }
    }

    checkSession();

    return () => {
      cancelled = true;
    };
  }, []);

  if (authState === "checking") {
    return (
      <div className="dashboard-loading">
        Checking session...
      </div>
    );
  }

  if (authState === "denied") {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  if (authState === "error") {
    return (
      <div className="dashboard-loading">
        Unable to verify your session.
      </div>
    );
  }

  return children;
}


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Login />}
        />

        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />

        <Route
          path="/profile"
          element={
            <RequireAuth>
              <Profile />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;