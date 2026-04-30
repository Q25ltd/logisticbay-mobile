/**
 * AsyncStorage helpers for trailer check memory.
 *
 * Trailers that have already been checked today skip re-check.
 * Previously in ShiftScreens.tsx — extracted for reuse and testability.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

function todayKey(): string {
  return `trailers_${new Date().toDateString()}`;
}

/** Returns list of trailer registrations that have been checked today. */
export async function getCheckedTrailersToday(): Promise<string[]> {
  try {
    const v = await AsyncStorage.getItem(todayKey());
    return v ? JSON.parse(v) : [];
  } catch {
    return [];
  }
}

/** Marks a trailer registration as checked for today. Idempotent. */
export async function markTrailerCheckedToday(reg: string): Promise<void> {
  try {
    const current = await getCheckedTrailersToday();
    const upper   = reg.trim().toUpperCase();
    if (!current.includes(upper)) {
      await AsyncStorage.setItem(todayKey(), JSON.stringify([...current, upper]));
    }
  } catch {}
}
