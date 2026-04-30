/**
 * Central colour palette for LogisticBay mobile.
 *
 * Import from here — never define colours inline in components or screens.
 * Screens that previously imported COLOURS from "../components" should now
 * import from "../theme".
 */
export const COLOURS = {
  primary:    "#1a1a2e",
  accent:     "#e94560",
  pass:       "#16a34a",
  fail:       "#dc2626",
  muted:      "#6b7280",
  border:     "#e5e7eb",
  background: "#f9fafb",
  white:      "#ffffff",
  warning:    "#f59e0b",
} as const;

export type ColourKey = keyof typeof COLOURS;
