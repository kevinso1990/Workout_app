import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";

import {
  exerciseNamesReady,
  localizeExerciseName,
  subscribeExerciseNames,
} from "@/lib/exerciseNameCatalog";

/**
 * Returns a function that maps an exercise's canonical (English) name to its
 * localized display name. Re-renders the caller when the German catalog
 * finishes hydrating, so names swap in as soon as the map is ready.
 */
export function useLocalizeExerciseName(): (name: string) => string {
  const { i18n } = useTranslation();
  // Subscribe so the component re-renders on hydration (value flips to true).
  useSyncExternalStore(
    subscribeExerciseNames,
    exerciseNamesReady,
    exerciseNamesReady,
  );
  return (name: string) => localizeExerciseName(name, i18n.language);
}
