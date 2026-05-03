import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLOURS, Button, Card } from "../components";
import { useShift, type DeliveryEntry } from "../ShiftContext";
import { api } from "../api";

type LoadType = "weight" | "pallets" | "hours" | "other";

interface Props { navigation: any }

// ─────────────────────────────────────────────────────────────────────────────
// Delivery row (summary card)
// ─────────────────────────────────────────────────────────────────────────────

function DeliveryRow({ delivery, onEdit, onRemove }: {
  delivery: DeliveryEntry; onEdit: () => void; onRemove: () => void;
}) {
  const loadSummary =
    delivery.loadType === "pallets" && delivery.pallets ? `📦 ${delivery.pallets} pallets` :
    delivery.loadType === "weight"  && delivery.tonnes  ? `⚖️ ${delivery.tonnes}t${delivery.kgs ? ` / ${delivery.kgs}kg` : ""}` :
    delivery.loadType === "hours"   && delivery.hours   ? `⏱ ${delivery.hours}h` :
    delivery.notes ? delivery.notes.slice(0, 30) : "";

  return (
    <Card style={styles.deliveryCard}>
      <View style={styles.deliveryHeader}>
        <Text style={styles.deliveryTitle}>{delivery.materials || "No material specified"}</Text>
        <View style={styles.deliveryActions}>
          <TouchableOpacity onPress={onEdit} style={styles.editBtn}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onRemove} style={styles.removeBtn}>
            <Text style={styles.removeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
      {(delivery.collectFrom || delivery.deliverTo) && (
        <Text style={styles.deliveryMeta}>
          {delivery.collectFrom ? `From: ${delivery.collectFrom}` : ""}
          {delivery.collectFrom && delivery.deliverTo ? "  →  " : ""}
          {delivery.deliverTo ? `To: ${delivery.deliverTo}` : ""}
        </Text>
      )}
      {delivery.ticketNo ? <Text style={styles.deliveryMeta}>Ticket: {delivery.ticketNo}</Text> : null}
      <View style={styles.deliveryStats}>
        {delivery.startTime ? <Text style={styles.stat}>⏱ {delivery.startTime}–{delivery.finishTime}</Text> : null}
        {loadSummary ? <Text style={styles.stat}>{loadSummary}</Text> : null}
      </View>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Delivery form
// ─────────────────────────────────────────────────────────────────────────────

function DeliveryForm({ initial, onSave, onCancel }: {
  initial?: Partial<DeliveryEntry>; onSave: (d: Omit<DeliveryEntry, "id">) => void; onCancel: () => void;
}) {
  const [materials,   setMaterials]   = useState(initial?.materials   ?? "");
  const [collectFrom, setCollectFrom] = useState(initial?.collectFrom ?? "");
  const [deliverTo,   setDeliverTo]   = useState(initial?.deliverTo   ?? "");
  const [ticketNo,    setTicketNo]    = useState(initial?.ticketNo    ?? "");
  const [startTime,   setStartTime]   = useState(initial?.startTime   ?? "");
  const [finishTime,  setFinishTime]  = useState(initial?.finishTime  ?? "");
  const [hours,       setHours]       = useState(initial?.hours       ?? "");
  const [loadType,    setLoadType]    = useState<LoadType>(initial?.loadType ?? "weight");
  const [pallets,     setPallets]     = useState(initial?.pallets     ?? "");
  const [tonnes,      setTonnes]      = useState(initial?.tonnes      ?? "");
  const [kgs,         setKgs]         = useState(initial?.kgs         ?? "");
  const [notes,       setNotes]       = useState(initial?.notes       ?? "");

  function save() {
    if (!materials.trim() && !collectFrom.trim() && !deliverTo.trim()) {
      Alert.alert("Required", "Please enter at least material type, collection or delivery point");
      return;
    }
    onSave({ materials, collectFrom, deliverTo, ticketNo, startTime, finishTime, hours, loadType, pallets, tonnes, kgs, notes });
  }

  const field = (label: string, value: string, onChange: (v: string) => void, opts?: any) => (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.fieldInput} value={value} onChangeText={onChange}
        placeholderTextColor={COLOURS.muted} {...opts} />
    </View>
  );

  return (
    <ScrollView style={styles.form} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
      <Text style={styles.formTitle}>Delivery / Job Details</Text>

      {field("Materials / Job Type", materials,   setMaterials,   { placeholder: "e.g. Aggregates, Pallets, Skip" })}
      {field("Collect From",         collectFrom, setCollectFrom, { placeholder: "Collection point or address" })}
      {field("Deliver To",           deliverTo,   setDeliverTo,   { placeholder: "Delivery point or address" })}
      {field("Ticket / Reference No", ticketNo,   setTicketNo,    { placeholder: "Ticket or job reference" })}

      <View style={styles.twoCol}>
        <View style={[styles.fieldRow, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.fieldLabel}>Start Time</Text>
          <TextInput style={styles.fieldInput} value={startTime} onChangeText={setStartTime}
            placeholder="e.g. 08:00" placeholderTextColor={COLOURS.muted} />
        </View>
        <View style={[styles.fieldRow, { flex: 1 }]}>
          <Text style={styles.fieldLabel}>Finish Time</Text>
          <TextInput style={styles.fieldInput} value={finishTime} onChangeText={setFinishTime}
            placeholder="e.g. 12:30" placeholderTextColor={COLOURS.muted} />
        </View>
      </View>

      {field("Hours", hours, setHours, { placeholder: "e.g. 4.5", keyboardType: "decimal-pad" })}

      <Text style={styles.fieldLabel}>Load Type</Text>
      <View style={styles.loadTypeRow}>
        {([
          { key: "weight",  label: "⚖️ Weight"  },
          { key: "pallets", label: "📦 Pallets" },
          { key: "hours",   label: "⏱ Hours"   },
          { key: "other",   label: "📝 Other"   },
        ] as { key: LoadType; label: string }[]).map(lt => (
          <TouchableOpacity
            key={lt.key}
            style={[styles.loadTypeBtn, loadType === lt.key && styles.loadTypeBtnActive]}
            onPress={() => setLoadType(lt.key)}
          >
            <Text style={[styles.loadTypeBtnText, loadType === lt.key && styles.loadTypeBtnTextActive]}>
              {lt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loadType === "weight" && (
        <View style={styles.twoCol}>
          <View style={[styles.fieldRow, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.fieldLabel}>Tonnes</Text>
            <TextInput style={styles.fieldInput} value={tonnes} onChangeText={setTonnes}
              placeholder="e.g. 23.4" placeholderTextColor={COLOURS.muted} keyboardType="decimal-pad" />
          </View>
          <View style={[styles.fieldRow, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>Kgs</Text>
            <TextInput style={styles.fieldInput} value={kgs} onChangeText={setKgs}
              placeholder="e.g. 865" placeholderTextColor={COLOURS.muted} keyboardType="decimal-pad" />
          </View>
        </View>
      )}

      {loadType === "pallets" && (
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Number of Pallets</Text>
          <TextInput style={styles.fieldInput} value={pallets} onChangeText={setPallets}
            placeholder="e.g. 24" placeholderTextColor={COLOURS.muted} keyboardType="numeric" />
        </View>
      )}

      {field("Notes", notes, setNotes, {
        placeholder: "Any issues or notes for this job",
        multiline: true,
        style: styles.multiline,
      })}

      <View style={styles.formButtons}>
        <Button label="Save Job" onPress={save} style={{ flex: 1, marginRight: 8 }} />
        <Button label="Cancel"   onPress={onCancel} variant="ghost" style={{ flex: 1 }} />
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function DeliveriesScreen({ navigation }: Props) {
  const { currentSegment, addDelivery, removeDelivery, updateDelivery, updateShiftField } = useShift();

  const [showForm,    setShowForm]    = useState(false);
  const [editId,      setEditId]      = useState<string | null>(null);
  const [plannedJobs, setPlannedJobs] = useState<any[]>([]);
  const [prefill,     setPrefill]     = useState<Partial<DeliveryEntry> | undefined>(undefined);

  React.useEffect(() => { updateShiftField("lastScreen", "Deliveries"); }, []);

  // Load today's planned jobs from planner
  React.useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    api.get(`/jobs/my?date=${today}`)
      .then((r: any) => setPlannedJobs(r.data.data.filter((j: any) => j.status !== "cancelled")))
      .catch(() => {});
  }, []);

  function handleSave(data: Omit<DeliveryEntry, "id">) {
    if (editId) { updateDelivery(editId, data); setEditId(null); }
    else        { addDelivery({ ...data, id: Math.random().toString(36).slice(2) }); }
    setShowForm(false);
    setPrefill(undefined);
  }

  function handleRemove(id: string) {
    Alert.alert("Remove Job", "Remove this delivery entry?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeDelivery(id) },
    ]);
  }

  function openJobDetail(job: any) {
    navigation.navigate("JobDetail", { jobId: job.id });
  }

  const editingDelivery = editId ? currentSegment.deliveries.find(d => d.id === editId) : undefined;

  if (showForm) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => { setShowForm(false); setEditId(null); setPrefill(undefined); }}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>{editId ? "Edit Job" : "Add Job"}</Text>
          <View style={{ width: 50 }} />
        </View>
        <DeliveryForm
          initial={editingDelivery ?? prefill}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditId(null); setPrefill(undefined); }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Deliveries / Jobs</Text>
        <TouchableOpacity onPress={() => { setPrefill(undefined); setShowForm(true); }} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.hint}>
          Segment {currentSegment.segmentNumber} — {currentSegment.truckReg}
          {currentSegment.hasTrailer ? ` + ${currentSegment.trailerReg}` : ""}
        </Text>

        {/* Planner-assigned jobs */}
        {plannedJobs.length > 0 && (
          <View style={styles.plannedSection}>
            <Text style={styles.plannedTitle}>📋 Assigned Jobs Today</Text>
            <Text style={styles.plannedHint}>Tap a job to pre-fill the form</Text>
            {plannedJobs.map((job: any) => (
              <TouchableOpacity
                key={job.id}
                style={[styles.plannedCard, job.status === "completed" && styles.plannedCardDone]}
                onPress={() => openJobDetail(job)}
              >
                <View style={styles.plannedCardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.plannedRoute}>
                      {job.pickupTextSnapshot || "—"} → {job.dropoffTextSnapshot || "—"}
                    </Text>
                    {job.referenceNumber ? <Text style={styles.plannedMeta}>📋 {job.referenceNumber}</Text> : null}
                    {job.materialType    ? <Text style={styles.plannedMeta}>📦 {job.materialType}</Text>    : null}
                    {job.plannerNotes   ? <Text style={styles.plannedMeta}>💬 {job.plannerNotes}</Text>    : null}
                  </View>
                  <View style={[styles.plannedStatus, {
                    backgroundColor:
                      job.status === "completed"      ? "#dcfce7" :
                      job.status === "in_progress"    ? "#fef9c3" :
                      job.status === "arrived_pickup" ? "#e0e7ff" : "#dbeafe"
                  }]}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color:
                      job.status === "completed"      ? "#14532d" :
                      job.status === "in_progress"    ? "#713f12" :
                      job.status === "arrived_pickup" ? "#3730a3" : "#1e40af"
                    }}>
                      {job.status === "completed"      ? "✓ DONE" :
                       job.status === "in_progress"    ? "▶ ACTIVE" :
                       job.status === "arrived_pickup" ? "📍 ON SITE" : "VIEW →"}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Manual deliveries */}
        {currentSegment.deliveries.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>{plannedJobs.length > 0 ? "No deliveries recorded yet" : "No jobs recorded yet"}</Text>
            <Text style={styles.emptySub}>
              {plannedJobs.length > 0
                ? "Tap an assigned job above or use + Add"
                : "Tap \"+ Add\" to record a delivery or job"}
            </Text>
          </View>
        ) : (
          currentSegment.deliveries.map(d => (
            <DeliveryRow
              key={d.id}
              delivery={d}
              onEdit={() => { setEditId(d.id); setPrefill(undefined); setShowForm(true); }}
              onRemove={() => handleRemove(d.id)}
            />
          ))
        )}
      </ScrollView>

      <View style={styles.bottomNav}>
        <Button
          label="End Segment / Finish Shift →"
          onPress={() => navigation.navigate("EndSegment")}
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
  topTitle:       { fontSize: 16, fontWeight: "700", color: COLOURS.primary },
  addBtn:         { backgroundColor: COLOURS.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addBtnText:     { color: COLOURS.white, fontWeight: "700", fontSize: 13 },
  scroll:         { flex: 1 },
  hint:           { fontSize: 13, color: COLOURS.muted, marginBottom: 12 },
  empty:          { alignItems: "center", paddingTop: 60 },
  emptyIcon:      { fontSize: 48, marginBottom: 12 },
  emptyText:      { fontSize: 16, fontWeight: "700", color: COLOURS.primary, marginBottom: 4 },
  emptySub:       { fontSize: 13, color: COLOURS.muted, textAlign: "center" },
  plannedSection: { marginBottom: 16 },
  plannedTitle:   { fontSize: 13, fontWeight: "700", color: COLOURS.primary, marginBottom: 2 },
  plannedHint:    { fontSize: 11, color: COLOURS.muted, marginBottom: 8 },
  plannedCard: {
    backgroundColor: COLOURS.white, borderRadius: 10, padding: 12,
    marginBottom: 8, borderWidth: 1.5, borderColor: "#dbeafe",
  },
  plannedCardDone:  { borderColor: "#dcfce7", opacity: 0.6 },
  plannedCardRow:   { flexDirection: "row", alignItems: "center", gap: 10 },
  plannedRoute:     { fontSize: 13, fontWeight: "700", color: COLOURS.primary, marginBottom: 2 },
  plannedMeta:      { fontSize: 11, color: COLOURS.muted },
  plannedStatus:    { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  deliveryCard:   { marginBottom: 10 },
  deliveryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  deliveryTitle:  { fontSize: 15, fontWeight: "700", color: COLOURS.primary, flex: 1 },
  deliveryActions:{ flexDirection: "row", gap: 8 },
  editBtn:        { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "#e0f2fe", borderRadius: 6 },
  editBtnText:    { color: "#0369a1", fontSize: 12, fontWeight: "600" },
  removeBtn:      { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "#fef2f2", borderRadius: 6 },
  removeBtnText:  { color: COLOURS.fail, fontSize: 12, fontWeight: "700" },
  deliveryMeta:   { fontSize: 12, color: COLOURS.muted, marginBottom: 2 },
  deliveryStats:  { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  stat:           { fontSize: 12, color: COLOURS.primary, backgroundColor: COLOURS.background, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  form:           { flex: 1, padding: 16 },
  formTitle:      { fontSize: 18, fontWeight: "700", color: COLOURS.primary, marginBottom: 16 },
  fieldRow:       { marginBottom: 12 },
  fieldLabel:     { fontSize: 12, fontWeight: "600", color: COLOURS.primary, marginBottom: 4 },
  fieldInput: {
    borderWidth: 1.5, borderColor: COLOURS.border, borderRadius: 10,
    padding: 11, fontSize: 14, color: COLOURS.primary, backgroundColor: COLOURS.white,
  },
  multiline:      { minHeight: 70, textAlignVertical: "top" },
  twoCol:         { flexDirection: "row" },
  formButtons:    { flexDirection: "row", marginTop: 8 },
  loadTypeRow:    { flexDirection: "row", gap: 6, marginBottom: 14, flexWrap: "wrap" },
  loadTypeBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1.5, borderColor: COLOURS.border, backgroundColor: COLOURS.white,
  },
  loadTypeBtnActive:    { backgroundColor: COLOURS.primary, borderColor: COLOURS.primary },
  loadTypeBtnText:      { fontSize: 13, fontWeight: "600", color: COLOURS.primary },
  loadTypeBtnTextActive:{ color: COLOURS.white },
  bottomNav: {
    flexDirection: "row", padding: 16, backgroundColor: COLOURS.white,
    borderTopWidth: 1, borderTopColor: COLOURS.border,
  },
});
