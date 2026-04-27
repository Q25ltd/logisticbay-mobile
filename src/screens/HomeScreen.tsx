import React from "react";
import {
  View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, Alert,
} from "react-native";
import { useAuth } from "../AuthContext";
import { useShift } from "../ShiftContext";
import { COLOURS } from "../components";

export default function HomeScreen({ navigation }: { navigation: any }) {
  const { user, logout, mustChangePin } = useAuth();

  React.useEffect(() => {
    if (mustChangePin) {
      navigation.navigate("ChangePin", { forced: true });
    }
  }, [mustChangePin]);
  const { draft, resetDraft, draftRestored } = useShift() as any;
  const [jobs, setJobs] = React.useState<any[]>([]);

  React.useEffect(() => {
    // Load today's jobs on home screen
    import("../api").then(({ api }) => {
      api.get("/jobs/my")
        .then(r => setJobs(r.data.data))
        .catch(() => {});
    });
  }, []);

  const pendingJobs   = jobs.filter(j => j.status === "pending" || j.status === "accepted").length;
  const activeJobs    = jobs.filter(j => j.status === "in_progress" || j.status === "arrived_pickup").length;

  const hasDraft = draftRestored && !!draft?.shiftId;

  function handleDiscardDraft() {
    Alert.alert(
      "Discard Draft Shift?",
      "The in-progress shift will be lost. This cannot be undone.",
      [
        { text: "Keep it", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => resetDraft() },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name?.split(" ")[0] ?? "Driver"} 👋</Text>
          <Text style={styles.company}>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {/* Resume draft banner */}
      {hasDraft && (
        <View style={styles.draftBanner}>
          <View style={styles.draftLeft}>
            <Text style={styles.draftTitle}>⚠ Unfinished Shift</Text>
            <Text style={styles.draftSub}>
              You have a shift in progress. Continue where you left off.
            </Text>
          </View>
          <View style={styles.draftActions}>
            <TouchableOpacity
              style={styles.resumeBtn}
              onPress={() => {
                // If finish time not entered yet, go to EndShift regardless of lastScreen
                // This prevents jumping straight to Review with no finish time
                const hasFinishTime = !!(draft?.finishTime);
                const lastScreen    = draft?.lastScreen ?? "EndShift";
                const screen = (!hasFinishTime && lastScreen === "Review") ? "EndShift" : lastScreen;
                navigation.navigate(screen);
              }}
            >
              <Text style={styles.resumeBtnText}>Resume →</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDiscardDraft}>
              <Text style={styles.discardText}>Discard</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main actions */}
      <View style={styles.content}>
        <TouchableOpacity
          style={[styles.startBtn, hasDraft && styles.startBtnDisabled]}
          onPress={() => {
            if (hasDraft) {
              Alert.alert(
                "Shift in Progress",
                "You have an unfinished shift. Please resume or discard it before starting a new one.",
                [{ text: "OK" }]
              );
              return;
            }
            navigation.navigate("StartShift");
          }}
        >
          <Text style={styles.startBtnIcon}>🚛</Text>
          <Text style={styles.startBtnText}>Start Shift</Text>
          <Text style={styles.startBtnSub}>Begin your working day</Text>
        </TouchableOpacity>

        {/* Jobs preview — whole card tappable */}
        <TouchableOpacity style={styles.jobsPreview} onPress={() => navigation.navigate("Jobs")} activeOpacity={0.7}>
          <View style={styles.jobsPreviewHeader}>
            <Text style={styles.jobsPreviewTitle}>📋 Today's Jobs</Text>
            <Text style={styles.jobsPreviewLink}>Manage →</Text>
          </View>
          {jobs.length === 0 ? (
            <Text style={styles.jobsPreviewEmpty}>No jobs assigned for today</Text>
          ) : (
            <>
              <Text style={styles.jobsPreviewSummary}>
                {jobs.length} job{jobs.length !== 1 ? "s" : ""} · {pendingJobs} pending · {activeJobs} active
              </Text>
              {jobs.slice(0, 2).map((j: any) => (
                <View key={j.id} style={styles.jobPreviewRow}>
                  <View style={[styles.jobPreviewDot, {
                    backgroundColor: j.status === "completed" ? "#16a34a" :
                                     j.status === "in_progress" ? "#f59e0b" : "#6b7280"
                  }]} />
                  <Text style={styles.jobPreviewText} numberOfLines={1}>
                    {j.pickupTextSnapshot || "—"} → {j.dropoffTextSnapshot || "—"}
                  </Text>
                </View>
              ))}
              {jobs.length > 2 && (
                <Text style={styles.jobsPreviewMore}>+{jobs.length - 2} more — tap Manage to see all</Text>
              )}
            </>
          )}
        </TouchableOpacity>

        <View style={styles.grid}>
          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate("History")}
          >
            <Text style={styles.gridIcon}>📋</Text>
            <Text style={styles.gridLabel}>My Shifts</Text>
            <Text style={styles.gridSub}>View history</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => navigation.navigate("ChangePin")}
          >
            <Text style={styles.gridIcon}>🔒</Text>
            <Text style={styles.gridLabel}>Change PIN</Text>
            <Text style={styles.gridSub}>Update your 6-digit PIN</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: COLOURS.background },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 20, backgroundColor: COLOURS.primary,
  },
  greeting:         { fontSize: 20, fontWeight: "700", color: COLOURS.white },
  company:          { fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  logoutBtn:        { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 8 },
  logoutText:       { color: COLOURS.white, fontSize: 13 },

  draftBanner: {
    flexDirection: "row", backgroundColor: "#fff7ed", borderLeftWidth: 4,
    borderLeftColor: COLOURS.warning, margin: 16, borderRadius: 10, padding: 14,
    alignItems: "center",
  },
  draftLeft:        { flex: 1 },
  draftTitle:       { fontSize: 14, fontWeight: "700", color: "#92400e", marginBottom: 4 },
  draftSub:         { fontSize: 12, color: "#92400e" },
  draftActions:     { alignItems: "center", marginLeft: 12 },
  resumeBtn:        { backgroundColor: COLOURS.warning, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, marginBottom: 6 },
  resumeBtnText:    { color: COLOURS.white, fontWeight: "700", fontSize: 13 },
  discardText:      { color: COLOURS.muted, fontSize: 11 },

  content:          { flex: 1, padding: 16 },
  startBtn: {
    backgroundColor: COLOURS.primary, borderRadius: 16, padding: 24,
    alignItems: "center", marginBottom: 16,
  },
  startBtnDisabled: { opacity: 0.4 },
  startBtnIcon:     { fontSize: 40, marginBottom: 8 },
  startBtnText:     { fontSize: 20, fontWeight: "800", color: COLOURS.white, marginBottom: 4 },
  startBtnSub:      { fontSize: 13, color: "rgba(255,255,255,0.6)" },

  jobsPreview: {
    backgroundColor: COLOURS.white, borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1.5, borderColor: COLOURS.border,
  },
  jobsPreviewHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  jobsPreviewTitle:   { fontSize: 15, fontWeight: "700", color: COLOURS.primary },
  jobsPreviewLink:    { fontSize: 13, fontWeight: "600", color: COLOURS.accent },
  jobsPreviewEmpty:   { fontSize: 13, color: COLOURS.muted, fontStyle: "italic" },
  jobsPreviewSummary: { fontSize: 12, color: COLOURS.muted, marginBottom: 8 },
  jobPreviewRow:      { flexDirection: "row", alignItems: "center", marginBottom: 4, gap: 8 },
  jobPreviewDot:      { width: 8, height: 8, borderRadius: 4 },
  jobPreviewText:     { fontSize: 13, color: COLOURS.primary, flex: 1 },
  jobsPreviewMore:    { fontSize: 11, color: COLOURS.muted, marginTop: 4, fontStyle: "italic" },
  grid:             { flexDirection: "row", gap: 12 },
  gridCard: {
    flex: 1, backgroundColor: COLOURS.white, borderRadius: 12, padding: 16,
    alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  gridIcon:         { fontSize: 28, marginBottom: 6 },
  gridLabel:        { fontSize: 14, fontWeight: "700", color: COLOURS.primary, marginBottom: 2 },
  gridSub:          { fontSize: 11, color: COLOURS.muted },
});
