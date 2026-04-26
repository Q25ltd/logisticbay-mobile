import React, { useState } from "react";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, SafeAreaView, Alert,
} from "react-native";
import { COLOURS, Button } from "../components";
import { useShift, type CheckEntry, type CheckResult } from "../ShiftContext";
import { getChecksForClass } from "../constants";

interface Props {
  navigation: any;
  route: { params: { type: "truck" | "trailer" } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Three-state toggle: PASS / N/A / FAIL
// ─────────────────────────────────────────────────────────────────────────────

function ResultToggle({
  result, naAllowed, onChange,
}: {
  result:    CheckResult;
  naAllowed: boolean;
  onChange:  (r: CheckResult) => void;
}) {
  const options: { value: CheckResult; label: string; bg: string }[] = [
    { value: "pass", label: "PASS", bg: COLOURS.pass },
    ...(naAllowed ? [{ value: "na" as CheckResult, label: "N/A", bg: "#9ca3af" }] : []),
    { value: "fail", label: "FAIL", bg: COLOURS.fail },
  ];

  return (
    <View style={tog.row}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.value}
          style={[
            tog.btn,
            result === opt.value
              ? { backgroundColor: opt.bg, borderColor: opt.bg }
              : { backgroundColor: "#f3f4f6", borderColor: "#e5e7eb" },
          ]}
          onPress={() => onChange(opt.value)}
        >
          <Text style={[tog.label, { color: result === opt.value ? "#fff" : COLOURS.muted }]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const tog = StyleSheet.create({
  row:   { flexDirection: "row", gap: 4 },
  btn:   { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1.5 },
  label: { fontSize: 11, fontWeight: "700" },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function ChecklistScreen({ navigation, route }: Props) {
  const { type }                          = route.params;
  const { currentSegment, updateSegment, updateShiftField } = useShift();

  // Save current screen so app can resume here after crash
  React.useEffect(() => {
    const screenName = type === "truck" ? "TruckChecklist" : "TrailerChecklist";
    updateShiftField("lastScreen", screenName);
  }, [type]);

  const isTruck      = type === "truck";
  const vehicleClass = currentSegment.vehicleClass;
  const checkItems   = getChecksForClass(vehicleClass, isTruck ? "truck" : "trailer");
  const existing     = isTruck ? currentSegment.truckChecks : currentSegment.trailerChecks;

  const title = isTruck
    ? vehicleClass === "van"    ? "Van Walk Round Check"
    : vehicleClass === "class2" ? "Rigid HGV Walk Round Check"
    :                             "Truck Walk Round Check"
    : "Trailer Walk Round Check";

  function getNext(): string {
    if (isTruck && vehicleClass === "class1" && currentSegment.hasTrailer && currentSegment.needsTrailerCheck) {
      return "TrailerChecklist";
    }
    return "Deliveries";
  }

  const [items, setItems] = useState<CheckEntry[]>(existing);

  function setResult(index: number, result: CheckResult) {
    const updated = [...items];
    updated[index] = { ...updated[index], result, note: result !== "fail" ? "" : updated[index].note };
    setItems(updated);
  }

  function setNote(index: number, note: string) {
    const updated = [...items];
    updated[index] = { ...updated[index], note };
    setItems(updated);
  }

  function handleNext() {
    const missing = items.find(i => i.result === "fail" && !i.note.trim());
    if (missing) {
      Alert.alert("Note Required", `Please describe the defect for:\n${missing.label}`);
      return;
    }
    if (isTruck) updateSegment({ truckChecks: items });
    else         updateSegment({ trailerChecks: items });
    navigation.navigate(getNext());
  }

  const failCount = items.filter(i => i.result === "fail").length;
  const naCount   = items.filter(i => i.result === "na").length;
  const categories = Array.from(new Set(checkItems.map(c => c.category)));

  function getCategoryLabel(cat: string): string {
    if (cat === "inside")  return "INSIDE CHECKS";
    if (cat === "outside") return "OUTSIDE CHECKS";
    if (cat === "body")    return "BODY / LOAD AREA";
    if (cat === "load")    return "LOAD SECURITY";
    return cat.toUpperCase();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>{title}</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.legalBanner}>
        <Text style={styles.legalText}>
          ⚖️  DVSA legal requirement — complete before moving the vehicle.
          Mark N/A only if item genuinely not fitted.
        </Text>
      </View>

      {(failCount > 0 || naCount > 0) && (
        <View style={styles.statusBar}>
          {failCount > 0 && <Text style={styles.failCount}>⚠ {failCount} defect{failCount > 1 ? "s" : ""}</Text>}
          {naCount   > 0 && <Text style={styles.naCount}>  {naCount} N/A</Text>}
        </View>
      )}

      <KeyboardAwareScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 120 }}
        enableOnAndroid={true}
        extraScrollHeight={20}
      >
        {categories.map(cat => {
          const catItems = checkItems.filter(c => c.category === cat);
          const catStart = checkItems.findIndex(c => c.category === cat);
          return (
            <View key={cat}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryLabel}>{getCategoryLabel(cat)}</Text>
              </View>
              {catItems.map((checkItem, localIdx) => {
                const globalIdx = catStart + localIdx;
                const entry     = items[globalIdx];
                if (!entry) return null;
                return (
                  <View key={checkItem.key}>
                    <View style={[styles.checkRow, globalIdx % 2 === 0 && styles.checkRowAlt]}>
                      <View style={styles.checkLeft}>
                        <Text style={styles.checkLabel}>{checkItem.label}</Text>
                      </View>
                      <ResultToggle
                        result={entry.result}
                        naAllowed={checkItem.naAllowed}
                        onChange={r => setResult(globalIdx, r)}
                      />
                    </View>
                    {entry.result === "fail" && (
                      <TextInput
                        style={styles.noteInput}
                        placeholder="Describe the defect (required by law)"
                        placeholderTextColor={COLOURS.muted}
                        value={entry.note}
                        onChangeText={note => setNote(globalIdx, note)}
                        multiline
                      />
                    )}
                    {entry.result === "na" && (
                      <View style={styles.naNote}>
                        <Text style={styles.naNoteText}>Marked as not applicable / not fitted</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}
        <View style={{ height: 20 }} />
      </KeyboardAwareScrollView>

      <View style={styles.bottomNav}>
        <Button
          label={failCount > 0 ? `Continue — ${failCount} defect${failCount > 1 ? "s" : ""} recorded →` : "All checks done →"}
          onPress={handleNext}
          style={{ backgroundColor: failCount > 0 ? COLOURS.warning : COLOURS.pass }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLOURS.background },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLOURS.white,
    borderBottomWidth: 1, borderBottomColor: COLOURS.border,
  },
  backText:       { color: COLOURS.accent, fontSize: 15, fontWeight: "600" },
  topTitle:       { fontSize: 15, fontWeight: "700", color: COLOURS.primary },
  legalBanner: {
    backgroundColor: "#eff6ff", borderLeftWidth: 3, borderLeftColor: "#3b82f6",
    padding: 10, margin: 12, borderRadius: 6,
  },
  legalText:      { fontSize: 11, color: "#1e40af", lineHeight: 17 },
  statusBar: {
    flexDirection: "row", backgroundColor: "#fef2f2",
    paddingHorizontal: 16, paddingVertical: 8,
    borderLeftWidth: 3, borderLeftColor: COLOURS.fail,
    marginHorizontal: 12, borderRadius: 6, marginBottom: 4,
  },
  failCount:      { color: COLOURS.fail, fontWeight: "700", fontSize: 13 },
  naCount:        { color: COLOURS.muted, fontWeight: "600", fontSize: 13 },
  scroll:         { flex: 1 },
  categoryHeader: {
    backgroundColor: COLOURS.primary, paddingVertical: 6,
    paddingHorizontal: 14, marginTop: 4,
  },
  categoryLabel:  { color: COLOURS.white, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  checkRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 10, paddingHorizontal: 12, backgroundColor: COLOURS.white,
    minHeight: 52,
  },
  checkRowAlt:    { backgroundColor: COLOURS.background },
  checkLeft:      { flex: 1, paddingRight: 10 },
  checkLabel:     { fontSize: 12, color: COLOURS.primary, lineHeight: 17 },
  noteInput: {
    borderWidth: 1.5, borderColor: COLOURS.fail, borderRadius: 8,
    padding: 10, fontSize: 13, color: COLOURS.primary,
    backgroundColor: "#fef2f2", marginHorizontal: 12, marginBottom: 6,
  },
  naNote: {
    backgroundColor: "#f3f4f6", marginHorizontal: 12, marginBottom: 4,
    paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6,
  },
  naNoteText:     { fontSize: 11, color: COLOURS.muted, fontStyle: "italic" },
  bottomNav: {
    padding: 16, backgroundColor: COLOURS.white,
    borderTopWidth: 1, borderTopColor: COLOURS.border,
  },
});
