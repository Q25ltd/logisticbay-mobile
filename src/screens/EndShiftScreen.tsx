import React, { useState, useEffect } from "react";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import {
  View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, TextInput, Switch, Alert,
} from "react-native";
import { Button, Card } from "../components";
import { COLOURS } from "../theme";
import { useShift } from "../ShiftContext";
import { type Segment } from "../ShiftContext";
import { calcPaidHours, formatTimeInput, getCurrentTime, isValidTime } from "../utils/shiftTime";
import { shiftSharedStyles } from "./shiftShared";
import type { EndShiftScreenProps } from "../navigation/types";

export function EndShiftScreen({ navigation }: EndShiftScreenProps) {
  const { draft, updateShiftField, draftRestored } = useShift();

  const [finishTime,  setFinishTime]  = useState(getCurrentTime());
  const [breakMins,   setBreakMins]   = useState("0");
  const [fuelDrawn,   setFuelDrawn]   = useState("");
  const [adBlue,      setAdBlue]      = useState("");
  const [nightOut,    setNightOut]    = useState(false);
  const [expenses,    setExpenses]    = useState("");
  const [delays,      setDelays]      = useState("");
  const [defects,     setDefects]     = useState("");
  const [initialised, setInitialised] = useState(false);

  useEffect(() => { updateShiftField("lastScreen", "EndShift"); }, []);

  // Re-initialise fields from restored draft (after app crash)
  useEffect(() => {
    if (draftRestored && !initialised) {
      if (draft.fuelDrawn)  setFuelDrawn(draft.fuelDrawn);
      if (draft.adBlueDrawn) setAdBlue(draft.adBlueDrawn);
      if (draft.nightOut)   setNightOut(draft.nightOut);
      if (draft.expenses)   setExpenses(draft.expenses);
      if (draft.delaysNote) setDelays(draft.delaysNote);
      if (draft.defectsNote) setDefects(draft.defectsNote);
      if (draft.finishTime) setFinishTime(draft.finishTime);
      if (draft.breakMins)  setBreakMins(String(draft.breakMins));
      setInitialised(true);
    }
  }, [draftRestored]);

  const startTime = draft.startTime ?? "";
  const breakNum  = parseInt(breakMins) || 0;
  const hours     = calcPaidHours(startTime, finishTime, breakNum);

  const totalMileage = draft.segments.reduce((sum, s: Segment) => {
    if (s.odometerEnd && s.odometerStart) {
      const diff = parseInt(s.odometerEnd) - parseInt(s.odometerStart);
      return diff > 0 ? sum + diff : sum;
    }
    return sum;
  }, 0);

  function handleTimeBlur() {
    const formatted = formatTimeInput(finishTime);
    setFinishTime(formatted);
    updateShiftField("finishTime", formatted);
  }

  useEffect(() => { updateShiftField("breakMins", parseInt(breakMins) || 0); }, [breakMins]);

  function handleNext() {
    const formatted = formatTimeInput(finishTime);
    if (!isValidTime(formatted)) { Alert.alert("Finish time should be HH:MM — e.g. 17:30"); return; }
    updateShiftField("nightOut",    nightOut);
    updateShiftField("expenses",    expenses);
    updateShiftField("delaysNote",  delays);
    updateShiftField("defectsNote", defects);
    updateShiftField("finishTime",  formatted);
    updateShiftField("breakMins",   breakNum);
    updateShiftField("totalHours",  hours.paidStr);
    updateShiftField("totalMins",   hours.paidMins);
    navigation.navigate("Review");
  }

  const overDailyLimit = hours.totalMins > 10 * 60;

  return (
    <SafeAreaView style={shiftSharedStyles.container}>
      <View style={shiftSharedStyles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={shiftSharedStyles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={shiftSharedStyles.topTitle}>End of Shift</Text>
        <View style={{ width: 60 }} />
      </View>

      <KeyboardAwareScrollView
        style={shiftSharedStyles.scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 120 }}
        enableOnAndroid
        extraScrollHeight={20}
      >
        {/* Live hours bar */}
        <View style={styles.hoursSummary}>
          {[
            { label: "Start",  value: startTime || "—" },
            { label: "Finish", value: finishTime },
            { label: "Break",  value: breakNum > 0 ? `${breakNum}m` : "—" },
            { label: "Paid",   value: hours.paidStr !== "—" ? hours.paidStr : "—", accent: true },
          ].map((item, i, arr) => (
            <React.Fragment key={item.label}>
              <View style={styles.hoursSummaryItem}>
                <Text style={styles.hoursSummaryLabel}>{item.label}</Text>
                <Text style={[styles.hoursSummaryValue, item.accent && { color: COLOURS.accent }]}>
                  {item.value}
                </Text>
              </View>
              {i < arr.length - 1 && <View style={styles.hoursSummaryDivider} />}
            </React.Fragment>
          ))}
        </View>

        {overDailyLimit && (
          <View style={styles.legalWarning}>
            <Text style={styles.legalWarningTitle}>⚠ Over 10 Hours</Text>
            <Text style={styles.legalWarningText}>
              UK/EU regulations allow max 9h daily driving, extendable to 10h twice per week.
            </Text>
          </View>
        )}

        <Card>
          <Text style={shiftSharedStyles.fieldLabel}>Finish Time</Text>
          <TextInput
            style={shiftSharedStyles.input}
            value={finishTime}
            onChangeText={setFinishTime}
            onBlur={handleTimeBlur}
            placeholder="HH:MM e.g. 17:30"
            placeholderTextColor={COLOURS.muted}
            keyboardType="numbers-and-punctuation"
          />
          <Text style={shiftSharedStyles.fieldHint}>Auto-filled — edit if you finished earlier</Text>

          <Text style={shiftSharedStyles.fieldLabel}>Unpaid Break</Text>
          <View style={styles.breakButtons}>
            {["0", "15", "30", "45", "60"].map(v => (
              <TouchableOpacity
                key={v}
                style={[styles.breakBtn, breakMins === v && styles.breakBtnActive]}
                onPress={() => setBreakMins(v)}
              >
                <Text style={[styles.breakBtnText, breakMins === v && styles.breakBtnTextActive]}>
                  {v === "0" ? "None" : `${v}m`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={shiftSharedStyles.input}
            value={breakMins}
            onChangeText={setBreakMins}
            placeholder="Or type minutes"
            placeholderTextColor={COLOURS.muted}
            keyboardType="numeric"
          />

          {hours.paidStr !== "—" && (
            <View style={styles.paidResult}>
              <View style={styles.paidResultRow}>
                {[
                  { label: "Total Shift", value: hours.totalStr },
                  { label: "Break",       value: hours.breakStr },
                  { label: "Paid Hours",  value: hours.paidStr, accent: true },
                ].map((item, i, arr) => (
                  <React.Fragment key={item.label}>
                    <View style={styles.paidResultItem}>
                      <Text style={styles.paidResultLabel}>{item.label}</Text>
                      <Text style={[styles.paidResultValue, item.accent && { color: COLOURS.accent, fontSize: 20 }]}>
                        {item.value}
                      </Text>
                    </View>
                    {i < arr.length - 1 && <Text style={styles.paidResultSep}>{i === 0 ? "−" : "="}</Text>}
                  </React.Fragment>
                ))}
              </View>
            </View>
          )}
        </Card>

        <Card>
          <Text style={shiftSharedStyles.fieldLabel}>Shift Totals</Text>
          <View style={styles.totalsGrid}>
            <View style={styles.totalItem}>
              <Text style={styles.totalValue}>{totalMileage > 0 ? totalMileage.toLocaleString() : "—"}</Text>
              <Text style={styles.totalLabel}>Miles</Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.totalItem}>
              <Text style={styles.totalValue}>
                {draft.segments.reduce((s, seg: Segment) => s + (parseFloat(seg.fuelDrawn ?? "") || 0), 0) > 0
                  ? `${draft.segments.reduce((s, seg: Segment) => s + (parseFloat(seg.fuelDrawn ?? "") || 0), 0)}L`
                  : "—"}
              </Text>
              <Text style={styles.totalLabel}>Fuel</Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.totalItem}>
              <Text style={styles.totalValue}>
                {draft.segments.reduce((s, seg: Segment) => s + (parseFloat(seg.adBlueDrawn ?? "") || 0), 0) > 0
                  ? `${draft.segments.reduce((s, seg: Segment) => s + (parseFloat(seg.adBlueDrawn ?? "") || 0), 0)}L`
                  : "—"}
              </Text>
              <Text style={styles.totalLabel}>AdBlue</Text>
            </View>
          </View>

          <View style={shiftSharedStyles.rowBetween}>
            <View>
              <Text style={shiftSharedStyles.fieldLabel}>Night Out</Text>
              <Text style={shiftSharedStyles.fieldHint}>Affects overnight allowance</Text>
            </View>
            <Switch
              value={nightOut}
              onValueChange={setNightOut}
              trackColor={{ false: COLOURS.border, true: COLOURS.primary }}
              thumbColor={COLOURS.white}
            />
          </View>
        </Card>

        <Card>
          <Text style={shiftSharedStyles.fieldLabel}>
            Delays / Issues <Text style={shiftSharedStyles.optional}>(optional)</Text>
          </Text>
          <TextInput
            style={[shiftSharedStyles.input, shiftSharedStyles.multiline]}
            value={delays}
            onChangeText={setDelays}
            placeholder="Traffic, roadworks, site delays, waiting time..."
            placeholderTextColor={COLOURS.muted}
            multiline
          />

          <Text style={shiftSharedStyles.fieldLabel}>
            Expenses <Text style={shiftSharedStyles.optional}>(optional)</Text>
          </Text>
          <TextInput
            style={[shiftSharedStyles.input, shiftSharedStyles.multiline]}
            value={expenses}
            onChangeText={setExpenses}
            placeholder="Toll receipts, parking, meals..."
            placeholderTextColor={COLOURS.muted}
            multiline
          />

          <Text style={shiftSharedStyles.fieldLabel}>
            Defects Found During Shift <Text style={shiftSharedStyles.optional}>(optional)</Text>
          </Text>
          <TextInput
            style={[shiftSharedStyles.input, shiftSharedStyles.multiline]}
            value={defects}
            onChangeText={setDefects}
            placeholder="Any defects discovered during the day..."
            placeholderTextColor={COLOURS.muted}
            multiline
          />
        </Card>

        <View style={{ height: 20 }} />
      </KeyboardAwareScrollView>

      <View style={shiftSharedStyles.bottomNav}>
        <Button label="Review & Submit →" onPress={handleNext} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hoursSummary: {
    flexDirection: "row", backgroundColor: COLOURS.primary,
    margin: 16, borderRadius: 12, padding: 14,
  },
  hoursSummaryItem:    { flex: 1, alignItems: "center" },
  hoursSummaryLabel:   { color: "rgba(255,255,255,0.6)", fontSize: 9, textTransform: "uppercase", marginBottom: 4 },
  hoursSummaryValue:   { color: COLOURS.white, fontSize: 14, fontWeight: "800" },
  hoursSummaryDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.15)", marginHorizontal: 4 },
  legalWarning: {
    margin: 16, backgroundColor: "#fff7ed", borderLeftWidth: 3,
    borderLeftColor: COLOURS.warning, padding: 12, borderRadius: 6,
  },
  legalWarningTitle: { fontSize: 13, fontWeight: "700", color: "#92400e", marginBottom: 4 },
  legalWarningText:  { fontSize: 12, color: "#92400e", lineHeight: 17 },
  breakButtons:      { flexDirection: "row", gap: 6, marginBottom: 8, marginTop: 4 },
  breakBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8, minHeight: 44,
    borderWidth: 1.5, borderColor: COLOURS.border,
    backgroundColor: COLOURS.white, alignItems: "center", justifyContent: "center",
  },
  breakBtnActive:     { backgroundColor: COLOURS.primary, borderColor: COLOURS.primary },
  breakBtnText:       { fontSize: 12, fontWeight: "600", color: COLOURS.primary },
  breakBtnTextActive: { color: COLOURS.white },
  paidResult:      { backgroundColor: COLOURS.primary, borderRadius: 10, padding: 14, marginTop: 8 },
  paidResultRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  paidResultItem:  { alignItems: "center", flex: 1 },
  paidResultLabel: { color: "rgba(255,255,255,0.6)", fontSize: 9, textTransform: "uppercase", marginBottom: 4 },
  paidResultValue: { color: COLOURS.white, fontSize: 14, fontWeight: "800" },
  paidResultSep:   { color: "rgba(255,255,255,0.3)", fontSize: 16, marginHorizontal: 2 },
  totalsGrid:   { flexDirection: "row", alignItems: "center", marginVertical: 8 },
  totalItem:    { flex: 1, alignItems: "center" },
  totalValue:   { fontSize: 22, fontWeight: "900", color: COLOURS.primary },
  totalLabel:   { fontSize: 11, color: COLOURS.muted, marginTop: 2, textTransform: "uppercase" },
  totalDivider: { width: 1, height: 40, backgroundColor: COLOURS.border },
});

export default EndShiftScreen;
