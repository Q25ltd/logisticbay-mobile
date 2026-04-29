import React, { useState, useEffect, useRef } from "react";
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, TextInput, Switch, Alert, KeyboardAvoidingView,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLOURS, Button, Card, SectionHeader } from "../components";
import { useShift } from "../ShiftContext";
import { VEHICLE_CLASSES, type VehicleClass } from "../constants";
import { api } from "../api";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getCurrentTime(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;
}

function isValidTime(t: string): boolean {
  return /^\d{1,2}:\d{2}$/.test(t);
}

function formatTimeInput(raw: string): string {
  // Auto-insert colon: "0600" → "06:00", "830" → "08:30"
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 4) return `${digits.slice(0,2)}:${digits.slice(2,4)}`;
  if (digits.length === 3) return `0${digits[0]}:${digits.slice(1)}`;
  return raw;
}

function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function calcPaidHours(start: string, finish: string, breakMins: number) {
  if (!isValidTime(start) || !isValidTime(finish)) {
    return { totalMins: 0, paidMins: 0, totalStr: "—", paidStr: "—", breakStr: "—" };
  }
  let total = timeToMins(finish) - timeToMins(start);
  if (total < 0) total += 24 * 60;
  const paid = Math.max(0, total - breakMins);
  const fmt  = (m: number) => `${Math.floor(m/60)}h ${(m%60).toString().padStart(2,"0")}m`;
  return {
    totalMins: total, paidMins: paid,
    totalStr: fmt(total), paidStr: fmt(paid),
    breakStr: breakMins > 0 ? `${breakMins} min` : "None",
  };
}

// Persist last truck/class across sessions
async function saveLastVehicle(truckReg: string, vehicleClass: VehicleClass) {
  try { await AsyncStorage.setItem("lastVehicle", JSON.stringify({ truckReg, vehicleClass })); } catch {}
}
async function loadLastVehicle(): Promise<{ truckReg: string; vehicleClass: VehicleClass } | null> {
  try { const v = await AsyncStorage.getItem("lastVehicle"); return v ? JSON.parse(v) : null; } catch { return null; }
}

// Trailer memory — checked trailers today skip re-check
export async function getCheckedTrailersToday(): Promise<string[]> {
  try {
    const today = new Date().toDateString();
    const v = await AsyncStorage.getItem(`trailers_${today}`);
    return v ? JSON.parse(v) : [];
  } catch { return []; }
}
export async function markTrailerCheckedToday(reg: string) {
  try {
    const today   = new Date().toDateString();
    const current = await getCheckedTrailersToday();
    const upper   = reg.trim().toUpperCase();
    if (!current.includes(upper)) {
      await AsyncStorage.setItem(`trailers_${today}`, JSON.stringify([...current, upper]));
    }
  } catch {}
}

