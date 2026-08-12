import { useEffect, useState } from "react";
import "./ProfileContent.css";

const initialProfile = {
  fullName: "Ali H",
  displayName: "Ali H",
  email: "ali.h@example.com",
  bio: "Building connected notes and turning scattered ideas into useful knowledge.",
};

const emptyPasswordForm = {
  oldPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function ProfileContent() {
  const [profile, setProfile] = useState(initialProfile);
  const [saved, setSaved] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [passwordMessage, setPasswordMessage] = useState(null);

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

  function handleSubmit(event) {
    event.preventDefault();

    // Frontend-only feedback for now. This is where a future API request will go.
    setSaved(true);
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

  function handlePasswordSubmit(event) {
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

    // Frontend-only for now. Do not log or store passwords in localStorage.
    // A future backend request should securely verify oldPassword and update
    // the account password using only oldPassword and newPassword.
    setPasswordMessage({
      type: "success",
      text: "Password details are valid. Connect this form to the backend to apply the change.",
    });
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
          <span>Member since 2026</span>
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