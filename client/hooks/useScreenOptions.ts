import { Platform } from "react-native";
import { NativeStackNavigationOptions } from "@react-navigation/native-stack";

import { useTheme } from "@/hooks/useTheme";

interface UseScreenOptionsParams {
  transparent?: boolean;
}

export function useScreenOptions({
  transparent = true,
}: UseScreenOptionsParams = {}): NativeStackNavigationOptions {
  const { theme, isDark } = useTheme();

  return {
    headerTitleAlign: "center",
    headerTransparent: transparent,
    headerBlurEffect: isDark ? "dark" : "light",
    headerTintColor: theme.text,
    headerBackVisible: true,
    // Chevron only. Otherwise iOS labels the back button with the previous
    // route's name — internal, English ids like "Main" leaked into the UI.
    headerBackButtonDisplayMode: "minimal",
    headerStyle: {
      backgroundColor: Platform.select({
        ios: undefined,
        android: theme.backgroundRoot,
        web: theme.backgroundRoot,
      }),
    },
    gestureEnabled: true,
    gestureDirection: "horizontal",
    fullScreenGestureEnabled: true,
    contentStyle: {
      backgroundColor: theme.backgroundRoot,
    },
  };
}
