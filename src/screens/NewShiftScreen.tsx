import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { api } from "../api";
import { Button, Card, SectionHeader, Badge, COLOURS } from "../components";

// ─────────────────────────────────────────────────────────────────────────────
// Checklist keys
// ─────────────────────────────────────────────────────────────────────────────

const TRUCK_KEYS = [
  "lights", "brakes", "tyres", "mirrors",
  "wipers", "fuel", "oil", "horn", "seatbelt", "fire_extinguisher",
];

const TRAILER_KEYS = [
  "lights", "brakes", "tyres", "coupling",
  "doors", "straps", "tail_lift", "reflectors",
];

function formatKey(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ChecklistItem {
  key:   string;
  ok:    boolean;
  note:  string;
}

function buildChecklist(keys: string[]): ChecklistItem[] {
  return keys.map(key => ({ key, ok: true, note: "" }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Step indicator
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = ["Vehicle", "Truck", "Trailer", "Summary"];

function StepIndicator({ current }: { current: number }) {
  return (
    <View style={styles.steps}>
      {STEPS.map((label, i) => (
        <View key={i} style={styles.stepItem}>
          <View style={[styles.stepDot, i <= current && styles.stepDotActive]}>
            <Text style={[styles.stepNum, i <= current && styles.stepNumActive]}>
              {i + 1}
            </Text>
          </View>
          <Text style={[styles.stepLabel, i === current && styles.stepLabelActive]}>
            {label}
          </Text>
          {i < STEPS.length - 1 && (
            <View style={[styles.stepLine, i < current && styles.stepLineActive]} />
          )}
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Checklist step
// ─────────────────────────────────────────────────────────────────────────────

function ChecklistStep({
  title,
  items,
  onChange,
}: {
  title:    string;
  items:    ChecklistItem[];
  onChange: (updated: ChecklistItem[]) => void;
}) {
  function toggle(index: number) {
    const updated = [...items];
    updated[index] = { ...updated[index], ok: !updated[index].ok, note: "" };
    onChange(updated);
  }

  function setNote(index: number, note: string) {
    const updated = [...items];
    updated[index] = { ...updated[index], note };
    onChange(updated);
  }

  return (
    <ScrollView style={styles.stepContent}>
      <SectionHeader title={title} />
      {items.map((item, i) => (
        <View key={item.key}>
          <View style={[styles.checkRow, i % 2 === 0 && { backgroundColor: COLOURS.background }]}>
            <Text style={styles.checkKey}>{formatKey(item.key)}</Text>
            <View style={styles.checkRight}>
              <Badge ok={item.ok} />
              <Switch
                value={item.ok}
                onValueChange={() => toggle(i)}
                trackColor={{ false: COLOURS.fail, true: COLOURS.pass }}
                thumbColor={COLOURS.white}
                style={styles.switch}
              />
            </View>
          </View>
          {!item.ok && (
            <TextInput
              style={styles.noteInput}
              placeholder="Describe the issue (required)"
              placeholderTextColor={COLOURS.muted}
              value={item.note}
              onChangeText={note => setNote(i, note)}
              multiline
            />
          )}
        </View>
      ))}
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function NewShiftScreen({ navigation }: { navigation: any }) {
  const [step, setStep]               = useState(0);
  const [truckReg, setTruckReg]       = useState("");
  const [trailerReg, setTrailerReg]   = useState("");
  const [odometerStart, setOdomStart] = useState("");
  const [odometerEnd, setOdomEnd]     = useState("");
  const [nightOut, setNightOut]       = useState(false);
  const [delaysNote, setDelaysNote]   = useState("");
  const [expensesNote, setExpenses]   = useState("");
  const [truckChecklist, setTruck]    = useState<ChecklistItem[]>(buildChecklist(TRUCK_KEYS));
  const [trailerChecklist, setTrailer]= useState<ChecklistItem[]>(buildChecklist(TRAILER_KEYS));
  const [submitting, setSubmitting]   = useState(false);

  // ── Validation per step ───────────────────────────────────────────────────

  function validateStep(): string | null {
    if (step === 0) {
      if (!truckReg.trim())   return "Truck registration is required";
      if (!trailerReg.trim()) return "Trailer registration is required";
      if (!odometerStart)     return "Odometer start is required";
      if (!odometerEnd)       return "Odometer end is required";
      if (parseInt(odometerEnd) < parseInt(odometerStart)) return "Odometer end must be >= start";
    }
    if (step === 1) {
      const failed = truckChecklist.find(i => !i.ok && !i.note.trim());
      if (failed) return `Note required for failed item: ${formatKey(failed.key)}`;
    }
    if (step === 2) {
      const failed = trailerChecklist.find(i => !i.ok && !i.note.trim());
      if (failed) return `Note required for failed item: ${formatKey(failed.key)}`;
    }
    return null;
  }

  function next() {
    const err = validateStep();
    if (err) { Alert.alert("Required", err); return; }
    setStep(s => s + 1);
  }

  function back() {
    setStep(s => s - 1);
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function submit() {
    setSubmitting(true);
    try {
      await api.post("/shifts", {
        truckReg:         truckReg.trim().toUpperCase(),
        trailerReg:       trailerReg.trim().toUpperCase(),
        odometerStart:    parseInt(odometerStart),
        odometerEnd:      parseInt(odometerEnd),
        truckChecklist:   truckChecklist.map(i => ({
          key:  i.key,
          ok:   i.ok,
          ...(i.note ? { note: i.note } : {}),
        })),
        trailerChecklist: trailerChecklist.map(i => ({
          key:  i.key,
          ok:   i.ok,
          ...(i.note ? { note: i.note } : {}),
        })),
        nightOut,
        delaysNote:   delaysNote.trim(),
        expensesNote: expensesNote.trim(),
        shiftDate:    new Date().toISOString(),
      });

      Alert.alert(
        "Shift Submitted ✅",
        "Your shift report has been submitted and the office will receive it by email.",
        [{ text: "Done", onPress: () => navigation.navigate("Home") }]
      );
    } catch (err: any) {
      const msg = err.response?.data?.details?.join("\n") ?? err.response?.data?.error ?? "Submission failed";
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render steps ──────────────────────────────────────────────────────────

  const mileage = odometerEnd && odometerStart
    ? parseInt(odometerEnd) - parseInt(odometerStart)
    : null;

  return (
    <SafeAreaView style={styles.container}>

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>New Shift</Text>
        <View style={{ width: 60 }} />
      </View>

      <StepIndicator current={step} />

      {/* Step 0 — Vehicle details */}
      {step === 0 && (
        <ScrollView style={styles.stepContent} keyboardShouldPersistTaps="handled">
          <SectionHeader title="Vehicle Details" />
          <Card>
            <Text style={styles.fieldLabel}>Truck Registration</Text>
            <TextInput
              style={styles.input}
              value={truckReg}
              onChangeText={setTruckReg}
              placeholder="AB12 CDE"
              placeholderTextColor={COLOURS.muted}
              autoCapitalize="characters"
            />

            <Text style={styles.fieldLabel}>Trailer Registration</Text>
            <TextInput
              style={styles.input}
              value={trailerReg}
              onChangeText={setTrailerReg}
              placeholder="XY34 FGH"
              placeholderTextColor={COLOURS.muted}
              autoCapitalize="characters"
            />

            <Text style={styles.fieldLabel}>Odometer Start (km)</Text>
            <TextInput
              style={styles.input}
              value={odometerStart}
              onChangeText={setOdomStart}
              placeholder="10000"
              placeholderTextColor={COLOURS.muted}
              keyboardType="numeric"
            />

            <Text style={styles.fieldLabel}>Odometer End (km)</Text>
            <TextInput
              style={styles.input}
              value={odometerEnd}
              onChangeText={setOdomEnd}
              placeholder="10250"
              placeholderTextColor={COLOURS.muted}
              keyboardType="numeric"
            />

            {mileage !== null && mileage >= 0 && (
              <View style={styles.mileageBadge}>
                <Text style={styles.mileageText}>Total mileage: {mileage} km</Text>
              </View>
            )}

            <View style={styles.switchRow}>
              <Text style={styles.fieldLabel}>Night Out</Text>
              <Switch
                value={nightOut}
                onValueChange={setNightOut}
                trackColor={{ false: COLOURS.border, true: COLOURS.primary }}
                thumbColor={COLOURS.white}
              />
            </View>

            <Text style={styles.fieldLabel}>Delays (optional)</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={delaysNote}
              onChangeText={setDelaysNote}
              placeholder="Any delays during the shift..."
              placeholderTextColor={COLOURS.muted}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.fieldLabel}>Expenses (optional)</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={expensesNote}
              onChangeText={setExpenses}
              placeholder="Fuel, tolls, etc..."
              placeholderTextColor={COLOURS.muted}
              multiline
              numberOfLines={3}
            />
          </Card>
        </ScrollView>
      )}

      {/* Step 1 — Truck checklist */}
      {step === 1 && (
        <ChecklistStep
          title="Truck Checklist"
          items={truckChecklist}
          onChange={setTruck}
        />
      )}

      {/* Step 2 — Trailer checklist */}
      {step === 2 && (
        <ChecklistStep
          title="Trailer Checklist"
          items={trailerChecklist}
          onChange={setTrailer}
        />
      )}

      {/* Step 3 — Summary */}
      {step === 3 && (
        <ScrollView style={styles.stepContent}>
          <SectionHeader title="Summary" />
          <Card>
            <Text style={styles.summaryRow}><Text style={styles.summaryLabel}>Truck: </Text>{truckReg.toUpperCase()}</Text>
            <Text style={styles.summaryRow}><Text style={styles.summaryLabel}>Trailer: </Text>{trailerReg.toUpperCase()}</Text>
            <Text style={styles.summaryRow}><Text style={styles.summaryLabel}>Odometer: </Text>{odometerStart} → {odometerEnd} km</Text>
            <Text style={styles.summaryRow}><Text style={styles.summaryLabel}>Mileage: </Text>{mileage} km</Text>
            <Text style={styles.summaryRow}><Text style={styles.summaryLabel}>Night Out: </Text>{nightOut ? "Yes" : "No"}</Text>
          </Card>

          {/* Defect summary */}
          {[...truckChecklist, ...trailerChecklist].some(i => !i.ok) && (
            <View style={styles.defectBanner}>
              <Text style={styles.defectTitle}>⚠ Defects to report</Text>
              {[...truckChecklist, ...trailerChecklist]
                .filter(i => !i.ok)
                .map(i => (
                  <Text key={i.key} style={styles.defectItem}>
                    • {formatKey(i.key)}: {i.note}
                  </Text>
                ))}
            </View>
          )}

          {delaysNote ? (
            <Card>
              <Text style={styles.summaryLabel}>Delays</Text>
              <Text style={styles.summaryRow}>{delaysNote}</Text>
            </Card>
          ) : null}
        </ScrollView>
      )}

      {/* Bottom navigation */}
      <View style={styles.bottomNav}>
        {step > 0 && (
          <Button label="← Back" onPress={back} variant="ghost" style={{ flex: 1, marginRight: 8 }} />
        )}
        {step < 3 ? (
          <Button label="Next →" onPress={next} style={{ flex: 1 }} />
        ) : (
          <Button
            label={submitting ? "Submitting..." : "Submit Shift"}
            onPress={submit}
            loading={submitting}
            style={{ flex: 1, backgroundColor: COLOURS.pass }}
          />
        )}
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: COLOURS.background,
  },
  topBar: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "space-between",
    paddingHorizontal: 16,
    paddingVertical:   12,
    backgroundColor:   COLOURS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLOURS.border,
  },
  backBtn: { width: 60 },
  backText: { color: COLOURS.accent, fontSize: 15, fontWeight: "600" },
  topTitle: { fontSize: 17, fontWeight: "700", color: COLOURS.primary },
  steps: {
    flexDirection:   "row",
    justifyContent:  "center",
    alignItems:      "center",
    paddingVertical: 16,
    backgroundColor: COLOURS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLOURS.border,
  },
  stepItem: {
    alignItems: "center",
    flexDirection: "row",
  },
  stepDot: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: COLOURS.border,
    alignItems:      "center",
    justifyContent:  "center",
  },
  stepDotActive: { backgroundColor: COLOURS.primary },
  stepNum:       { fontSize: 12, fontWeight: "700", color: COLOURS.muted },
  stepNumActive: { color: COLOURS.white },
  stepLabel:     { fontSize: 10, color: COLOURS.muted, marginLeft: 4 },
  stepLabelActive: { color: COLOURS.primary, fontWeight: "700" },
  stepLine:      { width: 20, height: 2, backgroundColor: COLOURS.border, marginHorizontal: 4 },
  stepLineActive: { backgroundColor: COLOURS.primary },
  stepContent:   { flex: 1, padding: 16 },
  checkRow: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "space-between",
    paddingVertical:  12,
    paddingHorizontal: 12,
    borderRadius:     6,
    marginBottom:     2,
  },
  checkKey:   { fontSize: 15, color: COLOURS.primary, flex: 1 },
  checkRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  switch:     { marginLeft: 8 },
  noteInput: {
    borderWidth:     1.5,
    borderColor:     COLOURS.fail,
    borderRadius:    8,
    padding:         10,
    fontSize:        14,
    color:           COLOURS.primary,
    backgroundColor: "#fef2f2",
    marginBottom:    8,
    marginHorizontal: 12,
  },
  fieldLabel: {
    fontSize:     13,
    fontWeight:   "600",
    color:        COLOURS.primary,
    marginBottom:  6,
    marginTop:     4,
  },
  input: {
    borderWidth:     1.5,
    borderColor:     COLOURS.border,
    borderRadius:    10,
    padding:         12,
    fontSize:        15,
    color:           COLOURS.primary,
    marginBottom:    14,
    backgroundColor: COLOURS.background,
  },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  switchRow: {
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "space-between",
    marginBottom:    14,
  },
  mileageBadge: {
    backgroundColor: COLOURS.primary,
    borderRadius:     8,
    padding:          10,
    alignItems:       "center",
    marginBottom:     14,
  },
  mileageText: { color: COLOURS.white, fontWeight: "700", fontSize: 15 },
  bottomNav: {
    flexDirection:    "row",
    padding:          16,
    backgroundColor:  COLOURS.white,
    borderTopWidth:   1,
    borderTopColor:   COLOURS.border,
  },
  summaryLabel: { fontWeight: "700", color: COLOURS.primary },
  summaryRow:   { fontSize: 15, color: COLOURS.primary, marginBottom: 8 },
  defectBanner: {
    backgroundColor: "#fef2f2",
    borderRadius:     10,
    padding:          14,
    marginBottom:     12,
    borderLeftWidth:  3,
    borderLeftColor:  COLOURS.fail,
  },
  defectTitle: { color: COLOURS.fail, fontWeight: "700", fontSize: 14, marginBottom: 8 },
  defectItem:  { color: "#7f1d1d", fontSize: 13, marginBottom: 4 },
});
