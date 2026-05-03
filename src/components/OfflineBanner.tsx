/**
 * OfflineBanner
 *
 * Subtle top banner that shows connection and sync status.
 * Only visible when offline, syncing, or just synced.
 * Hidden completely when online and in sync.
 */

import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import type { SyncStatus } from "../hooks/useNetworkStatus";

interface Props {
  syncStatus:  SyncStatus;
  queueSize:   number;
  failedCount?: number;
  onRetry?:    () => void;
}

const MESSAGES: Record<SyncStatus, string> = {
  offline: "📶 Offline — saving locally",
  syncing: "⏫ Syncing...",
  synced:  "✅ Synced",
  failed:  "⚠️ Sync failed",
  online:  "",
};

const COLOURS: Record<SyncStatus, string> = {
  offline: "#92400e",
  syncing: "#1d4ed8",
  synced:  "#166534",
  failed:  "#991b1b",
  online:  "transparent",
};

const BG: Record<SyncStatus, string> = {
  offline: "#fef3c7",
  syncing: "#eff6ff",
  synced:  "#dcfce7",
  failed:  "#fee2e2",
  online:  "transparent",
};

export function OfflineBanner({ syncStatus, queueSize, failedCount = 0, onRetry }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const visible = syncStatus !== "online";

  useEffect(() => {
    Animated.timing(opacity, {
      toValue:         visible ? 1 : 0,
      duration:        300,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  if (syncStatus === "online") return null;

  const message = syncStatus === "failed"
    ? `⚠️ ${failedCount || queueSize} action${(failedCount || queueSize) !== 1 ? "s" : ""} failed to sync`
    : syncStatus === "offline" && queueSize > 0
      ? `📶 Offline — ${queueSize} action${queueSize !== 1 ? "s" : ""} queued`
      : MESSAGES[syncStatus];

  return (
    <Animated.View style={[styles.banner, { backgroundColor: BG[syncStatus], opacity }]}> 
      <Text style={[styles.text, { color: COLOURS[syncStatus] }]}> 
        {message}
      </Text>
      {syncStatus === "failed" && onRetry ? (
        <Text style={[styles.retryText, { color: COLOURS[syncStatus] }]} onPress={onRetry}>
          Retry
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical:   6,
    paddingHorizontal: 16,
    alignItems:        "center",
    flexDirection:     "row",
    justifyContent:    "center",
    gap:               12,
  },
  text: {
    fontSize:   12,
    fontWeight: "600",
  },
  retryText: {
    fontSize:       12,
    fontWeight:     "800",
    textDecorationLine: "underline",
  },
});
