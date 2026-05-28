"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { en } from "./translations/en";
import { ar } from "./translations/ar";
import { fr } from "./translations/fr";

const translations = { en, ar, fr };

const LanguageContext = createContext({
  lang: "en",
  setLang: () => {},
  t: (key) => key,
  dir: "ltr",
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sellora-lang");
    if (saved && translations[saved]) {
      setLangState(saved);
    }
    setMounted(true);
  }, []);

  const setLang = (l) => {
    setLangState(l);
    localStorage.setItem("sellora-lang", l);
    document.documentElement.setAttribute("dir", l === "ar" ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", l);
  };

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", lang);
  }, [lang, mounted]);

  const t = (key) => {
    return translations[lang]?.[key] || translations.en?.[key] || key;
  };

  const dir = lang === "ar" ? "rtl" : "ltr";

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
