
import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { authHeaders, SESSION_KEYS } from "../utils/auth";
import { flashToast } from "../components/Toaster";

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
    const { pathname } = useLocation();

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
        SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
        flashToast("info", message);
        setUser(null);
        window.location.href = "/login";
    }

    const isActive = (href) =>
        pathname === href || pathname.startsWith(`${href}/`);

    const link = (href, label) => (
        <a
            href={href}
            className={`nav-link ${isActive(href) ? "nav-link-active" : ""}`}
        >
            {label}
        </a>
    );

    const isStaff = ["employee", "admin"].includes(user?.user_role);
    const isAdmin = user?.user_role === "admin";

    return (
        <header className="nav-container">

            <nav className="nav-bar nav-primary">
                <a href="/home" className="nav-brand">
                    IoT Card Store
                </a>

                <div className="nav-links">
                    {link("/home", "Home")}
                    {link("/products", "Shop")}
                    {link("/self-checkout", "Self-Checkout")}
                </div>

                <div className="nav-user">
                    {user ? (
                        <>
                            {link("/customer", "Account")}
                            {user.user_role === "customer" &&
                                link("/customer/purchases", "Purchases")}
                            {link("/customer/settings", "Settings")}

                            <span className="nav-greeting">
                                {user.user_fname || "Signed in"}
                            </span>

                            <button
                                type="button"
                                className="nav-logout"
                                onClick={() => logOut()}
                            >
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

            {isStaff && (
                <nav className="nav-bar nav-secondary">
                    <div className="nav-links">
                        {link("/dashboard", "Overview")}
                        {link("/dashboard/inventory", "Inventory")}
                        {link("/dashboard/fridges", "Fridges")}
                        {isAdmin && link("/dashboard/users", "Users")}
                    </div>
                </nav>
            )}

        </header>
    );
}

export default NavBar;
