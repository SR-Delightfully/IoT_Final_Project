import { useEffect, useState } from "react";
import { authHeaders, SESSION_KEYS } from "../utils/auth";
import { flashToast } from "./Toaster";

const API = import.meta.env.VITE_API_URL;

function readUser() {
  const id = localStorage.getItem("user_id");
  if (!id) return null;

  return {
    user_id: id,
    user_role: localStorage.getItem("user_role") || "customer",
    user_fname: localStorage.getItem("user_fname") || "",
  };
}

function NavBar() {
  const [user, setUser] = useState(readUser);
  const path = window.location.pathname;

  // Refresh name and role from the server, so a role change by an admin
  // shows up without logging out and back in.
  useEffect(() => {
    const saved = readUser();
    if (!saved) return;

    fetch(`${API}/me`, { headers: authHeaders() })
      .then(async (res) => {
        if (res.status === 401) {
          logOut("Your session expired. Please log in again.");
          return;
        }
        if (!res.ok) return;

        const me = await res.json();
        localStorage.setItem("user_role", me.user_role);
        localStorage.setItem("user_fname", me.user_fname);
        setUser(readUser());
      })
      .catch(() => {});
  }, []);

  function logOut(message = "You have been logged out.") {
    SESSION_KEYS.forEach((key) =>
      localStorage.removeItem(key),
    );
    flashToast("info", message);
    setUser(null);
    window.location.href = "/login";
  }

  // highlighted for its own page and anything under it (e.g. /account/...)
  const isActive = (href) => path === href || path.startsWith(`${href}/`);

  const link = (href, label) => (
    <a
      href={href}
      className={`nav-link ${isActive(href) ? "nav-link-active" : ""}`}
    >
      {label}
    </a>
  );

  const isAdmin = user?.user_role === "admin";

  return (
    <nav className="nav-bar">
      <a href="/home" className="nav-brand">
        IoT Card Store
      </a>

      <div className="nav-links">
        {link("/products", "Products")}
        {link("/self-checkout", "Self-Checkout")}

        {isAdmin && (
          <>
            {link("/dashboard/inventory", "Inventory")}
            {link("/dashboard/fridges", "Fridges")}
            {link("/dashboard/users", "Users")}
          </>
        )}
      </div>

      <div className="nav-user">
        {user ? (
          <>
            {user.user_role === "customer" && link("/account", "Account")}
            {link("/settings", "Settings")}
            <span className="nav-greeting">
              {user.user_fname || "Signed in"}
              {user.user_role === "admin" && (
                <span className="nav-badge">admin</span>
              )}
            </span>
            <button type="button" className="nav-logout" onClick={() => logOut()}>
              Log out
            </button>
          </>
        ) : (
          <>
            {link("/login", "Log in")}
            {link("/register", "Register")}
          </>
        )}
      </div>
    </nav>
  );
}

export default NavBar;
