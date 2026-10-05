import { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router";

// CSS FILES:
import "./assets/css/00_Global_Styles.css";
import "./assets/css/01_Registration_Styles.css";
import "./assets/css/02_Home_Styles.css";

// PAGE IMPORTS:
import Registration from "./pages/registration";
import Login from "./pages/login";
import Home from "./pages/home";

function App() {

  return (
    //BrowserRouter: this is where we handle routes in the frontend :)
   <Router> 
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Registration />} />
    </Routes>
   </Router>
  );
}

export default App;