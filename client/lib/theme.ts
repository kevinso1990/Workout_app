const THEME_KEY = "workoutapp_theme";

export type Theme = "dark" | "light";

export function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return "dark";
}

export function setStoredTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  setStoredTheme(theme);
}
