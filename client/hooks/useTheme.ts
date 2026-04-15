import { Colors } from "@/constants/theme";
import { useThemeContext } from "@/context/ThemeContext";

export function useTheme() {
  const { isDark, resolvedScheme } = useThemeContext();
  return {
    theme: Colors[resolvedScheme],
    isDark,
  };
}
