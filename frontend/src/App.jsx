import "./App.css";
import { useState } from "react";

function App(){

const [email, setEmail] = useState("");

const [password, setPassword] = useState("");



return(
  <main>
    <h1>
      TreeNotes
    </h1>

    <h6>Connect your ideas and grow your knowledge.</h6>

    <br />

    <form onSubmit={handleSubmit}>

    <label htmlFor="email">Please Enter your email address</label>

    <input type="email" placeholder="email" id="email" onChange={(event) => setEmail(event.target.value)} required />

    <br />


    <label htmlFor="password">Please Enter your password</label>

    <input type="password" placeholder="password" id="password" onChange={(event) => setPassword(event.target.value)} required/>
    <br />

    <input type="submit" value="log in" />

    </form>
    
  </main>



)

function handleSubmit(event){
  event.preventDefault();


  const loginData = {
    email:  email,
    password: password, 

  }; 
console.log(loginData)

}

}




export default App

