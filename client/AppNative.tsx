import "react-native-gesture-handler";
import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
} from "@expo-google-fonts/montserrat";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";

SplashScreen.preventAutoHideAsync().catch(() => {});

import { GlobalErrorBridge } from "@/components/GlobalErrorBridge";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { I18nRoot } from "@/components/I18nRoot";
import { NativeToastHost } from "@/components/NativeToastHost";
import { ThemeProvider } from "@/context/ThemeContext";
import { SubscriptionProvider } from "@/context/SubscriptionContext";
import {
  ActiveWorkoutRecovery,
  rootNavigationRef,
} from "@/navigation/ActiveWorkoutRecovery";
import RootStackNavigator from "@/navigation/RootStackNavigator";
import { initDataSync } from "@/lib/dataSync";
import { registerWebServiceWorker } from "@/lib/installWebGlobalErrorHandlers";

// Provider ordering rationale (outside-in):
//   GestureHandlerRootView  -> required at the very top of the tree by
//                              react-native-gesture-handler.
//   SafeAreaProvider        -> exposes safe-area insets to everything below.
//   GlobalErrorBridge     -> window.onerror outside React tree.
//   ThemeProvider         -> app theme (ErrorFallback does not depend on it).
//   ErrorBoundary         -> catches render errors inside the nav tree.
//   NavigationContainer     -> root of all React Navigation state.
//
// OnboardingProvider is intentionally NOT placed here. It is owned by
// OnboardingStackNavigator (the only subtree whose screens call
// useOnboarding); duplicating it at the root would split the context and
// cause onboarding screens to read from a different instance than the
// navigator manages.
export default function AppNative() {
  const [navReady, setNavReady] = useState(false);
  const [bootstrapRoute, setBootstrapRoute] = useState<
    "Disclaimer" | "Onboarding" | "Main"
  >("Main");
  const [bootstrapComplete, setBootstrapComplete] = useState(false);

  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  });

  useEffect(() => initDataSync(), []);

  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const buildId =
        (window as Window & { __FITPLAN_BUILD_ID?: string }).__FITPLAN_BUILD_ID ??
        "dev";
      void registerWebServiceWorker(buildId);
    }
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GlobalErrorBridge>
        <SafeAreaProvider>
          <ThemeProvider>
            <SubscriptionProvider>
            <ErrorBoundary>
              <I18nRoot>
                <NavigationContainer
                  ref={rootNavigationRef}
                  onReady={() => setNavReady(true)}
                >
                  <RootStackNavigator
                    onBootstrapRoute={setBootstrapRoute}
                    onBootstrapComplete={() => setBootstrapComplete(true)}
                  />
                  <ActiveWorkoutRecovery
                    bootstrapReady={navReady && bootstrapComplete}
                    initialRoute={bootstrapRoute}
                  />
                </NavigationContainer>
                <NativeToastHost />
                <StatusBar style="auto" />
              </I18nRoot>
            </ErrorBoundary>
            </SubscriptionProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GlobalErrorBridge>
    </GestureHandlerRootView>
  );
}
