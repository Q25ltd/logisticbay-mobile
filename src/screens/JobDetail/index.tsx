/**
 * JobDetailScreen — orchestrating screen for a single planned job.
 *
 * This file owns state and coordinates sub-forms. The sub-forms themselves
 * are in VehicleConfirmForm, CollectionForm, DeliveryForm, and JobActionBar.
 * Each sub-form receives only the state it needs plus callbacks to update it.
 */
import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, ActivityIndicator, Alert, TextInput,
} from "react-native";
import { api } from "../../api";
import { Card } from "../../components";
import { COLOURS } from "../../theme";
import { useShift } from "../../ShiftContext";
import { enqueueJobEvent } from "../../offlineQueue";
import { useIsOnline } from "../../hooks/useNetworkStatus";
import { JOB_STATUS_LABELS, JOB_STATUS_COLOURS, EVENT_TYPE_LABELS } from "../../constants/jobStatuses";
import { VehicleConfirmForm } from "./VehicleConfirmForm";
import { CollectionForm }     from "./CollectionForm";
import { DeliveryForm }       from "./DeliveryForm";
import { JobActionBar }       from "./JobActionBar";
import { jobDetailStyles as s } from "./jobDetailStyles";
import type { JobDetailScreenProps } from "../../navigation/types";

// ── Action definition map ─────────────────────────────────────────────────────

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

// ── Screen ────────────────────────────────────────────────────────────────────

