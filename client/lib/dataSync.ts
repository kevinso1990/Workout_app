import { AppState, type AppStateStatus } from "react-native";

import { pushCloudBackup } from "@/lib/cloudSync";
import type { CompletedSessionSyncPayload } from "@/lib/activeWorkoutPersistence";
import { ensureAuthToken } from "@/lib/nativeAuth";
import {
  enqueueAndTrySyncWorkoutSession,
  flushWorkoutSyncQueue,
  getPendingSyncCount,
} from "@/lib/workoutSessionSyncQueue";

export type SyncState = "idle" | "syncing" | "error";

export interface DataSyncStatus {
  state: SyncState;
  lastSuccessAt: string | null;
  lastError: string | null;
  pendingSessions: number;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let syncInFlight: Promise<boolean> | null = null;
let appStateSubscribed = false;

let status: DataSyncStatus = {
  state: "idle",
  lastSuccessAt: null,
  lastError: null,
  pendingSessions: 0,
};

const listeners = new Set<(next: DataSyncStatus) => void>();

function emitStatus(): void {
  const snapshot = { ...status };
  listeners.forEach((listener) => listener(snapshot));
}

export function subscribeDataSyncStatus(
  listener: (next: DataSyncStatus) => void,
): () => void {
  listeners.add(listener);
  listener({ ...status });
  return () => {
    listeners.delete(listener);
  };
}

export function getDataSyncStatus(): DataSyncStatus {
  return { ...status };
}

/** Debounced full sync — cloud backup + structured session queue flush. */
export function scheduleDataSync(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void runDataSync();
  }, 500);
}

/**
 * Queue a completed session for structured server ingest, then schedule a
 * full backup push. Replaces scattered enqueue + pushCloudBackup call pairs.
 */
export async function scheduleSessionSync(
  session: CompletedSessionSyncPayload,
): Promise<void> {
  await enqueueAndTrySyncWorkoutSession(session);
  scheduleDataSync();
}

/**
 * Runs cloud backup and replays any pending session sync queue.
 * Never throws — returns whether everything succeeded.
 */
export async function runDataSync(): Promise<boolean> {
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    const pending = await getPendingSyncCount();
    status = { ...status, state: "syncing", pendingSessions: pending };
    emitStatus();

    try {
      await ensureAuthToken();
      const backupOk = await pushCloudBackup();
      await flushWorkoutSyncQueue();
      const remaining = await getPendingSyncCount();

      if (!backupOk || remaining > 0) {
        status = {
          state: "error",
          lastSuccessAt: backupOk ? new Date().toISOString() : status.lastSuccessAt,
          lastError:
            remaining > 0
              ? `${remaining} workout(s) still pending sync`
              : "Cloud backup failed",
          pendingSessions: remaining,
        };
        emitStatus();
        return false;
      }

      status = {
        state: "idle",
        lastSuccessAt: new Date().toISOString(),
        lastError: null,
        pendingSessions: 0,
      };
      emitStatus();
      return true;
    } catch (err) {
      status = {
        ...status,
        state: "error",
        lastError: err instanceof Error ? err.message : "Sync failed",
        pendingSessions: await getPendingSyncCount(),
      };
      emitStatus();
      return false;
    } finally {
      syncInFlight = null;
    }
  })();

  return syncInFlight;
}

/**
 * App-start hook: ensure guest JWT, sync on foreground, retry pending queue.
 * Replaces the standalone workout sync app-state listener.
 */
export function initDataSync(): () => void {
  if (appStateSubscribed) return () => {};
  appStateSubscribed = true;

  const onChange = (next: AppStateStatus) => {
    if (next === "active") void runDataSync();
  };

  const sub = AppState.addEventListener("change", onChange);
  void runDataSync();

  return () => {
    sub.remove();
    appStateSubscribed = false;
  };
}
