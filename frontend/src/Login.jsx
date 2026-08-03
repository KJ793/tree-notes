import "./App.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import treeGraph from "./assets/graph.png";

function Login(){

const [email, setEmail] = useState("");

const [password, setPassword] = useState("");

const navigate = useNavigate();

return(


  <main className="loginpage">
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

        <button>Login</button>
       </div>

    </nav>
    <section className="maincontent">

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


    <button type="submit" className="loginbutton">
      Login
    </button>

    <a href="#" className="forgotpassword">
      Forgot Password?
    </a>

    <div className="divider">
      <span></span>
      <p>Or</p>
      <span></span>
    </div>

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

function handleSubmit(event){
  event.preventDefault();


  const loginData = {
    email:  email,
    password: password,

  };
console.log(loginData)

navigate("/dashboard");

}

}




export default Login;
