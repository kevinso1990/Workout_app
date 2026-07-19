import { nativeRequest } from "@/lib/nativeApi";

export type SplitAgeResponse = {
  planId: number;
  planName: string;
  weeksOnPlan: number;
  shouldPrompt: boolean;
} | null;

export async function fetchSplitAge(
  thresholdWeeks = 4,
): Promise<SplitAgeResponse> {
  return nativeRequest<SplitAgeResponse>(
    `/api/split-refresh?threshold=${thresholdWeeks}`,
  );
}

export async function snoozeSplitRefreshOnServer(): Promise<void> {
  await nativeRequest<{ ok: boolean }>("/api/split-refresh/snooze", {
    method: "POST",
    body: JSON.stringify({}),
  });
}
