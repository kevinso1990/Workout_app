import React, { createContext, useContext, useState, ReactNode } from "react";
import { UserPreferences } from "@/lib/storage";
import type {
  FitnessLevel,
  FitnessGoal,
  Equipment,
  MuscleGroup,
} from "@/lib/onboardingUtils";
export type { FitnessLevel, FitnessGoal, Equipment, MuscleGroup } from "@/lib/onboardingUtils";

interface OnboardingState {
  workoutDaysPerWeek: number;
  fitnessLevel: FitnessLevel | null;
  fitnessGoals: FitnessGoal[];
  equipment: Equipment | null;
  focusMuscles: MuscleGroup[];
}

interface OnboardingContextType {
  state: OnboardingState;
  setWorkoutDays: (days: number) => void;
  setFitnessLevel: (level: FitnessLevel) => void;
  setFitnessGoals: (goals: FitnessGoal[]) => void;
  setEquipment: (equipment: Equipment) => void;
  setFocusMuscles: (muscles: MuscleGroup[]) => void;
  getPreferences: () => UserPreferences;
  reset: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(
  undefined
);

const initialState: OnboardingState = {
  workoutDaysPerWeek: 3,
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

  const getPreferences = (): UserPreferences => {
    return {
      workoutDaysPerWeek: state.workoutDaysPerWeek,
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
