import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router";

// CSS FILES:
import "./assets/css/00_Global_Styles.css";
import "./assets/css/01_Registration_Styles.css";
import "./assets/css/02_Home_Styles.css";
import "./assets/css/03_Fridge_Styles.css";
import "./assets/css/04_Account_Styles.css";
import "./assets/css/05_Dashboard_Styles.css";
import "./assets/css/06_Checkout_Styles.css";
import "./assets/css/07_Products_Styles.css";
import "./assets/css/08_Toast_Styles.css";
import "./assets/css/99_Testing_Styles.css";

// PAGE IMPORTS:
import Account from "./pages/account";
import FridgeDashboard from "./pages/fridgeDashboard";
import Home from "./pages/home";
import Login from "./pages/login";
import ProductDashboard from "./pages/productDashboard";
import Products from "./pages/products";
import Purchases from "./pages/purchases";
import Registration from "./pages/registration";
import SelfCheckout from "./pages/selfCheckout";
import Settings from "./pages/settings";
import Testing from "./pages/testing";
import UserRoles from "./pages/userRoles";

// COMPONENTS:
import NavBar from "./components/NavBar";
import { ToastProvider } from "./components/Toaster";

function App() {
  return (
    //BrowserRouter: this is where we handle routes in the frontend :)
    <Router>
      <ToastProvider>
        <NavBar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Registration />} />

          {/* Store */}
          <Route path="/products" element={<Products />} />
          <Route path="/self-checkout" element={<SelfCheckout />} />
          {/* payment and receipt happen inside the self-checkout page */}
          <Route path="/self-checkout/*" element={<Navigate to="/self-checkout" replace />} />

          {/* Customer account */}
          <Route path="/account" element={<Account />} />
          <Route path="/account/purchases" element={<Purchases />} />
          <Route path="/account/purchase-history" element={<Navigate to="/account/purchases" replace />} />
          {/* points and tier are shown on the account page */}
          <Route path="/account/membership" element={<Navigate to="/account" replace />} />
          <Route path="/settings" element={<Settings />} />

          {/* Admin dashboard */}
          <Route path="/dashboard" element={<Navigate to="/dashboard/inventory" replace />} />
          <Route path="/dashboard/inventory" element={<ProductDashboard />} />
          <Route path="/dashboard/fridges" element={<FridgeDashboard />} />
          <Route path="/dashboard/users" element={<UserRoles />} />

          {/* Old addresses still work */}
          <Route path="/admin/products" element={<Navigate to="/dashboard/inventory" replace />} />
          <Route path="/admin/users" element={<Navigate to="/dashboard/users" replace />} />
          <Route path="/fridges" element={<Navigate to="/dashboard/fridges" replace />} />

          <Route path="/testing" element={<Testing />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </Router>
  );
}

export default App;
