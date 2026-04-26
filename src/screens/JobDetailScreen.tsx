import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, ActivityIndicator, Alert, TextInput,
} from "react-native";
import { api } from "../api";
import { COLOURS, Button, Card } from "../components";

// Status flow and button labels
const ACTIONS: Record<string, { label: string; next: string; colour: string; description: string } | null> = {
  pending:        { label: "▶  Start Job",           next: "in_progress",    colour: COLOURS.accent,  description: "Tap when leaving for pickup" },
  accepted:       { label: "▶  Start Job",           next: "in_progress",    colour: COLOURS.accent,  description: "Tap when leaving for pickup" },
  in_progress:    { label: "📍 Arrived at Pickup",   next: "arrived_pickup", colour: "#f59e0b",       description: "Tap when you arrive at the collection point" },
  arrived_pickup: { label: "✅ Collected — Complete", next: "completed",      colour: COLOURS.pass,    description: "Tap when load is collected and job is done" },
  completed:      null,
  cancelled:      null,
};

const STATUS_LABELS: Record<string,string> = {
  pending:        "Pending",
  accepted:       "Accepted",
  in_progress:    "In Progress",
  arrived_pickup: "At Pickup",
  completed:      "Completed",
  cancelled:      "Cancelled",
};

const STATUS_COLOURS: Record<string,{ bg: string; text: string }> = {
  pending:        { bg: "#dbeafe", text: "#1e40af" },
  accepted:       { bg: "#dbeafe", text: "#1e40af" },
  in_progress:    { bg: "#fef9c3", text: "#713f12" },
  arrived_pickup: { bg: "#e0e7ff", text: "#3730a3" },
  completed:      { bg: "#dcfce7", text: "#14532d" },
  cancelled:      { bg: "#f3f4f6", text: "#6b7280" },
};

