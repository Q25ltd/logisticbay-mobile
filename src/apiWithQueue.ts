/**
 * apiWithQueue
 *
 * Drop-in replacement for api.patch / api.post calls in screens.
 * - If online: sends immediately, returns response data.
 * - If offline: saves to queue, returns null (caller should handle gracefully).
 *
 * Usage:
 *   import { apiWithQueue } from "../apiWithQueue";
 *
 *   const result = await apiWithQueue("PATCH", `/jobs/${jobId}/status`, { status: "collected" });
 *   if (result === null) {
 *     // queued — update local UI optimistically
 *   }
 */

import NetInfo from "@react-native-community/netinfo";
import { api } from "./api";
import { enqueue } from "./offlineQueue";

export async function apiWithQueue<T = unknown>(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  url:    string,
  data?:  unknown,
): Promise<T | null> {
  // Check connectivity
  const state   = await NetInfo.fetch();
  const isOnline = !!(state.isConnected && state.isInternetReachable !== false);

  if (isOnline) {
    try {
      const res = await api.request<T>({ method, url, data });
      return res.data;
    } catch (err: unknown) {
      // Network error mid-request — queue it
      const isNetworkError = !((err as { response?: unknown }).response);
      if (isNetworkError) {
        await enqueue({ method, url, data });
        return null;
      }
      throw err; // 4xx/5xx — real API error, don't queue
    }
  } else {
    await enqueue({ method, url, data });
    return null;
  }
}
