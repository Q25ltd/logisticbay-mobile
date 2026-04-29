import React from "react";
import {
  View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, Alert,
} from "react-native";
import { useAuth } from "../AuthContext";
import { useShift } from "../ShiftContext";
import { COLOURS, AppFooter } from "../components";

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
                // New flow: if shift active and lastScreen not set or is old-style, go to Jobs
                const SAFE_SCREENS = ["EndShift", "Review", "Jobs", "JobDetail"];
                const rawScreen  = draft?.lastScreen;
                const hasFinishTime = !!(draft?.finishTime);

                // If lastScreen is not set or is StartShift/old screen, go to Jobs
                if (!rawScreen || !SAFE_SCREENS.includes(rawScreen)) {
                  navigation.navigate("Jobs");
                  return;
                }

                // If finish time not entered yet, don't go to Review
                const screen = (!hasFinishTime && rawScreen === "Review") ? "EndShift" : rawScreen;
                navigation.navigate(screen);
              }}
            >
              <Text style={styles.resumeBtnText}>Resume →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.discardBtn} onPress={handleDiscardDraft}>
              <Text style={styles.discardBtnText}>Discard</Text>
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

        {/* Jobs preview — read only, all upcoming */}
        <View style={styles.jobsPreview}>
          <View style={styles.jobsPreviewHeader}>
            <Text style={styles.jobsPreviewTitle}>📋 My Upcoming Jobs</Text>
            <TouchableOpacity onPress={() => navigation.navigate("Jobs")}>
              <Text style={styles.jobsPreviewLink}>View all →</Text>
            </TouchableOpacity>
          </View>
          {jobs.length === 0 ? (
            <Text style={styles.jobsPreviewEmpty}>No jobs assigned yet</Text>
          ) : (
            <>
              {jobs.slice(0, 5).map((j: any) => {
                const jobDate = new Date(j.scheduledDate || j.createdAt);
                const isToday = jobDate.toDateString() === new Date().toDateString();
                const dateLabel = isToday ? "Today" : jobDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
                return (
                  <View key={j.id} style={styles.jobPreviewRow}>
                    <View style={{ width: 48 }}>
                      <Text style={styles.jobPreviewDate}>{dateLabel}</Text>
                    </View>
                    <View style={[styles.jobPreviewDot, {
                      backgroundColor: j.status === "completed" ? "#16a34a" :
                                       j.status === "in_progress" ? "#f59e0b" : "#6b7280"
                    }]} />
                    <Text style={styles.jobPreviewText} numberOfLines={1}>
                      {j.pickupTextSnapshot || "—"} → {j.dropoffTextSnapshot || "—"}
                    </Text>
                  </View>
                );
              })}
              {jobs.length > 5 && (
                <TouchableOpacity onPress={() => navigation.navigate("Jobs")}>
                  <Text style={styles.jobsPreviewMore}>+{jobs.length - 5} more — tap to see all</Text>
                </TouchableOpacity>
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
            onPress={() => navigation.navigate("Holidays")}
          >
            <Text style={styles.gridIcon}>🏖️</Text>
            <Text style={styles.gridLabel}>Holidays</Text>
            <Text style={styles.gridSub}>Request & track</Text>
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

        {/* Company brand banner */}
        <View style={styles.companyBanner}>
          <Text style={styles.companyBannerLabel}>POWERED BY</Text>
          <Text
            style={styles.companyBannerName}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {user?.companyName ?? "LogisticBay"}
          </Text>
          <Text style={styles.companyBannerSub}>logistics · transport · delivery</Text>
        </View>
      </View>
      <AppFooter />
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
  discardBtn:     { marginTop: 8, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, borderWidth: 1.5, borderColor: COLOURS.fail, alignItems: "center" },
  discardBtnText: { fontSize: 13, fontWeight: "700", color: COLOURS.fail },
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
  jobPreviewDate:  { fontSize: 10, fontWeight: "700", color: COLOURS.accent, width: 44 },
  jobPreviewText:     { fontSize: 13, color: COLOURS.primary, flex: 1 },
  jobsPreviewMore:    { fontSize: 11, color: COLOURS.muted, marginTop: 4, fontStyle: "italic" },
  grid:             { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  gridCard: { width: "30%",
    flex: 1, backgroundColor: COLOURS.white, borderRadius: 12, padding: 16,
    alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  gridIcon:         { fontSize: 28, marginBottom: 6 },
  gridLabel:        { fontSize: 14, fontWeight: "700", color: COLOURS.primary, marginBottom: 2 },
  gridSub:          { fontSize: 11, color: COLOURS.muted },
  companyBanner: {
    marginTop: 20, marginHorizontal: 0, paddingVertical: 24, paddingHorizontal: 20,
    backgroundColor: COLOURS.primary, borderRadius: 16, alignItems: "center",
  },
  companyBannerLabel: { fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 },
  companyBannerName:  { fontSize: 36, fontWeight: "900", color: COLOURS.white, textAlign: "center", lineHeight: 40 },
  companyBannerSub:   { fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 6, letterSpacing: 1 },
});
