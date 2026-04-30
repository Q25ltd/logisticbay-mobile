import { StyleSheet } from "react-native";
import { COLOURS } from "../../theme";

export const jobDetailStyles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLOURS.background },
  center:       { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLOURS.white,
    borderBottomWidth: 1, borderBottomColor: COLOURS.border,
  },
  backText:     { color: COLOURS.accent, fontSize: 15, fontWeight: "600" },
  topTitle:     { fontSize: 17, fontWeight: "700", color: COLOURS.primary },
  statusBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText:   { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  scroll:       { flex: 1 },
  sectionLabel: { fontSize: 10, color: COLOURS.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  bold:         { fontWeight: "700" },
  input:        { borderWidth: 1.5, borderColor: COLOURS.border, borderRadius: 8, padding: 12, fontSize: 14, color: COLOURS.primary, marginBottom: 8, backgroundColor: COLOURS.white },
  multiline:    { minHeight: 80, textAlignVertical: "top" } as any,
  unitRow:      { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  unitBtn:      { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: COLOURS.border, backgroundColor: COLOURS.white },
  unitBtnActive:    { backgroundColor: COLOURS.primary, borderColor: COLOURS.primary },
  unitBtnText:      { fontSize: 12, fontWeight: "600", color: COLOURS.muted },
  unitBtnTextActive:{ color: COLOURS.white },
  optional:     { fontWeight: "400", color: COLOURS.muted },
  bottomNav:    { padding: 16, backgroundColor: COLOURS.white, borderTopWidth: 1, borderTopColor: COLOURS.border },
  formInfo:     { fontSize: 14, color: COLOURS.primary, marginBottom: 12, padding: 10, backgroundColor: COLOURS.background, borderRadius: 8 },
});
