
import { useEffect, useRef, useState } from "react";
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
        user_lname: localStorage.getItem("user_lname") || "",
    };
}

function NavBar() {
    const [user, setUser] = useState(readUser);
    const [accountOpen, setAccountOpen] = useState(false);
    const { pathname } = useLocation();
    const accountRef = useRef(null);

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
                localStorage.setItem("user_lname", me.user_lname);
                setUser(readUser());
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        function handleClickOutside(event) {
            if (accountRef.current && !accountRef.current.contains(event.target)) {
                setAccountOpen(false);
            }
        }

        function handleEscape(event) {
            if (event.key === "Escape") {
                setAccountOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, []);

    function logOut(message = "You have been logged out.") {
        SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
        flashToast("info", message);
        setUser(null);
        window.location.href = "/login";
    }

    const isActive = (href) =>
        pathname === href || pathname.endsWith(`/${href}`);

    const link = (href, label) => (
        <a
            href={href}
            className={`nav-link ${isActive(href) ? "nav-link-active" : ""}`}
        >
            {label}
        </a>
    );

    const isemployee = ["employee", "admin"].includes(user?.user_role);
    const isAdmin = user?.user_role === "admin";

    const firstName = user?.user_fname
        ? user.user_fname.charAt(0).toUpperCase() + user.user_fname.slice(1)
        : "";

    const lastName = user?.user_lname
        ? user.user_lname.charAt(0).toUpperCase() + user.user_lname.slice(1)
        : "";

    return (
        <header className="nav-container">

            <nav className="nav-bar nav-primary">
                <a href="/home" className="nav-brand">
                    TCG:GO
                </a>

                <div className="nav-links">
                    {link("/home", "Home")}
                    {link("/products", "Browse")}
                    {link("/self-checkout", "Shop")}
                </div>

                <div className="nav-user">
                    {user ? (
                        <div className="nav-account-dropdown" ref={accountRef}>
                            <button
                                type="button"
                                className={`nav-greeting ${accountOpen ? "nav-greeting-open" : ""}`}
                                onClick={() => setAccountOpen((open) => !open)}
                                aria-expanded={accountOpen}
                                aria-haspopup="true"
                            >
                                Welcome back, {firstName} {lastName}!
                                <span className="nav-dropdown-arrow" />
                            </button>

                            {accountOpen && (
                                <div className="nav-dropdown-menu">
                                    {link("/customer", "My Account")}

                                    {user.user_role === "customer" &&
                                        link("/customer/purchases", "My Purchases")}

                                    {link("/customer/settings", "Settings")}

                                    <div className="nav-dropdown-divider" />

                                    <button
                                        type="button"
                                        className="nav-dropdown-logout"
                                        onClick={() => logOut()}
                                    >
                                        Log Out
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {link("/login", "Log in")}
                            {link("/register", "Register")}
                        </>
                    )}
                </div>
            </nav>

            {isemployee && (
                <nav className="nav-bar nav-secondary">
                    <span className="nav-label">
                        {isAdmin ? "Admin Mode" : "Employee Mode"}
                    </span>

                    <div className="nav-links">
                        {link("/dashboard", "Overview")}
                        {link("/dashboard/inventory", "Inventory")}
                        {isAdmin && link("/dashboard/reports", "Sales Reports")}
                        {link("/dashboard/fridges", "Fridges")}
                        {isAdmin && link("/dashboard/users", "Users")}
                    </div>
                </nav>
            )}

        </header>
    );
}

export default NavBar;
