import React, { useEffect, useState } from "react";
import { getStoredTheme, applyTheme, type Theme } from "../lib/theme";
import { api } from "../lib/api";
import { APP_NAME } from "../config";

export default function Profile() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  const [stats, setStats] = useState({ totalSessions: 0, totalVolume: 0, totalPRs: 0 });

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

  return (
    <div className="px-4 pt-8 pb-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-8">{APP_NAME}</h1>

      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-[var(--color-accent)]">{stats.totalSessions}</div>
          <div className="text-xs text-[var(--color-text-secondary)] mt-1">Workouts</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-[var(--color-accent)]">{Math.round(stats.totalVolume / 1000)}k</div>
          <div className="text-xs text-[var(--color-text-secondary)] mt-1">Volume (kg)</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">{stats.totalPRs}</div>
          <div className="text-xs text-[var(--color-text-secondary)] mt-1">PRs</div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between p-4 active:bg-[var(--color-surface-alt)] transition-colors"
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
            <span className="font-medium">Appearance</span>
          </div>
          <span className="text-sm text-[var(--color-text-secondary)]">{theme === "dark" ? "Dark" : "Light"}</span>
        </button>
      </div>
    </div>
  );
}
