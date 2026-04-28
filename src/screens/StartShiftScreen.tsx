import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, Alert, TextInput, Modal, ActivityIndicator,
} from "react-native";
import * as Location from "expo-location";
import { api } from "../api";
import { COLOURS, Button, Card } from "../components";
import { useShift } from "../ShiftContext";

const DAYS = [
  { key: "mon", label: "Mon", full: "Monday" },
  { key: "tue", label: "Tue", full: "Tuesday" },
  { key: "wed", label: "Wed", full: "Wednesday" },
  { key: "thu", label: "Thu", full: "Thursday" },
  { key: "fri", label: "Fri", full: "Friday" },
  { key: "sat", label: "Sat", full: "Saturday" },
  { key: "sun", label: "Sun", full: "Sunday" },
];

const HOUR_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const SHORT_REASONS = ["Medical appointment", "Family / personal", "Fatigue", "Other"];

function getWeekStart(offset = 0): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getTodayKey(): string {
  const day = new Date().getDay();
  return ["sun","mon","tue","wed","thu","fri","sat"][day];
}

function formatTime(t: string): string {
  const clean = t.replace(/[^0-9]/g, "");
  if (clean.length >= 4) return `${clean.slice(0,2)}:${clean.slice(2,4)}`;
  return t;
}

function isValidTime(t: string): boolean {
  return /^\d{2}:\d{2}$/.test(t);
}

interface DayPlan {
  pref: "normal" | "overtime" | "short_day" | "unavailable";
  hours: number;
  shortReason?: string;
  shortNote?: string;
}

const DEFAULT_PLAN: DayPlan = { pref: "normal", hours: 8 };