// Draft persistence — save/restore in case app crashes
async function saveDraft(draft: any) {
  try { await AsyncStorage.setItem("shiftDraft", JSON.stringify(draft)); } catch {}
}
async function clearDraft() {
  try { await AsyncStorage.removeItem("shiftDraft"); } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Start Shift Screen
// ─────────────────────────────────────────────────────────────────────────────

export function StartShiftScreen({ navigation }: { navigation: any }) {
  const { draft, updateShiftField, updateSegment, setShiftId, setVehicleClass } = useShift();

  React.useEffect(() => { updateShiftField("lastScreen", "StartShift"); }, []);
  const seg = draft.segments[0];

  const [vehicleClass, setVC]       = useState<VehicleClass>("class1");
  const [truckReg,     setTruckReg] = useState(seg.truckReg);
  const [hasTrailer,   setHasTrailer]= useState(true);
  const [trailerReg,   setTrailerReg]= useState(seg.trailerReg);
  const [odomStart,    setOdomStart] = useState(seg.odometerStart);
  const [startTime,    setStartTime] = useState(getCurrentTime());
  const [loading,      setLoading]   = useState(false);

  useEffect(() => {
    loadLastVehicle().then(last => {
      if (last) {
        if (!truckReg) setTruckReg(last.truckReg);
        setVC(last.vehicleClass);
      }
    });
  }, []);

  const isClass1 = vehicleClass === "class1";

  function handleCancel() {
    Alert.alert(
      "Cancel Shift?",
      "Any information entered will be lost.",
      [
        { text: "Keep editing", style: "cancel" },
        { text: "Cancel shift", style: "destructive", onPress: () => navigation.goBack() },
      ]
    );
  }

  function handleTimeBlur() {
    setStartTime(formatTimeInput(startTime));
  }

  async function handleNext() {
    const cleanTruck   = truckReg.trim().toUpperCase().replace(/\s+/g, "");
    const cleanTrailer = trailerReg.trim().toUpperCase().replace(/\s+/g, "");

    if (!cleanTruck)   { Alert.alert("Just need the truck reg to continue"); return; }
    if (!odomStart.trim() || isNaN(parseInt(odomStart))) { Alert.alert("Just need the odometer reading to continue"); return; }
    if (isClass1 && hasTrailer && !cleanTrailer) { Alert.alert("Just need the trailer reg — or toggle off if running solo"); return; }

    const formattedTime = formatTimeInput(startTime);
    if (!isValidTime(formattedTime)) { Alert.alert("Start time should be HH:MM — e.g. 06:00"); return; }

    setLoading(true);
    try {
      const res = await api.post("/shifts", {
        shiftDate: new Date().toISOString(),
        startTime: formattedTime,
      });

      setShiftId(res.data.id);
      updateShiftField("startTime", formattedTime);

      const finalHasTrailer = isClass1 && hasTrailer;
      const finalTrailerReg = finalHasTrailer ? cleanTrailer : "";

      updateSegment({
        vehicleClass,
        truckReg:          cleanTruck,
        trailerReg:        finalTrailerReg,
        hasTrailer:        finalHasTrailer,
        odometerStart:     odomStart,
        needsTruckCheck:   true,
        needsTrailerCheck: finalHasTrailer,
      });
      setVehicleClass(vehicleClass);

      await saveLastVehicle(cleanTruck, vehicleClass);
      if (finalHasTrailer && finalTrailerReg) {
        await markTrailerCheckedToday(finalTrailerReg);
      }

      navigation.navigate("TruckChecklist");
    } catch (err: any) {
      Alert.alert("Couldn't start shift", err.response?.data?.error ?? "Check your connection and try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleCancel}>
          <Text style={styles.backText}>✕ Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Start Shift</Text>
        <View style={{ width: 60 }} />
      </View>

      <KeyboardAwareScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }} enableOnAndroid={true} extraScrollHeight={20}>

          {/* Vehicle class — 3 big tap targets */}
          <View style={styles.classGrid}>
            {VEHICLE_CLASSES.map(vc => (
              <TouchableOpacity
                key={vc.key}
                style={[styles.classCard, vehicleClass === vc.key && styles.classCardActive]}
                onPress={() => {
                  setVC(vc.key);
                  if (vc.key !== "class1") setHasTrailer(false);
                  else setHasTrailer(true);
                }}
              >
                <Text style={styles.classIcon}>{vc.icon}</Text>
                <Text style={[styles.classLabel, vehicleClass === vc.key && { color: COLOURS.white }]}>{vc.label}</Text>
                <Text style={[styles.classSub, vehicleClass === vc.key && { color: "rgba(255,255,255,0.7)" }]}>{vc.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Card>
            <Text style={styles.fieldLabel}>{vehicleClass === "van" ? "Van" : "Truck"} Registration</Text>
            <TextInput
              style={styles.input} value={truckReg}
              onChangeText={t => setTruckReg(t.toUpperCase())}
              placeholder="e.g. AB12 CDE" placeholderTextColor={COLOURS.muted}
              autoCapitalize="characters" returnKeyType="next"
            />

            {isClass1 && (
              <>
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.fieldLabel}>Starting with Trailer?</Text>
                    <Text style={styles.fieldHint}>Toggle off if running solo</Text>
                  </View>
                  <Switch value={hasTrailer} onValueChange={setHasTrailer}
                    trackColor={{ false: COLOURS.border, true: COLOURS.primary }} thumbColor={COLOURS.white} />
                </View>

                {hasTrailer && (
                  <TextInput
                    style={styles.input} value={trailerReg}
                    onChangeText={t => setTrailerReg(t.toUpperCase())}
                    placeholder="Trailer reg e.g. XY34 FGH" placeholderTextColor={COLOURS.muted}
                    autoCapitalize="characters"
                  />
                )}
              </>
            )}

            <Text style={styles.fieldLabel}>Odometer Start (km)</Text>
            <TextInput
              style={styles.input} value={odomStart} onChangeText={setOdomStart}
              placeholder="e.g. 10000" placeholderTextColor={COLOURS.muted} keyboardType="numeric"
            />

            <Text style={styles.fieldLabel}>Start Time</Text>
            <TextInput
              style={styles.input} value={startTime} onChangeText={setStartTime}
              onBlur={handleTimeBlur}
              placeholder="HH:MM e.g. 06:00" placeholderTextColor={COLOURS.muted}
              keyboardType="numbers-and-punctuation"
            />
            <Text style={styles.fieldHint}>Auto-filled — edit if you started earlier</Text>
          </Card>

          <View style={styles.legalNote}>
            <Text style={styles.legalText}>
              ⚖️  Next: walk round check including oil & water.{"\n"}
              All 18 items default to PASS — only tap items with defects. Clean vehicle = zero taps.
            </Text>
          </View>

          <View style={{ height: 20 }} />
        </KeyboardAwareScrollView>

      <View style={styles.bottomNav}>
        <Button label="Start Walk Round →" onPress={handleNext} loading={loading} />
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// End Shift Screen
// ─────────────────────────────────────────────────────────────────────────────

export function EndShiftScreen({ navigation }: { navigation: any }) {
  const { draft, updateShiftField, draftRestored } = useShift() as any;

  const [finishTime,   setFinishTime]   = useState(getCurrentTime());
  const [breakMins,    setBreakMins]    = useState("0");
  const [fuelDrawn,    setFuelDrawn]    = useState("");
  const [adBlue,       setAdBlue]       = useState("");
  const [nightOut,     setNightOut]     = useState(false);
  const [expenses,     setExpenses]     = useState("");
  const [delays,       setDelays]       = useState("");
  const [defects,      setDefects]      = useState("");
  const [initialised,  setInitialised]  = useState(false);

  React.useEffect(() => { updateShiftField("lastScreen", "EndShift"); }, []);

  // Re-initialise fields from restored draft (after app crash/disconnect)
  React.useEffect(() => {
    if (draftRestored && !initialised) {
      if (draft.fuelDrawn)        setFuelDrawn(draft.fuelDrawn);
      if (draft.adBlueDrawn)      setAdBlue(draft.adBlueDrawn);
      if (draft.nightOut)         setNightOut(draft.nightOut);
      if (draft.expenses)         setExpenses(draft.expenses);
      if (draft.delaysNote)       setDelays(draft.delaysNote);
      if (draft.defectsNote)      setDefects(draft.defectsNote);
      if (draft.finishTime)       setFinishTime(draft.finishTime);
      if (draft.breakMins)        setBreakMins(String(draft.breakMins));
      setInitialised(true);
    }
  }, [draftRestored]);

  const startTime = (draft as any).startTime ?? "";
  const breakNum  = parseInt(breakMins) || 0;
  const hours     = calcPaidHours(startTime, finishTime, breakNum);

  // Only count mileage for truck changes — trailer changes share same truck odometer
  const totalMileage = draft.segments.reduce((sum, s) => {
    if (s.odometerEnd && s.odometerStart) {
      const diff = parseInt(s.odometerEnd) - parseInt(s.odometerStart);
      return diff > 0 ? sum + diff : sum;
    }
    return sum;
  }, 0);

  function handleTimeBlur() {
    const formatted = formatTimeInput(finishTime);
    setFinishTime(formatted);
    updateShiftField("finishTime", formatted); // persist immediately
  }

  // Persist breakMins whenever it changes
  React.useEffect(() => {
    updateShiftField("breakMins", parseInt(breakMins) || 0);
  }, [breakMins]);

  function handleNext() {
    const formatted = formatTimeInput(finishTime);
    if (!isValidTime(formatted)) { Alert.alert("Finish time should be HH:MM — e.g. 17:30"); return; }
    updateShiftField("nightOut",    nightOut);
    updateShiftField("expenses",    expenses);
    updateShiftField("delaysNote",  delays);
    updateShiftField("defectsNote", defects);
    // fuel/adBlue already saved per segment at vehicle change
    updateShiftField("finishTime",  formatted);
    updateShiftField("breakMins",   breakNum);
    updateShiftField("totalHours",  hours.paidStr);
    updateShiftField("totalMins",   hours.paidMins);
    navigation.navigate("Review");
  }

  const overDailyLimit = hours.totalMins > 10 * 60;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>End of Shift</Text>
        <View style={{ width: 60 }} />
      </View>

      <KeyboardAwareScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }} enableOnAndroid={true} extraScrollHeight={20}>

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
                  <Text style={[styles.hoursSummaryValue, (item as any).accent && { color: COLOURS.accent }]}>
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
            <Text style={styles.fieldLabel}>Finish Time</Text>
            <TextInput
              style={styles.input} value={finishTime}
              onChangeText={setFinishTime} onBlur={handleTimeBlur}
              placeholder="HH:MM e.g. 17:30" placeholderTextColor={COLOURS.muted}
              keyboardType="numbers-and-punctuation"
            />
            <Text style={styles.fieldHint}>Auto-filled — edit if you finished earlier</Text>

            <Text style={styles.fieldLabel}>Unpaid Break</Text>
            <View style={styles.breakButtons}>
              {["0","15","30","45","60"].map(v => (
                <TouchableOpacity key={v}
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
              style={styles.input} value={breakMins} onChangeText={setBreakMins}
              placeholder="Or type minutes" placeholderTextColor={COLOURS.muted} keyboardType="numeric"
            />

            {hours.paidStr !== "—" && (
              <View style={styles.paidResult}>
                <View style={styles.paidResultRow}>
                  <View style={styles.paidResultItem}>
                    <Text style={styles.paidResultLabel}>Total Shift</Text>
                    <Text style={styles.paidResultValue}>{hours.totalStr}</Text>
                  </View>
                  <Text style={styles.paidResultMinus}>−</Text>
                  <View style={styles.paidResultItem}>
                    <Text style={styles.paidResultLabel}>Break</Text>
                    <Text style={styles.paidResultValue}>{hours.breakStr}</Text>
                  </View>
                  <Text style={styles.paidResultMinus}>=</Text>
                  <View style={styles.paidResultItem}>
                    <Text style={styles.paidResultLabel}>Paid Hours</Text>
                    <Text style={[styles.paidResultValue, { color: COLOURS.accent, fontSize: 20 }]}>{hours.paidStr}</Text>
                  </View>
                </View>
              </View>
            )}
          </Card>

          <Card>
            {/* Calculated totals from all segments */}
            <Text style={styles.fieldLabel}>Shift Totals</Text>
            <View style={styles.totalsGrid}>
              <View style={styles.totalItem}>
                <Text style={styles.totalValue}>{totalMileage > 0 ? `${totalMileage.toLocaleString()}` : "—"}</Text>
                <Text style={styles.totalLabel}>Miles</Text>
              </View>
              <View style={styles.totalDivider} />
              <View style={styles.totalItem}>
                <Text style={styles.totalValue}>
                  {draft.segments.reduce((s: number, seg: any) => s + (parseFloat(seg.fuelDrawn) || 0), 0) > 0
                    ? `${draft.segments.reduce((s: number, seg: any) => s + (parseFloat(seg.fuelDrawn) || 0), 0)}L`
                    : "—"}
                </Text>
                <Text style={styles.totalLabel}>Fuel</Text>
              </View>
              <View style={styles.totalDivider} />
              <View style={styles.totalItem}>
                <Text style={styles.totalValue}>
                  {draft.segments.reduce((s: number, seg: any) => s + (parseFloat(seg.adBlueDrawn) || 0), 0) > 0
                    ? `${draft.segments.reduce((s: number, seg: any) => s + (parseFloat(seg.adBlueDrawn) || 0), 0)}L`
                    : "—"}
                </Text>
                <Text style={styles.totalLabel}>AdBlue</Text>
              </View>
            </View>
            <Text style={styles.totalsHint}>Recorded at each vehicle change · tap to correct</Text>

            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.fieldLabel}>Night Out</Text>
                <Text style={styles.fieldHint}>Affects overnight allowance</Text>
              </View>
              <Switch value={nightOut} onValueChange={setNightOut}
                trackColor={{ false: COLOURS.border, true: COLOURS.primary }} thumbColor={COLOURS.white} />
            </View>
          </Card>

          <Card>
            <Text style={styles.fieldLabel}>Delays / Issues <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput style={[styles.input, styles.multiline]} value={delays} onChangeText={setDelays}
              placeholder="Traffic, roadworks, site delays, waiting time..." placeholderTextColor={COLOURS.muted} multiline />

            <Text style={styles.fieldLabel}>Expenses <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput style={[styles.input, styles.multiline]} value={expenses} onChangeText={setExpenses}
              placeholder="Toll receipts, parking, meals..." placeholderTextColor={COLOURS.muted} multiline />

            <Text style={styles.fieldLabel}>Defects Found During Shift <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput style={[styles.input, styles.multiline]} value={defects} onChangeText={setDefects}
              placeholder="Any defects discovered during the day..." placeholderTextColor={COLOURS.muted} multiline />
          </Card>

          <View style={{ height: 20 }} />
        </KeyboardAwareScrollView>

      <View style={styles.bottomNav}>
        <Button label="Review & Submit →" onPress={handleNext} />
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Review & Submit Screen
// ─────────────────────────────────────────────────────────────────────────────

export function ReviewScreen({ navigation }: { navigation: any }) {
  const { draft, resetDraft } = useShift();
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const submitLock    = useRef(false); // prevent double-tap

  const allChecks    = draft.segments.flatMap(s => [...s.truckChecks, ...s.trailerChecks]);
  const hasDefects   = allChecks.some((c: any) => c.result === "fail" || c.ok === false);
  const failedChecks = allChecks.filter((c: any) => c.result === "fail" || c.ok === false);

  // Only count mileage for truck changes — trailer changes share same truck odometer
  const totalMileage = draft.segments.reduce((sum, s) => {
    if (s.odometerEnd && s.odometerStart) {
      const diff = parseInt(s.odometerEnd) - parseInt(s.odometerStart);
      return diff > 0 ? sum + diff : sum;
    }
    return sum;
  }, 0);
  const totalJobs   = draft.segments.reduce((sum, s) => sum + s.deliveries.length, 0);

  const startTime   = (draft as any).startTime   ?? "";
  const finishTime  = (draft as any).finishTime  ?? "";
  const totalHours  = (draft as any).totalHours  ?? "";
  const breakMins   = (draft as any).breakMins   ?? 0;
  const fuelDrawn   = (draft as any).fuelDrawn   ?? "";
  const adBlueDrawn = (draft as any).adBlueDrawn ?? "";

  async function handleSubmit() {
    if (submitLock.current) return; // block double-tap
    if (!draft.shiftId) { Alert.alert("Shift ID missing — please restart the app"); return; }

    submitLock.current = true;
    setSubmitting(true);
    try {
      for (const seg of draft.segments) {
        const segRes = await api.post(`/shifts/${draft.shiftId}/segments`, {
          truckReg:          seg.truckReg,
          trailerReg:        seg.hasTrailer ? seg.trailerReg : null,
          odometerStart:     seg.odometerStart ? parseInt(seg.odometerStart) : null,
          truckChecks:       seg.needsTruckCheck   ? seg.truckChecks   : [],
          trailerChecks:     seg.needsTrailerCheck ? seg.trailerChecks : null,
          prevOdometerEnd:   seg.odometerEnd ? parseInt(seg.odometerEnd) : undefined,
          vehicleClass:      seg.vehicleClass,
          needsTruckCheck:   seg.needsTruckCheck,
          needsTrailerCheck: seg.needsTrailerCheck,
        });

        const segmentId = segRes.data.segmentId;
        for (const d of seg.deliveries) {
          await api.post(`/shifts/${draft.shiftId}/segments/${segmentId}/deliveries`, {
            materials: d.materials, collectFrom: d.collectFrom, deliverTo: d.deliverTo,
            ticketNo: d.ticketNo, startTime: d.startTime, finishTime: d.finishTime,
            hours: d.hours, loadType: d.loadType ?? "weight", pallets: d.pallets ?? "",
            tonnes: d.tonnes, kgs: d.kgs, notes: d.notes,
          });
        }
      }

      const lastSeg = draft.segments[draft.segments.length - 1];
      await api.patch(`/shifts/${draft.shiftId}/submit`, {
        odometerEnd:  lastSeg.odometerEnd ? parseInt(lastSeg.odometerEnd) : undefined,
        segmentNotes: lastSeg.notes,
        nightOut:     draft.nightOut,
        expenses:     draft.expenses,
        delaysNote:   draft.delaysNote,
        defectsNote:  draft.defectsNote,
        fuelDrawn, adBlueDrawn,
        endTime:      finishTime,
        totalHours,
        breakMins:    String(breakMins),
      });

      await clearDraft();
      resetDraft();
      setSubmitted(true);

      Alert.alert(
        "✅ Shift Submitted",
        "Your report has been sent to the office by email with a full PDF attached.",
        [{ text: "Done", onPress: () => navigation.navigate("Home") }]
      );
    } catch (err: any) {
      submitLock.current = false; // allow retry on error
      const msg = err.response?.data?.details?.join("\n") ?? err.response?.data?.error ?? "Submission failed — check your connection";
      Alert.alert("Submission failed", msg + "\n\nYour data is safe — tap Submit to try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} disabled={submitting}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Review & Submit</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scroll}>

        {/* Defect warning — prominent */}
        {hasDefects && (
          <View style={styles.defectBanner}>
            <Text style={styles.defectTitle}>⚠ {failedChecks.length} Defect{failedChecks.length > 1 ? "s" : ""} Recorded</Text>
            {failedChecks.slice(0, 3).map((c: any) => (
              <Text key={c.key} style={styles.defectItem}>• {c.label}{c.note ? `: ${c.note}` : ""}</Text>
            ))}
            {failedChecks.length > 3 && (
              <Text style={styles.defectItem}>+ {failedChecks.length - 3} more — see full PDF</Text>
            )}
            <Text style={styles.defectNote}>These will be flagged in the report sent to your office.</Text>
          </View>
        )}

        {/* Hours — most important thing to the driver */}
        <Card style={{ margin: 16, marginBottom: 8 }}>
          <Text style={styles.sectionLabel}>Hours Today</Text>
          <View style={styles.hoursGrid}>
            <View style={styles.hoursGridItem}>
              <Text style={styles.hoursGridLabel}>Start</Text>
              <Text style={styles.hoursGridValue}>{startTime || "—"}</Text>
            </View>
            <View style={styles.hoursGridItem}>
              <Text style={styles.hoursGridLabel}>Finish</Text>
              <Text style={styles.hoursGridValue}>{finishTime || "—"}</Text>
            </View>
            <View style={styles.hoursGridItem}>
              <Text style={styles.hoursGridLabel}>Break</Text>
              <Text style={styles.hoursGridValue}>{breakMins > 0 ? `${breakMins}m` : "None"}</Text>
            </View>
            <View style={[styles.hoursGridItem, { backgroundColor: COLOURS.primary, borderRadius: 8, padding: 10 }]}>
              <Text style={[styles.hoursGridLabel, { color: "rgba(255,255,255,0.6)" }]}>Paid Hours</Text>
              <Text style={[styles.hoursGridValue, { color: COLOURS.accent, fontSize: 22 }]}>{totalHours || "—"}</Text>
            </View>
          </View>
          <Text style={styles.legalInfoText}>UK/EU: max 48h avg/week · max 60h any single week · min 11h rest</Text>
        </Card>

        {/* Shift summary */}
        <Card style={{ marginHorizontal: 16, marginBottom: 8 }}>
          <Text style={styles.sectionLabel}>Shift Summary</Text>
          <Text style={styles.summaryRow}>📅 {new Date(draft.shiftDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</Text>
          <Text style={styles.summaryRow}>📍 {totalMileage.toLocaleString()} km total · {draft.segments.length} segment{draft.segments.length !== 1 ? "s" : ""} · {totalJobs} job{totalJobs !== 1 ? "s" : ""}</Text>
          <Text style={styles.summaryRow}>
            ✅ Checks: <Text style={{ color: hasDefects ? COLOURS.fail : COLOURS.pass, fontWeight: "700" }}>
              {hasDefects ? `${failedChecks.length} defect${failedChecks.length > 1 ? "s" : ""}` : "All passed"}
            </Text>
          </Text>
          {fuelDrawn   ? <Text style={styles.summaryRow}>⛽ Fuel: {fuelDrawn}</Text>   : null}
          {adBlueDrawn ? <Text style={styles.summaryRow}>🔵 AdBlue: {adBlueDrawn}</Text> : null}
          {draft.nightOut && <Text style={styles.summaryRow}>🌙 Night out</Text>}
        </Card>

        {/* Segments */}
        {draft.segments.map((seg, i) => (
          <Card key={seg.id} style={{ marginHorizontal: 16, marginBottom: 8 }}>
            <Text style={styles.sectionLabel}>
              Segment {i + 1} — {seg.vehicleClass === "van" ? "🚐 Van" : seg.vehicleClass === "class2" ? "🚚 Rigid" : "🚛 Artic"}
            </Text>
            <Text style={styles.summaryRow}>
              {seg.truckReg}{seg.hasTrailer ? `  +  ${seg.trailerReg}` : ""}
            </Text>
            {seg.odometerEnd && (
              <Text style={styles.summaryRow}>
                {parseInt(seg.odometerEnd) - parseInt(seg.odometerStart)} km
                ({seg.odometerStart} → {seg.odometerEnd})
              </Text>
            )}
            {!seg.needsTruckCheck   && <Text style={styles.skippedNote}>Truck check not repeated — unchanged</Text>}
            {!seg.needsTrailerCheck && seg.hasTrailer && <Text style={styles.skippedNote}>Trailer check not repeated — unchanged</Text>}
            <Text style={styles.summaryRow}>{seg.deliveries.length} job{seg.deliveries.length !== 1 ? "s" : ""}</Text>
          </Card>
        ))}

        {draft.delaysNote ? (
          <Card style={{ marginHorizontal: 16, marginBottom: 8 }}>
            <Text style={styles.sectionLabel}>Delays</Text>
            <Text style={styles.summaryRow}>{draft.delaysNote}</Text>
          </Card>
        ) : null}

        {draft.expenses ? (
          <Card style={{ marginHorizontal: 16, marginBottom: 8 }}>
            <Text style={styles.sectionLabel}>Expenses</Text>
            <Text style={styles.summaryRow}>{draft.expenses}</Text>
          </Card>
        ) : null}

        <View style={{ height: 20 }} />
      </ScrollView>

      <View style={styles.bottomNav}>
        <Button
          label={submitting ? "Submitting..." : "Submit Shift Report"}
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting || submitted}
          style={{ backgroundColor: hasDefects ? COLOURS.fail : COLOURS.pass }}
        />
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLOURS.background },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLOURS.white,
    borderBottomWidth: 1, borderBottomColor: COLOURS.border,
  },
  backText:     { color: COLOURS.accent, fontSize: 15, fontWeight: "600" },
  topTitle:     { fontSize: 16, fontWeight: "700", color: COLOURS.primary },
  scroll:       { flex: 1 },
  fieldLabel:   { fontSize: 12, fontWeight: "600", color: COLOURS.primary, marginBottom: 4, marginTop: 8 },
  fieldHint:    { fontSize: 11, color: COLOURS.muted, marginBottom: 8, marginTop: -2 },
  optional:     { fontWeight: "400", color: COLOURS.muted },
  input: {
    borderWidth: 1.5, borderColor: COLOURS.border, borderRadius: 10,
    padding: 12, fontSize: 15, color: COLOURS.primary, marginBottom: 4,
    backgroundColor: COLOURS.white, minHeight: 44,
  },
  multiline:    { minHeight: 70, textAlignVertical: "top" },
  rowBetween:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  legalNote: {
    margin: 16, backgroundColor: "#eff6ff", borderLeftWidth: 3,
    borderLeftColor: "#3b82f6", padding: 12, borderRadius: 6,
  },
  legalText:    { fontSize: 12, color: "#1e40af", lineHeight: 18 },
  legalWarning: {
    margin: 16, backgroundColor: "#fff7ed", borderLeftWidth: 3,
    borderLeftColor: COLOURS.warning, padding: 12, borderRadius: 6,
  },
  legalWarningTitle: { fontSize: 13, fontWeight: "700", color: "#92400e", marginBottom: 4 },
  legalWarningText:  { fontSize: 12, color: "#92400e", lineHeight: 17 },
  legalInfoText:     { fontSize: 11, color: "#1e40af", marginTop: 8 },
  bottomNav: {
    padding: 16, backgroundColor: COLOURS.white,
    borderTopWidth: 1, borderTopColor: COLOURS.border,
  },

  // Vehicle class selector
  classGrid:      { flexDirection: "row", gap: 8, padding: 16, paddingBottom: 0 },
  classCard: {
    flex: 1, borderRadius: 12, padding: 12, backgroundColor: COLOURS.white,
    borderWidth: 1.5, borderColor: COLOURS.border, alignItems: "center",
  },
  classCardActive: { backgroundColor: COLOURS.primary, borderColor: COLOURS.primary },
  classIcon:       { fontSize: 24, marginBottom: 4 },
  classLabel:      { fontSize: 13, fontWeight: "700", color: COLOURS.primary, textAlign: "center" },
  classSub:        { fontSize: 10, color: COLOURS.muted, textAlign: "center", marginTop: 2 },

  // Hours summary bar
  hoursSummary: {
    flexDirection: "row", backgroundColor: COLOURS.primary,
    margin: 16, borderRadius: 12, padding: 14,
  },
  hoursSummaryItem:    { flex: 1, alignItems: "center" },
  hoursSummaryLabel:   { color: "rgba(255,255,255,0.6)", fontSize: 9, textTransform: "uppercase", marginBottom: 4 },
  hoursSummaryValue:   { color: COLOURS.white, fontSize: 14, fontWeight: "800" },
  hoursSummaryDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.15)", marginHorizontal: 4 },

  // Break buttons
  breakButtons:        { flexDirection: "row", gap: 6, marginBottom: 8, marginTop: 4 },
  breakBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8, minHeight: 44,
    borderWidth: 1.5, borderColor: COLOURS.border,
    backgroundColor: COLOURS.white, alignItems: "center", justifyContent: "center",
  },
  breakBtnActive:     { backgroundColor: COLOURS.primary, borderColor: COLOURS.primary },
  breakBtnText:       { fontSize: 12, fontWeight: "600", color: COLOURS.primary },
  breakBtnTextActive: { color: COLOURS.white },

  // Paid hours result
  paidResult:    { backgroundColor: COLOURS.primary, borderRadius: 10, padding: 14, marginTop: 8 },
  paidResultRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  paidResultItem:{ alignItems: "center", flex: 1 },
  paidResultLabel:{ color: "rgba(255,255,255,0.6)", fontSize: 9, textTransform: "uppercase", marginBottom: 4 },
  paidResultValue:{ color: COLOURS.white, fontSize: 14, fontWeight: "800" },
  paidResultMinus:{ color: "rgba(255,255,255,0.3)", fontSize: 16, marginHorizontal: 2 },

  // Mileage summary
  totalsGrid:      { flexDirection: "row", alignItems: "center", marginVertical: 8 },
  totalItem:       { flex: 1, alignItems: "center" },
  totalValue:      { fontSize: 22, fontWeight: "900", color: COLOURS.primary },
  totalLabel:      { fontSize: 11, color: COLOURS.muted, marginTop: 2, textTransform: "uppercase" },
  totalDivider:    { width: 1, height: 40, backgroundColor: COLOURS.border },
  totalsHint:      { fontSize: 11, color: COLOURS.muted, fontStyle: "italic", textAlign: "center", marginBottom: 12 },
  mileageSummary:      { backgroundColor: COLOURS.background, borderRadius: 8, padding: 10, marginTop: 8, alignItems: "center" },
  mileageSummaryLabel: { fontSize: 10, color: COLOURS.muted, textTransform: "uppercase" },
  mileageSummaryValue: { fontSize: 20, fontWeight: "800", color: COLOURS.primary },

  // Review screen
  defectBanner: {
    margin: 16, backgroundColor: "#fef2f2", borderRadius: 10,
    padding: 16, borderLeftWidth: 3, borderLeftColor: COLOURS.fail,
  },
  defectTitle:  { color: COLOURS.fail, fontWeight: "700", fontSize: 14, marginBottom: 8 },
  defectItem:   { color: "#7f1d1d", fontSize: 12, marginBottom: 4 },
  defectNote:   { color: COLOURS.fail, fontSize: 11, marginTop: 8, fontStyle: "italic" },
  hoursGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  hoursGridItem:{ flex: 1, minWidth: "45%", alignItems: "center", padding: 10, backgroundColor: COLOURS.background, borderRadius: 8 },
  hoursGridLabel:{ fontSize: 10, color: COLOURS.muted, textTransform: "uppercase", marginBottom: 4 },
  hoursGridValue:{ fontSize: 17, fontWeight: "800", color: COLOURS.primary },
  sectionLabel: { fontSize: 10, color: COLOURS.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  summaryRow:   { fontSize: 14, color: COLOURS.primary, marginBottom: 6 },
  skippedNote:  { fontSize: 11, color: COLOURS.muted, fontStyle: "italic", marginBottom: 4 },
  bold:         { fontWeight: "700" },
});
