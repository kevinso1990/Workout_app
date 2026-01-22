import React, { createContext, useContext, useState, ReactNode } from "react";
import { UserPreferences } from "@/lib/storage";

interface OnboardingState {
  workoutDaysPerWeek: number;
  cardioDays: string[];
  splitPreference: "choose" | "recommended" | null;
  exercisePreference: "choose" | "default" | null;
}

interface OnboardingContextType {
  state: OnboardingState;
  setWorkoutDays: (days: number) => void;
  setCardioDays: (sports: string[]) => void;
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
  cardioDays: [],
  splitPreference: null,
  exercisePreference: null,
};

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>(initialState);

  const setWorkoutDays = (days: number) => {
    setState((prev) => ({ ...prev, workoutDaysPerWeek: days }));
  };

  const setCardioDays = (sports: string[]) => {
    setState((prev) => ({ ...prev, cardioDays: sports }));
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
      cardioDays: state.cardioDays,
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
        setCardioDays,
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
