import { nativeRequest } from "@/lib/nativeApi";

export type RecoveryStatusRow = {
  muscle_group: string;
  recovery_percent: number;
  fatigue_score: number;
};

export async function fetchRecoveryStatus(): Promise<RecoveryStatusRow[]> {
  return nativeRequest<RecoveryStatusRow[]>("/api/recovery");
}
