import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import WelcomeScreen from "@/screens/onboarding/WelcomeScreen";
import EquipmentScreen from "@/screens/onboarding/EquipmentScreen";
import GoalsScreen from "@/screens/onboarding/GoalsScreen";
import FrequencyScreen from "@/screens/onboarding/FrequencyScreen";
import SplitSelectionScreen from "@/screens/onboarding/SplitSelectionScreen";
import { OnboardingProvider } from "@/context/OnboardingContext";

export type OnboardingStackParamList = {
  Welcome: undefined;
  Equipment: undefined;
  Goals: undefined;
  Frequency: undefined;
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
        <Stack.Screen name="SplitSelection" component={SplitSelectionScreen} />
      </Stack.Navigator>
    </OnboardingProvider>
  );
}