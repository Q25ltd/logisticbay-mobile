import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, SafeAreaView,
  TouchableOpacity, ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api";
import { COLOURS, Card } from "../components";

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
  if (s === "completed") return COLOURS.pass;
  if (s === "failed")    return COLOURS.fail;
  if (s === "draft")     return COLOURS.warning;
  return "#f59e0b";
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
      // Auto-hide shifts older than 90 days (still in DB, just not shown on driver's phone)
      const allShifts = res.data.data.filter((s: Shift) => s.status !== "deleted");
      const toAutoHide = allShifts.filter((s: Shift) => daysSince(s.createdAt) >= 90).map((s: Shift) => s.id);
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

  async function handleHide(shift: Shift) {
    const age = daysSince(shift.createdAt);

    if (age < 28) {
      Alert.alert(
        "Too Recent to Hide",
        `Shifts can be hidden from your view after 28 days.\n\nThis shift is ${age} day${age !== 1 ? "s" : ""} old.\n\nThe report is stored securely — your manager has access at all times.`,
        [{ text: "OK" }]
      );
      return;
    }

    Alert.alert(
      "Hide from Your History?",
      "This shift will be removed from your phone's history list.\n\nThe full report stays in the system — your manager can still view it.\n\nShifts older than 90 days are hidden automatically.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Hide",
          style: "destructive",
          onPress: async () => {
            await hideShift(shift.id);
            setHidden(prev => [...prev, shift.id]);
          },
        },
      ]
    );
  }

  // Filter out hidden shifts for display
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
        ℹ️  Reports are stored securely · Manager has full access · Can be hidden from your list after 28 days
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
            const age       = daysSince(item.createdAt);
            const canHide   = age >= 28;
            const daysLeft  = Math.max(0, 90 - age);

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
                      <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
                    </View>
                  </View>

                  <View style={styles.statsRow}>
                    {item.totalHours ? (
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Paid Hours</Text>
                        <Text style={[styles.statValue, { color: COLOURS.accent }]}>{item.totalHours}</Text>
                      </View>
                    ) : null}
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
                  {daysLeft <= 14 && (
                    <Text style={styles.autoHideNote}>Auto-hides from your list in {daysLeft} days</Text>
                  )}
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity
                    style={[styles.hideBtn, !canHide && styles.hideBtnDisabled]}
                    onPress={() => handleHide(item)}
                  >
                    <Text style={[styles.hideBtnText, !canHide && { color: COLOURS.muted }]}>
                      {canHide ? "Hide" : `Hide in ${28 - age}d`}
                    </Text>
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
  hideBtn:          { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#f3f4f6", borderRadius: 6 },
  hideBtnDisabled:  { backgroundColor: COLOURS.background },
  hideBtnText:      { fontSize: 12, fontWeight: "600", color: COLOURS.muted },
});
