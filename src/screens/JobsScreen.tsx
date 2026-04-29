import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, SafeAreaView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api";
import { COLOURS, Card } from "../components";
import { useShift } from "../ShiftContext";

interface Job {
  id:                  number;
  pickupTextSnapshot:  string;
  dropoffTextSnapshot: string;
  referenceNumber:     string;
  materialType:        string;
  quantityExpected:    string;
  quantityUnit:        string;
  plannerNotes:        string;
  status:              string;
  plannedDate:         string;
  events:              any[];
}

function statusColour(s: string) {
  if (s === "completed")      return COLOURS.pass;
  if (s === "in_progress")    return "#f59e0b";
  if (s === "arrived_pickup") return "#8b5cf6";
  if (s === "cancelled")      return COLOURS.muted;
  return COLOURS.accent;
}

function statusLabel(s: string) {
  const labels: Record<string,string> = {
    pending:        "Pending",
    accepted:       "Accepted",
    in_progress:    "In Progress",
    arrived_pickup: "At Pickup",
    completed:      "Completed",
    cancelled:      "Cancelled",
  };
  return labels[s] || s;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const today    = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString())    return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function JobCard({ item, onPress, viewOnly }: { item: Job; onPress: () => void; viewOnly: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.jobCard}>
        <View style={styles.jobHeader}>
          <View style={[styles.statusDot, { backgroundColor: statusColour(item.status) }]} />
          <Text style={[styles.statusText, { color: statusColour(item.status) }]}>
            {statusLabel(item.status)}
          </Text>
          {viewOnly && (
            <View style={styles.viewOnlyBadge}>
              <Text style={styles.viewOnlyText}>VIEW ONLY</Text>
            </View>
          )}
        </View>

        <Text style={styles.jobRoute}>{item.pickupTextSnapshot || "—"}</Text>
        <Text style={styles.jobArrow}>↓</Text>
        <Text style={styles.jobRoute}>{item.dropoffTextSnapshot || "—"}</Text>

        <View style={styles.jobMeta}>
          {item.referenceNumber ? <Text style={styles.metaItem}>📋 {item.referenceNumber}</Text> : null}
          {item.materialType    ? <Text style={styles.metaItem}>📦 {item.materialType}</Text>    : null}
          {item.quantityExpected ? <Text style={styles.metaItem}>⚖️ {item.quantityExpected} {item.quantityUnit}</Text> : null}
        </View>

        {item.plannerNotes ? (
          <Text style={styles.jobNotes}>💬 {item.plannerNotes}</Text>
        ) : null}

        <Text style={styles.tapHint}>
          {viewOnly ? "Start a shift to update job status" : "Tap to view details →"}
        </Text>
      </Card>
    </TouchableOpacity>
  );
}