export default function JobDetailScreen({ navigation, route }: { navigation: any; route: any }) {
  const { jobId } = route.params;
  const [job,         setJob]         = useState<any>(null);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [note,        setNote]        = useState("");
  const [showNoteBox, setShowNoteBox] = useState(false);

  async function load() {
    try {
      const res = await api.get(`/jobs/${jobId}`);
      setJob(res.data);
    } catch {
      Alert.alert("Error", "Could not load job details");
      navigation.goBack();
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [jobId]);

  async function handleAction() {
    const action = ACTIONS[job.status];
    if (!action) return;

    Alert.alert(
      action.label,
      `Confirm: ${action.label.replace("→","").replace("✓","").trim()}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setSaving(true);
            try {
              await api.patch(`/jobs/${jobId}/status`, { status: action.next });
              await load();
            } catch (err: any) {
              Alert.alert("Error", err.response?.data?.error ?? "Failed to update");
            }
            setSaving(false);
          },
        },
      ]
    );
  }

  async function handleAddNote() {
    if (!note.trim()) { Alert.alert("Enter a note first"); return; }
    setSaving(true);
    try {
      await api.post(`/jobs/${jobId}/note`, { note: note.trim() });
      setNote("");
      setShowNoteBox(false);
      await load();
      Alert.alert("Note added ✓", "Your note has been sent to the planner.");
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.error ?? "Failed to add note");
    }
    setSaving(false);
  }

  if (loading) return (
    <SafeAreaView style={styles.center}>
      <ActivityIndicator size="large" color={COLOURS.primary} />
    </SafeAreaView>
  );

  if (!job) return null;

  const action      = ACTIONS[job.status];
  const statusStyle = STATUS_COLOURS[job.status] ?? STATUS_COLOURS.pending;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Job Details</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.statusText, { color: statusStyle.text }]}>
            {STATUS_LABELS[job.status] ?? job.status}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>

        {/* Route — read only, set by planner */}
        <Card style={{ marginBottom: 12 }}>
          <Text style={styles.sectionLabel}>Route</Text>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: COLOURS.accent }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>PICKUP</Text>
              <Text style={styles.routeText}>{job.pickupTextSnapshot || "—"}</Text>
            </View>
          </View>
          <View style={styles.routeConnector} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: COLOURS.fail }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>DROPOFF</Text>
              <Text style={styles.routeText}>{job.dropoffTextSnapshot || "—"}</Text>
            </View>
          </View>
        </Card>

        {/* Job details — read only */}
        {(job.referenceNumber || job.materialType || job.quantityExpected || job.plannerNotes) && (
          <Card style={{ marginBottom: 12 }}>
            <Text style={styles.sectionLabel}>Job Details</Text>
            {job.referenceNumber  ? <Text style={styles.detailRow}>📋 <Text style={styles.bold}>{job.referenceNumber}</Text></Text>  : null}
            {job.materialType     ? <Text style={styles.detailRow}>📦 {job.materialType}{job.quantityExpected ? ` — ${job.quantityExpected} ${job.quantityUnit}` : ""}</Text> : null}
            {job.plannerNotes     ? (
              <View style={styles.plannerNote}>
                <Text style={styles.plannerNoteLabel}>📌 Planner Notes</Text>
                <Text style={styles.plannerNoteText}>{job.plannerNotes}</Text>
              </View>
            ) : null}
            <Text style={styles.readOnlyNote}>ℹ️ These details are set by your planner and cannot be edited</Text>
          </Card>
        )}

        {/* Activity log */}
        {job.events?.length > 0 && (
          <Card style={{ marginBottom: 12 }}>
            <Text style={styles.sectionLabel}>Activity Log</Text>
            {job.events.map((e: any) => (
              <View key={e.id} style={styles.eventRow}>
                <View style={styles.eventDotSmall} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventType}>
                    {e.eventType === "started"        ? "▶ Job started" :
                     e.eventType === "arrived_pickup" ? "📍 Arrived at pickup" :
                     e.eventType === "completed"      ? "✅ Job completed" :
                     e.eventType === "note_added"     ? "💬 Note added" :
                     e.eventType}
                  </Text>
                  {e.note ? <Text style={styles.eventNote}>"{e.note}"</Text> : null}
                  <Text style={styles.eventTime}>
                    {new Date(e.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Add note */}
        {job.status !== "cancelled" && (
          <Card style={{ marginBottom: 12 }}>
            <Text style={styles.sectionLabel}>Report a Problem or Add Note</Text>
            {!showNoteBox ? (
              <TouchableOpacity style={styles.addNoteBtn} onPress={() => setShowNoteBox(true)}>
                <Text style={styles.addNoteBtnText}>+ Add Note / Report Issue</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TextInput
                  style={styles.noteInput}
                  value={note}
                  onChangeText={setNote}
                  placeholder="e.g. Site closed, access issue, delivery refused, damage found..."
                  placeholderTextColor={COLOURS.muted}
                  multiline
                  autoFocus
                />
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <TouchableOpacity
                    style={[styles.noteSubmitBtn, { flex: 1 }]}
                    onPress={handleAddNote}
                    disabled={saving}
                  >
                    <Text style={styles.noteSubmitText}>{saving ? "Sending..." : "Send Note →"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.noteCancelBtn, { flex: 1 }]}
                    onPress={() => { setShowNoteBox(false); setNote(""); }}
                  >
                    <Text style={styles.noteCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Card>
        )}

      </ScrollView>

      {/* Action button */}
      <View style={styles.bottomNav}>
        {action ? (
          <View>
            <Text style={{ fontSize: 11, color: COLOURS.muted, textAlign: "center", marginBottom: 6 }}>
              {action.description}
            </Text>
            <Button
              label={saving ? "Updating..." : action.label}
              onPress={handleAction}
              loading={saving}
              style={{ backgroundColor: action.colour }}
            />
          </View>
        ) : job.status === "completed" ? (
          <View style={styles.completedBar}>
            <Text style={styles.completedText}>✅ Job Completed — well done!</Text>
          </View>
        ) : job.status === "cancelled" ? (
          <View style={[styles.completedBar, { backgroundColor: "#f3f4f6" }]}>
            <Text style={[styles.completedText, { color: COLOURS.muted }]}>⛔ Job Cancelled</Text>
          </View>
        ) : null}
      </View>
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
  statusBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText:      { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  scroll:          { flex: 1 },
  sectionLabel:    { fontSize: 10, color: COLOURS.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  routeRow:        { flexDirection: "row", alignItems: "flex-start", gap: 12, marginVertical: 4 },
  routeDot:        { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  routeConnector:  { width: 2, height: 20, backgroundColor: COLOURS.border, marginLeft: 5, marginVertical: 2 },
  routeLabel:      { fontSize: 9, color: COLOURS.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  routeText:       { fontSize: 15, fontWeight: "700", color: COLOURS.primary },
  detailRow:       { fontSize: 14, color: COLOURS.primary, marginBottom: 8 },
  bold:            { fontWeight: "700" },
  plannerNote: {
    backgroundColor: "#eff6ff", borderRadius: 8, padding: 12,
    marginTop: 4, marginBottom: 8,
  },
  plannerNoteLabel:{ fontSize: 11, fontWeight: "700", color: "#1e40af", marginBottom: 4 },
  plannerNoteText: { fontSize: 13, color: "#1e40af", lineHeight: 18 },
  readOnlyNote:    { fontSize: 11, color: COLOURS.muted, fontStyle: "italic", marginTop: 4 },
  eventRow:        { flexDirection: "row", gap: 10, marginBottom: 12 },
  eventDotSmall:   { width: 8, height: 8, borderRadius: 4, backgroundColor: COLOURS.accent, marginTop: 5 },
  eventType:       { fontSize: 13, fontWeight: "600", color: COLOURS.primary },
  eventNote:       { fontSize: 12, color: COLOURS.muted, marginTop: 2, fontStyle: "italic" },
  eventTime:       { fontSize: 11, color: COLOURS.muted, marginTop: 2 },
  addNoteBtn: {
    borderWidth: 1.5, borderColor: COLOURS.border, borderRadius: 8,
    padding: 12, alignItems: "center", borderStyle: "dashed",
  },
  addNoteBtnText:  { fontSize: 13, fontWeight: "600", color: COLOURS.muted },
  noteInput: {
    borderWidth: 1.5, borderColor: COLOURS.border, borderRadius: 8,
    padding: 12, fontSize: 14, color: COLOURS.primary,
    minHeight: 80,
  } as any,
  noteSubmitBtn:   { backgroundColor: COLOURS.primary, borderRadius: 8, padding: 12, alignItems: "center" },
  noteSubmitText:  { color: COLOURS.white, fontWeight: "700", fontSize: 13 },
  noteCancelBtn:   { backgroundColor: COLOURS.background, borderRadius: 8, padding: 12, alignItems: "center", borderWidth: 1, borderColor: COLOURS.border },
  noteCancelText:  { color: COLOURS.muted, fontWeight: "600", fontSize: 13 },
  bottomNav:       { padding: 16, backgroundColor: COLOURS.white, borderTopWidth: 1, borderTopColor: COLOURS.border },
  completedBar:    { backgroundColor: "#dcfce7", borderRadius: 10, padding: 16, alignItems: "center" },
  completedText:   { fontSize: 15, fontWeight: "700", color: "#14532d" },
});