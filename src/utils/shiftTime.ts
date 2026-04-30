/**
 * Pure time-calculation utilities used across shift screens.
 *
 * All functions here are stateless and testable in isolation.
 * Previously buried inside ShiftScreens.tsx.
 */

/** Returns current time as "HH:MM" */
export function getCurrentTime(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
}

/** Returns true if the string looks like a valid HH:MM time */
export function isValidTime(t: string): boolean {
  return /^\d{1,2}:\d{2}$/.test(t);
}

/**
 * Auto-inserts a colon for 4-digit numeric input.
 * "0600" → "06:00", "830" → "08:30"
 */
export function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 4) return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
  if (digits.length === 3) return `0${digits[0]}:${digits.slice(1)}`;
  return raw;
}

/** Converts "HH:MM" to total minutes from midnight */
export function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export interface PaidHoursResult {
  totalMins: number;
  paidMins:  number;
  totalStr:  string;
  paidStr:   string;
  breakStr:  string;
}

/**
 * Calculates paid hours given start/finish times and break duration.
 * Returns formatted strings and raw minute values.
 * Handles overnight shifts (finish < start).
 */
export function calcPaidHours(
  start:     string,
  finish:    string,
  breakMins: number,
): PaidHoursResult {
  if (!isValidTime(start) || !isValidTime(finish)) {
    return { totalMins: 0, paidMins: 0, totalStr: "—", paidStr: "—", breakStr: "—" };
  }
  let total = timeToMins(finish) - timeToMins(start);
  if (total < 0) total += 24 * 60; // overnight shift
  const paid = Math.max(0, total - breakMins);
  const fmt  = (m: number) => `${Math.floor(m / 60)}h ${(m % 60).toString().padStart(2, "0")}m`;
  return {
    totalMins: total,
    paidMins:  paid,
    totalStr:  fmt(total),
    paidStr:   fmt(paid),
    breakStr:  breakMins > 0 ? `${breakMins} min` : "None",
  };
}
