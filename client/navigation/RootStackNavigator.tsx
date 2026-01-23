import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import MainTabNavigator from "@/navigation/MainTabNavigator";
import OnboardingStackNavigator from "@/navigation/OnboardingStackNavigator";
import CreatePlanScreen from "@/screens/CreatePlanScreen";
import PlanDetailScreen from "@/screens/PlanDetailScreen";
import StartWorkoutScreen from "@/screens/main/StartWorkoutScreen";
import ActiveWorkoutScreen from "@/screens/main/ActiveWorkoutScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useTheme } from "@/hooks/useTheme";
import { getOnboardingComplete } from "@/lib/storage";
import { Colors } from "@/constants/theme";

export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
  CreatePlan: undefined;
  PlanDetail: { planId: string };
  StartWorkout: { planId?: string };
  ActiveWorkout: { planId: string; planName: string; dayIndex: number };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(true);

  useEffect(() => {
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    try {
      const complete = await getOnboardingComplete();
      setShowOnboarding(!complete);
    } catch (error) {
      console.error("Error checking onboarding:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.backgroundRoot,
        }}
      >
        <ActivityIndicator color={Colors.light.primary} size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={screenOptions}
      initialRouteName={showOnboarding ? "Onboarding" : "Main"}
    >
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
          headerTitle: "New Workout Plan",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="PlanDetail"
        component={PlanDetailScreen}
        options={{
          headerTitle: "Workout Plan",
        }}
      />
      <Stack.Screen
        name="StartWorkout"
        component={StartWorkoutScreen}
        options={{
          headerTitle: "Start Workout",
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
