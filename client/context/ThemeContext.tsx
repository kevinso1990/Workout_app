import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "theme";

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  isDark: boolean;
  resolvedScheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // "Chalk & Iron" is a committed dark identity — dark is the default and
  // the palette is identical in both schemes, so this only drives StatusBar
  // and any isDark checks. 'light' is honoured if a user explicitly picks it.
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const systemScheme = useColorScheme();

  // Load persisted theme on mount. Default to dark; only an explicit stored
  // 'light' switches away from the Chalk & Iron dark default.
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      setModeState(saved === "light" ? "light" : "dark");
    });
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
  }, []);

  const resolvedScheme = useMemo(
    (): "light" | "dark" =>
      mode === "system" ? (systemScheme ?? "light") : mode,
    [mode, systemScheme]
  );

  const value = useMemo(
    () => ({
      mode,
      setMode,
      isDark: resolvedScheme === "dark",
      resolvedScheme,
    }),
    [mode, setMode, resolvedScheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeContext must be used within ThemeProvider");
  }
  return ctx;
}
