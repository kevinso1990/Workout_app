import { Palettes } from "@/constants/theme";
import { useThemeContext } from "@/context/ThemeContext";

/**
 * Resolves the active palette.
 *
 * Every screen that reads colours from `theme.*` is theme-aware for free. A
 * screen that still writes `Colors.light.*` is NOT — that constant is the dark
 * palette by definition, so such a screen keeps its dark colours regardless of
 * the setting. See the burn-down guard in
 * client/__tests__/themeReadiness.test.ts.
 */
export function useTheme() {
  const { isDark, resolvedScheme } = useThemeContext();
  return {
    theme: Palettes[resolvedScheme],
    isDark,
  };
}
