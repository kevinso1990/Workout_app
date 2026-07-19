import AsyncStorage from "@react-native-async-storage/async-storage";

import { getApiUrl } from "@/lib/query-client";
import type { CompletedSessionSyncPayload } from "@/lib/activeWorkoutPersistence";
import { ensureAuthToken, getAuthHeaders } from "@/lib/nativeAuth";

const QUEUE_KEY = "@workout_session_sync_queue";
const SYNC_TIMEOUT_MS = 20_000;

export type SyncQueueStatus =
  | "PENDING"
  | "IN_FLIGHT"
  | "COMPLETE"
  | "FAILED_PARTIAL";

export type QueuedWorkoutSession = {
  id: string;
  session: CompletedSessionSyncPayload;
  enqueuedAt: number;
  attempts: number;
  status: SyncQueueStatus;
};

type SyncLocalResponse = {
  ok?: boolean;
  localSessionId?: string;
  ingestComplete?: boolean;
  serverSessionId?: number;
  error?: string;
};

let flushInFlight: Promise<void> | null = null;

async function readQueue(): Promise<QueuedWorkoutSession[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedWorkoutSession[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      ...item,
      status: item.status ?? "PENDING",
      attempts: item.attempts ?? 0,
    }));
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedWorkoutSession[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function getPendingSyncCount(): Promise<number> {
  const queue = await readQueue();
  return queue.filter(
    (q) => q.status === "PENDING" || q.status === "FAILED_PARTIAL",
  ).length;
}

function isFullIngestSuccess(body: SyncLocalResponse): boolean {
  return body.ok === true && body.ingestComplete === true;
}

/**
 * POST completed session to backend. Never throws — returns outcome for queue handling.
 */
export async function trySyncWorkoutSessionToServer(
  session: CompletedSessionSyncPayload,
): Promise<{
  ok: boolean;
  fullIngest: boolean;
  status: SyncQueueStatus;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  try {
    await ensureAuthToken();
    const url = new URL("/api/sessions/sync-local", getApiUrl()).toString();
    const res = await fetch(url, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ session }),
      signal: controller.signal,
    });

    let body: SyncLocalResponse = {};
    try {
      body = (await res.json()) as SyncLocalResponse;
    } catch {
      body = {};
    }

    if (!res.ok) {
      return { ok: false, fullIngest: false, status: "PENDING" };
    }

    if (isFullIngestSuccess(body)) {
      return { ok: true, fullIngest: true, status: "COMPLETE" };
    }

    // 201 without structured ingest — keep retrying until auth + ingest succeed.
    return { ok: true, fullIngest: false, status: "FAILED_PARTIAL" };
  } catch {
    return { ok: false, fullIngest: false, status: "PENDING" };
  } finally {
    clearTimeout(timer);
  }
}

/** Queue then attempt immediate sync; failures stay queued for background flush. */
export async function enqueueAndTrySyncWorkoutSession(
  session: CompletedSessionSyncPayload,
): Promise<void> {
  const queue = await readQueue();
  const existing = queue.findIndex((q) => q.id === session.id);
  const entry: QueuedWorkoutSession = {
    id: session.id,
    session,
    enqueuedAt: Date.now(),
    attempts: existing >= 0 ? queue[existing].attempts : 0,
    status: "PENDING",
  };
  if (existing >= 0) queue[existing] = entry;
  else queue.push(entry);
  await writeQueue(queue);

  const queueAfterRead = await readQueue();
  const idx = queueAfterRead.findIndex((q) => q.id === session.id);
  if (idx >= 0) {
    queueAfterRead[idx] = { ...queueAfterRead[idx], status: "IN_FLIGHT" };
    await writeQueue(queueAfterRead);
  }

  const result = await trySyncWorkoutSessionToServer(session);
  const latest = await readQueue();
  const i = latest.findIndex((q) => q.id === session.id);
  if (i < 0) return;

  if (result.fullIngest) {
    await writeQueue(latest.filter((q) => q.id !== session.id));
    return;
  }

  latest[i] = {
    ...latest[i],
    status: result.ok ? "FAILED_PARTIAL" : "PENDING",
    attempts: latest[i].attempts + (result.fullIngest ? 0 : 1),
  };
  await writeQueue(latest);
}

/**
 * Replay queued sessions in order. Stops at first failure. Never rejects.
 */
export async function flushWorkoutSyncQueue(): Promise<void> {
  if (flushInFlight) {
    await flushInFlight.catch(() => {});
    return;
  }

  flushInFlight = (async () => {
    let queue = await readQueue();
    while (queue.length > 0) {
      const item = queue[0];
      queue[0] = { ...item, status: "IN_FLIGHT" };
      await writeQueue(queue);

      const result = await trySyncWorkoutSessionToServer(item.session);
      queue = await readQueue();
      if (result.fullIngest) {
        queue = queue.filter((q) => q.id !== item.id);
        await writeQueue(queue);
        continue;
      }

      const head = queue[0];
      if (head?.id === item.id) {
        queue[0] = {
          ...head,
          status: result.ok ? "FAILED_PARTIAL" : "PENDING",
          attempts: head.attempts + 1,
        };
        await writeQueue(queue);
      }
      break;
    }
  })();

  try {
    await flushInFlight;
  } catch {
    // non-fatal
  } finally {
    flushInFlight = null;
  }
}

export async function getQueueEntry(
  sessionId: string,
): Promise<QueuedWorkoutSession | null> {
  const queue = await readQueue();
  return queue.find((q) => q.id === sessionId) ?? null;
}
