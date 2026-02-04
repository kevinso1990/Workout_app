import React, { createContext, useContext, useState, ReactNode } from "react";
import { UserPreferences } from "@/lib/storage";

export type FitnessLevel = "beginner" | "intermediate" | "advanced";
export type FitnessGoal = "build_muscle" | "lose_fat" | "get_stronger" | "stay_fit";
export type Equipment = "full_gym" | "dumbbells_only" | "home_minimal" | "bodyweight";
export type MuscleGroup = "chest" | "back" | "shoulders" | "arms" | "legs" | "core";

interface OnboardingState {
  workoutDaysPerWeek: number;
  cardioDays: string[];
  splitPreference: "choose" | "recommended" | null;
  exercisePreference: "choose" | "default" | null;
  fitnessLevel: FitnessLevel | null;
  fitnessGoals: FitnessGoal[];
  equipment: Equipment | null;
  focusMuscles: MuscleGroup[];
}

interface OnboardingContextType {
  state: OnboardingState;
  setWorkoutDays: (days: number) => void;
  setCardioDays: (sports: string[]) => void;
  setSplitPreference: (preference: "choose" | "recommended") => void;
  setExercisePreference: (preference: "choose" | "default") => void;
  setFitnessLevel: (level: FitnessLevel) => void;
  setFitnessGoals: (goals: FitnessGoal[]) => void;
  setEquipment: (equipment: Equipment) => void;
  setFocusMuscles: (muscles: MuscleGroup[]) => void;
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
  fitnessLevel: null,
  fitnessGoals: [],
  equipment: null,
  focusMuscles: [],
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

  const setFitnessLevel = (level: FitnessLevel) => {
    setState((prev) => ({ ...prev, fitnessLevel: level }));
  };

  const setFitnessGoals = (goals: FitnessGoal[]) => {
    setState((prev) => ({ ...prev, fitnessGoals: goals }));
  };

  const setEquipment = (equipment: Equipment) => {
    setState((prev) => ({ ...prev, equipment: equipment }));
  };

  const setFocusMuscles = (muscles: MuscleGroup[]) => {
    setState((prev) => ({ ...prev, focusMuscles: muscles }));
  };

  const getPreferences = (): UserPreferences | null => {
    if (!state.splitPreference || !state.exercisePreference) return null;
    return {
      workoutDaysPerWeek: state.workoutDaysPerWeek,
      splitPreference: state.splitPreference,
      exercisePreference: state.exercisePreference,
      cardioDays: state.cardioDays,
      fitnessLevel: state.fitnessLevel,
      fitnessGoals: state.fitnessGoals,
      equipment: state.equipment,
      focusMuscles: state.focusMuscles,
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
        setFitnessLevel,
        setFitnessGoals,
        setEquipment,
        setFocusMuscles,
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