export default function JobDetailScreen({ navigation, route }: JobDetailScreenProps) {
  const { jobId } = route.params;
  const { draft, currentSegment, draftRestored } = useShift();
  const hasActiveShift = draftRestored && !!draft?.shiftId;
  const viewOnly = !hasActiveShift;
  const isOnline = useIsOnline();

  // ── Core job state ──────────────────────────────────────────────────────────
  const [job,     setJob]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  // ── Note form ───────────────────────────────────────────────────────────────
  const [note,        setNote]        = useState("");
  const [showNoteBox, setShowNoteBox] = useState(false);

  // ── Sub-form visibility ─────────────────────────────────────────────────────
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [showCollectForm, setShowCollectForm] = useState(false);
  const [showDeliverForm, setShowDeliverForm] = useState(false);

  // ── Vehicle confirmation state ──────────────────────────────────────────────
  const [truckReg,         setTruckReg]         = useState("");
  const [trailerReg,       setTrailerReg]        = useState("");
  const [vehicleClass,     setVehicleClass]      = useState("class1");
  const [vehicleConfirmed, setVehicleConfirmed]  = useState(false);

  // ── Collection state ────────────────────────────────────────────────────────
  const [actualQty,   setActualQty]   = useState("");
  const [actualUnit,  setActualUnit]  = useState("pallets");
  const [collectNote, setCollectNote] = useState("");

  // ── Delivery state ──────────────────────────────────────────────────────────
  const [podNumber,    setPodNumber]    = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [deliveredQty, setDeliveredQty] = useState("");

  // ── Data loading ────────────────────────────────────────────────────────────

  async function loadJob() {
    try {
      const res = await api.get(`/jobs/${jobId}`);
      setJob(res.data);
      if (res.data.assignedTruck)   setTruckReg(res.data.assignedTruck);
      if (res.data.assignedTrailer) setTrailerReg(res.data.assignedTrailer);
      if (res.data.vehicleClass)    setVehicleClass(res.data.vehicleClass);
      if (res.data.actualQuantity)  setDeliveredQty(res.data.actualQuantity);
      if (res.data.actualUnit)      setActualUnit(res.data.actualUnit);
    } catch {
      Alert.alert("Error", "Could not load job details");
      navigation.goBack();
    }
    setLoading(false);
  }

  useEffect(() => { loadJob(); }, [jobId]);

  // ── Status update ───────────────────────────────────────────────────────────

  async function doStatusUpdate(status: string, extra: Record<string, unknown>) {
    setSaving(true);

    if (!isOnline) {
      // Offline: queue and update UI optimistically
      const STATUS_TO_EVENT_TYPE: Record<string, string> = {
        in_progress: 'started',
      };
      await enqueueJobEvent({
        jobId,
        eventType:      STATUS_TO_EVENT_TYPE[status] ?? status,
        actualQuantity: extra.actualQuantity as string | undefined,
        actualUnit:     extra.actualUnit     as string | undefined,
        podNumber:      extra.podNumber      as string | undefined,
        collectionNote: extra.collectionNote as string | undefined,
        deliveryNote:   extra.deliveryNote   as string | undefined,
      });
      // Optimistic local update so the driver sees progress
      setJob((prev: any) => prev ? { ...prev, status, ...extra } : prev);
      setSaving(false);
      return;
    }

    try {
      await api.patch(`/jobs/${jobId}/status`, { status, ...extra });
      await loadJob();
    } catch (err: unknown) {
      Alert.alert("Error", (err as any)?.response?.data?.error ?? "Failed to update");
    }
    setSaving(false);
  }

  function handleAction() {
    const action = ACTIONS[job.status];
    if (!action) return;

    // Need vehicle confirmation before starting
    if ((job.status === "pending" || job.status === "accepted") && !vehicleConfirmed) {
      const currentTrailer = currentSegment?.trailerReg ?? "";
      const jobTrailer     = job.assignedTrailer ?? "";
      if (jobTrailer && jobTrailer !== currentTrailer) {
        Alert.alert(
          "Trailer Change",
          `This job has trailer ${jobTrailer} assigned.\nYou currently have: ${currentTrailer || "no trailer"}\n\nUse assigned trailer?`,
          [
            { text: "Yes - use assigned", onPress: () => { setTrailerReg(jobTrailer); setShowVehicleForm(true); } },
            { text: "Keep current trailer", onPress: () => setShowVehicleForm(true) },
          ],
        );
        return;
      }
      setShowVehicleForm(true);
      return;
    }

    const needsCollectForm = action.needsForm === "collect" && job.requireCollection;
    const needsDeliverForm = action.needsForm === "deliver" && (job.requirePOD || job.requireDeliveryQty);

    if (needsCollectForm) { setShowCollectForm(true); return; }
    if (needsDeliverForm) { setShowDeliverForm(true); return; }

    // No form needed — confirm via alert
    Alert.alert(action.label, action.description, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", onPress: () => doStatusUpdate(action.next, {}) },
    ]);
  }

  async function handleCollectConfirm() {
    await doStatusUpdate("collected", { actualQuantity: actualQty, actualUnit, collectionNote: collectNote });
    setShowCollectForm(false);
  }

  async function handleDeliverConfirm() {
    await doStatusUpdate("completed", {
      podNumber,
      deliveryNote,
      actualQuantity: deliveredQty || job.actualQuantity,
      actualUnit:     actualUnit   || job.actualUnit,
    });
    setShowDeliverForm(false);
  }

  async function handleAddNote() {
    if (!note.trim()) { Alert.alert("Enter a note first"); return; }
    setSaving(true);
    try {
      await api.post(`/jobs/${jobId}/note`, { note: note.trim() });
      setNote("");
      setShowNoteBox(false);
      await loadJob();
      Alert.alert("Note added ✓", "Your note has been sent to the planner.");
    } catch (err: unknown) {
      Alert.alert("Error", (err as any)?.response?.data?.error ?? "Failed to add note");
    }
    setSaving(false);
  }

  // ── Loading / null guards ───────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator size="large" color={COLOURS.primary} />
      </SafeAreaView>
    );
  }
  if (!job) return null;

  // ── Sub-form renders ────────────────────────────────────────────────────────

  const action = ACTIONS[job.status];

  if (showVehicleForm) {
    return (
      <VehicleConfirmForm
        job={job}
        truckReg={truckReg}
        trailerReg={trailerReg}
        vehicleClass={vehicleClass}
        saving={saving}
        onBack={() => setShowVehicleForm(false)}
        onChangeTruck={setTruckReg}
        onChangeTrailer={setTrailerReg}
        onChangeClass={setVehicleClass}
        onConfirm={() => {
          setVehicleConfirmed(true);
          setShowVehicleForm(false);
          doStatusUpdate("in_progress", {});
        }}
      />
    );
  }

  if (showCollectForm && action?.needsForm === "collect") {
    return (
      <CollectionForm
        job={job}
        actualQty={actualQty}
        actualUnit={actualUnit}
        collectNote={collectNote}
        saving={saving}
        onBack={() => setShowCollectForm(false)}
        onChangeQty={setActualQty}
        onChangeUnit={setActualUnit}
        onChangeNote={setCollectNote}
        onConfirm={handleCollectConfirm}
      />
    );
  }

  if (showDeliverForm && action?.needsForm === "deliver") {
    return (
      <DeliveryForm
        job={job}
        deliveredQty={deliveredQty}
        podNumber={podNumber}
        deliveryNote={deliveryNote}
        saving={saving}
        onBack={() => setShowDeliverForm(false)}
        onChangeQty={setDeliveredQty}
        onChangePod={setPodNumber}
        onChangeNote={setDeliveryNote}
        onConfirm={handleDeliverConfirm}
      />
    );
  }

  // ── Main job detail view ────────────────────────────────────────────────────

  const statusStyle = JOB_STATUS_COLOURS[job.status] ?? JOB_STATUS_COLOURS["pending"];

  return (
    <SafeAreaView style={s.container}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Jobs")}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.topTitle}>Job Details</Text>
        <View style={[s.statusBadge, { backgroundColor: statusStyle.bg }]}>
          <Text style={[s.statusText, { color: statusStyle.text }]}>
            {JOB_STATUS_LABELS[job.status] ?? job.status}
          </Text>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>

        {/* Progress bar */}
        <View style={styles.progressBar}>
          {["in_progress", "arrived_pickup", "collected", "arrived_dropoff", "completed"].map((st, i, arr) => {
            const current = arr.indexOf(job.status);
            const done    = i <= current;
            return (
              <React.Fragment key={st}>
                <View style={[styles.progressDot, done && styles.progressDotDone]} />
                {i < arr.length - 1 && (
                  <View style={[styles.progressLine, done && i < current && styles.progressLineDone]} />
                )}
              </React.Fragment>
            );
          })}
        </View>
        <View style={styles.progressLabels}>
          {["Pickup", "At Pickup", "Collected", "At Drop", "Done"].map(l => (
            <Text key={l} style={styles.progressLabel}>{l}</Text>
          ))}
        </View>

        {/* Vehicle */}
        <Card style={{ marginBottom: 12 }}>
          <Text style={s.sectionLabel}>Assigned Vehicle</Text>
          {job.assignedTruck ? (
            <View>
              {[
                { icon: "🚛", label: "TRUCK",   reg: job.assignedTruck },
                ...(job.assignedTrailer ? [{ icon: "🚚", label: "TRAILER", reg: job.assignedTrailer }] : []),
              ].map(v => (
                <View key={v.label} style={styles.vehicleRow}>
                  <Text style={styles.vehicleIcon}>{v.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vehicleLabel}>{v.label}</Text>
                    <Text style={styles.vehicleReg}>{v.reg}</Text>
                  </View>
                </View>
              ))}
              {!job.assignedTrailer && (
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
          <Text style={s.sectionLabel}>Route</Text>
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
          <Text style={s.sectionLabel}>Job Details</Text>
          {job.referenceNumber ? (
            <Text style={styles.detailRow}>📋 <Text style={s.bold}>{job.referenceNumber}</Text></Text>
          ) : null}
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
          {job.podNumber ? (
            <Text style={styles.detailRow}>🧾 POD: <Text style={s.bold}>{job.podNumber}</Text></Text>
          ) : null}
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
            <Text style={s.sectionLabel}>Activity Log</Text>
            {job.events.map((e: any) => (
              <View key={e.id} style={styles.eventRow}>
                <View style={styles.eventDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventType}>{EVENT_TYPE_LABELS[e.eventType] ?? e.eventType}</Text>
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
            <Text style={s.sectionLabel}>Report a Problem or Add Note</Text>
            {!showNoteBox ? (
              <TouchableOpacity style={styles.addNoteBtn} onPress={() => setShowNoteBox(true)}>
                <Text style={styles.addNoteBtnText}>+ Add Note / Report Issue</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TextInput
                  style={[s.input, s.multiline]}
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

      <View style={s.bottomNav}>
        <JobActionBar
          jobStatus={job.status}
          action={action}
          saving={saving}
          viewOnly={viewOnly}
          onAction={handleAction}
          onStartShift={() => navigation.navigate("StartShift")}
          onBackToJobs={() => navigation.navigate("Jobs")}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  progressBar:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 16 },
  progressDot:      { width: 12, height: 12, borderRadius: 6, backgroundColor: COLOURS.border },
  progressDotDone:  { backgroundColor: COLOURS.primary },
  progressLine:     { flex: 1, height: 2, backgroundColor: COLOURS.border },
  progressLineDone: { backgroundColor: COLOURS.primary },
  progressLabels:   { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 10, marginTop: 4, marginBottom: 12 },
  progressLabel:    { fontSize: 9, color: COLOURS.muted, textAlign: "center", flex: 1 },
  vehicleRow:       { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 10 },
  vehicleIcon:      { fontSize: 24 },
  vehicleLabel:     { fontSize: 9, color: COLOURS.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  vehicleReg:       { fontSize: 18, fontWeight: "900", color: COLOURS.primary, letterSpacing: 1 },
  vehicleNote:      { fontSize: 12, color: COLOURS.muted, fontStyle: "italic", marginTop: 4 },
  noVehicleBanner:  { backgroundColor: "#fef3c7", borderRadius: 8, padding: 12 },
  noVehicleText:    { fontSize: 14, fontWeight: "700", color: "#92400e", marginBottom: 4 },
  noVehicleSub:     { fontSize: 12, color: "#92400e" },
  routeRow:         { flexDirection: "row", alignItems: "flex-start", gap: 12, marginVertical: 4 },
  routeDot:         { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  routeConnector:   { width: 2, height: 20, backgroundColor: COLOURS.border, marginLeft: 5, marginVertical: 2 },
  routeLabel:       { fontSize: 9, color: COLOURS.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  routeText:        { fontSize: 15, fontWeight: "700", color: COLOURS.primary },
  detailRow:        { fontSize: 14, color: COLOURS.primary, marginBottom: 8 },
  qtyRow:           { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  qtyBadge:         { backgroundColor: "#dbeafe", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  qtyLabel:         { fontSize: 8, color: "#1e40af", textTransform: "uppercase", fontWeight: "700" },
  qtyValue:         { fontSize: 13, color: "#1e40af", fontWeight: "700" },
  plannerNote:      { backgroundColor: "#eff6ff", borderRadius: 8, padding: 12, marginTop: 4, marginBottom: 8 },
  plannerNoteLabel: { fontSize: 11, fontWeight: "700", color: "#1e40af", marginBottom: 4 },
  plannerNoteText:  { fontSize: 13, color: "#1e40af", lineHeight: 18 },
  eventRow:         { flexDirection: "row", gap: 10, marginBottom: 12 },
  eventDot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: COLOURS.accent, marginTop: 5 },
  eventType:        { fontSize: 13, fontWeight: "600", color: COLOURS.primary },
  eventNote:        { fontSize: 12, color: COLOURS.muted, marginTop: 2, fontStyle: "italic" },
  eventTime:        { fontSize: 11, color: COLOURS.muted, marginTop: 2 },
  addNoteBtn:       { borderWidth: 1.5, borderColor: COLOURS.border, borderRadius: 8, padding: 12, alignItems: "center", borderStyle: "dashed" },
  addNoteBtnText:   { fontSize: 13, fontWeight: "600", color: COLOURS.muted },
  noteSubmitBtn:    { backgroundColor: COLOURS.primary, borderRadius: 8, padding: 12, alignItems: "center" },
  noteSubmitText:   { color: COLOURS.white, fontWeight: "700", fontSize: 13 },
  noteCancelBtn:    { backgroundColor: COLOURS.background, borderRadius: 8, padding: 12, alignItems: "center", borderWidth: 1, borderColor: COLOURS.border },
  noteCancelText:   { color: COLOURS.muted, fontWeight: "600", fontSize: 13 },
});
