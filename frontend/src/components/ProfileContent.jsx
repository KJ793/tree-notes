import { useEffect, useState } from "react";
import "./ProfileContent.css";

// Stores the initial profile data for the logged-in user. This is a placeholder until the backend is connected.
const initialProfile = {
  fullName: "Ali H",
  displayName: "Ali H",
  email: "ali.h@example.com",
  bio: "Building connected notes and turning scattered ideas into useful knowledge.",
  memberSince: "2026",
};

// Stores the initial state of the password change form. This is used to reset the form when the modal is closed.
const emptyPasswordForm = {
  oldPassword: "",
  newPassword: "",
  confirmPassword: "",
};

// Backend
// Function for retrieving user details
async function getLoggedInUserDetails() {
  /*
    BACKEND TODO:

    Replace the mock return below with an authenticated API
    request for the currently logged-in user.

    Example:

    const response = await fetch("/api/profile", {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Unable to retrieve user profile.");
    }

    return await response.json();
  */
  return initialProfile;
}

// Backend
// Function for saving updated user details
async function saveLoggedInUserDetails(profileData) {
  /*
    BACKEND TODO:

    Replace the mock return below with an authenticated API
    request that sends the updated profile to the backend.

    Example:

    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(profileData),
    });

    if (!response.ok) {
      throw new Error("Unable to save user profile.");
    }

    return await response.json();
  */
  return {
    success: true,
    profile: profileData,
  };
}

// Backend
// Function for changing the logged-in user's password
async function changeLoggedInUserPassword(oldPassword, newPassword) {
  /*
    BACKEND TODO:

    Replace the mock return below with an authenticated API
    request.

    The backend should:
      1. Identify the currently logged-in user.
      2. Verify oldPassword securely.
      3. Hash newPassword.
      4. Update the stored password.
      5. Return success or an error message.

    Example:

    const response = await fetch("/api/profile/password", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        oldPassword,
        newPassword,
      }),
    });

    const result = await response.json();

    return {
      backendConnected: true,
      success: response.ok,
      message: result.message,
    };
  */
  return {
    backendConnected: false,
    success: false,
  };
}

// Backend
// Function for updating the user's profile photo
async function updateLoggedInUserProfilePhoto(photoFile) {
  /*
    BACKEND TODO:

    This can later upload the selected profile image to the
    backend. The backend can then store the image or image URL
    against the currently logged-in user.

    This function is not wired to a file picker yet.
  */

  return {
    backendConnected: false,
    success: false,
    photoFile,
  };
}

