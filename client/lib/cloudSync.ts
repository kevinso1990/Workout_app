import AsyncStorage from "@react-native-async-storage/async-storage";

import { getApiUrl } from "@/lib/query-client";
import {
  decodeJwtSub,
  ensureAuthToken,
  getAuthHeaders,
  getStoredToken,
} from "@/lib/nativeAuth";
import {
  getWorkoutHistory,
  getWorkoutPlans,
  getUserPreferences,
  getOnboardingComplete,
  setUserPreferences,
  setOnboardingComplete,
  replaceWorkoutHistory,
  replaceWorkoutPlans,
  type WorkoutSession,
  type WorkoutPlan,
  type UserPreferences,
} from "@/lib/storage";

const CLOUD_USER_ID_KEY = "cloud_user_id";

/**
 * Snapshot bundled into the backend's `currentPlan` field. We send more than
 * just the plan so a wiped device can be fully restored (plans + prefs +
 * onboarding flag), landing the user back in the app instead of onboarding.
 */
type CloudSnapshot = {
  plans: WorkoutPlan[];
  preferences: UserPreferences | null;
  onboardingComplete: boolean;
};

type SyncGetResponse = {
  found: boolean;
  workoutHistory: WorkoutSession[];
  currentPlan: CloudSnapshot | null;
  updatedAt?: string;
};

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID. Neutral "tyl-" prefix
  // (never "dev-", which looked broken when shown to users as a backup code).
  return `tyl-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Returns the stable anonymous backup id, generating + persisting one once. */
export async function getCloudUserId(): Promise<string> {
  let id = await AsyncStorage.getItem(CLOUD_USER_ID_KEY);
  if (!id) {
    id = generateId();
    await AsyncStorage.setItem(CLOUD_USER_ID_KEY, id);
  }
  return id;
}

/** Lets the user adopt an existing backup id (manual restore from a code). */
export async function setCloudUserId(id: string): Promise<void> {
  await AsyncStorage.setItem(CLOUD_USER_ID_KEY, id.trim());
}

/**
 * Backup key used for cloud sync. Authenticated users sync under `u{userId}`
 * so data follows their account; guests keep the anonymous device UUID.
 */
export async function getSyncBackupKey(): Promise<string> {
  const token = await getStoredToken();
  if (token) {
    const sub = decodeJwtSub(token);
    if (sub != null) return `u${sub}`;
  }
  return getCloudUserId();
}

function syncUrl(path = ""): string {
  return new URL(`/api/workouts/sync${path}`, getApiUrl()).toString();
}

/**
 * Pushes the current local history + a full snapshot to the cloud backup.
 * Fire-and-forget: never throws, returns success boolean for callers that care.
 */
export async function pushCloudBackup(): Promise<boolean> {
  try {
    const [userId, workoutHistory, plans, preferences, onboardingComplete] =
      await Promise.all([
        getSyncBackupKey(),
        getWorkoutHistory(),
        getWorkoutPlans(),
        getUserPreferences(),
        getOnboardingComplete(),
      ]);

    const snapshot: CloudSnapshot = { plans, preferences, onboardingComplete };

    await ensureAuthToken();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(syncUrl(), {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          userId,
          workoutHistory,
          currentPlan: snapshot,
        }),
        signal: controller.signal,
      });
      return res.ok;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return false;
  }
}

type RestoreResult = {
  restored: boolean;
  historyCount: number;
  planCount: number;
};

/**
 * Fetches the cloud backup for the given id and writes it into local storage.
 * Overwrites local data — only call when local is empty or on explicit
 * user-initiated restore.
 */
export async function restoreFromCloud(userId: string): Promise<RestoreResult> {
  const empty: RestoreResult = {
    restored: false,
    historyCount: 0,
    planCount: 0,
  };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    let data: SyncGetResponse;
    try {
      const res = await fetch(syncUrl(`/${encodeURIComponent(userId)}`), {
        method: "GET",
        headers: await getAuthHeaders(),
        signal: controller.signal,
      });
      if (!res.ok) return empty;
      data = (await res.json()) as SyncGetResponse;
    } finally {
      clearTimeout(timeout);
    }

    if (!data.found) return empty;

    const history = Array.isArray(data.workoutHistory)
      ? data.workoutHistory
      : [];
    const snapshot = data.currentPlan;
    const plans = Array.isArray(snapshot?.plans) ? snapshot!.plans : [];

    if (history.length > 0) {
      await replaceWorkoutHistory(history);
    }
    if (plans.length > 0) {
      await replaceWorkoutPlans(plans);
    }
    if (snapshot?.preferences) {
      await setUserPreferences(snapshot.preferences);
    }
    // If the cloud has real data, the user already onboarded — skip it.
    if (snapshot?.onboardingComplete || history.length > 0 || plans.length > 0) {
      await setOnboardingComplete(true);
    }

    return {
      restored: history.length > 0 || plans.length > 0,
      historyCount: history.length,
      planCount: plans.length,
    };
  } catch {
    return empty;
  }
}

/**
 * App-start safety net: if local storage has no history AND no plans but a
 * backup id exists, pull the data back from the cloud. Returns whether a
 * restore happened (so the caller can re-route to Main).
 */
export async function restoreFromCloudIfEmpty(): Promise<boolean> {
  try {
    const [history, plans] = await Promise.all([
      getWorkoutHistory(),
      getWorkoutPlans(),
    ]);
    if (history.length > 0 || plans.length > 0) return false;

    const backupKey = await getSyncBackupKey();
    const result = await restoreFromCloud(backupKey);
    return result.restored;
  } catch {
    return false;
  }
}
