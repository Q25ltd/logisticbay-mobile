import { useEffect, useRef, useState, useCallback } from "react";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { flushQueue, getQueueLength, type QueuedJobEvent } from "../offlineQueue";

export type SyncStatus = "online" | "offline" | "syncing" | "synced";

interface NetworkStatus {
  isOnline:    boolean;
  syncStatus:  SyncStatus;
  queueSize:   number;
  triggerSync: () => Promise<void>;
}

type Listener = (status: NetworkStatus) => void;
let _listeners: Listener[] = [];
let _status: NetworkStatus = {
  isOnline:    true,
  syncStatus:  "online",
  queueSize:   0,
  triggerSync: async () => {},
};

function notify(s: NetworkStatus) {
  _status = s;
  _listeners.forEach(fn => fn(s));
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(_status);
  const isSyncing = useRef(false);

  const runFlush = useCallback(async () => {
    if (isSyncing.current) return;
    const size = await getQueueLength();
    if (size === 0) return;

    isSyncing.current = true;
    notify({ ..._status, syncStatus: "syncing", queueSize: size });

    try {
      const { api } = await import("../api");

      const sent = await flushQueue(
        async (events: QueuedJobEvent[]) => {
          const res = await api.post<{
            synced: { clientEventId: string; status: string }[];
            failed: { clientEventId: string; status: string }[];
          }>(
            "/sync/events",
            { events },
          );
          return [...res.data.synced, ...res.data.failed].map(r => ({
            clientEventId: r.clientEventId,
            result:        r.status,
          }));
        },
        (remaining) => {
          notify({ ..._status, syncStatus: "syncing", queueSize: remaining });
        },
      );

      if (sent > 0) {
        notify({ ..._status, isOnline: true, syncStatus: "synced", queueSize: 0 });
        setTimeout(() => {
          notify({ ..._status, isOnline: true, syncStatus: "online", queueSize: 0 });
        }, 3000);
      } else {
        notify({ ..._status, isOnline: true, syncStatus: "online" });
      }
    } catch {
      notify({ ..._status, syncStatus: "online" });
    } finally {
      isSyncing.current = false;
    }
  }, []);

  useEffect(() => {
    const listener: Listener = (s) => setStatus({ ...s });
    _listeners.push(listener);

    const unsubscribe = NetInfo.addEventListener(async (state: NetInfoState) => {
      const online = !!(state.isConnected && state.isInternetReachable !== false);
      const size   = await getQueueLength();

      if (online) {
        notify({ isOnline: true, syncStatus: "online", queueSize: size, triggerSync: runFlush });
        if (size > 0) runFlush();
      } else {
        notify({ isOnline: false, syncStatus: "offline", queueSize: size, triggerSync: runFlush });
      }
    });

    _status.triggerSync = runFlush;

    return () => {
      unsubscribe();
      _listeners = _listeners.filter(fn => fn !== listener);
    };
  }, [runFlush]);

  return status;
}

export function useIsOnline(): boolean {
  const [online, setOnline] = useState(_status.isOnline);
  useEffect(() => {
    const listener: Listener = (s) => setOnline(s.isOnline);
    _listeners.push(listener);
    return () => { _listeners = _listeners.filter(fn => fn !== listener); };
  }, []);
  return online;
}