function ProfileContent() {
  const [profile, setProfile] = useState(initialProfile);
  const [saved, setSaved] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [passwordMessage, setPasswordMessage] = useState(null);

  // Load the currently logged-in user's profile when this page opens.
  useEffect(() => {
    let cancelled = false;

    async function loadUserDetails() {
      try {
        const userDetails = await getLoggedInUserDetails();

        if (!cancelled && userDetails) {
          setProfile(userDetails);
        }
      } catch (error) {
        console.error("Unable to load profile:", error);
      }
    }

    loadUserDetails();

    return () => {
      cancelled = true;
    };
  }, []);

  // Close the password modal when the user presses Escape.
  useEffect(() => {
    if (!passwordModalOpen) {
      return undefined;
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setPasswordModalOpen(false);
        setPasswordForm(emptyPasswordForm);
        setPasswordMessage(null);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [passwordModalOpen]);

  function handleFieldChange(event) {
    const { name, value } = event.target;

    setProfile((currentProfile) => ({
      ...currentProfile,
      [name]: value,
    }));

    setSaved(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      // Backend call is isolated inside saveLoggedInUserDetails().
      const result = await saveLoggedInUserDetails(profile);

      if (result?.success) {
        setSaved(true);
      }
    } catch (error) {
      console.error("Unable to save profile:", error);
      setSaved(false);
    }
  }

  function openPasswordModal() {
    setPasswordForm(emptyPasswordForm);
    setPasswordMessage(null);
    setPasswordModalOpen(true);
  }

  function closePasswordModal() {
    setPasswordModalOpen(false);
    setPasswordForm(emptyPasswordForm);
    setPasswordMessage(null);
  }

  function handlePasswordFieldChange(event) {
    const { name, value } = event.target;

    setPasswordForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));

    // Remove an old validation message as soon as the user starts editing again.
    setPasswordMessage(null);
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();

    const { oldPassword, newPassword, confirmPassword } = passwordForm;

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({
        type: "error",
        text: "Please complete all three password fields.",
      });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordMessage({
        type: "error",
        text: "Your new password must be at least 8 characters long.",
      });
      return;
    }

    if (oldPassword === newPassword) {
      setPasswordMessage({
        type: "error",
        text: "Your new password must be different from your current password.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({
        type: "error",
        text: "The new password and confirmation do not match.",
      });
      return;
    }

    try {
      // Backend call is isolated inside changeLoggedInUserPassword().
      // confirmPassword is intentionally not sent to the backend.
      const result = await changeLoggedInUserPassword(
        oldPassword,
        newPassword
      );

      if (!result.backendConnected) {
        setPasswordMessage({
          type: "success",
          text: "Password details are valid. Backend connection is still required to apply the change.",
        });
        return;
      }

      if (result.success) {
        setPasswordMessage({
          type: "success",
          text: result.message || "Password updated successfully.",
        });

        setPasswordForm(emptyPasswordForm);
        return;
      }

      setPasswordMessage({
        type: "error",
        text: result.message || "Unable to update password.",
      });
    } catch (error) {
      console.error("Unable to update password:", error);

      setPasswordMessage({
        type: "error",
        text: "Unable to update password. Please try again.",
      });
    }
  }

  return (
    <div className="profile-content">
      <header className="profile-heading">
        <div>
          <p className="profile-eyebrow">Account</p>
          <h1>User Profile</h1>
          <p className="profile-heading-copy">
            Manage the details connected to your TreeNotes account.
          </p>
        </div>

        <button
          className="profile-save-button"
          type="submit"
          form="profile-form"
        >
          {saved ? "Saved" : "Save changes"}
        </button>
      </header>

      <section className="profile-identity-card" aria-labelledby="profile-name">
        <div className="profile-avatar" aria-hidden="true">
          AH
        </div>

        <div className="profile-identity-copy">
          <h2 id="profile-name">{profile.displayName || "TreeNotes user"}</h2>
          <p>{profile.email}</p>
          <span>Member since {profile.memberSince || "2026"}</span>
        </div>

        <button className="profile-secondary-button" type="button">
          Change photo
        </button>
      </section>

      <div className="profile-layout-grid">
        <form
          id="profile-form"
          className="profile-card profile-form-card"
          onSubmit={handleSubmit}
        >
          <div className="profile-card-heading">
            <div>
              <h2>Personal information</h2>
              <p>Update how your account appears throughout TreeNotes.</p>
            </div>
          </div>

          <div className="profile-form-grid">
            <label className="profile-field">
              <span>Full name</span>
              <input
                name="fullName"
                type="text"
                value={profile.fullName}
                onChange={handleFieldChange}
                autoComplete="name"
              />
            </label>

            <label className="profile-field">
              <span>Display name</span>
              <input
                name="displayName"
                type="text"
                value={profile.displayName}
                onChange={handleFieldChange}
              />
            </label>

            <label className="profile-field profile-field-wide">
              <span>Email address</span>
              <input
                name="email"
                type="email"
                value={profile.email}
                onChange={handleFieldChange}
                autoComplete="email"
              />
            </label>

            <label className="profile-field profile-field-wide">
              <span>Bio</span>
              <textarea
                name="bio"
                value={profile.bio}
                onChange={handleFieldChange}
                rows="5"
                maxLength="240"
              />
              <small>{profile.bio.length}/240 characters</small>
            </label>
          </div>
        </form>

        <aside className="profile-side-column">
          <section className="profile-card">
            <div className="profile-card-heading">
              <div>
                <h2>Preferences</h2>
                <p>Choose how TreeNotes behaves for your account.</p>
              </div>
            </div>

            <label className="profile-toggle-row">
              <span>
                <strong>Dark appearance</strong>
                <small>Use the dark TreeNotes interface.</small>
              </span>
              <input
                type="checkbox"
                checked={darkMode}
                onChange={(event) => setDarkMode(event.target.checked)}
              />
            </label>
          </section>

          <section className="profile-card">
            <div className="profile-card-heading">
              <div>
                <h2>Account security</h2>
                <p>Password and sign-in controls will live here.</p>
              </div>
            </div>

            <button
              className="profile-secondary-button profile-full-button"
              type="button"
              onClick={openPasswordModal}
            >
              Change password
            </button>
          </section>
        </aside>
      </div>

      {passwordModalOpen && (
        <div
          className="profile-modal-backdrop"
          onMouseDown={closePasswordModal}
        >
          <section
            className="profile-password-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="profile-modal-heading">
              <div>
                <p className="profile-eyebrow">Account security</p>
                <h2 id="change-password-title">Change password</h2>
                <p>
                  Enter your current password, then choose a new password for
                  your TreeNotes account.
                </p>
              </div>

              <button
                className="profile-modal-close"
                type="button"
                onClick={closePasswordModal}
                aria-label="Close change password dialog"
              >
                x
              </button>
            </div>

            <form className="profile-password-form" onSubmit={handlePasswordSubmit}>
              <label className="profile-field">
                <span>Current password</span>
                <input
                  name="oldPassword"
                  type="password"
                  value={passwordForm.oldPassword}
                  onChange={handlePasswordFieldChange}
                  autoComplete="current-password"
                  autoFocus
                />
              </label>

              <label className="profile-field">
                <span>New password</span>
                <input
                  name="newPassword"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordFieldChange}
                  autoComplete="new-password"
                />
              </label>

              <label className="profile-field">
                <span>Confirm new password</span>
                <input
                  name="confirmPassword"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordFieldChange}
                  autoComplete="new-password"
                />
              </label>

              {passwordMessage && (
                <p
                  className={`profile-password-message profile-password-message-${passwordMessage.type}`}
                  role="status"
                >
                  {passwordMessage.text}
                </p>
              )}

              <div className="profile-modal-actions">
                <button
                  className="profile-secondary-button"
                  type="button"
                  onClick={closePasswordModal}
                >
                  Cancel
                </button>
                <button className="profile-save-button" type="submit">
                  Update password
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default ProfileContent;