import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "offlineJobEvents_v2";

export type QueueEventStatus = "pending" | "syncing" | "failed";

export interface QueuedJobEvent {
  clientEventId:   string;
  jobId:           number;
  eventType:       string;
  actualQuantity?: string;
  actualUnit?:     string;
  podNumber?:      string;
  collectionNote?: string;
  deliveryNote?:   string;
  clientTimestamp: string;
  status:          QueueEventStatus;
  retryCount:      number;
  createdAt:       string;
  lastAttemptAt?:  string;
  lastError?:      string;
  gpsLat?:         number;
  gpsLng?:         number;
}

async function readQueue(): Promise<QueuedJobEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedJobEvent[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedJobEvent[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

export async function enqueueJobEvent(
  event: Omit<QueuedJobEvent, "clientEventId" | "clientTimestamp" | "status" | "retryCount" | "createdAt" | "lastAttemptAt" | "lastError">,
): Promise<QueuedJobEvent> {
  const { v4: uuidv4 } = await import("uuid");
  const now = new Date().toISOString();
  const queued: QueuedJobEvent = {
    ...event,
    clientEventId:   uuidv4(),
    clientTimestamp: now,
    status:          "pending",
    retryCount:      0,
    createdAt:       now,
  };
  const queue = await readQueue();
  queue.push(queued);
  await writeQueue(queue);
  return queued;
}

export async function getQueueLength(): Promise<number> {
  const queue = await readQueue();
  return queue.length;
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

export async function flushQueue(
  apiFn: (events: QueuedJobEvent[]) => Promise<{ clientEventId: string; result: string }[]>,
  onProgress?: (remaining: number) => void,
): Promise<number> {
  const queue = await readQueue();
  const normalizedQueue = queue.map(e => ({
    ...e,
    status:     e.status ?? "pending",
    retryCount: e.retryCount ?? 0,
    createdAt:  e.createdAt ?? e.clientTimestamp,
  }));
  if (normalizedQueue.length === 0) return 0;

  const now = new Date().toISOString();
  const sendable = normalizedQueue.filter(e => e.status === "pending" || e.status === "failed" || e.status === "syncing");
  if (sendable.length === 0) return 0;

  const sendableIds = new Set(sendable.map(e => e.clientEventId));
  const syncingQueue = normalizedQueue.map(e => (
    sendableIds.has(e.clientEventId)
      ? { ...e, status: "syncing" as QueueEventStatus, lastAttemptAt: now }
      : e
  ));
  await writeQueue(syncingQueue);
  onProgress?.(syncingQueue.length);

  try {
    const results = await apiFn(sendable);
    const applied = results.filter(r => r.result === "accepted" || r.result === "duplicate");
    const appliedIds = new Set(applied.map(r => r.clientEventId));
    const resultIds = new Set(results.map(r => r.clientEventId));

    const remaining = syncingQueue
      .filter(e => !appliedIds.has(e.clientEventId))
      .map(e => {
        if (!sendableIds.has(e.clientEventId)) return e;

        if (resultIds.has(e.clientEventId)) {
          return {
            ...e,
            status: "failed" as QueueEventStatus,
            retryCount: e.retryCount + 1,
            lastAttemptAt: now,
            lastError: "API rejected event",
          };
        }

        return {
          ...e,
          status: "failed" as QueueEventStatus,
          retryCount: e.retryCount + 1,
          lastAttemptAt: now,
          lastError: "No sync result returned for event",
        };
      });

    await writeQueue(remaining);
    onProgress?.(remaining.length);
    return applied.length;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Sync request failed";
    const failedQueue = syncingQueue.map(e => (
      sendableIds.has(e.clientEventId)
        ? {
            ...e,
            status: "failed" as QueueEventStatus,
            retryCount: e.retryCount + 1,
            lastAttemptAt: now,
            lastError: message,
          }
        : e
    ));

    await writeQueue(failedQueue);
    onProgress?.(failedQueue.length);
    return 0;
  }
}
