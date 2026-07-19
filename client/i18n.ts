import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en/translation.json";
import de from "./locales/de/translation.json";
import fr from "./locales/fr/translation.json";
import es from "./locales/es/translation.json";
import it from "./locales/it/translation.json";
import pt from "./locales/pt/translation.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      de: { translation: de },
      fr: { translation: fr },
      es: { translation: es },
      it: { translation: it },
      pt: { translation: pt },
    },
    // No hardcoded `lng`: let the detector pick the browser/OS language.
    // German-speaking visitors (de, de-DE, de-AT, de-CH) get German; everyone
    // else falls back to English. A manual choice in localStorage wins.
    supportedLngs: ["de", "en"],
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "app_language",
    },
  });

i18n.on("languageChanged", (lng) => {
  document.documentElement.setAttribute("lang", lng);
});

document.documentElement.setAttribute("lang", i18n.language || "en");

export default i18n;
