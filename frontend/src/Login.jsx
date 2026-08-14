import "./App.css";
import { useState } from "react";

import treeGraph from "./assets/graph.png";

function Login(){

// << FRONTEND DEV >> //
// Stores email entered by user //
const [email, setEmail] = useState("");

// Stores password entered by user //
const [password, setPassword] = useState("");

// Handles login loading state //
const [loading, setLoading] = useState(false);

// Handles login errors //
const [error, setError] = useState("");

async function handleSubmit(event) {

    event.preventDefault();

    // << FRONTEND DEV >> //
    // Build login data from form values //

    const loginData = {
      email: email,
      password: password,
    };

    setLoading(true);
    setError("");


    try {

      // << BACKEND CONNECTION GOES HERE KYLE / DAMON >> //
      // Frontend provides: {
      //  email: string,
      //   password: string
      // }


      const response = await fetch("/api/login", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(loginData),
      });


      // << BACKEND AUTH STUFF >> //
      // Backend validates email and password //

      if (!response.ok) {
        throw new Error("Login failed.");
      }


      // << BACKEND RESPONSE >> //
      // Expected response structure:
      //
      // {
      //   user: {
      //     id: number/string,
      //     email: string,
      //     name: string
      //   }
      // }

      const data = await response.json();


      // << FRONTEND DEV >> //
      // Login successful //
      // User data can later be stored in app/auth state //
      // Redirect to dashboard will go here //

      console.log("Logged in user:", data);


    } catch (error) {

      // << FRONTEND DEV >> //
      // Login error handling //

      console.error("Login error:", error);

      setError(
        "Unable to login. Please check your email and password."
      );

    } finally {

      // Stop loading whether login succeeds or fails //

      setLoading(false);
    }
  }




return(
  
  
  <main className="loginpage">
    {/* << FRONTEND DEV >> */}
    {/* Login page navigation */}

    <nav className="navbar">
      <div className="logo">
        <div className="logotext">
        <h2>TreeNotes</h2>
        <p>Organise. Connect. Remember.</p>
      </div>
      </div>
       <div className="navlinks">
        <a href="#">Features</a>
        <a href="#">Docs</a>
        <a href="#">GitHub</a>

        <button type="button">Login</button>
       </div>

    </nav>
    <section className="maincontent">
        {/* << FRONTEND DEV >> */}
        {/* Login page hero section */}

      <section className="herosection">
        <h1>
          Organize Ideas, <br />
          grow <span>Knowledge</span>
        </h1>

        <p>
          TreeNotes is an open-source note-taking web app that helps organise your
          ideas as a tree and connect what matters.
        </p>
        <div className="graphpreview">
          <img src={treeGraph} alt="TreeNotes knowledge graph" />
        </div>

      </section>

      {/* << LOGIN FORM >> */}
      <section className="loginsection">
        <div className="logincard">

          <h2>Welcome Back!</h2>
          <p className="loginsubtitle">
            Login to continue to TreeNotes.
          </p>
        <form onSubmit={handleSubmit}>

    <label htmlFor="email">Email</label>

    <input type="email" placeholder="email" id="email" onChange={(event) => setEmail(event.target.value)} required />




    <label htmlFor="password">Password</label>

    <input type="password" placeholder="password" id="password" onChange={(event) => setPassword(event.target.value)} required/>
    {/* << FRONTEND LOGIN DISPLAY >> */}

    {error && (
        <p className="login-error">
            {error}
        </p>
    )}


    <button type="submit" className="loginbutton" disabled={loading}>
        {loading
            ? "Logging in..."
            : "Login"
        }

    </button>

    <a href="#" className="forgotpassword">
      Forgot Password?
    </a>

    <div className="divider">
      <span></span>
      <p>Or</p>
      <span></span>
    </div>

    {/* << GOOGLE AUTH CONNECTION >> */}
    {/* Backend/auth integration will go here later */}


    <button type="button" className="googlebutton">
      Continue with Google
    </button>

    </form>
    </div>
      </section>
      
    </section>

    <footer className="footer">
      © 2026 TreeNotes. Open-source under MIT License.
    </footer>
    

    
    
  </main>



)



}






export default Login;

