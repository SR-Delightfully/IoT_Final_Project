import { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router";

// CSS FILES:
import "./assets/css/00_Global_Styles.css";
import "./assets/css/01_Registration_Styles.css";
import "./assets/css/02_Home_Styles.css";
import "./assets/css/03_Fridge_Styles.css";
import "./assets/css/04_Account_Styles.css";
import "./assets/css/05_Products_Styles.css";

// PAGE IMPORTS:
import Registration from "./pages/registration";
import Login from "./pages/login";
import Home from "./pages/home";
import Fridge from "./pages/fridge";
import Account from "./pages/account";
import Products from "./pages/products";
import ProductDashboard from "./pages/productDashboard";
import Settings from "./pages/settings";
import UserRoles from "./pages/userRoles";

// COMPONENTS:
import NavBar from "./components/NavBar";

function App() {

  return (
    //BrowserRouter: this is where we handle routes in the frontend :)
   <Router>
    <NavBar />
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Registration />} />
      <Route path="/home" element={<Home />} />
      <Route path="/fridges" element={<Fridge />} />
      <Route path="/account" element={<Account />} />
      <Route path="/products" element={<Products />} />
      <Route path="/admin/products" element={<ProductDashboard />} />
      <Route path="/admin/users" element={<UserRoles />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
   </Router>
  );
}

export default App;