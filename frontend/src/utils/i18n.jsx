import { createContext, useContext, useEffect, useMemo, useState } from "react";
import selfCheckoutFr from "../assets/translations/self_checkout.json";
import siteFr from "../assets/translations/site.json";

// English text is the key; French comes from the translation files.
// Placeholders like {count} are filled in from the params object.
const FRENCH = { ...selfCheckoutFr, ...siteFr };
const LANGUAGE_KEY = "language";

function startingLanguage() {
  const saved = localStorage.getItem(LANGUAGE_KEY);
  if (saved === "en" || saved === "fr") return saved;
  return (navigator.language || "en").toLowerCase().startsWith("fr") ? "fr" : "en";
}

let currentLanguage = startingLanguage();

export function currentLang() {
  return currentLanguage;
}

export function localeFor(lang = currentLanguage) {
  return lang === "fr" ? "fr-CA" : "en-CA";
}

// Usable outside React too (PDF exports, helpers).
export function translate(text, params, lang = currentLanguage) {
  if (text == null) return "";
  const base = lang === "fr" ? FRENCH[text] ?? text : text;
  if (!params) return base;
  return base.replace(/\{(\w+)\}/g, (match, key) =>
    params[key] !== undefined ? String(params[key]) : match
  );
}

const LanguageContext = createContext({
  lang: currentLanguage,
  setLang: () => {},
  t: translate,
  locale: localeFor(),
});

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(currentLanguage);

  useEffect(() => {
    currentLanguage = lang;
    localStorage.setItem(LANGUAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  // Same object until the language changes, so effects that use t don't re-run.
  const value = useMemo(
    () => ({
      lang,
      setLang,
      t: (text, params) => translate(text, params, lang),
      locale: localeFor(lang),
    }),
    [lang]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useI18n() {
  return useContext(LanguageContext);
}
