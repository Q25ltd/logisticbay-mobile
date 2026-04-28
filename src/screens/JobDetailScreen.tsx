import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, ActivityIndicator, Alert, TextInput,
} from "react-native";
import { api } from "../api";
import { COLOURS, Button, Card } from "../components";
import { useShift } from "../ShiftContext";

const STATUS_LABELS: Record<string,string> = {
  pending:         "Pending",
  accepted:        "Accepted",
  in_progress:     "En Route to Pickup",
  arrived_pickup:  "At Pickup",
  collected:       "Load Collected",
  arrived_dropoff: "At Dropoff",
  completed:       "Delivered ✅",
  cancelled:       "Cancelled",
};

const STATUS_COLOURS: Record<string,{ bg: string; text: string }> = {
  pending:         { bg: "#dbeafe", text: "#1e40af" },
  accepted:        { bg: "#dbeafe", text: "#1e40af" },
  in_progress:     { bg: "#fef9c3", text: "#713f12" },
  arrived_pickup:  { bg: "#e0e7ff", text: "#3730a3" },
  collected:       { bg: "#fef3c7", text: "#92400e" },
  arrived_dropoff: { bg: "#f3e8ff", text: "#6b21a8" },
  completed:       { bg: "#dcfce7", text: "#14532d" },
  cancelled:       { bg: "#f3f4f6", text: "#6b7280" },
};

interface ActionStep {
  label:       string;
  next:        string;
  colour:      string;
  description: string;
  needsForm?:  "collect" | "deliver";
}

const ACTIONS: Record<string, ActionStep | null> = {
  pending:         { label: "▶ Start Job — Leave for Pickup", next: "in_progress",    colour: COLOURS.accent,  description: "Tap when you leave for the collection point" },
  accepted:        { label: "▶ Start Job — Leave for Pickup", next: "in_progress",    colour: COLOURS.accent,  description: "Tap when you leave for the collection point" },
  in_progress:     { label: "📍 Arrived at Pickup",           next: "arrived_pickup", colour: "#8b5cf6",       description: "Tap when you arrive at the collection point" },
  arrived_pickup:  { label: "📦 Confirm Collection",          next: "collected",      colour: "#f59e0b",       description: "Enter actual quantities collected",           needsForm: "collect" },
  collected:       { label: "🚛 Arrived at Dropoff",          next: "arrived_dropoff",colour: "#6366f1",       description: "Tap when you arrive at the delivery point" },
  arrived_dropoff: { label: "✅ Confirm Delivery",            next: "completed",      colour: COLOURS.pass,    description: "Enter POD and actual quantities delivered",   needsForm: "deliver" },
  completed:       null,
  cancelled:       null,
};

