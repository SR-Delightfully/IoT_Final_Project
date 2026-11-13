import { useEffect, useState } from "react";

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

    fetch(`${API}/me`, { headers: { "X-User-Id": saved.user_id } })
      .then(async (res) => {
        if (res.status === 401) {
          logOut();
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

  function logOut() {
    ["user_id", "user_role", "user_fname", "customer_id"].forEach((key) =>
      localStorage.removeItem(key),
    );
    setUser(null);
    window.location.href = "/login";
  }

  const link = (href, label) => (
    <a
      href={href}
      className={`nav-link ${path === href ? "nav-link-active" : ""}`}
    >
      {label}
    </a>
  );

  return (
    <nav className="nav-bar">
      <a href="/home" className="nav-brand">
        IoT Card Store
      </a>

      <div className="nav-links">
        {link("/products", "Products")}

        {user?.user_role === "admin" && (
          <>
            {link("/admin/products", "Dashboard")}
            {link("/admin/users", "Users")}
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
            <button type="button" className="nav-logout" onClick={logOut}>
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
