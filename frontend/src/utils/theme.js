import { useEffect, useState } from "react";

// Appearance settings, saved per browser.
export const THEMES = ["dark", "light", "system"];
export const ACCENTS = ["gold", "violet", "emerald", "crimson"];

const THEME_KEY = "theme";
const ACCENT_KEY = "accent";
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

export function readThemePrefs() {
  const theme = localStorage.getItem(THEME_KEY);
  const accent = localStorage.getItem(ACCENT_KEY);
  return {
    theme: THEMES.includes(theme) ? theme : "dark",
    accent: ACCENTS.includes(accent) ? accent : "gold",
  };
}

// The kiosk keeps its own dark look, whatever the visitor picked.
export function applyTheme(prefs = readThemePrefs(), kiosk = false) {
  const root = document.documentElement;
  const resolved =
    prefs.theme === "system" ? (darkQuery.matches ? "dark" : "light") : prefs.theme;

  root.dataset.theme = kiosk ? "dark" : resolved;
  root.dataset.accent = kiosk ? "gold" : prefs.accent;
  root.style.colorScheme = root.dataset.theme;
}

export function useTheme(kiosk = false) {
  const [prefs, setPrefs] = useState(readThemePrefs);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, prefs.theme);
    localStorage.setItem(ACCENT_KEY, prefs.accent);
    applyTheme(prefs, kiosk);

    // Follow the operating system while "system" is selected.
    const onChange = () => applyTheme(prefs, kiosk);
    darkQuery.addEventListener("change", onChange);
    return () => darkQuery.removeEventListener("change", onChange);
  }, [prefs, kiosk]);

  return [prefs, setPrefs];
}
