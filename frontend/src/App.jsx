
import { Navigate, Route, BrowserRouter as Router, Routes, useLocation } from "react-router";

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
import "./assets/css/09_Overview_Styles.css";

// PAGE IMPORTS:
import Account from "./pages/account";
import FridgeDashboard from "./pages/fridgeDashboard";
import Home from "./pages/home";
import Login from "./pages/login";
import ProductDashboard from "./pages/productDashboard";
import OverviewDashboard from "./pages/overviewDashboard";
import Products from "./pages/products";
import Purchases from "./pages/purchases";
import Registration from "./pages/registration";
import SelfCheckout from "./pages/selfCheckout";
import Settings from "./pages/settings";
import Testing from "./pages/testing";
import UserRoles from "./pages/userRoles";
import Reports from "./pages/reports";

// COMPONENTS:
import NavBar from "./layout/navbar";
import { ToastProvider } from "./components/Toaster";
import ScannerSimulator from "./components/ScannerSimulator";

const SHOW_SCANNER_SIMULATOR = import.meta.env.VITE_SCANNER_SIMULATOR !== "false";
import UserDashboard from "./pages/userDashboard";

function AppContent() {
  const location = useLocation();

  const hideNavBar = [
    "/login",
    "/register",
    "/self-checkout",
  ].includes(location.pathname);

  return (
    <ToastProvider>
      {!hideNavBar && <NavBar />}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Registration />} />

        {/* Store */}
        <Route path="/products" element={<Products />} />
        <Route path="/self-checkout" element={<SelfCheckout />} />

        {/* Customer account */}
        <Route path="/customer" element={<Account />} />
        <Route path="/customer/purchases" element={<Purchases />} />
        <Route path="/customer/settings" element={<Settings />} />

        {/* Admin dashboard */}
        <Route path="/dashboard" element={<OverviewDashboard />} />
        <Route path="/dashboard/inventory" element={<ProductDashboard />} />
        <Route path="/dashboard/reports" element={<Reports />} />
        <Route path="/dashboard/fridges" element={<FridgeDashboard />} />
        <Route path="/dashboard/users" element={<UserDashboard />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {SHOW_SCANNER_SIMULATOR && <ScannerSimulator />}
    </ToastProvider>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
