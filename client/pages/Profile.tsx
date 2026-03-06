import React, { useEffect, useState } from "react";
import { getStoredTheme, applyTheme, type Theme } from "../lib/theme";
import { api } from "../lib/api";
import { APP_NAME } from "../config";
import { useTranslation } from "react-i18next";

const BADGES = [
  { count: 1,   icon: "🏋️", key: "firstWorkout" },
  { count: 5,   icon: "🔥", key: "fiveWorkouts" },
  { count: 10,  icon: "⚡", key: "tenWorkouts" },
  { count: 25,  icon: "💪", key: "twentyFiveWorkouts" },
  { count: 50,  icon: "🥇", key: "fiftyWorkouts" },
  { count: 100, icon: "🏆", key: "hundredWorkouts" },
  { count: 250, icon: "👑", key: "twoFiftyWorkouts" },
];

const LANGUAGES = [
  { code: "en", name: "English", flag: "EN" },
  { code: "de", name: "Deutsch", flag: "DE" },
  { code: "fr", name: "Fran\u00e7ais", flag: "FR" },
  { code: "es", name: "Espa\u00f1ol", flag: "ES" },
  { code: "it", name: "Italiano", flag: "IT" },
  { code: "pt", name: "Portugu\u00eas", flag: "PT" },
];

export default function Profile() {
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  const [stats, setStats] = useState({ totalSessions: 0, totalVolume: 0, totalPRs: 0 });
  const [showLangPicker, setShowLangPicker] = useState(false);

  useEffect(() => {
    Promise.all([api.getSessions(), api.getPRs()]).then(([sessions, prs]) => {
      const totalVolume = sessions.reduce((a: number, s: any) => a + (s.totalVolume || 0), 0);
      setStats({ totalSessions: sessions.length, totalVolume, totalPRs: prs.length });
    });
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code);
    setShowLangPicker(false);
  };

  const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

  return (
    <div className="px-4 pt-8 pb-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-8">{APP_NAME}</h1>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-[var(--color-accent)]">{stats.totalSessions}</div>
          <div className="text-xs text-[var(--color-text-secondary)] mt-1">{t("profile.workouts")}</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-[var(--color-accent)]">{Math.round(stats.totalVolume / 1000)}k</div>
          <div className="text-xs text-[var(--color-text-secondary)] mt-1">{t("profile.volumeKg")}</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">{stats.totalPRs}</div>
          <div className="text-xs text-[var(--color-text-secondary)] mt-1">{t("profile.prs")}</div>
        </div>
      </div>

      <div className="mb-6">
        <div className="section-label">{t("profile.badges")}</div>
        <div className="flex flex-wrap gap-2">
          {BADGES.map(badge => {
            const earned = stats.totalSessions >= badge.count;
            return (
              <div
                key={badge.key}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl min-w-[3.5rem] transition-all ${
                  earned
                    ? "bg-[rgba(79,142,247,0.12)] border border-[var(--color-accent)]/30"
                    : "bg-[var(--color-surface-alt)] opacity-35"
                }`}
                title={t(`profile.badge_${badge.key}`, { count: badge.count })}
              >
                <span className="text-2xl">{badge.icon}</span>
                <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">{badge.count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card overflow-hidden">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between p-4 active:bg-[var(--color-surface-alt)] transition-colors"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-surface-alt)] flex items-center justify-center">
              {theme === "dark" ? (
                <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </div>
            <span className="font-medium">{t("profile.appearance")}</span>
          </div>
          <span className="text-sm text-[var(--color-text-secondary)]">{theme === "dark" ? t("profile.dark") : t("profile.light")}</span>
        </button>

        <button
          onClick={() => setShowLangPicker(true)}
          className="w-full flex items-center justify-between p-4 active:bg-[var(--color-surface-alt)] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-surface-alt)] flex items-center justify-center">
              <svg className="w-5 h-5 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-medium">{t("profile.language")}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)]">{currentLang.flag}</span>
            <span className="text-sm text-[var(--color-text-secondary)]">{currentLang.name}</span>
          </div>
        </button>
      </div>

      {showLangPicker ? (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-end sm:items-center justify-center p-6" onClick={() => setShowLangPicker(false)}>
          <div className="card p-4 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{t("profile.language")}</h3>
            <div className="space-y-1">
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                    i18n.language === lang.code
                      ? "bg-[rgba(79,142,247,0.15)] text-[var(--color-accent)]"
                      : "active:bg-[var(--color-surface-alt)]"
                  }`}
                >
                  <span className="text-sm font-bold w-8 text-center px-1 py-0.5 rounded bg-[var(--color-surface-alt)]">{lang.flag}</span>
                  <span className="font-medium">{lang.name}</span>
                  {i18n.language === lang.code ? (
                    <svg className="w-5 h-5 ml-auto text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
