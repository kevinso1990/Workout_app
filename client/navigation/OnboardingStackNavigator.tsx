import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import WelcomeScreen from "@/screens/onboarding/WelcomeScreen";
import EquipmentScreen from "@/screens/onboarding/EquipmentScreen";
import GoalsScreen from "@/screens/onboarding/GoalsScreen";
import FrequencyScreen from "@/screens/onboarding/FrequencyScreen";
import FitnessLevelScreen from "@/screens/onboarding/FitnessLevelScreen";
import SplitSelectionScreen from "@/screens/onboarding/SplitSelectionScreen";
import CardioSportsScreen from "@/screens/onboarding/CardioSportsScreen";
import SplitPreferenceScreen from "@/screens/onboarding/SplitPreferenceScreen";
import ExercisePreferenceScreen from "@/screens/onboarding/ExercisePreferenceScreen";
import { OnboardingProvider } from "@/context/OnboardingContext";

export type OnboardingStackParamList = {
  Welcome: undefined;
  Equipment: undefined;
  Goals: undefined;
  Frequency: undefined;
  FitnessLevel: undefined;
  /** Optional cardio preferences — reachable from flows that need it; stack must list the name for typed navigation. */
  CardioSports: undefined;
  SplitPreference: undefined;
  ExercisePreference: undefined;
  SplitSelection: undefined;
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
        <Stack.Screen name="Equipment" component={EquipmentScreen} />
        <Stack.Screen name="Goals" component={GoalsScreen} />
        <Stack.Screen name="Frequency" component={FrequencyScreen} />
        <Stack.Screen name="FitnessLevel" component={FitnessLevelScreen} />
        <Stack.Screen name="CardioSports" component={CardioSportsScreen} />
        <Stack.Screen name="SplitPreference" component={SplitPreferenceScreen} />
        <Stack.Screen name="ExercisePreference" component={ExercisePreferenceScreen} />
        <Stack.Screen name="SplitSelection" component={SplitSelectionScreen} />
      </Stack.Navigator>
    </OnboardingProvider>
  );
}
