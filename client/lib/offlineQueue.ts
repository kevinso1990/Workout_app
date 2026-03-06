/**
 * Offline-tolerant set logging queue.
 * When the network is unavailable, sets are stored in localStorage and replayed
 * when connectivity is restored.
 */

const QUEUE_KEY = "offline_set_queue";

interface QueuedSet {
  id: string; // local temp id
  data: {
    session_id: number;
    exercise_id: number;
    set_number: number;
    weight: number;
    reps: number;
    is_drop_set?: boolean;
    parent_set_id?: number | null;
    rir?: number;
  };
  createdAt: number;
}

function loadQueue(): QueuedSet[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedSet[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

export function enqueue(data: QueuedSet["data"]): string {
  const id = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const queue = loadQueue();
  queue.push({ id, data, createdAt: Date.now() });
  saveQueue(queue);
  return id;
}

export function dequeue(localId: string): void {
  const queue = loadQueue().filter(q => q.id !== localId);
  saveQueue(queue);
}

export function getQueue(): QueuedSet[] {
  return loadQueue();
}

export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

/** Replay all queued sets, calling the provided submit function. */
export async function flushQueue(
  submit: (data: QueuedSet["data"]) => Promise<{ id: number }>,
): Promise<void> {
  const queue = loadQueue();
  if (queue.length === 0) return;

  for (const item of queue) {
    try {
      await submit(item.data);
      dequeue(item.id);
    } catch {
      // Stop at first failure — network still down
      break;
    }
  }
}