export default function StartShiftScreen({ navigation }: { navigation: any }) {
  const { setShiftId, updateShiftField } = useShift() as any;

  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [workingTime, setWorkingTime] = useState<any>(null);
  const [startTime,   setStartTime]   = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  });

  // Week plan - all 7 days
  const [weekPlan, setWeekPlan] = useState<Record<string, DayPlan>>({
    mon: { pref: "normal", hours: 8 },
    tue: { pref: "normal", hours: 8 },
    wed: { pref: "normal", hours: 8 },
    thu: { pref: "normal", hours: 8 },
    fri: { pref: "normal", hours: 8 },
    sat: { pref: "unavailable", hours: 0 },
    sun: { pref: "unavailable", hours: 0 },
  });

  // Day editor modal
  const [editingDay,  setEditingDay]  = useState<string | null>(null);
  const [editPlan,    setEditPlan]    = useState<DayPlan>(DEFAULT_PLAN);

  const todayKey  = getTodayKey();
  const weekStart = getWeekStart(0);
  const isFriday  = new Date().getDay() === 5;

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [wtRes, avRes] = await Promise.all([
        api.get("/working-time/my"),
        api.get(`/availability/my?weekStart=${weekStart.toISOString()}`),
      ]);
      setWorkingTime(wtRes.data);

      // Load existing week plan if available
      const avail = avRes.data?.data;
      if (avail) {
        const loaded: Record<string, DayPlan> = {};
        DAYS.forEach(d => {
          const pref  = avail[`${d.key}Pref`]  ?? "normal";
          const note  = avail[`${d.key}Note`]  ?? "";
          const hours = pref === "unavailable" ? 0 : pref === "overtime" ? 10 : 8;
          loaded[d.key] = { pref, hours, shortNote: note };
        });
        setWeekPlan(loaded);
      }
    } catch {}
    setLoading(false);
  }

  function openDayEditor(dayKey: string) {
    const today = new Date();
    const todayIdx  = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const dayIdx    = DAYS.findIndex(d => d.key === dayKey);
    const daysAhead = dayIdx - todayIdx;

    // Strict rule — same day or tomorrow needs warning
    if (daysAhead <= 1 && daysAhead >= 0 && weekPlan[dayKey].pref !== "normal") {
      // Already set, just editing
    }

    setEditPlan({ ...weekPlan[dayKey] });
    setEditingDay(dayKey);
  }

  function saveDay() {
    if (!editingDay) return;

    const today     = new Date();
    const todayIdx  = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const dayIdx    = DAYS.findIndex(d => d.key === editingDay);
    const daysAhead = dayIdx - todayIdx;

    const update = () => {
      setWeekPlan(p => ({ ...p, [editingDay]: editPlan }));
      setEditingDay(null);
    };

    if (daysAhead <= 1 && daysAhead >= 0) {
      Alert.alert(
        "Short Notice Change",
        "This is a same-day or next-day change. Your planner will be notified and may need to contact you.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Confirm Change", onPress: update },
        ]
      );
    } else {
      update();
    }
  }

  async function handleStartShift() {
    const formattedTime = formatTime(startTime);
    if (!isValidTime(formattedTime)) {
      Alert.alert("Invalid time", "Please enter time as HH:MM e.g. 06:00");
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

    setSaving(true);
    try {
      // Save week availability
      const availPayload: any = { weekStart: weekStart.toISOString() };
      DAYS.forEach(d => {
        availPayload[`${d.key}Pref`] = weekPlan[d.key].pref;
        availPayload[`${d.key}Note`] = weekPlan[d.key].shortNote ?? "";
      });
      await api.post("/availability/my", availPayload);

      // Save today's preference
      const todayPlan = weekPlan[todayKey];
      await api.post("/shift-preferences", {
        preferenceType: todayPlan.pref,
        requestedHours: todayPlan.hours,
        shortDayReason: todayPlan.shortReason ?? "",
        shortDayNote:   todayPlan.shortNote   ?? "",
        overtimeHours:  todayPlan.pref === "overtime" ? todayPlan.hours : null,
        startTime:      formattedTime,
        gpsLat,
        gpsLng,
      });

      // Create shift
      const res = await api.post("/shifts", {
        shiftDate: new Date().toISOString(),
        startTime: formattedTime,
      });
      setShiftId(res.data.id);
      updateShiftField("startTime", formattedTime);

      navigation.replace("Jobs");
    } catch (err: any) {
      Alert.alert("Cannot Start Shift", err.response?.data?.error ?? "Something went wrong");
    }
    setSaving(false);
  }

  const todayPlan = weekPlan[todayKey];

  if (loading) return (
    <SafeAreaView style={styles.center}>
      <ActivityIndicator size="large" color={COLOURS.primary} />
    </SafeAreaView>
  );

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

        {/* Date & start time */}
        <Card style={{ marginBottom: 12 }}>
          <Text style={styles.dateText}>
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </Text>
          <Text style={styles.fieldLabel}>Start time</Text>
          <TextInput
            style={styles.timeInput}
            value={startTime}
            onChangeText={setStartTime}
            placeholder="HH:MM"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
          <Text style={styles.hint}>📍 GPS location recorded at shift start</Text>
        </Card>

        {/* Working time */}
        {workingTime && (workingTime.isNearLimit || workingTime.isAtLimit) && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>{workingTime.warnings[0]}</Text>
          </View>
        )}

        {/* Week plan */}
        <Card style={{ marginBottom: 12 }}>
          <Text style={styles.sectionLabel}>This Week's Plan</Text>
          <Text style={styles.hint}>Tap any day to change · Today is highlighted</Text>
          <View style={{ marginTop: 10 }}>
            {DAYS.map(day => {
              const plan    = weekPlan[day.key];
              const isToday = day.key === todayKey;
              const prefColour =
                plan.pref === "normal"      ? COLOURS.pass  :
                plan.pref === "overtime"    ? "#f59e0b"     :
                plan.pref === "short_day"   ? "#f97316"     : COLOURS.muted;

              return (
                <TouchableOpacity
                  key={day.key}
                  style={[styles.dayRow, isToday && styles.dayRowToday]}
                  onPress={() => openDayEditor(day.key)}
                >
                  <Text style={[styles.dayName, isToday && { color: COLOURS.primary, fontWeight: "800" }]}>
                    {day.label} {isToday ? "← Today" : ""}
                  </Text>
                  <View style={styles.dayRight}>
                    {plan.pref !== "unavailable" && (
                      <Text style={styles.dayHours}>{plan.hours}h</Text>
                    )}
                    <View style={[styles.prefPill, { backgroundColor: prefColour + "20" }]}>
                      <Text style={[styles.prefPillText, { color: prefColour }]}>
                        {plan.pref === "normal"      ? "Normal"     :
                         plan.pref === "overtime"    ? "Overtime"   :
                         plan.pref === "short_day"   ? "Short day"  : "Unavailable"}
                      </Text>
                    </View>
                    <Text style={styles.editArrow}>›</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {isFriday && (
            <TouchableOpacity
              style={styles.repeatBtn}
              onPress={() => Alert.alert(
                "Repeat pattern?",
                "This will copy your current week plan to next week.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Yes, repeat", onPress: async () => {
                    const nextWeekStart = getWeekStart(1);
                    const payload: any = { weekStart: nextWeekStart.toISOString() };
                    DAYS.forEach(d => {
                      payload[`${d.key}Pref`] = weekPlan[d.key].pref;
                      payload[`${d.key}Note`] = weekPlan[d.key].shortNote ?? "";
                    });
                    try {
                      await api.post("/availability/my", payload);
                      Alert.alert("✅ Done", "Next week's availability set to the same pattern.");
                    } catch { Alert.alert("Error", "Could not save next week"); }
                  }},
                ]
              )}
            >
              <Text style={styles.repeatBtnText}>↻ It's Friday — repeat this pattern for next week</Text>
            </TouchableOpacity>
          )}
        </Card>

        <Text style={styles.legalNote}>
          🇬🇧 Max 48h/week · Min 11h rest between shifts · Breaks are your responsibility
        </Text>
      </ScrollView>

      <View style={styles.bottomNav}>
        <Button
          label={saving ? "Starting..." : "🚛 Start Shift"}
          onPress={handleStartShift}
          loading={saving}
          style={{ backgroundColor: COLOURS.primary }}
        />
      </View>

      {/* Day editor modal */}
      <Modal visible={!!editingDay} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {DAYS.find(d => d.key === editingDay)?.full}
            </Text>

            <Text style={styles.fieldLabel}>Availability</Text>
            <View style={styles.prefRow}>
              {[
                { key: "normal",      label: "Normal",      colour: COLOURS.pass },
                { key: "overtime",    label: "Overtime",    colour: "#f59e0b" },
                { key: "short_day",   label: "Short Day",   colour: "#f97316" },
                { key: "unavailable", label: "Unavailable", colour: COLOURS.muted },
              ].map(p => (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.prefBtn, editPlan.pref === p.key && { backgroundColor: p.colour, borderColor: p.colour }]}
                  onPress={() => setEditPlan(ep => ({
                    ...ep,
                    pref:  p.key as any,
                    hours: p.key === "unavailable" ? 0 : p.key === "overtime" ? 10 : p.key === "short_day" ? 4 : 8,
                  }))}
                >
                  <Text style={[styles.prefBtnText, editPlan.pref === p.key && { color: COLOURS.white }]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {editPlan.pref === "overtime" && (
              <>
                <Text style={styles.fieldLabel}>Overtime hours (above normal)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.hoursRow}>
                    {[9,10,11,12,13,14,15].map(h => (
                      <TouchableOpacity
                        key={h}
                        style={[styles.hoursBtn, editPlan.hours === h && styles.hoursBtnActive]}
                        onPress={() => setEditPlan(ep => ({ ...ep, hours: h }))}
                      >
                        <Text style={[styles.hoursBtnText, editPlan.hours === h && { color: COLOURS.white }]}>
                          {h}h
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}
            {editPlan.pref === "short_day" && (
              <>
                <Text style={styles.fieldLabel}>Finish after (hours)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.hoursRow}>
                    {[2,3,4,5,6,7].map(h => (
                      <TouchableOpacity
                        key={h}
                        style={[styles.hoursBtn, editPlan.hours === h && styles.hoursBtnActive]}
                        onPress={() => setEditPlan(ep => ({ ...ep, hours: h }))}
                      >
                        <Text style={[styles.hoursBtnText, editPlan.hours === h && { color: COLOURS.white }]}>
                          {h}h
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}
            {editPlan.pref === "normal" && (
              <View style={styles.normalNote}>
                <Text style={styles.normalNoteText}>✓ Normal day — standard hours as set by your planner</Text>
              </View>
            )}

            {editPlan.pref === "short_day" && (
              <>
                <Text style={styles.fieldLabel}>Reason</Text>
                {SHORT_REASONS.map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.reasonBtn, editPlan.shortReason === r && styles.reasonBtnActive]}
                    onPress={() => setEditPlan(ep => ({ ...ep, shortReason: r }))}
                  >
                    <Text style={[styles.reasonBtnText, editPlan.shortReason === r && { color: COLOURS.white }]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingDay(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveDay}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLOURS.background },
  center:         { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLOURS.white,
    borderBottomWidth: 1, borderBottomColor: COLOURS.border,
  },
  backText:       { color: COLOURS.accent, fontSize: 15, fontWeight: "600" },
  topTitle:       { fontSize: 17, fontWeight: "700", color: COLOURS.primary },
  dateText:       { fontSize: 18, fontWeight: "700", color: COLOURS.primary, marginBottom: 12 },
  fieldLabel:     { fontSize: 12, fontWeight: "600", color: COLOURS.primary, marginBottom: 4, marginTop: 8 },
  timeInput: {
    borderWidth: 1.5, borderColor: COLOURS.border, borderRadius: 8,
    padding: 12, fontSize: 24, fontWeight: "700", color: COLOURS.primary,
    textAlign: "center", marginBottom: 6,
  },
  hint:           { fontSize: 11, color: COLOURS.muted, fontStyle: "italic" },
  sectionLabel:   { fontSize: 10, color: COLOURS.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  warningBanner:  { backgroundColor: "#fef3c7", borderRadius: 8, padding: 12, marginBottom: 12 },
  warningText:    { fontSize: 12, color: "#92400e", fontWeight: "600" },
  dayRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLOURS.border,
  },
  dayRowToday:    { backgroundColor: "#f0f4ff", marginHorizontal: -16, paddingHorizontal: 16, borderRadius: 8 },
  dayName:        { fontSize: 14, color: COLOURS.primary, fontWeight: "600", flex: 1 },
  dayRight:       { flexDirection: "row", alignItems: "center", gap: 8 },
  dayHours:       { fontSize: 13, fontWeight: "700", color: COLOURS.primary },
  prefPill:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  prefPillText:   { fontSize: 11, fontWeight: "700" },
  editArrow:      { fontSize: 18, color: COLOURS.muted },
  repeatBtn: {
    marginTop: 12, padding: 12, borderRadius: 8,
    backgroundColor: "#eff6ff", alignItems: "center",
  },
  repeatBtnText:  { fontSize: 13, fontWeight: "600", color: "#1e40af" },
  legalNote:      { fontSize: 11, color: COLOURS.muted, textAlign: "center", lineHeight: 16, marginTop: 8 },
  bottomNav:      { padding: 16, backgroundColor: COLOURS.white, borderTopWidth: 1, borderTopColor: COLOURS.border },
  // Modal
  modalOverlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: COLOURS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40,
  },
  modalTitle:     { fontSize: 18, fontWeight: "700", color: COLOURS.primary, marginBottom: 12 },
  prefRow:        { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  prefBtn: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1.5, borderColor: COLOURS.border,
  },
  prefBtnText:    { fontSize: 13, fontWeight: "600", color: COLOURS.muted },
  hoursRow:       { flexDirection: "row", gap: 8, paddingVertical: 4 },
  hoursBtn: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1.5, borderColor: COLOURS.border,
  },
  hoursBtnActive: { backgroundColor: COLOURS.primary, borderColor: COLOURS.primary },
  hoursBtnText:   { fontSize: 14, fontWeight: "700", color: COLOURS.muted },
  reasonBtn: {
    padding: 10, borderRadius: 8, borderWidth: 1.5,
    borderColor: COLOURS.border, marginBottom: 6,
  },
  reasonBtnActive:    { backgroundColor: "#f97316", borderColor: "#f97316" },
  reasonBtnText:      { fontSize: 13, color: COLOURS.muted, fontWeight: "600" },
  modalBtns:      { flexDirection: "row", gap: 12, marginTop: 16 },
  cancelBtn: {
    flex: 1, padding: 14, borderRadius: 10, borderWidth: 1.5,
    borderColor: COLOURS.border, alignItems: "center",
  },
  cancelBtnText:  { fontSize: 14, fontWeight: "600", color: COLOURS.muted },
  saveBtn:        { flex: 1, padding: 14, borderRadius: 10, backgroundColor: COLOURS.primary, alignItems: "center" },
  saveBtnText:    { fontSize: 14, fontWeight: "700", color: COLOURS.white },
  normalNote:     { backgroundColor: "#dcfce7", borderRadius: 8, padding: 12, marginTop: 8 },
  normalNoteText: { fontSize: 13, color: "#14532d", fontWeight: "600" },
});
