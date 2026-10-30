import { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router";

// CSS FILES:
import "./assets/css/00_Global_Styles.css";
import "./assets/css/01_Registration_Styles.css";
import "./assets/css/02_Home_Styles.css";
import "./assets/css/03_Fridge_Styles.css";
import "./assets/css/04_Dashboard_Styles.css";
import "./assets/css/05_Checkout_Styles.css";

// PAGE IMPORTS:
import Registration from "./pages/registration";
import Login from "./pages/login";
import Home from "./pages/home";
import Dashboard from "./pages/dashboard";
import SelfCheckout from "./pages/selfCheckout";

function App() {

  return (
    //BrowserRouter: this is where we handle routes in the frontend :)
   <Router> 
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Registration />} />
      <Route path="/home" element={<Home />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/self-checkout" element={<SelfCheckout />} />
    </Routes>
   </Router>
  );
}

export default App;