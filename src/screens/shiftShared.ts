/**
 * Styles shared across StartShiftScreen, EndShiftScreen, and ReviewScreen.
 *
 * Screen-specific styles live in each screen file; truly shared structure
 * (container, topBar, scroll, bottomNav, input) lives here.
 */
import { StyleSheet } from "react-native";
import { COLOURS } from "../theme";

export const shiftSharedStyles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLOURS.background },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLOURS.white,
    borderBottomWidth: 1, borderBottomColor: COLOURS.border,
  },
  backText:   { color: COLOURS.accent, fontSize: 15, fontWeight: "600" },
  topTitle:   { fontSize: 16, fontWeight: "700", color: COLOURS.primary },
  scroll:     { flex: 1 },
  bottomNav: {
    padding: 16, backgroundColor: COLOURS.white,
    borderTopWidth: 1, borderTopColor: COLOURS.border,
  },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: COLOURS.primary, marginBottom: 4, marginTop: 8 },
  fieldHint:  { fontSize: 11, color: COLOURS.muted, marginBottom: 8, marginTop: -2 },
  optional:   { fontWeight: "400", color: COLOURS.muted } as const,
  input: {
    borderWidth: 1.5, borderColor: COLOURS.border, borderRadius: 10,
    padding: 12, fontSize: 15, color: COLOURS.primary, marginBottom: 4,
    backgroundColor: COLOURS.white, minHeight: 44,
  },
  multiline:  { minHeight: 70, textAlignVertical: "top" } as const,
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
});
