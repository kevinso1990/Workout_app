import { useCallback, useEffect, useState } from "react";

import {
  loadMeasureOverrides,
  setMeasureOverride,
  type ExerciseMeasure,
  type MeasureOverrides,
} from "@/lib/customExercises";

/** The user's per-exercise "weight or seconds" choices, loaded once and kept in sync. */
export function useMeasureOverrides() {
  const [overrides, setOverrides] = useState<MeasureOverrides>({});
  useEffect(() => {
    let cancelled = false;
    void loadMeasureOverrides().then((o) => {
      if (!cancelled) setOverrides(o);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const setMeasure = useCallback(async (name: string, measure: ExerciseMeasure) => {
    setOverrides(await setMeasureOverride(name, measure));
  }, []);
  return { overrides, setMeasure };
}
