import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import MainTabNavigator from "@/navigation/MainTabNavigator";
import OnboardingStackNavigator from "@/navigation/OnboardingStackNavigator";
import CreatePlanScreen from "@/screens/CreatePlanScreen";
import EditPlanScreen from "@/screens/EditPlanScreen";
import PlanDetailScreen from "@/screens/PlanDetailScreen";
import ImportWorkoutScreen from "@/screens/ImportWorkoutScreen";
import StartWorkoutScreen from "@/screens/main/StartWorkoutScreen";
import ActiveWorkoutScreen from "@/screens/main/ActiveWorkoutScreen";
import DisclaimerScreen from "@/screens/DisclaimerScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { HEVY } from "@/constants/hevyLayout";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useTheme } from "@/hooks/useTheme";
import {
  getDisclaimerAccepted,
  getOnboardingComplete,
} from "@/lib/storage";

export type RootStackParamList = {
  Disclaimer: undefined;
  Onboarding: undefined;
  Main: undefined;
  CreatePlan: undefined;
  EditPlan: { planId: string };
  PlanDetail: { planId: string };
  ImportWorkout: undefined;
  StartWorkout: { planId?: string };
  ActiveWorkout: {
    planId: string;
    planName: string;
    dayIndex: number;
    restored?: boolean;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type BootstrapTarget = "Disclaimer" | "Onboarding" | "Main";

type RootStackNavigatorProps = {
  onBootstrapRoute?: (route: BootstrapTarget) => void;
  onBootstrapComplete?: () => void;
};

export default function RootStackNavigator({
  onBootstrapRoute,
  onBootstrapComplete,
}: RootStackNavigatorProps) {
  const screenOptions = useScreenOptions();
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState<BootstrapTarget>("Disclaimer");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const disclaimerOk = await getDisclaimerAccepted();
        if (!disclaimerOk) {
          if (!cancelled) {
            setInitialRoute("Disclaimer");
            onBootstrapRoute?.("Disclaimer");
          }
          return;
        }
        const onboardingComplete = await getOnboardingComplete();
        if (!cancelled) {
          const route = onboardingComplete ? "Main" : "Onboarding";
          setInitialRoute(route);
          onBootstrapRoute?.(route);
        }
      } catch (error) {
        console.error("Bootstrap error:", error);
        if (!cancelled) {
          setInitialRoute("Disclaimer");
          onBootstrapRoute?.("Disclaimer");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          onBootstrapComplete?.();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onBootstrapRoute, onBootstrapComplete]);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: HEVY.canvas,
        }}
      >
        <BrandLogo height={56} testID="brand-logo-bootstrap" />
        <ActivityIndicator
          color={theme.primary}
          size="large"
          style={{ marginTop: 24 }}
        />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={screenOptions}
      initialRouteName={initialRoute}
    >
      <Stack.Screen
        name="Disclaimer"
        component={DisclaimerScreen}
        options={{
          headerShown: false,
          gestureEnabled: false,
          animation: "fade",
        }}
      />
      <Stack.Screen
        name="Onboarding"
        component={OnboardingStackNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Main"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CreatePlan"
        component={CreatePlanScreen}
        options={{
          headerTitle: () => <HeaderTitle brand />,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="EditPlan"
        component={EditPlanScreen}
        options={{
          headerTitle: () => <HeaderTitle brand />,
          headerBackTitle: "",
        }}
      />
      <Stack.Screen
        name="PlanDetail"
        component={PlanDetailScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="StartWorkout"
        component={StartWorkoutScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="ImportWorkout"
        component={ImportWorkoutScreen}
        options={{
          headerTitle: () => <HeaderTitle brand />,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="ActiveWorkout"
        component={ActiveWorkoutScreen}
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
}
