import React from "react";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ThemeProvider, useThemeContext } from "@/context/ThemeContext";

// Inner component so NavigationContainer can read the resolved theme from context.
function AppNavigator() {
  const { isDark } = useThemeContext();
  return (
    <NavigationContainer theme={isDark ? DarkTheme : DefaultTheme}>
      <RootStackNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppNavigator />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