export default function JobsScreen({ navigation }: { navigation: any }) {
  const [todayJobs,    setTodayJobs]    = useState<Job[]>([]);
  const [upcomingJobs, setUpcomingJobs] = useState<Job[]>([]);
  const [tab,          setTab]          = useState<"today" | "upcoming">("today");
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);

  const { draft, draftRestored, updateShiftField } = useShift() as any;
  const hasActiveShift = draftRestored && !!draft?.shiftId;
  const hasTruck = !!(draft?.truckReg);

  useEffect(() => {
    if (hasActiveShift) updateShiftField("lastScreen", "Jobs");
  }, [hasActiveShift]);

  async function load(refresh = false) {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.get("/jobs/my");
      setTodayJobs(res.data.data ?? []);
      setUpcomingJobs(res.data.upcoming ?? []);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }

  useFocusEffect(useCallback(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []));

  if (loading) return (
    <SafeAreaView style={styles.center}>
      <ActivityIndicator size="large" color={COLOURS.primary} />
    </SafeAreaView>
  );

  const jobs     = tab === "today" ? todayJobs : upcomingJobs;
  const viewOnly = !hasActiveShift || tab === "upcoming";

  const pending   = todayJobs.filter(j => j.status === "pending"   || j.status === "accepted").length;
  const active    = todayJobs.filter(j => j.status === "in_progress" || j.status === "arrived_pickup").length;
  const completed = todayJobs.filter(j => j.status === "completed").length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Line 1: Navigation */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.navigate("Home")}>
          <Text style={styles.backText}>← Home</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>My Jobs</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Line 2: Truck */}
      {hasActiveShift && (
        <TouchableOpacity
          style={styles.vehicleRow}
          onPress={() => navigation.navigate("ChangeVehicle", { changeType: "truck" })}
        >
          <Text style={styles.vehicleRowIcon}>🚛</Text>
          <Text style={styles.vehicleRowReg}>{draft?.truckReg || "No truck assigned"}</Text>
          <Text style={styles.vehicleRowChange}>Change →</Text>
        </TouchableOpacity>
      )}

      {/* Line 3: Trailer */}
      {hasActiveShift && draft?.currentSegment?.vehicleClass !== "van" && (
        <TouchableOpacity
          style={[styles.vehicleRow, { borderTopWidth: 0 }]}
          onPress={() => navigation.navigate("ChangeVehicle", { changeType: "trailer" })}
        >
          <Text style={styles.vehicleRowIcon}>🚚</Text>
          <Text style={styles.vehicleRowReg}>
            {draft?.currentSegment?.trailerReg || "No trailer"}
          </Text>
          <Text style={styles.vehicleRowChange}>Change →</Text>
        </TouchableOpacity>
      )}

      {/* Shift status warning */}
      {!hasActiveShift && (
        <View style={styles.noShiftBanner}>
          <Text style={styles.noShiftText}>
            🚛 Start a shift to update job statuses
          </Text>
        </View>
      )}


      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === "today" && styles.tabActive]}
          onPress={() => setTab("today")}
        >
          <Text style={[styles.tabText, tab === "today" && styles.tabTextActive]}>
            Today {todayJobs.length > 0 ? `(${todayJobs.length})` : ""}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "upcoming" && styles.tabActive]}
          onPress={() => setTab("upcoming")}
        >
          <Text style={[styles.tabText, tab === "upcoming" && styles.tabTextActive]}>
            Upcoming {upcomingJobs.length > 0 ? `(${upcomingJobs.length})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Today summary */}
      {tab === "today" && todayJobs.length > 0 && (
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{todayJobs.length}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: COLOURS.accent }]}>{pending}</Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: "#f59e0b" }]}>{active}</Text>
            <Text style={styles.summaryLabel}>Active</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: COLOURS.pass }]}>{completed}</Text>
            <Text style={styles.summaryLabel}>Done</Text>
          </View>
        </View>
      )}

      {jobs.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>{tab === "today" ? "📋" : "📅"}</Text>
          <Text style={styles.emptyTitle}>
            {tab === "today" ? "No jobs today" : "No upcoming jobs"}
          </Text>
          <Text style={styles.emptySub}>Your planner will assign jobs here</Text>
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          ListHeaderComponent={tab === "upcoming" ? (
            <View style={styles.upcomingNote}>
              <Text style={styles.upcomingNoteText}>
                📅 Plan your week — these jobs are assigned to you for upcoming days
              </Text>
            </View>
          ) : null}
          renderItem={({ item }) => {
            const isUpcoming = tab === "upcoming";
            return (
              <>
                {isUpcoming && (
                  <Text style={styles.dateHeader}>{fmtDate(item.plannedDate)}</Text>
                )}
                <JobCard
                  item={item}
                  viewOnly={viewOnly}
                  onPress={() => navigation.navigate("JobDetail", {
                    jobId: item.id,
                    viewOnly,
                  })}
                />
              </>
            );
          }}
        />
      )}

      {/* Bottom: End Shift */}
      {hasActiveShift && (
        <TouchableOpacity
          style={styles.endShiftBottom}
          onPress={() => navigation.navigate("EndShift")}
        >
          <Text style={styles.endShiftBottomText}>✅ Shift Complete — End Shift</Text>
          <Text style={styles.endShiftBottomSub}>Enjoy your rest! 🎉</Text>
        </TouchableOpacity>
      )}
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
  endShiftText:   { color: COLOURS.fail, fontSize: 14, fontWeight: "700" },
  vehicleText:    { color: COLOURS.accent, fontSize: 14, fontWeight: "700" },
  topTitle:       { fontSize: 17, fontWeight: "700", color: COLOURS.primary },
  noShiftBanner: {
    backgroundColor: "#fff7ed", borderLeftWidth: 4, borderLeftColor: COLOURS.warning,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  noShiftText:    { fontSize: 13, color: "#92400e", fontWeight: "600" },
  tabs: {
    flexDirection: "row", backgroundColor: COLOURS.white,
    borderBottomWidth: 1, borderBottomColor: COLOURS.border,
  },
  tab: {
    flex: 1, paddingVertical: 12, alignItems: "center",
    borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  tabActive:      { borderBottomColor: COLOURS.primary },
  tabText:        { fontSize: 14, fontWeight: "600", color: COLOURS.muted },
  tabTextActive:  { color: COLOURS.primary },
  summary: {
    flexDirection: "row", backgroundColor: COLOURS.primary,
    margin: 16, borderRadius: 12, padding: 16,
  },
  summaryItem:    { flex: 1, alignItems: "center" },
  summaryValue:   { fontSize: 24, fontWeight: "900", color: COLOURS.white },
  summaryLabel:   { fontSize: 10, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.15)" },
  emptyIcon:      { fontSize: 48, marginBottom: 12 },
  emptyTitle:     { fontSize: 18, fontWeight: "700", color: COLOURS.primary, marginBottom: 4 },
  emptySub:       { fontSize: 13, color: COLOURS.muted },
  upcomingNote: {
    backgroundColor: "#eff6ff", borderRadius: 8, padding: 12, marginBottom: 12,
    borderLeftWidth: 3, borderLeftColor: "#3b82f6",
  },
  upcomingNoteText: { fontSize: 13, color: "#1e40af" },
  dateHeader:     { fontSize: 12, fontWeight: "700", color: COLOURS.muted, textTransform: "uppercase", marginBottom: 6, marginTop: 4 },
  jobCard:        { marginBottom: 12 },
  jobHeader:      { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  statusDot:      { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText:     { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  viewOnlyBadge:  { marginLeft: "auto", backgroundColor: "#f3f4f6", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  vehicleRow:        { flexDirection: "row", alignItems: "center", backgroundColor: COLOURS.white, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLOURS.border },
  vehicleRowIcon:    { fontSize: 20, marginRight: 10 },
  vehicleRowReg:     { flex: 1, fontSize: 16, fontWeight: "800", color: COLOURS.primary, letterSpacing: 1 },
  vehicleRowChange:  { fontSize: 12, color: COLOURS.accent, fontWeight: "600" },
  endShiftBottom:    { backgroundColor: "#16a34a", padding: 16, alignItems: "center", borderTopWidth: 1, borderTopColor: "#15803d" },
  endShiftBottomText:{ fontSize: 16, fontWeight: "800", color: COLOURS.white },
  endShiftBottomSub: { fontSize: 12, color: "#bbf7d0", marginTop: 2 },
  spareBanner:     { backgroundColor: "#fef3c7", padding: 12, borderBottomWidth: 1, borderBottomColor: "#f59e0b" },
  spareBannerText:{ fontSize: 13, fontWeight: "600", color: "#92400e", textAlign: "center" },
  truckBanner:    { backgroundColor: "#f0fdf4", padding: 8, borderBottomWidth: 1, borderBottomColor: "#86efac", flexDirection: "row", justifyContent: "center", gap: 16 },
  truckBannerText:{ fontSize: 13, fontWeight: "700", color: "#14532d" },
  viewOnlyText:   { fontSize: 9, fontWeight: "700", color: COLOURS.muted },
  jobRoute:       { fontSize: 15, fontWeight: "700", color: COLOURS.primary },
  jobArrow:       { fontSize: 16, color: COLOURS.muted, marginVertical: 2, marginLeft: 4 },
  jobMeta:        { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  metaItem:       { fontSize: 12, color: COLOURS.muted },
  jobNotes:       { fontSize: 12, color: COLOURS.muted, marginTop: 6, fontStyle: "italic" },
  tapHint:        { fontSize: 11, color: COLOURS.muted, marginTop: 8, fontStyle: "italic" },
  vehicleRow:        { flexDirection: "row", alignItems: "center", backgroundColor: COLOURS.white, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLOURS.border },
  vehicleRowIcon:    { fontSize: 20, marginRight: 10 },
  vehicleRowReg:     { flex: 1, fontSize: 16, fontWeight: "800", color: COLOURS.primary, letterSpacing: 1 },
  vehicleRowChange:  { fontSize: 12, color: COLOURS.accent, fontWeight: "600" },
  endShiftBottom:    { backgroundColor: "#16a34a", padding: 16, alignItems: "center", borderTopWidth: 1, borderTopColor: "#15803d" },
  endShiftBottomText:{ fontSize: 16, fontWeight: "800", color: COLOURS.white },
  endShiftBottomSub: { fontSize: 12, color: "#bbf7d0", marginTop: 2 },
  spareBanner:     { backgroundColor: "#fef3c7", padding: 12, borderBottomWidth: 1, borderBottomColor: "#f59e0b" },
  spareBannerText:{ fontSize: 13, fontWeight: "600", color: "#92400e", textAlign: "center" },
  truckBanner:    { backgroundColor: "#f0fdf4", padding: 8, borderBottomWidth: 1, borderBottomColor: "#86efac", flexDirection: "row", justifyContent: "center", gap: 12 },
  truckBannerText:{ fontSize: 13, fontWeight: "700", color: "#14532d" },
});