export default function JobDetailScreen({ navigation, route }: { navigation: any; route: any }) {
  const { jobId } = route.params;
  const { draft, draftRestored } = useShift() as any;
  const hasActiveShift = draftRestored && !!draft?.shiftId;
  const viewOnly = !hasActiveShift;

  const [job,          setJob]          = useState<any>(null);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [note,         setNote]         = useState("");
  const [showNoteBox,  setShowNoteBox]  = useState(false);
  const [showForm,     setShowForm]     = useState(false);

  // Collection form
  const [actualQty,    setActualQty]    = useState("");
  const [actualUnit,   setActualUnit]   = useState("pallets");
  const [collectNote,  setCollectNote]  = useState("");

  // Delivery form
  const [podNumber,    setPodNumber]    = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [deliveredQty, setDeliveredQty] = useState("");

  async function load() {
    try {
      const res = await api.get(`/jobs/${jobId}`);
      setJob(res.data);
      // Pre-fill delivery qty from collected qty
      if (res.data.actualQuantity) setDeliveredQty(res.data.actualQuantity);
      if (res.data.actualUnit)     setActualUnit(res.data.actualUnit);
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

    // Check if planner requires confirmation for this step
    const needsCollectForm = action.needsForm === "collect" && job.requireCollection;
    const needsDeliverForm = action.needsForm === "deliver" && (job.requirePOD || job.requireDeliveryQty);

    if (needsCollectForm || needsDeliverForm) {
      setShowForm(true);
      return;
    }

    // No confirmation required — just tap through
    if (action.needsForm) {
      Alert.alert(
        action.label,
        action.description,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Confirm", onPress: () => doStatusUpdate(action.next, {}) },
        ]
      );
      return;
    }

    Alert.alert(
      action.label,
      action.description,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => doStatusUpdate(action.next, {}) },
      ]
    );
  }

  async function handleCollect() {
    if (!actualQty.trim()) {
      Alert.alert("Required", "Please enter actual quantity collected");
      return;
    }
    await doStatusUpdate("collected", {
      actualQuantity: actualQty,
      actualUnit,
      collectionNote: collectNote,
    });
    setShowForm(false);
  }

  async function handleDeliver() {
    if (job.requirePOD && !podNumber.trim()) {
      Alert.alert("Required", "Planner requires a POD / delivery reference number");
      return;
    }
    if (job.requireDeliveryQty && !deliveredQty.trim()) {
      Alert.alert("Required", "Planner requires the actual delivery quantity");
      return;
    }
    await doStatusUpdate("completed", {
      podNumber,
      deliveryNote,
      actualQuantity: deliveredQty || job.actualQuantity,
      actualUnit:     actualUnit   || job.actualUnit,
    });
    setShowForm(false);
  }

  async function doStatusUpdate(status: string, extra: any) {
    setSaving(true);
    try {
      await api.patch(`/jobs/${jobId}/status`, { status, ...extra });
      await load();
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.error ?? "Failed to update");
    }
    setSaving(false);
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

  // Collection form modal
  if (showForm && action?.needsForm === "collect") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setShowForm(false)}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>Confirm Collection</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          <Card>
            <Text style={styles.formInfo}>
              📋 Planner expected: <Text style={styles.bold}>{job.quantityExpected || "not specified"} {job.quantityUnit}</Text>
            </Text>
            <Text style={styles.sectionLabel}>Actual Quantity Collected</Text>
            <TextInput
              style={styles.input}
              value={actualQty}
              onChangeText={setActualQty}
              placeholder="e.g. 4"
              keyboardType="decimal-pad"
              placeholderTextColor={COLOURS.muted}
            />
            <Text style={styles.sectionLabel}>Unit of measurement</Text>
            <View style={styles.unitRow}>
              {["pallets", "kgs", "bags", "other"].map(u => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitBtn, actualUnit === u && styles.unitBtnActive]}
                  onPress={() => setActualUnit(u)}
                >
                  <Text style={[styles.unitBtnText, actualUnit === u && styles.unitBtnTextActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.sectionLabel}>Collection Note <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={collectNote}
              onChangeText={setCollectNote}
              placeholder="e.g. 1 pallet damaged, refused by depot..."
              placeholderTextColor={COLOURS.muted}
              multiline
            />
          </Card>
        </ScrollView>
        <View style={styles.bottomNav}>
          <Button
            label={saving ? "Saving..." : "✅ Confirm Collection"}
            onPress={handleCollect}
            loading={saving}
            style={{ backgroundColor: "#f59e0b" }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Delivery form modal
  if (showForm && action?.needsForm === "deliver") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setShowForm(false)}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>Confirm Delivery</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          <Card>
            {job.actualQuantity ? (
              <Text style={styles.formInfo}>
                📦 Collected: <Text style={styles.bold}>{job.actualQuantity} {job.actualUnit}</Text>
              </Text>
            ) : null}
            <Text style={styles.sectionLabel}>Actual Quantity Delivered</Text>
            <TextInput
              style={styles.input}
              value={deliveredQty}
              onChangeText={setDeliveredQty}
              placeholder="e.g. 4"
              keyboardType="decimal-pad"
              placeholderTextColor={COLOURS.muted}
            />
            <Text style={styles.sectionLabel}>POD / Delivery Reference <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={styles.input}
              value={podNumber}
              onChangeText={setPodNumber}
              placeholder="e.g. POD-12345"
              placeholderTextColor={COLOURS.muted}
            />
            <Text style={styles.sectionLabel}>Delivery Note <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={deliveryNote}
              onChangeText={setDeliveryNote}
              placeholder="e.g. left at reception, customer signed, short delivered 1..."
              placeholderTextColor={COLOURS.muted}
              multiline
            />
          </Card>
        </ScrollView>
        <View style={styles.bottomNav}>
          <Button
            label={saving ? "Saving..." : "✅ Confirm Delivery"}
            onPress={handleDeliver}
            loading={saving}
            style={{ backgroundColor: COLOURS.pass }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Jobs")}>
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

        {/* Progress bar */}
        <View style={styles.progressBar}>
          {["in_progress","arrived_pickup","collected","arrived_dropoff","completed"].map((s, i) => {
            const statuses = ["in_progress","arrived_pickup","collected","arrived_dropoff","completed"];
            const current  = statuses.indexOf(job.status);
            const done     = i <= current;
            return (
              <React.Fragment key={s}>
                <View style={[styles.progressDot, done && styles.progressDotDone]} />
                {i < statuses.length - 1 && (
                  <View style={[styles.progressLine, done && i < current && styles.progressLineDone]} />
                )}
              </React.Fragment>
            );
          })}
        </View>
        <View style={styles.progressLabels}>
          {["Pickup", "At Pickup", "Collected", "At Drop", "Done"].map((l, i) => (
            <Text key={l} style={styles.progressLabel}>{l}</Text>
          ))}
        </View>

        {/* Vehicle */}
        <Card style={{ marginBottom: 12 }}>
          <Text style={styles.sectionLabel}>Assigned Vehicle</Text>
          {job.assignedTruck ? (
            <View>
              <View style={styles.vehicleRow}>
                <Text style={styles.vehicleIcon}>🚛</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vehicleLabel}>TRUCK</Text>
                  <Text style={styles.vehicleReg}>{job.assignedTruck}</Text>
                </View>
              </View>
              {job.assignedTrailer ? (
                <View style={styles.vehicleRow}>
                  <Text style={styles.vehicleIcon}>🚚</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vehicleLabel}>TRAILER</Text>
                    <Text style={styles.vehicleReg}>{job.assignedTrailer}</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.vehicleNote}>No trailer assigned — solo run</Text>
              )}
            </View>
          ) : (
            <View style={styles.noVehicleBanner}>
              <Text style={styles.noVehicleText}>⚠️ No vehicle assigned</Text>
              <Text style={styles.noVehicleSub}>Speak to your planner or enter manually below</Text>
            </View>
          )}
        </Card>

        {/* Route */}
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
            <View style={[styles.routeDot, { backgroundColor: COLOURS.pass }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>DROPOFF</Text>
              <Text style={styles.routeText}>{job.dropoffTextSnapshot || "—"}</Text>
            </View>
          </View>
        </Card>

        {/* Job details */}
        <Card style={{ marginBottom: 12 }}>
          <Text style={styles.sectionLabel}>Job Details</Text>
          {job.referenceNumber ? <Text style={styles.detailRow}>📋 <Text style={styles.bold}>{job.referenceNumber}</Text></Text> : null}
          {job.materialType ? (
            <View style={styles.qtyRow}>
              <Text style={styles.detailRow}>📦 {job.materialType}</Text>
              {job.quantityExpected ? (
                <View style={styles.qtyBadge}>
                  <Text style={styles.qtyLabel}>PLANNED</Text>
                  <Text style={styles.qtyValue}>{job.quantityExpected} {job.quantityUnit}</Text>
                </View>
              ) : null}
              {job.actualQuantity ? (
                <View style={[styles.qtyBadge, { backgroundColor: "#dcfce7" }]}>
                  <Text style={[styles.qtyLabel, { color: "#14532d" }]}>ACTUAL</Text>
                  <Text style={[styles.qtyValue, { color: "#14532d" }]}>{job.actualQuantity} {job.actualUnit}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {job.podNumber ? <Text style={styles.detailRow}>🧾 POD: <Text style={styles.bold}>{job.podNumber}</Text></Text> : null}
          {job.plannerNotes ? (
            <View style={styles.plannerNote}>
              <Text style={styles.plannerNoteLabel}>📌 Planner Notes</Text>
              <Text style={styles.plannerNoteText}>{job.plannerNotes}</Text>
            </View>
          ) : null}
          {(job.requireCollection || job.requirePOD || job.requireDeliveryQty) ? (
            <View style={[styles.plannerNote, { backgroundColor: "#fef3c7" }]}>
              <Text style={[styles.plannerNoteLabel, { color: "#92400e" }]}>⚠️ Planner Requires</Text>
              {job.requireCollection  ? <Text style={[styles.plannerNoteText, { color: "#92400e" }]}>• Confirm collection quantity</Text> : null}
              {job.requirePOD         ? <Text style={[styles.plannerNoteText, { color: "#92400e" }]}>• POD / delivery reference</Text>      : null}
              {job.requireDeliveryQty ? <Text style={[styles.plannerNoteText, { color: "#92400e" }]}>• Confirm delivery quantity</Text>      : null}
            </View>
          ) : null}
          {job.collectionNote ? (
            <View style={[styles.plannerNote, { backgroundColor: "#fef9c3" }]}>
              <Text style={[styles.plannerNoteLabel, { color: "#713f12" }]}>📦 Collection Note</Text>
              <Text style={[styles.plannerNoteText, { color: "#713f12" }]}>{job.collectionNote}</Text>
            </View>
          ) : null}
          {job.deliveryNote ? (
            <View style={[styles.plannerNote, { backgroundColor: "#dcfce7" }]}>
              <Text style={[styles.plannerNoteLabel, { color: "#14532d" }]}>🚚 Delivery Note</Text>
              <Text style={[styles.plannerNoteText, { color: "#14532d" }]}>{job.deliveryNote}</Text>
            </View>
          ) : null}
        </Card>

        {/* Activity log */}
        {job.events?.length > 0 && (
          <Card style={{ marginBottom: 12 }}>
            <Text style={styles.sectionLabel}>Activity Log</Text>
            {job.events.map((e: any) => (
              <View key={e.id} style={styles.eventRow}>
                <View style={styles.eventDotSmall} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventType}>
                    {e.eventType === "started"         ? "▶ Left for pickup" :
                     e.eventType === "arrived_pickup"  ? "📍 Arrived at pickup" :
                     e.eventType === "collected"       ? "📦 Load collected" :
                     e.eventType === "arrived_dropoff" ? "📍 Arrived at dropoff" :
                     e.eventType === "completed"       ? "✅ Delivered" :
                     e.eventType === "note_added"      ? "💬 Note added" :
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
        {job.status !== "cancelled" && job.status !== "completed" && (
          <Card style={{ marginBottom: 12 }}>
            <Text style={styles.sectionLabel}>Report a Problem or Add Note</Text>
            {!showNoteBox ? (
              <TouchableOpacity style={styles.addNoteBtn} onPress={() => setShowNoteBox(true)}>
                <Text style={styles.addNoteBtnText}>+ Add Note / Report Issue</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TextInput
                  style={[styles.input, styles.multiline] as any}
                  value={note}
                  onChangeText={setNote}
                  placeholder="e.g. Site closed, access issue, refused..."
                  placeholderTextColor={COLOURS.muted}
                  multiline
                  autoFocus
                />
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <TouchableOpacity style={[styles.noteSubmitBtn, { flex: 1 }]} onPress={handleAddNote} disabled={saving}>
                    <Text style={styles.noteSubmitText}>{saving ? "Sending..." : "Send Note →"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.noteCancelBtn, { flex: 1 }]} onPress={() => { setShowNoteBox(false); setNote(""); }}>
                    <Text style={styles.noteCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Card>
        )}
      </ScrollView>

      <View style={styles.bottomNav}>
        {viewOnly && action ? (
          <TouchableOpacity style={styles.noShiftBar} onPress={() => navigation.navigate("StartShift")} activeOpacity={0.8}>
            <Text style={styles.noShiftText}>🚛 Start a shift to update this job</Text>
            <Text style={styles.noShiftSub}>Tap here to begin your shift →</Text>
          </TouchableOpacity>
        ) : action ? (
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
          <View>
            <View style={styles.completedBar}>
              <Text style={styles.completedText}>✅ Job Delivered — well done!</Text>
            </View>
            <TouchableOpacity
              style={styles.endShiftBtn}
              onPress={() => navigation.navigate("EndShift")}
            >
              <Text style={styles.endShiftBtnText}>🏁 Finished for the day? End Shift →</Text>
            </TouchableOpacity>
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
  progressBar:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 16 },
  progressDot:     { width: 12, height: 12, borderRadius: 6, backgroundColor: COLOURS.border },
  progressDotDone: { backgroundColor: COLOURS.primary },
  progressLine:    { flex: 1, height: 2, backgroundColor: COLOURS.border },
  progressLineDone:{ backgroundColor: COLOURS.primary },
  progressLabels:  { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 10, marginTop: 4, marginBottom: 12 },
  progressLabel:   { fontSize: 9, color: COLOURS.muted, textAlign: "center", flex: 1 },
  sectionLabel:    { fontSize: 10, color: COLOURS.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  routeRow:        { flexDirection: "row", alignItems: "flex-start", gap: 12, marginVertical: 4 },
  routeDot:        { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  routeConnector:  { width: 2, height: 20, backgroundColor: COLOURS.border, marginLeft: 5, marginVertical: 2 },
  routeLabel:      { fontSize: 9, color: COLOURS.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  routeText:       { fontSize: 15, fontWeight: "700", color: COLOURS.primary },
  detailRow:       { fontSize: 14, color: COLOURS.primary, marginBottom: 8 },
  bold:            { fontWeight: "700" },
  qtyRow:          { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  qtyBadge:        { backgroundColor: "#dbeafe", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  qtyLabel:        { fontSize: 8, color: "#1e40af", textTransform: "uppercase", fontWeight: "700" },
  qtyValue:        { fontSize: 13, color: "#1e40af", fontWeight: "700" },
  plannerNote:     { backgroundColor: "#eff6ff", borderRadius: 8, padding: 12, marginTop: 4, marginBottom: 8 },
  plannerNoteLabel:{ fontSize: 11, fontWeight: "700", color: "#1e40af", marginBottom: 4 },
  plannerNoteText: { fontSize: 13, color: "#1e40af", lineHeight: 18 },
  eventRow:        { flexDirection: "row", gap: 10, marginBottom: 12 },
  eventDotSmall:   { width: 8, height: 8, borderRadius: 4, backgroundColor: COLOURS.accent, marginTop: 5 },
  eventType:       { fontSize: 13, fontWeight: "600", color: COLOURS.primary },
  eventNote:       { fontSize: 12, color: COLOURS.muted, marginTop: 2, fontStyle: "italic" },
  eventTime:       { fontSize: 11, color: COLOURS.muted, marginTop: 2 },
  addNoteBtn:      { borderWidth: 1.5, borderColor: COLOURS.border, borderRadius: 8, padding: 12, alignItems: "center", borderStyle: "dashed" },
  addNoteBtnText:  { fontSize: 13, fontWeight: "600", color: COLOURS.muted },
  input:           { borderWidth: 1.5, borderColor: COLOURS.border, borderRadius: 8, padding: 12, fontSize: 14, color: COLOURS.primary, marginBottom: 8, backgroundColor: COLOURS.white },
  multiline:       { minHeight: 80, textAlignVertical: "top" } as any,
  noteSubmitBtn:   { backgroundColor: COLOURS.primary, borderRadius: 8, padding: 12, alignItems: "center" },
  noteSubmitText:  { color: COLOURS.white, fontWeight: "700", fontSize: 13 },
  noteCancelBtn:   { backgroundColor: COLOURS.background, borderRadius: 8, padding: 12, alignItems: "center", borderWidth: 1, borderColor: COLOURS.border },
  noteCancelText:  { color: COLOURS.muted, fontWeight: "600", fontSize: 13 },
  bottomNav:       { padding: 16, backgroundColor: COLOURS.white, borderTopWidth: 1, borderTopColor: COLOURS.border },
  completedBar:    { backgroundColor: "#dcfce7", borderRadius: 10, padding: 16, alignItems: "center" },
  completedText:   { fontSize: 15, fontWeight: "700", color: "#14532d" },
  noShiftBar:      { backgroundColor: "#fff7ed", borderRadius: 10, padding: 16, alignItems: "center", borderWidth: 1.5, borderColor: "#f59e0b" },
  noShiftText:     { fontSize: 14, fontWeight: "700", color: "#92400e", marginBottom: 4 },
  noShiftSub:      { fontSize: 12, color: "#92400e", opacity: 0.7 },
  endShiftBtn:     { marginTop: 8, padding: 14, borderRadius: 10, backgroundColor: COLOURS.primary, alignItems: "center" },
  endShiftBtnText: { fontSize: 14, fontWeight: "700", color: COLOURS.white },
  formInfo:        { fontSize: 14, color: COLOURS.primary, marginBottom: 12, padding: 10, backgroundColor: COLOURS.background, borderRadius: 8 },
  vehicleRow:      { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 10 },
  vehicleIcon:     { fontSize: 24 },
  vehicleLabel:    { fontSize: 9, color: COLOURS.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  vehicleReg:      { fontSize: 18, fontWeight: "900", color: COLOURS.primary, letterSpacing: 1 },
  vehicleNote:     { fontSize: 12, color: COLOURS.muted, fontStyle: "italic", marginTop: 4 },
  noVehicleBanner: { backgroundColor: "#fef3c7", borderRadius: 8, padding: 12 },
  noVehicleText:   { fontSize: 14, fontWeight: "700", color: "#92400e", marginBottom: 4 },
  noVehicleSub:    { fontSize: 12, color: "#92400e" },
  unitRow:         { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  unitBtn:         { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: COLOURS.border, backgroundColor: COLOURS.white },
  unitBtnActive:   { backgroundColor: COLOURS.primary, borderColor: COLOURS.primary },
  unitBtnText:     { fontSize: 12, fontWeight: "600", color: COLOURS.muted },
  unitBtnTextActive:{ color: COLOURS.white },
  optional:        { fontWeight: "400", color: COLOURS.muted },
});
