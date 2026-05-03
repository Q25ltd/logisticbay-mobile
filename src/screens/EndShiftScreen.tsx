import React, { useState, useEffect } from "react";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import {
  View, Text, StyleSheet,
  TouchableOpacity, TextInput, Switch, Alert,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card } from "../components";
import { COLOURS } from "../theme";
import { useShift } from "../ShiftContext";
import { type Segment } from "../ShiftContext";
import { calcPaidHours, formatTimeInput, getCurrentTime, isValidTime } from "../utils/shiftTime";
import { shiftSharedStyles } from "./shiftShared";
import type { EndShiftScreenProps } from "../navigation/types";

export function EndShiftScreen({ navigation }: EndShiftScreenProps) {
  const { draft, updateShiftField, draftRestored } = useShift();
  const odomUnit = (draft.odometerUnit ?? "km") as "km" | "miles";

  const [finishTime,  setFinishTime]  = useState(getCurrentTime());
  const [breakMins,   setBreakMins]   = useState("0");
  const [poaMins,     setPoaMins]     = useState("0");
  const [nightOut,    setNightOut]    = useState(false);
  const [expenses,    setExpenses]    = useState("");
  const [delays,      setDelays]      = useState("");
  const [defects,     setDefects]     = useState("");
  const [initialised, setInitialised] = useState(false);

  useEffect(() => { updateShiftField("lastScreen", "EndShift"); }, []);

  useEffect(() => {
    if (draftRestored && !initialised) {
      if (draft.nightOut)    setNightOut(draft.nightOut);
      if (draft.expenses)    setExpenses(draft.expenses);
      if (draft.delaysNote)  setDelays(draft.delaysNote);
      if (draft.defectsNote) setDefects(draft.defectsNote);
      if (draft.finishTime)  setFinishTime(draft.finishTime);
      if (draft.breakMins)   setBreakMins(String(draft.breakMins));
      if (draft.poaMins)     setPoaMins(String(draft.poaMins));
      setInitialised(true);
    }
  }, [draftRestored]);

  const startTime = draft.startTime ?? "";
  const breakNum  = parseInt(breakMins) || 0;
  const poaNum    = parseInt(poaMins)   || 0;
  const hours     = calcPaidHours(startTime, finishTime, breakNum, poaNum);

  // Per-segment stats
  const segmentStats = draft.segments.map((s: Segment) => {
    const miles = (s.odometerEnd && s.odometerStart)
      ? Math.max(0, parseInt(s.odometerEnd) - parseInt(s.odometerStart))
      : null;
    const fuel    = parseFloat(s.fuelDrawn   ?? "") || null;
    const adBlue  = parseFloat(s.adBlueDrawn ?? "") || null;
    return { truckReg: s.truckReg, miles, fuel, adBlue };
  });

  const totalMileage = segmentStats.reduce((sum, s) => sum + (s.miles ?? 0), 0);
  const totalFuel    = segmentStats.reduce((sum, s) => sum + (s.fuel   ?? 0), 0);
  const totalAdBlue  = segmentStats.reduce((sum, s) => sum + (s.adBlue ?? 0), 0);

  function handleTimeBlur() {
    const formatted = formatTimeInput(finishTime);
    setFinishTime(formatted);
    updateShiftField("finishTime", formatted);
  }

  useEffect(() => { updateShiftField("breakMins", parseInt(breakMins) || 0); }, [breakMins]);
  useEffect(() => { updateShiftField("poaMins",   parseInt(poaMins)   || 0); }, [poaMins]);

  function handleNext() {
    const formatted = formatTimeInput(finishTime);
    if (!isValidTime(formatted)) { Alert.alert("Finish time should be HH:MM — e.g. 17:30"); return; }
    updateShiftField("nightOut",    nightOut);
    updateShiftField("expenses",    expenses);
    updateShiftField("delaysNote",  delays);
    updateShiftField("defectsNote", defects);
    updateShiftField("finishTime",  formatted);
    updateShiftField("breakMins",   breakNum);
    updateShiftField("poaMins",     poaNum);
    updateShiftField("totalHours",  hours.workingStr);
    updateShiftField("totalMins",   hours.paidMins);
    updateShiftField("workingMins", hours.workingMins);
    navigation.navigate("Review");
  }

  const overDailyLimit = hours.totalMins > 10 * 60;
  const showPoaWarning = poaNum === 0 && hours.paidMins > 0;

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
            { label: "Start",   value: startTime || "—" },
            { label: "Finish",  value: finishTime },
            { label: "Break",   value: breakNum > 0 ? `${breakNum}m` : "—" },
            { label: poaNum > 0 ? "Working" : "Paid", value: poaNum > 0 ? hours.workingStr : hours.paidStr, accent: true },
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

          <Text style={[shiftSharedStyles.fieldLabel, { marginTop: 12 }]}>
            Period of Availability (POA) <Text style={shiftSharedStyles.optional}>(optional)</Text>
          </Text>
          <Text style={shiftSharedStyles.fieldHint}>
            Waiting time you knew about in advance — loading queue, ferry, depot wait. Not counted as working time under UK law.
          </Text>
          <View style={styles.breakButtons}>
            {["0", "30", "60", "90", "120", "180"].map(v => (
              <TouchableOpacity
                key={v}
                style={[styles.breakBtn, poaMins === v && styles.breakBtnActive]}
                onPress={() => setPoaMins(v)}
              >
                <Text style={[styles.breakBtnText, poaMins === v && styles.breakBtnTextActive]}>
                  {v === "0" ? "None" : v === "60" ? "1h" : v === "90" ? "1h30" : v === "120" ? "2h" : v === "180" ? "3h" : `${v}m`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={shiftSharedStyles.input}
            value={poaMins}
            onChangeText={setPoaMins}
            placeholder="Or type minutes"
            placeholderTextColor={COLOURS.muted}
            keyboardType="numeric"
          />

          {showPoaWarning && (
            <View style={styles.poaWarning}>
              <Text style={styles.poaWarningText}>
                ⚠ No POA entered — if you had any waiting time today, your legal working hours may be shown higher than actual. Add POA above to get an accurate figure.
              </Text>
            </View>
          )}

          {hours.paidStr !== "—" && (
            <View style={styles.paidResult}>
              {poaNum > 0 ? (
                <>
                  {/* Row 1: payroll calculation */}
                  <View style={styles.paidResultRow}>
                    {[
                      { label: "Total Shift", value: hours.totalStr },
                      { label: "Break",       value: hours.breakStr },
                      { label: "Paid Hours",  value: hours.paidStr },
                    ].map((item, i, arr) => (
                      <React.Fragment key={item.label}>
                        <View style={styles.paidResultItem}>
                          <Text style={styles.paidResultLabel}>{item.label}</Text>
                          <Text style={styles.paidResultValue}>{item.value}</Text>
                        </View>
                        {i < arr.length - 1 && <Text style={styles.paidResultSep}>{i === 0 ? "−" : "="}</Text>}
                      </React.Fragment>
                    ))}
                  </View>
                  {/* Divider */}
                  <View style={styles.paidResultDivider} />
                  {/* Row 2: legal working time calculation */}
                  <View style={styles.paidResultRow}>
                    {[
                      { label: "Paid Hours",   value: hours.paidStr },
                      { label: "POA",          value: hours.poaStr },
                      { label: "Working Time", value: hours.workingStr, accent: true },
                    ].map((item, i, arr) => (
                      <React.Fragment key={item.label}>
                        <View style={styles.paidResultItem}>
                          <Text style={styles.paidResultLabel}>{item.label}</Text>
                          <Text style={[styles.paidResultValue, (item as any).accent && { color: COLOURS.accent, fontSize: 20 }]}>
                            {item.value}
                          </Text>
                        </View>
                        {i < arr.length - 1 && <Text style={styles.paidResultSep}>{i === 0 ? "−" : "="}</Text>}
                      </React.Fragment>
                    ))}
                  </View>
                </>
              ) : (
                <View style={styles.paidResultRow}>
                  {[
                    { label: "Total Shift", value: hours.totalStr },
                    { label: "Break",       value: hours.breakStr },
                    { label: "Paid Hours",  value: hours.paidStr, accent: true },
                  ].map((item, i, arr) => (
                    <React.Fragment key={item.label}>
                      <View style={styles.paidResultItem}>
                        <Text style={styles.paidResultLabel}>{item.label}</Text>
                        <Text style={[styles.paidResultValue, (item as any).accent && { color: COLOURS.accent, fontSize: 20 }]}>
                          {item.value}
                        </Text>
                      </View>
                      {i < arr.length - 1 && <Text style={styles.paidResultSep}>{i === 0 ? "−" : "="}</Text>}
                    </React.Fragment>
                  ))}
                </View>
              )}
            </View>
          )}
        </Card>

        {/* Per-segment vehicle summary */}
        <Card style={{ marginTop: 12 }}>
          <Text style={shiftSharedStyles.fieldLabel}>Vehicles Used Today</Text>
          {segmentStats.map((seg, i) => (
            <View key={i} style={[styles.segRow, i > 0 && styles.segRowBorder]}>
              <View style={styles.segPlate}>
                <Text style={styles.segPlateText}>{seg.truckReg || "—"}</Text>
              </View>
              <View style={styles.segStats}>
                <View style={styles.segStat}>
                  <Text style={styles.segStatValue}>{seg.miles != null ? seg.miles.toLocaleString() : "—"}</Text>
                  <Text style={styles.segStatLabel}>{odomUnit}</Text>
                </View>
                <View style={styles.segStat}>
                  <Text style={styles.segStatValue}>{seg.fuel != null ? `${seg.fuel}L` : "—"}</Text>
                  <Text style={styles.segStatLabel}>fuel</Text>
                </View>
                <View style={styles.segStat}>
                  <Text style={styles.segStatValue}>{seg.adBlue != null ? `${seg.adBlue}L` : "—"}</Text>
                  <Text style={styles.segStatLabel}>adblue</Text>
                </View>
              </View>
            </View>
          ))}

          {/* Day totals */}
          {draft.segments.length > 1 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>TOTAL</Text>
              <View style={styles.segStats}>
                <View style={styles.segStat}>
                  <Text style={styles.totalValue}>{totalMileage > 0 ? totalMileage.toLocaleString() : "—"}</Text>
                  <Text style={styles.segStatLabel}>{odomUnit}</Text>
                </View>
                <View style={styles.segStat}>
                  <Text style={styles.totalValue}>{totalFuel > 0 ? `${totalFuel}L` : "—"}</Text>
                  <Text style={styles.segStatLabel}>fuel</Text>
                </View>
                <View style={styles.segStat}>
                  <Text style={styles.totalValue}>{totalAdBlue > 0 ? `${totalAdBlue}L` : "—"}</Text>
                  <Text style={styles.segStatLabel}>adblue</Text>
                </View>
              </View>
            </View>
          )}
        </Card>

        <Card style={{ marginTop: 12 }}>
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

        <Card style={{ marginTop: 12 }}>
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
  poaWarning: {
    backgroundColor: "#fffbeb", borderLeftWidth: 3, borderLeftColor: "#f59e0b",
    padding: 10, borderRadius: 6, marginTop: 8,
  },
  poaWarningText: { fontSize: 12, color: "#92400e", lineHeight: 17 },
  breakButtons:      { flexDirection: "row", gap: 6, marginBottom: 8, marginTop: 4 },
  breakBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8, minHeight: 44,
    borderWidth: 1.5, borderColor: COLOURS.border,
    backgroundColor: COLOURS.white, alignItems: "center", justifyContent: "center",
  },
  breakBtnActive:     { backgroundColor: COLOURS.primary, borderColor: COLOURS.primary },
  breakBtnText:       { fontSize: 12, fontWeight: "600", color: COLOURS.primary },
  breakBtnTextActive: { color: COLOURS.white },
  paidResult:        { backgroundColor: COLOURS.primary, borderRadius: 10, padding: 14, marginTop: 8 },
  paidResultDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.15)", marginVertical: 10 },
  paidResultRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  paidResultItem:  { alignItems: "center", flex: 1 },
  paidResultLabel: { color: "rgba(255,255,255,0.6)", fontSize: 9, textTransform: "uppercase", marginBottom: 4 },
  paidResultValue: { color: COLOURS.white, fontSize: 14, fontWeight: "800" },
  paidResultSep:   { color: "rgba(255,255,255,0.3)", fontSize: 16, marginHorizontal: 2 },
  // Per-segment rows
  segRow:          { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  segRowBorder:    { borderTopWidth: 1, borderTopColor: COLOURS.border },
  segPlate:        { backgroundColor: COLOURS.primary, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, minWidth: 90, alignItems: "center" },
  segPlateText:    { color: COLOURS.white, fontSize: 13, fontWeight: "900", letterSpacing: 1 },
  segStats:        { flex: 1, flexDirection: "row", justifyContent: "space-around", marginLeft: 12 },
  segStat:         { alignItems: "center" },
  segStatValue:    { fontSize: 15, fontWeight: "700", color: COLOURS.primary },
  segStatLabel:    { fontSize: 10, color: COLOURS.muted, textTransform: "uppercase", marginTop: 1 },
  totalsRow:       { flexDirection: "row", alignItems: "center", borderTopWidth: 2, borderTopColor: COLOURS.primary, paddingTop: 10, marginTop: 4 },
  totalsLabel:     { fontSize: 10, fontWeight: "800", color: COLOURS.primary, textTransform: "uppercase", letterSpacing: 0.5, minWidth: 90, textAlign: "center" },
  totalValue:      { fontSize: 15, fontWeight: "900", color: COLOURS.accent },
});

export default EndShiftScreen;
