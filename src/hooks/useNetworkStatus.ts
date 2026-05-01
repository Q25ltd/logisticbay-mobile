/**
 * useNetworkStatus
 *
 * Monitors connection state via NetInfo.
 * When connection is restored, automatically flushes the offline queue.
 *
 * Use this hook once at the top of the app (AppNavigator).
 * Any screen can call useIsOnline() for a simple boolean.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { flushQueue, queueLength, type QueuedAction } from "../offlineQueue";

export type SyncStatus = "online" | "offline" | "syncing" | "synced";

interface NetworkStatus {
  isOnline:   boolean;
  syncStatus: SyncStatus;
  queueSize:  number;
  /** Manually trigger a flush (e.g. on app foreground) */
  triggerSync: () => Promise<void>;
}

// Shared state — updated by the single useNetworkStatus instance
type Listener = (status: NetworkStatus) => void;
let _listeners: Listener[] = [];
let _status: NetworkStatus = { isOnline: true, syncStatus: "online", queueSize: 0, triggerSync: async () => {} };

function notify(s: NetworkStatus) {
  _status = s;
  _listeners.forEach(fn => fn(s));
}

// ─── Main hook (use once in AppNavigator) ─────────────────────────────────────

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(_status);
  const isSyncing = useRef(false);

  const runFlush = useCallback(async () => {
    if (isSyncing.current) return;
    const size = await queueLength();
    if (size === 0) return;

    isSyncing.current = true;
    notify({ ..._status, syncStatus: "syncing", queueSize: size });

    try {
      // Import api lazily to avoid circular dependency
      const { api } = await import("../api");

      const sent = await flushQueue(
        async (action: QueuedAction) => {
          await api.request({
            method: action.method,
            url:    action.url,
            data:   action.data,
          });
        },
        (remaining) => {
          notify({ ..._status, syncStatus: "syncing", queueSize: remaining });
        },
      );

      if (sent > 0) {
        notify({ ..._status, syncStatus: "synced", queueSize: 0 });
        // Reset to "online" after 3 seconds
        setTimeout(() => {
          notify({ ..._status, syncStatus: "online", queueSize: 0 });
        }, 3000);
      } else {
        notify({ ..._status, syncStatus: "online" });
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

    // Subscribe to NetInfo
    const unsubscribe = NetInfo.addEventListener(async (state: NetInfoState) => {
      const online = !!(state.isConnected && state.isInternetReachable !== false);
      const size   = await queueLength();

      if (online) {
        notify({ isOnline: true, syncStatus: "online", queueSize: size, triggerSync: runFlush });
        if (size > 0) runFlush();
      } else {
        notify({ isOnline: false, syncStatus: "offline", queueSize: size, triggerSync: runFlush });
      }
    });

    // Expose triggerSync on the shared status
    _status.triggerSync = runFlush;

    return () => {
      unsubscribe();
      _listeners = _listeners.filter(fn => fn !== listener);
    };
  }, [runFlush]);

  return status;
}

// ─── Lightweight hook for any screen that just needs online/offline ────────────

export function useIsOnline(): boolean {
  const [online, setOnline] = useState(_status.isOnline);
  useEffect(() => {
    const listener: Listener = (s) => setOnline(s.isOnline);
    _listeners.push(listener);
    return () => { _listeners = _listeners.filter(fn => fn !== listener); };
  }, []);
  return online;
}
