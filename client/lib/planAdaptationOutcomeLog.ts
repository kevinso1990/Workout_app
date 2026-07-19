import AsyncStorage from "@react-native-async-storage/async-storage";

import type { PerformanceSignalType } from "../../shared/signalDetection";

const KEY = "plan_adaptation_outcome_log_v1";
const MAX_ENTRIES = 200;

export type PlanAdaptationUserAction = "accept" | "dismiss" | "snooze";

export interface PlanAdaptationOutcomeEntry {
  signal_type: PerformanceSignalType;
  exercise_name?: string;
  sessions_analyzed: number;
  proposal_summary: string;
  user_action: PlanAdaptationUserAction;
  timestamp: string;
}

export async function logPlanAdaptationOutcome(
  entry: Omit<PlanAdaptationOutcomeEntry, "timestamp">,
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list: PlanAdaptationOutcomeEntry[] = raw ? JSON.parse(raw) : [];
    list.push({ ...entry, timestamp: new Date().toISOString() });
    const trimmed = list.slice(-MAX_ENTRIES);
    await AsyncStorage.setItem(KEY, JSON.stringify(trimmed));
    if (__DEV__) {
      console.info("[planAdaptation] outcome", entry);
    }
  } catch (err) {
    console.warn("[planAdaptation] failed to log outcome", err);
  }
}
