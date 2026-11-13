import { Route, BrowserRouter as Router, Routes } from "react-router";

// CSS FILES:
import "./assets/css/00_Global_Styles.css";
import "./assets/css/01_Registration_Styles.css";
import "./assets/css/02_Home_Styles.css";
import "./assets/css/03_Fridge_Styles.css";
import "./assets/css/04_Account_Styles.css";
import "./assets/css/04_Dashboard_Styles.css";
import "./assets/css/05_Checkout_Styles.css";
import "./assets/css/05_Products_Styles.css";
import "./assets/css/99_Testing_Styles.css";

// PAGE IMPORTS:
import Account from "./pages/account";
import Home from "./pages/home";
import Login from "./pages/login";
import ProductDashboard from "./pages/productDashboard";
import Products from "./pages/products";
import Registration from "./pages/registration";
import Settings from "./pages/settings";
import UserRoles from "./pages/userRoles";

// COMPONENTS:
import NavBar from "./components/NavBar";
import FridgeDashboard from "./pages/fridgeDashboard";
import SelfCheckout from "./pages/selfCheckout";
import Testing from "./pages/testing";

function App() {
  return (
    //BrowserRouter: this is where we handle routes in the frontend :)
    <Router>
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Registration />} />

        <Route
          path="/dashboard/"
          element={<p>{/* TODO: dashboard 'home'page */}</p>}
        />
        <Route path="/dashboard/fridges" element={<FridgeDashboard />} />
        <Route
          path="/dashboard/users"
          element={<p>{/* TODO: user crud dashboard */}</p>}
        />
        <Route
          path="/dashboard/inventory"
          element={<p>{/* TODO: product crud dashboard */}</p>}
        />

        <Route
          path="/account"
          element={<p>{/* TODO: user profile and settings? */}</p>}
        />
        <Route
          path="/account/purchase-history"
          element={<p>{/* TODO: transaction history */}</p>}
        />
        <Route
          path="/account/membership"
          element={
            <p>
              {/* TODO: display membership tiers, standing and possible rewards */}
            </p>
          }
        />

        <Route path="/self-checkout" element={<SelfCheckout />} />
        <Route
          path="/self-checkout/process-transaction"
          element={<p>{/* TODO: transaction simulation */}</p>}
        />
        <Route
          path="/self-checkout/receipt"
          element={<p>{/* TODO: display receipt of purchased products */}</p>}
        />

        <Route path="/testing" element={<Testing />} />
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
