import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import WelcomeScreen from "@/screens/onboarding/WelcomeScreen";
import FrequencyScreen from "@/screens/onboarding/FrequencyScreen";
import SplitPreferenceScreen from "@/screens/onboarding/SplitPreferenceScreen";
import ExercisePreferenceScreen from "@/screens/onboarding/ExercisePreferenceScreen";
import { OnboardingProvider } from "@/context/OnboardingContext";

export type OnboardingStackParamList = {
  Welcome: undefined;
  Frequency: undefined;
  SplitPreference: undefined;
  ExercisePreference: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export default function OnboardingStackNavigator() {
  return (
    <OnboardingProvider>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Frequency" component={FrequencyScreen} />
        <Stack.Screen name="SplitPreference" component={SplitPreferenceScreen} />
        <Stack.Screen name="ExercisePreference" component={ExercisePreferenceScreen} />
      </Stack.Navigator>
    </OnboardingProvider>
  );
}
