import { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router";

// CSS FILES:
import "./assets/css/00_Global_Styles.css";
import "./assets/css/01_Registration_Styles.css";
import "./assets/css/02_Home_Styles.css";
import "./assets/css/03_Fridge_Styles.css";
import "./assets/css/04_Dashboard_Styles.css";
import "./assets/css/05_Checkout_Styles.css";
import "./assets/css/99_Testing_Styles.css";

// PAGE IMPORTS:
import Registration from "./pages/registration";
import Login from "./pages/login";
import Home from "./pages/home";
import FridgeDashboard from "./pages/fridgeDashboard";
import SelfCheckout from "./pages/selfCheckout";
import Testing from "./pages/testing";

function App() {

  return (
    //BrowserRouter: this is where we handle routes in the frontend :)
   <Router> 
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/home" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Registration />} />

      <Route path="/dashboard/" element={<p>{/* TODO: dashboard 'home'page */}</p>} />
      <Route path="/dashboard/fridges" element={<FridgeDashboard />} />
      <Route path="/dashboard/users" element={<p>{/* TODO: user crud dashboard */}</p>} />
      <Route path="/dashboard/inventory" element={<p>{/* TODO: product crud dashboard */}</p>} />
      
      <Route path="/account" element={<p>{/* TODO: user profile and settings? */}</p>} />
      <Route path="/account/purchase-history" element={<p>{/* TODO: transaction history */}</p>} />
      <Route path="/account/membership" element={<p>{/* TODO: display membership tiers, standing and possible rewards */}</p>} />
      

      <Route path="/self-checkout" element={<SelfCheckout />} />
      <Route path="/self-checkout/process-transaction" element={<p>{/* TODO: transaction simulation */}</p>} />
      <Route path="/self-checkout/receipt" element={<p>{/* TODO: display receipt of purchased products */}</p>} />
      
      <Route path="/testing" element={<Testing />} />
    </Routes>
   </Router>
  );
}

export default App;