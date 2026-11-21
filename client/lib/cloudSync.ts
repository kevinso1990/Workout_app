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
const LAST_BACKUP_KEY = "cloud_last_backup_at";

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
      if (res.ok) await AsyncStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
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

/** ISO time of the last successful backup from this install, or null. */
export async function getLastBackupAt(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_BACKUP_KEY).catch(() => null);
}

export type CloudBackup = SyncGetResponse & { historyCount: number; planCount: number };

/** Reads the backup stored under `userId` without touching local data. */
export async function fetchCloudBackup(
  userId: string,
  /** Read as this account instead of the stored token (sign-in, before adopting it). */
  token?: string,
): Promise<CloudBackup | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const headers = await getAuthHeaders();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(syncUrl(`/${encodeURIComponent(userId)}`), {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as SyncGetResponse;
    if (!data.found) return null;
    const workoutHistory = Array.isArray(data.workoutHistory) ? data.workoutHistory : [];
    const plans = Array.isArray(data.currentPlan?.plans) ? data.currentPlan!.plans : [];
    return { ...data, workoutHistory, historyCount: workoutHistory.length, planCount: plans.length };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** The backup of the account `token` belongs to, or null. */
export async function fetchAccountBackup(token: string): Promise<CloudBackup | null> {
  const sub = decodeJwtSub(token);
  return sub == null ? null : fetchCloudBackup(`u${sub}`, token);
}

/**
 * Writes a fetched backup into local storage. Overwrites local data — only
 * call when local is empty or on explicit user-initiated restore.
 */
export async function applyCloudBackup(data: CloudBackup): Promise<RestoreResult> {
  const snapshot = data.currentPlan;
  const plans = Array.isArray(snapshot?.plans) ? snapshot!.plans : [];
  if (data.workoutHistory.length > 0) await replaceWorkoutHistory(data.workoutHistory);
  if (plans.length > 0) await replaceWorkoutPlans(plans);
  if (snapshot?.preferences) await setUserPreferences(snapshot.preferences);
  // If the cloud has real data, the user already onboarded — skip it.
  if (snapshot?.onboardingComplete || data.historyCount > 0 || plans.length > 0) {
    await setOnboardingComplete(true);
  }
  return {
    restored: data.historyCount > 0 || plans.length > 0,
    historyCount: data.historyCount,
    planCount: plans.length,
  };
}

/** Fetches the backup for `userId` and writes it into local storage. */
export async function restoreFromCloud(userId: string): Promise<RestoreResult> {
  try {
    const data = await fetchCloudBackup(userId);
    return data ? await applyCloudBackup(data) : { restored: false, historyCount: 0, planCount: 0 };
  } catch {
    return { restored: false, historyCount: 0, planCount: 0 };
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

    // The account key needs the token; on a reinstall the Keychain device id
    // brings back the same guest account, and with it this backup.
    await ensureAuthToken();
    const result = await restoreFromCloud(await getSyncBackupKey());
    if (result.restored) return true;
    // Backups from before account keys were stored under the random install id.
    const legacy = await AsyncStorage.getItem(CLOUD_USER_ID_KEY);
    return legacy ? (await restoreFromCloud(legacy)).restored : false;
  } catch {
    return false;
  }
}
