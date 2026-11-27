
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { authHeaders, SESSION_KEYS } from "../utils/auth";
import { flashToast } from "../components/Toaster";
import NotificationBell from "../components/NotificationBell";
import ThemeMenu from "../components/ThemeMenu";
import { useI18n } from "../utils/i18n";

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

function NavBar({ themePrefs, onThemeChange }) {
    const { t, lang, setLang } = useI18n();
    const [user, setUser] = useState(readUser);
    const [accountOpen, setAccountOpen] = useState(false);
    // Phone-size menu (the links collapse behind a button under 768px)
    const [menuOpen, setMenuOpen] = useState(false);
    const { pathname } = useLocation();
    const accountRef = useRef(null);

    useEffect(() => {
        const saved = readUser();
        if (!saved) return;

        fetch(`${API}/me`, { headers: authHeaders() })
            .then(async (res) => {
                if (res.status === 401) {
                    logOut(t("Your session expired. Please log in again."));
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

    function logOut(message = t("You have been logged out.")) {
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

    const isAdmin = user?.user_role === "admin";

    const firstName = user?.user_fname
        ? user.user_fname.charAt(0).toUpperCase() + user.user_fname.slice(1)
        : "";

    const lastName = user?.user_lname
        ? user.user_lname.charAt(0).toUpperCase() + user.user_lname.slice(1)
        : "";

    return (
        <header className={`nav-container ${menuOpen ? "nav-menu-open" : ""}`}>

            <nav className="nav-bar nav-primary">
                <a href="/home" className="nav-brand">
                    TCG:GO
                </a>

                <div className="nav-links">
                    {link("/home", t("Home"))}
                    {link("/products", t("Browse"))}
                    {link("/self-checkout", t("Shop"))}
                </div>

                <div className="nav-tools">
                    <button
                        type="button"
                        className="nav-tool-button language-toggle"
                        onClick={() => setLang(lang === "en" ? "fr" : "en")}
                        aria-label={lang === "en" ? "Passer au français" : "Switch to English"}
                        title={lang === "en" ? "Français" : "English"}
                    >
                        {lang === "en" ? "FR" : "EN"}
                    </button>
                    <ThemeMenu prefs={themePrefs} onChange={onThemeChange} t={t} />
                    {user && <NotificationBell />}
                </div>

                <button
                    type="button"
                    className="nav-menu-toggle"
                    aria-expanded={menuOpen}
                    aria-label={menuOpen ? t("Close menu") : t("Open menu")}
                    onClick={() => setMenuOpen((open) => !open)}
                >
                    <span aria-hidden="true">{menuOpen ? "✕" : "☰"}</span>
                </button>

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
                                {t("Welcome back, {name}!", { name: `${firstName} ${lastName}`.trim() })}
                                <span className="nav-dropdown-arrow" />
                            </button>

                            {accountOpen && (
                                <div className="nav-dropdown-menu">
                                    {link("/customer", t("My Account"))}

                                    {user.user_role === "customer" &&
                                        link("/customer/purchases", t("My Purchases"))}

                                    {link("/customer/settings", t("Settings"))}

                                    <div className="nav-dropdown-divider" />

                                    <button
                                        type="button"
                                        className="nav-dropdown-logout"
                                        onClick={() => logOut()}
                                    >
                                        {t("Log Out")}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {link("/login", t("Log in"))}
                            {link("/register", t("Register"))}
                        </>
                    )}
                </div>
            </nav>

            {isAdmin && (
                <nav className="nav-bar nav-secondary">
                    <span className="nav-label">{t("Admin Mode")}</span>

                    <div className="nav-links">
                        {link("/dashboard", t("Overview"))}
                        {link("/dashboard/inventory", t("Inventory"))}
                        {link("/dashboard/reports", t("Reports"))}
                        {link("/dashboard/fridges", t("Fridges"))}
                        {link("/dashboard/users", t("Users"))}
                    </div>
                </nav>
            )}

        </header>
    );
}

export default NavBar;
