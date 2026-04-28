import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, Alert, TextInput, ActivityIndicator,
} from "react-native";
import * as Location from "expo-location";
import { api } from "../api";
import { COLOURS, Button, Card } from "../components";
import { useShift } from "../ShiftContext";

function formatTimeInput(t: string): string {
  const clean = t.replace(/[^0-9]/g, "");
  if (clean.length >= 4) return `${clean.slice(0,2)}:${clean.slice(2,4)}`;
  return t;
}
function isValidTime(t: string): boolean {
  return /^\d{2}:\d{2}$/.test(t);
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PREF_LABELS: Record<string, string> = {
  normal:      "Normal day",
  overtime:    "Overtime",
  short_day:   "Short day",
  unavailable: "Unavailable",
};
const PREF_COLOURS: Record<string, string> = {
  normal:      COLOURS.pass,
  overtime:    "#f59e0b",
  short_day:   "#f97316",
  unavailable: COLOURS.muted,
};
const SHORT_DAY_REASONS = [
  "Medical appointment",
  "Family / personal",
  "Fatigue",
  "Other",
];
const OVERTIME_HOURS = [10, 11, 12, 13, 14, 15];

export default function StartShiftScreen({ navigation }: { navigation: any }) {
  const { setShiftId, updateShiftField } = useShift() as any;

  const [loading,       setLoading]       = useState(false);
  const [workingTime,   setWorkingTime]   = useState<any>(null);
  const [weekAvail,     setWeekAvail]     = useState<any>(null);

  // Today's preference
  const [prefType,      setPrefType]      = useState<"normal"|"overtime"|"short_day">("normal");
  const [overtimeHours, setOvertimeHours] = useState<number>(10);
  const [shortReason,   setShortReason]   = useState("");
  const [shortNote,     setShortNote]     = useState("");
  const [finishByTime,  setFinishByTime]  = useState("");
  const [startTime,     setStartTime]     = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [wtRes, avRes] = await Promise.all([
        api.get("/working-time/my"),
        api.get("/availability/my"),
      ]);
      setWorkingTime(wtRes.data);
      setWeekAvail(avRes.data?.data);
    } catch {}
  }

  async function handleStartShift() {
    if (prefType === "short_day" && !shortReason) {
      Alert.alert("Required", "Please select a reason for your short day request.");
      return;
    }

    // Get GPS
    let gpsLat: number | null = null;
    let gpsLng: number | null = null;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        gpsLat = loc.coords.latitude;
        gpsLng = loc.coords.longitude;
      }
    } catch {}

    setLoading(true);
    try {
      // Save shift preference
      const prefRes = await api.post("/shift-preferences", {
        preferenceType: prefType,
        requestedHours: prefType === "overtime" ? overtimeHours : null,
        finishByTime:   prefType === "short_day" ? finishByTime : null,
        shortDayReason: prefType === "short_day" ? shortReason : "",
        shortDayNote:   prefType === "short_day" ? shortNote   : "",
        overtimeHours:  prefType === "overtime"  ? overtimeHours : null,
        startTime,
        gpsLat,
        gpsLng,
      });

      // Show warnings if any
      const warnings = prefRes.data.warnings ?? [];
      if (warnings.length > 0) {
        await new Promise<void>(resolve => {
          Alert.alert("Working Time Notice", warnings.join("\n\n"), [
            { text: "I understand", onPress: resolve },
          ]);
        });
      }

      // Create the shift record
      const formattedTime = formatTimeInput(startTime);
      if (!isValidTime(formattedTime)) {
        Alert.alert("Invalid time", "Please enter time as HH:MM e.g. 06:00");
        setLoading(false);
        return;
      }

      const res = await api.post("/shifts", {
        shiftDate: new Date().toISOString(),
        startTime: formattedTime,
      });
      setShiftId(res.data.id);
      updateShiftField("startTime", formattedTime);

      navigation.replace("Home");
    } catch (err: any) {
      Alert.alert("Cannot Start Shift", err.response?.data?.error ?? "Something went wrong");
    }
    setLoading(false);
  }

  const today = new Date();
  const todayDay = today.getDay();
  const weekDayIndex = todayDay === 0 ? 6 : todayDay - 1;
  const todayName = DAYS[weekDayIndex];

  const getTodayPref = () => {
    if (!weekAvail) return null;
    const key = todayName.toLowerCase() + "Pref";
    return weekAvail[key];
  };

  const todayWeekPref = getTodayPref();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Start Shift</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>

        {/* Date & Time */}
        <Card style={{ marginBottom: 12 }}>
          <Text style={styles.sectionLabel}>Shift Start</Text>
          <Text style={styles.dateText}>
            {today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </Text>
          <Text style={styles.timeLabel}>Start time</Text>
          <TextInput
            style={styles.timeInput}
            value={startTime}
            onChangeText={setStartTime}
            placeholder="HH:MM"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
          <Text style={styles.hint}>📍 GPS location will be recorded when you start</Text>
        </Card>

        {/* Working time summary */}
        {workingTime && (
          <Card style={{ marginBottom: 12 }}>
            <Text style={styles.sectionLabel}>This Week's Hours</Text>
            <View style={styles.hoursRow}>
              <View style={styles.hoursStat}>
                <Text style={styles.hoursValue}>{workingTime.weeklyHours.toFixed(1)}</Text>
                <Text style={styles.hoursLabel}>Worked</Text>
              </View>
              <View style={styles.hoursDivider} />
              <View style={styles.hoursStat}>
                <Text style={[styles.hoursValue, workingTime.isNearLimit && { color: "#f59e0b" }]}>
                  {workingTime.remainingHours.toFixed(1)}
                </Text>
                <Text style={styles.hoursLabel}>Remaining</Text>
              </View>
              <View style={styles.hoursDivider} />
              <View style={styles.hoursStat}>
                <Text style={styles.hoursValue}>48.0</Text>
                <Text style={styles.hoursLabel}>Weekly Max</Text>
              </View>
            </View>
            {workingTime.warnings?.map((w: string, i: number) => (
              <View key={i} style={styles.warningBanner}>
                <Text style={styles.warningText}>{w}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* Weekly availability summary */}
        {weekAvail && (
          <Card style={{ marginBottom: 12 }}>
            <Text style={styles.sectionLabel}>Your Week's Availability</Text>
            <View style={styles.weekRow}>
              {DAYS.map((day, i) => {
                const key = day.toLowerCase() + "Pref";
                const pref = weekAvail[key] ?? "normal";
                const isToday = i === weekDayIndex;
                return (
                  <View key={day} style={[styles.dayCell, isToday && styles.dayCellToday]}>
                    <Text style={[styles.dayName, isToday && styles.dayNameToday]}>{day}</Text>
                    <View style={[styles.dayDot, { backgroundColor: PREF_COLOURS[pref] ?? COLOURS.muted }]} />
                    <Text style={styles.dayPref}>{pref === "normal" ? "✓" : pref === "unavailable" ? "✗" : pref === "overtime" ? "OT" : "SD"}</Text>
                  </View>
                );
              })}
            </View>
            {todayWeekPref && todayWeekPref !== "normal" && (
              <View style={[styles.todayPrefBanner, { borderLeftColor: PREF_COLOURS[todayWeekPref] }]}>
                <Text style={styles.todayPrefText}>
                  Your availability for today: <Text style={{ fontWeight: "700" }}>{PREF_LABELS[todayWeekPref]}</Text>
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* Today's preference */}
        <Card style={{ marginBottom: 12 }}>
          <Text style={styles.sectionLabel}>Today's Working Preference</Text>
          <Text style={styles.guidanceText}>
            This helps your planner build the day. Your final schedule may still change.
          </Text>

          <View style={styles.prefRow}>
            {(["normal", "overtime", "short_day"] as const).map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.prefBtn, prefType === p && { backgroundColor: PREF_COLOURS[p], borderColor: PREF_COLOURS[p] }]}
                onPress={() => setPrefType(p)}
              >
                <Text style={[styles.prefBtnText, prefType === p && { color: COLOURS.white }]}>
                  {p === "normal" ? "Normal" : p === "overtime" ? "Overtime" : "Short Day"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Overtime options */}
          {prefType === "overtime" && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.subLabel}>Preferred hours today</Text>
              <View style={styles.hoursGrid}>
                {OVERTIME_HOURS.map(h => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.hoursBtn, overtimeHours === h && styles.hoursBtnActive]}
                    onPress={() => setOvertimeHours(h)}
                  >
                    <Text style={[styles.hoursBtnText, overtimeHours === h && styles.hoursBtnTextActive]}>{h}h</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.guidanceText}>
                Overtime is subject to planner approval and working time regulations.
              </Text>
            </View>
          )}

          {/* Short day options */}
          {prefType === "short_day" && (
            <View style={{ marginTop: 12 }}>
              <View style={styles.shortDayWarning}>
                <Text style={styles.shortDayWarningText}>
                  ⚠️ Short day requests may need planner or manager confirmation.
                </Text>
              </View>
              <Text style={styles.subLabel}>Reason</Text>
              {SHORT_DAY_REASONS.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.reasonBtn, shortReason === r && styles.reasonBtnActive]}
                  onPress={() => setShortReason(r)}
                >
                  <Text style={[styles.reasonBtnText, shortReason === r && styles.reasonBtnTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
              <Text style={styles.subLabel}>Finish by (optional)</Text>
              <TextInput
                style={styles.timeInput}
                value={finishByTime}
                onChangeText={setFinishByTime}
                placeholder="e.g. 13:00"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
              <Text style={styles.subLabel}>Additional note (optional)</Text>
              <TextInput
                style={[styles.timeInput, { minHeight: 60 }]}
                value={shortNote}
                onChangeText={setShortNote}
                placeholder="Any additional information for your planner..."
                multiline
              />
            </View>
          )}
        </Card>

        <Text style={styles.legalNote}>
          🇬🇧 UK Working Time Regulations apply. Maximum 48 hours per week average. Minimum 11 hours rest between shifts. Breaks during shift are your responsibility.
        </Text>

      </ScrollView>

      <View style={styles.bottomNav}>
        <Button
          label={loading ? "Starting shift..." : "🚛 Start Shift"}
          onPress={handleStartShift}
          loading={loading}
          style={{ backgroundColor: COLOURS.primary }}
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
  topTitle:       { fontSize: 17, fontWeight: "700", color: COLOURS.primary },
  sectionLabel:   { fontSize: 10, color: COLOURS.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  dateText:       { fontSize: 18, fontWeight: "700", color: COLOURS.primary, marginBottom: 12 },
  timeLabel:      { fontSize: 12, color: COLOURS.muted, marginBottom: 4 },
  timeInput: {
    borderWidth: 1.5, borderColor: COLOURS.border, borderRadius: 8,
    padding: 12, fontSize: 20, fontWeight: "700", color: COLOURS.primary,
    textAlign: "center", marginBottom: 8,
  },
  hint:           { fontSize: 11, color: COLOURS.muted, fontStyle: "italic" },
  hoursRow:       { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  hoursStat:      { flex: 1, alignItems: "center" },
  hoursValue:     { fontSize: 24, fontWeight: "900", color: COLOURS.primary },
  hoursLabel:     { fontSize: 10, color: COLOURS.muted, textTransform: "uppercase" },
  hoursDivider:   { width: 1, height: 40, backgroundColor: COLOURS.border },
  warningBanner:  { backgroundColor: "#fef3c7", borderRadius: 8, padding: 10, marginTop: 8 },
  warningText:    { fontSize: 12, color: "#92400e", fontWeight: "600" },
  weekRow:        { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  dayCell:        { alignItems: "center", flex: 1, padding: 4, borderRadius: 8 },
  dayCellToday:   { backgroundColor: COLOURS.primary + "15" },
  dayName:        { fontSize: 10, color: COLOURS.muted, fontWeight: "600", marginBottom: 4 },
  dayNameToday:   { color: COLOURS.primary },
  dayDot:         { width: 8, height: 8, borderRadius: 4, marginBottom: 2 },
  dayPref:        { fontSize: 9, color: COLOURS.muted },
  todayPrefBanner:{ borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 6, marginTop: 8 },
  todayPrefText:  { fontSize: 13, color: COLOURS.primary },
  guidanceText:   { fontSize: 12, color: COLOURS.muted, fontStyle: "italic", marginBottom: 8 },
  prefRow:        { flexDirection: "row", gap: 8, marginBottom: 8 },
  prefBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1.5, borderColor: COLOURS.border,
    alignItems: "center", backgroundColor: COLOURS.white,
  },
  prefBtnText:    { fontSize: 12, fontWeight: "600", color: COLOURS.muted },
  subLabel:       { fontSize: 12, fontWeight: "600", color: COLOURS.primary, marginBottom: 6, marginTop: 8 },
  hoursGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  hoursBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1.5, borderColor: COLOURS.border, backgroundColor: COLOURS.white,
  },
  hoursBtnActive:     { backgroundColor: "#f59e0b", borderColor: "#f59e0b" },
  hoursBtnText:       { fontSize: 14, fontWeight: "600", color: COLOURS.muted },
  hoursBtnTextActive: { color: COLOURS.white },
  shortDayWarning:    { backgroundColor: "#fef3c7", borderRadius: 8, padding: 10, marginBottom: 8 },
  shortDayWarningText:{ fontSize: 12, color: "#92400e" },
  reasonBtn: {
    padding: 12, borderRadius: 8, borderWidth: 1.5,
    borderColor: COLOURS.border, marginBottom: 6, backgroundColor: COLOURS.white,
  },
  reasonBtnActive:    { backgroundColor: "#f97316", borderColor: "#f97316" },
  reasonBtnText:      { fontSize: 13, color: COLOURS.muted, fontWeight: "600" },
  reasonBtnTextActive:{ color: COLOURS.white },
  legalNote:      { fontSize: 11, color: COLOURS.muted, textAlign: "center", lineHeight: 16, marginTop: 8 },
  bottomNav:      { padding: 16, backgroundColor: COLOURS.white, borderTopWidth: 1, borderTopColor: COLOURS.border },
});
