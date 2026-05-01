/**
 * Offline Queue
 *
 * Saves API actions locally when the device has no connection.
 * When connection restores, flushes them in order.
 *
 * Usage:
 *   import { enqueue } from "../offlineQueue";
 *   await enqueue({ method: "PATCH", url: "/jobs/42/status", data: { status: "collected" } });
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "offlineQueue";

export interface QueuedAction {
  id:        string;
  method:    "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  url:       string;
  data?:     unknown;
  queuedAt:  string; // ISO timestamp
  attempts:  number;
}

// ─── Read / Write helpers ─────────────────────────────────────────────────────

async function readQueue(): Promise<QueuedAction[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedAction[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedAction[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Add an action to the offline queue. */
export async function enqueue(action: Omit<QueuedAction, "id" | "queuedAt" | "attempts">): Promise<void> {
  const queue = await readQueue();
  queue.push({
    ...action,
    id:       Math.random().toString(36).slice(2),
    queuedAt: new Date().toISOString(),
    attempts: 0,
  });
  await writeQueue(queue);
}

/** How many actions are waiting. */
export async function queueLength(): Promise<number> {
  const queue = await readQueue();
  return queue.length;
}

/** Clear the entire queue (e.g. after logout). */
export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

/**
 * Flush the queue — send all pending actions in order.
 * Requires the api instance to be passed in to avoid circular imports.
 * Returns number of actions successfully sent.
 */
export async function flushQueue(
  apiFn: (action: QueuedAction) => Promise<void>,
  onProgress?: (remaining: number) => void,
): Promise<number> {
  const queue = await readQueue();
  if (queue.length === 0) return 0;

  let sent = 0;
  const failed: QueuedAction[] = [];

  for (const action of queue) {
    try {
      await apiFn(action);
      sent++;
      onProgress?.(queue.length - sent);
    } catch (err: unknown) {
      // Keep failed actions — increment attempts
      const updated = { ...action, attempts: action.attempts + 1 };
      // Drop after 5 failed attempts to avoid permanent loops
      if (updated.attempts < 5) {
        failed.push(updated);
      }
    }
  }

  await writeQueue(failed);
  return sent;
}
