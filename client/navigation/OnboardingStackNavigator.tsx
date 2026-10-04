import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import WelcomeScreen from "@/screens/onboarding/WelcomeScreen";
import EquipmentScreen from "@/screens/onboarding/EquipmentScreen";
import GoalsScreen from "@/screens/onboarding/GoalsScreen";
import FrequencyScreen from "@/screens/onboarding/FrequencyScreen";
import CommitmentsScreen from "@/screens/onboarding/CommitmentsScreen";
import AvoidExercisesScreen from "@/screens/onboarding/AvoidExercisesScreen";
import FitnessLevelScreen from "@/screens/onboarding/FitnessLevelScreen";
import SplitSelectionScreen from "@/screens/onboarding/SplitSelectionScreen";
import { OnboardingProvider } from "@/context/OnboardingContext";

export type OnboardingStackParamList = {
  Welcome: undefined;
  Equipment: undefined;
  Goals: undefined;
  Commitments: undefined;
  AvoidExercises: undefined;
  Frequency: undefined;
  FitnessLevel: undefined;
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
        <Stack.Screen name="Commitments" component={CommitmentsScreen} />
        <Stack.Screen name="AvoidExercises" component={AvoidExercisesScreen} />
        <Stack.Screen name="Frequency" component={FrequencyScreen} />
        <Stack.Screen name="FitnessLevel" component={FitnessLevelScreen} />
        <Stack.Screen name="SplitSelection" component={SplitSelectionScreen} />
      </Stack.Navigator>
    </OnboardingProvider>
  );
}
