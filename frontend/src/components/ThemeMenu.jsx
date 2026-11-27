import { useRef, useState } from "react";
import { ACCENTS } from "../utils/theme";
import useClickAway from "../utils/useClickAway";

const THEME_LABELS = { dark: "Dark", light: "Light", system: "System" };
const ACCENT_LABELS = { gold: "Gold", violet: "Violet", emerald: "Emerald", crimson: "Crimson" };

function ThemeIcon({ dark }) {
  return dark ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

// Dark / light / system and an accent colour, from the navbar.
function ThemeMenu({ prefs, onChange, t = (text) => text }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickAway(ref, () => setOpen(false));

  const isDark = document.documentElement.dataset.theme !== "light";

  return (
    <div className="nav-tool" ref={ref}>
      <button
        type="button"
        className="nav-tool-button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={t("Appearance")}
        title={t("Appearance")}
        onClick={() => setOpen((value) => !value)}
      >
        <ThemeIcon dark={isDark} />
      </button>

      {open && (
        <div className="nav-popover" role="dialog" aria-label={t("Appearance")}>
          <span className="nav-popover-title">{t("Theme")}</span>
          <div className="theme-options">
            {Object.keys(THEME_LABELS).map((theme) => (
              <button
                key={theme}
                type="button"
                className={`theme-option ${prefs.theme === theme ? "is-selected" : ""}`}
                aria-pressed={prefs.theme === theme}
                onClick={() => onChange({ ...prefs, theme })}
              >
                {t(THEME_LABELS[theme])}
              </button>
            ))}
          </div>

          <span className="nav-popover-title">{t("Accent colour")}</span>
          <div className="accent-options">
            {ACCENTS.map((accent) => (
              <button
                key={accent}
                type="button"
                className={`accent-swatch accent-swatch-${accent} ${prefs.accent === accent ? "is-selected" : ""}`}
                aria-pressed={prefs.accent === accent}
                aria-label={t(ACCENT_LABELS[accent])}
                title={t(ACCENT_LABELS[accent])}
                onClick={() => onChange({ ...prefs, accent })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ThemeMenu;
