import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "offlineJobEvents_v2";

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

export async function enqueueJobEvent(event: Omit<QueuedJobEvent, "clientEventId" | "clientTimestamp">): Promise<QueuedJobEvent> {
  const { v4: uuidv4 } = await import("uuid");
  const queued: QueuedJobEvent = {
    ...event,
    clientEventId:   uuidv4(),
    clientTimestamp: new Date().toISOString(),
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
  if (queue.length === 0) return 0;

  try {
    const results = await apiFn(queue);
    const applied = results.filter(r => r.result === "accepted" || r.result === "duplicate");
    const appliedIds = new Set(applied.map(r => r.clientEventId));

    // Keep only events that were not applied (genuine failures)
    const remaining = queue.filter(e => !appliedIds.has(e.clientEventId));
    await writeQueue(remaining);
    onProgress?.(remaining.length);
    return applied.length;
  } catch {
    return 0;
  }
}
