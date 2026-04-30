/**
 * Job status display constants — single source of truth for the mobile app.
 *
 * Import these instead of defining inline label/colour maps in each screen.
 * When a new status is added to the backend, update here and it propagates
 * everywhere automatically.
 */

export const JOB_STATUS_LABELS: Record<string, string> = {
  pending:         "Pending",
  accepted:        "Accepted",
  in_progress:     "En Route to Pickup",
  arrived_pickup:  "At Pickup",
  collected:       "Load Collected",
  arrived_dropoff: "At Dropoff",
  completed:       "Delivered ✅",
  cancelled:       "Cancelled",
};

export const JOB_STATUS_COLOURS: Record<string, { bg: string; text: string }> = {
  pending:         { bg: "#dbeafe", text: "#1e40af" },
  accepted:        { bg: "#dbeafe", text: "#1e40af" },
  in_progress:     { bg: "#fef9c3", text: "#713f12" },
  arrived_pickup:  { bg: "#e0e7ff", text: "#3730a3" },
  collected:       { bg: "#fef3c7", text: "#92400e" },
  arrived_dropoff: { bg: "#f3e8ff", text: "#6b21a8" },
  completed:       { bg: "#dcfce7", text: "#14532d" },
  cancelled:       { bg: "#f3f4f6", text: "#6b7280" },
};

/** Human-readable label for an event type as shown in the activity log. */
export const EVENT_TYPE_LABELS: Record<string, string> = {
  started:         "▶ Left for pickup",
  arrived_pickup:  "📍 Arrived at pickup",
  collected:       "📦 Load collected",
  arrived_dropoff: "📍 Arrived at dropoff",
  completed:       "✅ Delivered",
  note_added:      "💬 Note added",
  cancelled:       "⛔ Cancelled",
};
