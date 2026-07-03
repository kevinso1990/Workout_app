import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, Platform } from "react-native";
import * as Localization from "expo-localization";

import en from "./locales/en/translation.json";
import de from "./locales/de/translation.json";

/** Same key as web `client/i18n.ts` LanguageDetector localStorage. */
export const APP_LANGUAGE_STORAGE_KEY = "app_language";

/**
 * Reads the user's preferred UI language from the OS.
 * Returns a BCP-47-ish string like "de-DE" / "en-US" (may be empty).
 *
 * `expo-localization` is the primary source: it exposes the OS *ordered
 * preferred-language list* and works under the New Architecture. It is
 * required here because `NativeModules.SettingsManager` is `undefined`
 * under the New Arch (TurboModules), and Hermes `Intl` resolves only the
 * region — e.g. it reports `en-DE` for a German (de-DE) device — so both
 * would wrongly default a German user to English. They remain as
 * last-resort fallbacks only.
 */
function getDeviceLanguage(): string {
  // 1. expo-localization — the OS preferred-language list (most reliable).
  try {
    const first = Localization.getLocales()?.[0];
    const tag = first?.languageTag || first?.languageCode;
    if (tag) return tag;
  } catch {
    /* module unavailable */
  }

  // 2. Legacy native-module lookup (unavailable under New Arch, kept for old builds).
  try {
    if (Platform.OS === "ios") {
      const settings = NativeModules.SettingsManager?.settings;
      const loc = settings?.AppleLanguages?.[0] || settings?.AppleLocale;
      if (loc) return loc;
    } else {
      const loc = NativeModules.I18nManager?.localeIdentifier;
      if (loc) return loc;
    }
  } catch {
    /* native modules unavailable */
  }

  // 3. Intl only resolves the region reliably — last resort.
  try {
    const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (intlLocale) return intlLocale;
  } catch {
    /* Intl may be unavailable on some Hermes configs */
  }

  return "";
}

/** German device language -> "de"; everything else -> "en". */
function detectDefaultLanguage(): "de" | "en" {
  return getDeviceLanguage().toLowerCase().startsWith("de") ? "de" : "en";
}

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
    // A manual choice wins; otherwise follow the device language
    // (German settings -> German, anything else -> English).
    const lng =
      stored === "de" || stored === "en" ? stored : detectDefaultLanguage();

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
