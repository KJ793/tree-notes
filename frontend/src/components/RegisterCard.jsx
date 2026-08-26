import { useState } from "react";


function RegisterCard({ onLogin }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");


  function validateRegistration() {

    // Full name is optional, so there is deliberately
    // no validation requirement for it.

    if (!email.trim()) {
      return "Please enter your email address.";
    }


    // Same minimum password rule used by the
    // Change Password profile functionality.
    if (password.length < 8) {
      return "Your password must be at least 8 characters long.";
    }


    if (password !== confirmPassword) {
      return "The password and confirmation do not match.";
    }


    return null;
  }


  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");


    const validationError =
      validateRegistration();

    if (validationError) {
      setError(validationError);
      return;
    }


    const registrationData = {
      fullName: fullName.trim(),
      email: email.trim(),
      password,
    };


    setLoading(true);


    try {

      /* =========================================
         BACKEND
         Function for registering a new user
         ========================================= */

      /*
        Frontend provides:

        {
          fullName: string,   // optional
          email: string,      // required
          password: string    // required
        }


        IMPORTANT:

        confirmPassword is NOT sent to the backend.

        Its only purpose is frontend validation.
      */


      /*
        BACKEND TODO:

        Uncomment/adjust once registration endpoint
        has been implemented.


        const response = await fetch("/api/register", {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify(registrationData),
        });


        const data = await response.json();


        if (!response.ok) {
          throw new Error(
            data.message ||
            "Unable to create account."
          );
        }
      */


      // Temporary frontend behaviour.
      console.log(
        "Registration data:",
        {
          fullName: registrationData.fullName,
          email: registrationData.email,
        }
      );


      setSuccess(
        "Registration details are valid. Backend registration is ready to be connected."
      );


    } catch (error) {
      console.error(
        "Registration error:",
        error
      );

      setError(
        error.message ||
        "Unable to create account."
      );


    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="logincard auth-card registration-card">

      <h2>Create Account</h2>

      <p className="loginsubtitle">
        Create your TreeNotes account.
      </p>


      <form onSubmit={handleSubmit}>

        {/* Optional personalisation */}

        <label htmlFor="register-name">
          Full name
          <span className="optional-field">
            {" "}Optional
          </span>
        </label>

        <input
          id="register-name"
          type="text"
          placeholder="Your name"
          value={fullName}
          onChange={(event) =>
            setFullName(event.target.value)
          }
          autoComplete="name"
        />


        {/* Required login identity */}

        <label htmlFor="register-email">
          Email
        </label>

        <input
          id="register-email"
          type="email"
          placeholder="email"
          value={email}
          onChange={(event) =>
            setEmail(event.target.value)
          }
          autoComplete="email"
          required
        />


        <label htmlFor="register-password">
          Password
        </label>

        <input
          id="register-password"
          type="password"
          placeholder="password"
          value={password}
          onChange={(event) =>
            setPassword(event.target.value)
          }
          autoComplete="new-password"
          required
        />


        <label htmlFor="register-confirm-password">
          Confirm password
        </label>

        <input
          id="register-confirm-password"
          type="password"
          placeholder="confirm password"
          value={confirmPassword}
          onChange={(event) =>
            setConfirmPassword(event.target.value)
          }
          autoComplete="new-password"
          required
        />


        <small className="password-hint">
          Password must contain at least 8 characters.
        </small>


        {error && (
          <p className="login-error">
            {error}
          </p>
        )}


        {success && (
          <p className="registration-success">
            {success}
          </p>
        )}


        <button
          type="submit"
          className="loginbutton"
          disabled={loading}
        >
          {loading
            ? "Creating account..."
            : "Create Account"}
        </button>


        <div className="auth-links-row">

          <button
            type="button"
            className="auth-text-link auth-switch-link"
            onClick={onLogin}
          >
            Have an account? Log in here
          </button>

        </div>

      </form>

    </div>
  );
}


export default RegisterCard;