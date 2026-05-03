import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, SafeAreaView,
  TouchableOpacity, ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api";
import { COLOURS, Card } from "../components";
import { useShift } from "../ShiftContext";

interface Shift {
  id:          number;
  driverName:  string;
  status:      string;
  nightOut:    boolean;
  shiftDate:   string;
  createdAt:   string;
  startTime?:  string;
  endTime?:    string;
  totalHours?: string;
  breakMins?:  string;
  poaMins?:    string;
  segments:    any[];
}

function minsFromStr(str?: string): number {
  if (!str) return 0;
  const match = str.match(/(\d+)h\s*(\d+)m/);
  if (!match) return 0;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
  });
}

function statusColour(s: string) {
  if (s === "completed" || s === "submitted") return COLOURS.pass;
  if (s === "failed")    return COLOURS.fail;
  if (s === "draft")     return COLOURS.warning;
  return "#f59e0b";
}

function statusLabel(s: string) {
  if (s === "submitted") return "SUBMITTED";
  if (s === "completed") return "COMPLETED";
  if (s === "failed")    return "FAILED";
  if (s === "draft")     return "DRAFT";
  return s.toUpperCase();
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

// Local hidden shifts stored in AsyncStorage
async function getHiddenShifts(): Promise<number[]> {
  try {
    const v = await AsyncStorage.getItem("hiddenShifts");
    return v ? JSON.parse(v) : [];
  } catch { return []; }
}

async function hideShift(id: number) {
  try {
    const current = await getHiddenShifts();
    if (!current.includes(id)) {
      await AsyncStorage.setItem("hiddenShifts", JSON.stringify([...current, id]));
    }
  } catch {}
}

export default function HistoryScreen({ navigation }: { navigation: any }) {
  const { draft, setShiftId, updateShiftField } = useShift();
  const [shifts,     setShifts]     = useState<Shift[]>([]);
  const [hidden,     setHidden]     = useState<number[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(refresh = false) {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const [res, hiddenIds] = await Promise.all([
        api.get("/shifts?limit=100"),
        getHiddenShifts(),
      ]);
      const allShifts = res.data.data.filter((s: Shift) => s.status !== "deleted");
      // Auto-hide completed shifts older than 33 days from the local list
      const toAutoHide = allShifts
        .filter((s: Shift) => s.status === "completed" && daysSince(s.createdAt) >= 33)
        .map((s: Shift) => s.id);
      if (toAutoHide.length > 0) {
        const newHidden = [...new Set([...hiddenIds, ...toAutoHide])];
        await AsyncStorage.setItem("hiddenShifts", JSON.stringify(newHidden));
        setHidden(newHidden);
      } else {
        setHidden(hiddenIds);
      }
      setShifts(allShifts);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function handleDelete(shift: Shift) {
    Alert.alert(
      "Delete This Shift?",
      "This will permanently remove the shift from your history.\n\nYour manager retains full access to the report in the system.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/shifts/${shift.id}`);
              setShifts(prev => prev.filter(s => s.id !== shift.id));
            } catch (err: any) {
              const msg = err?.response?.data?.error ?? err?.message ?? "Unknown error";
              const status = err?.response?.status ?? "no response";
              Alert.alert("Delete failed", `${status}: ${msg}`);
            }
          },
        },
      ]
    );
  }

  async function handleEdit(shift: Shift) {
    if (draft.shiftId === shift.id) {
      // Local draft matches — use actual data state to decide where to land
      const target = draft.finishTime ? "Review" : "EndShift";
      navigation.navigate(target);
      return;
    }

    // Local draft was lost — fetch from API to decide where to land
    try {
      const res = await api.get(`/shifts/${shift.id}`);
      const s = res.data;
      setShiftId(shift.id);
      updateShiftField("startTime",  s.startTime  ?? "");
      updateShiftField("finishTime", s.endTime    ?? "");
      updateShiftField("breakMins",  parseInt(s.breakMins ?? "0", 10));
      updateShiftField("totalHours", s.totalHours ?? "");
      updateShiftField("shiftDate",  s.shiftDate ? new Date(s.shiftDate) : new Date());
      updateShiftField("nightOut",   s.nightOut   ?? false);
      updateShiftField("expenses",   s.expenses   ?? "");
      updateShiftField("delaysNote", s.delaysNote ?? "");
      updateShiftField("defectsNote",s.defectsNote ?? "");
      // If the shift already has an end time recorded, go straight to Review
      const target = s.endTime ? "Review" : "EndShift";
      navigation.navigate(target);
    } catch {
      Alert.alert(
        "Could Not Load Shift",
        "Unable to fetch shift details. Check your connection and try again.",
        [{ text: "OK" }]
      );
    }
  }

  async function handleRetry(shift: Shift) {
    Alert.alert(
      "Retry Submission?",
      "This will re-send the shift report to the office.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Retry",
          onPress: async () => {
            try {
              await api.post(`/shifts/${shift.id}/retry`);
              Alert.alert("Sent", "Your shift report is being resubmitted. It may take a moment to process.");
              load(true);
            } catch (err: any) {
              const msg = err?.response?.data?.error ?? err?.message ?? "Unknown error";
              Alert.alert("Retry failed", msg);
            }
          },
        },
      ]
    );
  }

  // Filter out locally hidden shifts for display
  const visibleShifts = shifts.filter(s => !hidden.includes(s.id));

  // Weekly hours (from all shifts, not just visible)
  const weekStart   = getWeekStart(new Date());
  const thisWeek    = shifts.filter(s => new Date(s.shiftDate) >= weekStart);
  const weeklyMins  = thisWeek.reduce((sum, s) => sum + minsFromStr(s.totalHours), 0);
  const weeklyHours = Math.floor(weeklyMins / 60);
  const weeklyRem   = weeklyMins % 60;
  const weeklyStr   = weeklyMins > 0
    ? `${weeklyHours}h ${weeklyRem.toString().padStart(2,"0")}m`
    : "No shifts this week";
  const weekColour  = weeklyMins >= 60*60 ? COLOURS.fail : weeklyMins >= 48*60 ? COLOURS.warning : COLOURS.pass;
  const weekWarning = weeklyMins >= 60*60
    ? "⚠ Exceeded 60h weekly limit (UK/EU)"
    : weeklyMins >= 48*60
    ? "⚠ Approaching 60h weekly limit"
    : null;

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={COLOURS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>My Shifts</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Weekly hours */}
      <View style={[styles.weeklyCard, { borderColor: weekColour }]}>
        <View style={styles.weeklyLeft}>
          <Text style={styles.weeklyLabel}>This Week — Paid Hours</Text>
          <Text style={[styles.weeklyValue, { color: weekColour }]}>{weeklyStr}</Text>
          {weekWarning && <Text style={styles.weeklyWarning}>{weekWarning}</Text>}
        </View>
        <View style={styles.weeklyRight}>
          <Text style={styles.weeklyLimitLabel}>Legal limit</Text>
          <Text style={styles.weeklyLimitValue}>60h / week</Text>
          <Text style={styles.weeklyLimitSub}>48h avg target</Text>
        </View>
      </View>

      <Text style={styles.infoNote}>
        ℹ️  Completed shifts kept 33 days · Incomplete shifts can be deleted anytime · Manager always has full access
      </Text>

      {visibleShifts.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>No shifts to show</Text>
          <Text style={styles.emptySub}>Submit your first shift from the home screen</Text>
        </View>
      ) : (
        <FlatList
          data={visibleShifts}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          renderItem={({ item }) => {
            const totalMileage = (item.segments ?? []).reduce((sum: number, s: any) => {
              if (s.odometerEnd && s.odometerStart && s.odometerEnd > s.odometerStart) {
                return sum + (s.odometerEnd - s.odometerStart);
              }
              return sum;
            }, 0);
            const age        = daysSince(item.createdAt);
            const isComplete = item.status === "completed" || item.status === "submitted";
            const daysLeft   = isComplete ? Math.max(0, 33 - age) : null;

            return (
              <Card style={styles.shiftCard}>
                <TouchableOpacity
                  onPress={() => navigation.navigate("ShiftDetail", { shiftId: item.id })}
                  activeOpacity={0.7}
                >
                  <View style={styles.shiftHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.shiftDate}>{fmtDate(item.shiftDate ?? item.createdAt)}</Text>
                      <Text style={styles.shiftTruck}>
                        🚛 {item.segments?.[0]?.truckReg ?? "—"}
                        {item.segments?.[0]?.trailerReg ? `  +  📦 ${item.segments[0].trailerReg}` : ""}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColour(item.status) }]}>
                      <Text style={styles.statusText}>{statusLabel(item.status)}</Text>
                    </View>
                  </View>

                  <View style={styles.statsRow}>
                    {item.totalHours ? (() => {
                      const poaMins  = parseInt(item.poaMins  ?? "0", 10) || 0;
                      const workMins = minsFromStr(item.totalHours);
                      const paidMins = workMins + poaMins;
                      const paidStr  = `${Math.floor(paidMins / 60)}h ${(paidMins % 60).toString().padStart(2, "0")}m`;
                      return (
                        <>
                          <View style={styles.statItem}>
                            <Text style={styles.statLabel}>Working Hrs</Text>
                            <Text style={[styles.statValue, { color: COLOURS.accent }]}>{item.totalHours}</Text>
                          </View>
                          {poaMins > 0 && (
                            <View style={styles.statItem}>
                              <Text style={styles.statLabel}>Paid Hrs</Text>
                              <Text style={styles.statValue}>{paidStr}</Text>
                            </View>
                          )}
                        </>
                      );
                    })() : null}
                    {item.startTime && item.endTime ? (
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Times</Text>
                        <Text style={styles.statValue}>{item.startTime} – {item.endTime}</Text>
                      </View>
                    ) : null}
                    {totalMileage > 0 ? (
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Mileage</Text>
                        <Text style={styles.statValue}>{totalMileage.toLocaleString()} km</Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.tapHint}>Tap to view full details →</Text>
                </TouchableOpacity>

                <View style={styles.actionRow}>
                  {daysLeft !== null && daysLeft <= 7 && (
                    <Text style={styles.autoHideNote}>Auto-removed in {daysLeft} day{daysLeft !== 1 ? "s" : ""}</Text>
                  )}
                  {!isComplete && (
                    <Text style={styles.incompleteNote}>
                      {item.status === "failed" ? "Submission failed" : "Incomplete"}
                    </Text>
                  )}
                  <View style={{ flex: 1 }} />
                  {item.status === "draft" && (
                    <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(item)}>
                      <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>
                  )}
                  {item.status === "failed" && (
                    <TouchableOpacity style={styles.retryBtn} onPress={() => handleRetry(item)}>
                      <Text style={styles.retryBtnText}>Retry</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLOURS.background },
  center:          { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLOURS.white,
    borderBottomWidth: 1, borderBottomColor: COLOURS.border,
  },
  backText:        { color: COLOURS.accent, fontSize: 15, fontWeight: "600" },
  topTitle:        { fontSize: 17, fontWeight: "700", color: COLOURS.primary },
  weeklyCard: {
    flexDirection: "row", margin: 16, marginBottom: 4,
    backgroundColor: COLOURS.white, borderRadius: 12, padding: 16,
    borderWidth: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  weeklyLeft:       { flex: 1 },
  weeklyLabel:      { fontSize: 11, color: COLOURS.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  weeklyValue:      { fontSize: 24, fontWeight: "800", marginBottom: 4 },
  weeklyWarning:    { fontSize: 11, color: "#92400e" },
  weeklyRight:      { alignItems: "flex-end", justifyContent: "center" },
  weeklyLimitLabel: { fontSize: 10, color: COLOURS.muted, textTransform: "uppercase" },
  weeklyLimitValue: { fontSize: 16, fontWeight: "700", color: COLOURS.primary },
  weeklyLimitSub:   { fontSize: 10, color: COLOURS.muted },
  infoNote:         { fontSize: 11, color: COLOURS.muted, textAlign: "center", marginBottom: 8, paddingHorizontal: 20, lineHeight: 16 },
  emptyIcon:        { fontSize: 48, marginBottom: 12 },
  emptyText:        { fontSize: 18, fontWeight: "700", color: COLOURS.primary, marginBottom: 4 },
  emptySub:         { fontSize: 13, color: COLOURS.muted },
  shiftCard:        { marginBottom: 10 },
  shiftHeader:      { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  shiftDate:        { fontSize: 15, fontWeight: "700", color: COLOURS.primary, marginBottom: 2 },
  shiftTruck:       { fontSize: 13, color: COLOURS.muted },
  statusBadge:      { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText:       { color: COLOURS.white, fontSize: 10, fontWeight: "700" },
  statsRow:         { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  statItem:         { backgroundColor: COLOURS.background, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  statLabel:        { fontSize: 9, color: COLOURS.muted, textTransform: "uppercase", marginBottom: 2 },
  statValue:        { fontSize: 13, fontWeight: "700", color: COLOURS.primary },
  tapHint:          { fontSize: 11, color: COLOURS.muted, fontStyle: "italic" },
  actionRow:        { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: COLOURS.border, paddingTop: 8, marginTop: 4 },
  autoHideNote:     { fontSize: 11, color: COLOURS.muted },
  incompleteNote:   { fontSize: 11, color: COLOURS.warning, fontWeight: "600" },
  editBtn:          { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#eff6ff", borderRadius: 6, marginRight: 6 },
  editBtnText:      { fontSize: 12, fontWeight: "600", color: "#1d4ed8" },
  retryBtn:         { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#f0fdf4", borderRadius: 6, marginRight: 6 },
  retryBtnText:     { fontSize: 12, fontWeight: "600", color: COLOURS.pass },
  deleteBtn:        { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#fee2e2", borderRadius: 6 },
  deleteBtnText:    { fontSize: 12, fontWeight: "600", color: COLOURS.fail },
});
