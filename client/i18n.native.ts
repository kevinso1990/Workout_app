import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";

import en from "./locales/en/translation.json";
import de from "./locales/de/translation.json";

/** Same key as web `client/i18n.ts` LanguageDetector localStorage. */
export const APP_LANGUAGE_STORAGE_KEY = "app_language";

let initPromise: Promise<typeof i18n> | null = null;
let languagePersistListenerAttached = false;

/**
 * Initializes i18next for Expo / React Native (no browser LanguageDetector).
 * Call once before rendering screens that use `useTranslation`.
 */
export function initI18nNative(): Promise<typeof i18n> {
  if (i18n.isInitialized) return Promise.resolve(i18n);
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const stored = await AsyncStorage.getItem(APP_LANGUAGE_STORAGE_KEY);
    const lng = stored === "de" || stored === "en" ? stored : "en";

    await i18n.use(initReactI18next).init({
      resources: {
        en: { translation: en },
        de: { translation: de },
      },
      lng,
      fallbackLng: "en",
      supportedLngs: ["en", "de"],
      interpolation: { escapeValue: false },
    });

    if (!languagePersistListenerAttached) {
      languagePersistListenerAttached = true;
      i18n.on("languageChanged", (nextLng) => {
        void AsyncStorage.setItem(APP_LANGUAGE_STORAGE_KEY, nextLng);
      });
    }

    return i18n;
  })();

  return initPromise;
}
