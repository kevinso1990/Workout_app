import React, { createContext, useContext, useState, ReactNode } from "react";
import { UserPreferences } from "@/lib/storage";

interface OnboardingState {
  workoutDaysPerWeek: number;
  splitPreference: "choose" | "recommended" | null;
  exercisePreference: "choose" | "default" | null;
}

interface OnboardingContextType {
  state: OnboardingState;
  setWorkoutDays: (days: number) => void;
  setSplitPreference: (preference: "choose" | "recommended") => void;
  setExercisePreference: (preference: "choose" | "default") => void;
  getPreferences: () => UserPreferences | null;
  reset: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(
  undefined
);

const initialState: OnboardingState = {
  workoutDaysPerWeek: 3,
  splitPreference: null,
  exercisePreference: null,
};

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>(initialState);

  const setWorkoutDays = (days: number) => {
    setState((prev) => ({ ...prev, workoutDaysPerWeek: days }));
  };

  const setSplitPreference = (preference: "choose" | "recommended") => {
    setState((prev) => ({ ...prev, splitPreference: preference }));
  };

  const setExercisePreference = (preference: "choose" | "default") => {
    setState((prev) => ({ ...prev, exercisePreference: preference }));
  };

  const getPreferences = (): UserPreferences | null => {
    if (!state.splitPreference || !state.exercisePreference) return null;
    return {
      workoutDaysPerWeek: state.workoutDaysPerWeek,
      splitPreference: state.splitPreference,
      exercisePreference: state.exercisePreference,
    };
  };

  const reset = () => {
    setState(initialState);
  };

  return (
    <OnboardingContext.Provider
      value={{
        state,
        setWorkoutDays,
        setSplitPreference,
        setExercisePreference,
        getPreferences,
        reset,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
}
