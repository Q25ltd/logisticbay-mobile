import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, Alert,
} from "react-native";
import { Button, Card } from "../components";
import { COLOURS } from "../theme";
import { useShift } from "../ShiftContext";
import { type Segment, type CheckEntry } from "../ShiftContext";
import { api } from "../api";
import { clearPersistedDraft } from "../ShiftContext";
import { shiftSharedStyles } from "./shiftShared";
import type { ReviewScreenProps } from "../navigation/types";

export function ReviewScreen({ navigation }: ReviewScreenProps) {
  const { draft, resetDraft } = useShift();
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const submitLock = useRef(false);

  const allChecks    = draft.segments.flatMap(s => [...s.truckChecks, ...s.trailerChecks]);
  const hasDefects   = allChecks.some((c: CheckEntry) => c.result === "fail");
  const failedChecks = allChecks.filter((c: CheckEntry) => c.result === "fail");

  const totalMileage = draft.segments.reduce((sum, s: Segment) => {
    if (s.odometerEnd && s.odometerStart) {
      const diff = parseInt(s.odometerEnd) - parseInt(s.odometerStart);
      return diff > 0 ? sum + diff : sum;
    }
    return sum;
  }, 0);
  const totalJobs = draft.segments.reduce((sum, s: Segment) => sum + s.deliveries.length, 0);

  const startTime   = draft.startTime   ?? "";
  const finishTime  = draft.finishTime  ?? "";
  const totalHours  = draft.totalHours  ?? "";
  const breakMins   = draft.breakMins   ?? 0;
  const fuelDrawn   = draft.fuelDrawn   ?? "";
  const adBlueDrawn = draft.adBlueDrawn ?? "";

  async function handleSubmit() {
    if (submitLock.current) return;
    if (!draft.shiftId) { Alert.alert("Shift ID missing — please restart the app"); return; }

    submitLock.current = true;
    setSubmitting(true);
    try {
      for (const seg of draft.segments) {
        const segRes = await api.post(`/shifts/${draft.shiftId}/segments`, {
          truckReg:          seg.truckReg,
          trailerReg:        seg.hasTrailer ? seg.trailerReg : null,
          odometerStart:     seg.odometerStart ? parseInt(seg.odometerStart) : null,
          truckChecks:       seg.needsTruckCheck   ? seg.truckChecks   : [],
          trailerChecks:     seg.needsTrailerCheck ? seg.trailerChecks : null,
          prevOdometerEnd:   seg.odometerEnd ? parseInt(seg.odometerEnd) : undefined,
          vehicleClass:      seg.vehicleClass,
          needsTruckCheck:   seg.needsTruckCheck,
          needsTrailerCheck: seg.needsTrailerCheck,
        });

        const segmentId = segRes.data.segmentId;
        for (const d of seg.deliveries) {
          await api.post(`/shifts/${draft.shiftId}/segments/${segmentId}/deliveries`, {
            materials: d.materials, collectFrom: d.collectFrom, deliverTo: d.deliverTo,
            ticketNo: d.ticketNo, startTime: d.startTime, finishTime: d.finishTime,
            hours: d.hours, loadType: d.loadType ?? "weight", pallets: d.pallets ?? "",
            tonnes: d.tonnes, kgs: d.kgs, notes: d.notes,
          });
        }
      }

      const lastSeg = draft.segments[draft.segments.length - 1];
      await api.patch(`/shifts/${draft.shiftId}/submit`, {
        odometerEnd:  lastSeg.odometerEnd ? parseInt(lastSeg.odometerEnd) : undefined,
        segmentNotes: lastSeg.notes,
        nightOut:     draft.nightOut,
        expenses:     draft.expenses,
        delaysNote:   draft.delaysNote,
        defectsNote:  draft.defectsNote,
        fuelDrawn, adBlueDrawn,
        endTime:      finishTime,
        totalHours,
        breakMins:    String(breakMins),
      });

      await clearPersistedDraft();
      resetDraft();
      setSubmitted(true);

      Alert.alert(
        "✅ Shift Submitted",
        "Your report has been sent to the office by email with a full PDF attached.",
        [{ text: "Done", onPress: () => navigation.navigate("Home") }],
      );
    } catch (err: unknown) {
      submitLock.current = false;
      const apiErr = err as any;
      const msg = apiErr?.response?.data?.details?.join("\n")
        ?? apiErr?.response?.data?.error
        ?? "Submission failed — check your connection";
      Alert.alert("Submission failed", msg + "\n\nYour data is safe — tap Submit to try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={shiftSharedStyles.container}>
      <View style={shiftSharedStyles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} disabled={submitting}>
          <Text style={shiftSharedStyles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={shiftSharedStyles.topTitle}>Review & Submit</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={shiftSharedStyles.scroll}>

        {hasDefects && (
          <View style={styles.defectBanner}>
            <Text style={styles.defectTitle}>
              ⚠ {failedChecks.length} Defect{failedChecks.length > 1 ? "s" : ""} Recorded
            </Text>
            {failedChecks.slice(0, 3).map((c: CheckEntry) => (
              <Text key={c.key} style={styles.defectItem}>
                • {c.label}{c.note ? `: ${c.note}` : ""}
              </Text>
            ))}
            {failedChecks.length > 3 && (
              <Text style={styles.defectItem}>+ {failedChecks.length - 3} more — see full PDF</Text>
            )}
            <Text style={styles.defectNote}>These will be flagged in the report sent to your office.</Text>
          </View>
        )}

        <Card style={{ margin: 16, marginBottom: 8 }}>
          <Text style={styles.sectionLabel}>Hours Today</Text>
          <View style={styles.hoursGrid}>
            {[
              { label: "Start",      value: startTime  || "—" },
              { label: "Finish",     value: finishTime || "—" },
              { label: "Break",      value: breakMins > 0 ? `${breakMins}m` : "None" },
              { label: "Paid Hours", value: totalHours || "—", primary: true },
            ].map(item => (
              <View
                key={item.label}
                style={[
                  styles.hoursGridItem,
                  item.primary && { backgroundColor: COLOURS.primary, borderRadius: 8, padding: 10 },
                ]}
              >
                <Text style={[styles.hoursGridLabel, item.primary && { color: "rgba(255,255,255,0.6)" }]}>
                  {item.label}
                </Text>
                <Text style={[
                  styles.hoursGridValue,
                  item.primary && { color: COLOURS.accent, fontSize: 22 },
                ]}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.legalInfoText}>UK/EU: max 48h avg/week · max 60h any single week · min 11h rest</Text>
        </Card>

        <Card style={{ marginHorizontal: 16, marginBottom: 8 }}>
          <Text style={styles.sectionLabel}>Shift Summary</Text>
          <Text style={styles.summaryRow}>
            📅 {new Date(draft.shiftDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </Text>
          <Text style={styles.summaryRow}>
            📍 {totalMileage.toLocaleString()} km total · {draft.segments.length} segment{draft.segments.length !== 1 ? "s" : ""} · {totalJobs} job{totalJobs !== 1 ? "s" : ""}
          </Text>
          <Text style={styles.summaryRow}>
            ✅ Checks:{" "}
            <Text style={{ color: hasDefects ? COLOURS.fail : COLOURS.pass, fontWeight: "700" }}>
              {hasDefects ? `${failedChecks.length} defect${failedChecks.length > 1 ? "s" : ""}` : "All passed"}
            </Text>
          </Text>
          {fuelDrawn   ? <Text style={styles.summaryRow}>⛽ Fuel: {fuelDrawn}</Text>   : null}
          {adBlueDrawn ? <Text style={styles.summaryRow}>🔵 AdBlue: {adBlueDrawn}</Text> : null}
          {draft.nightOut && <Text style={styles.summaryRow}>🌙 Night out</Text>}
        </Card>

        {draft.segments.map((seg, i) => (
          <Card key={seg.id} style={{ marginHorizontal: 16, marginBottom: 8 }}>
            <Text style={styles.sectionLabel}>
              Segment {i + 1} — {seg.vehicleClass === "van" ? "🚐 Van" : seg.vehicleClass === "class2" ? "🚚 Rigid" : "🚛 Artic"}
            </Text>
            <Text style={styles.summaryRow}>
              {seg.truckReg}{seg.hasTrailer ? `  +  ${seg.trailerReg}` : ""}
            </Text>
            {seg.odometerEnd && (
              <Text style={styles.summaryRow}>
                {parseInt(seg.odometerEnd) - parseInt(seg.odometerStart)} km
                ({seg.odometerStart} → {seg.odometerEnd})
              </Text>
            )}
            {!seg.needsTruckCheck    && <Text style={styles.skippedNote}>Truck check not repeated — unchanged</Text>}
            {!seg.needsTrailerCheck  && seg.hasTrailer && <Text style={styles.skippedNote}>Trailer check not repeated — unchanged</Text>}
            <Text style={styles.summaryRow}>{seg.deliveries.length} job{seg.deliveries.length !== 1 ? "s" : ""}</Text>
          </Card>
        ))}

        {draft.delaysNote ? (
          <Card style={{ marginHorizontal: 16, marginBottom: 8 }}>
            <Text style={styles.sectionLabel}>Delays</Text>
            <Text style={styles.summaryRow}>{draft.delaysNote}</Text>
          </Card>
        ) : null}

        {draft.expenses ? (
          <Card style={{ marginHorizontal: 16, marginBottom: 8 }}>
            <Text style={styles.sectionLabel}>Expenses</Text>
            <Text style={styles.summaryRow}>{draft.expenses}</Text>
          </Card>
        ) : null}

        <View style={{ height: 20 }} />
      </ScrollView>

      <View style={shiftSharedStyles.bottomNav}>
        <Button
          label={submitting ? "Submitting..." : "Submit Shift Report"}
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting || submitted}
          style={{ backgroundColor: hasDefects ? COLOURS.fail : COLOURS.pass }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  defectBanner: {
    margin: 16, backgroundColor: "#fef2f2", borderRadius: 10,
    padding: 16, borderLeftWidth: 3, borderLeftColor: COLOURS.fail,
  },
  defectTitle: { color: COLOURS.fail, fontWeight: "700", fontSize: 14, marginBottom: 8 },
  defectItem:  { color: "#7f1d1d", fontSize: 12, marginBottom: 4 },
  defectNote:  { color: COLOURS.fail, fontSize: 11, marginTop: 8, fontStyle: "italic" },
  sectionLabel:  { fontSize: 10, color: COLOURS.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  summaryRow:    { fontSize: 14, color: COLOURS.primary, marginBottom: 6 },
  skippedNote:   { fontSize: 11, color: COLOURS.muted, fontStyle: "italic", marginBottom: 4 },
  legalInfoText: { fontSize: 11, color: "#1e40af", marginTop: 8 },
  hoursGrid:     { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  hoursGridItem: { flex: 1, minWidth: "45%", alignItems: "center", padding: 10, backgroundColor: COLOURS.background, borderRadius: 8 },
  hoursGridLabel:{ fontSize: 10, color: COLOURS.muted, textTransform: "uppercase", marginBottom: 4 },
  hoursGridValue:{ fontSize: 17, fontWeight: "800", color: COLOURS.primary },
});

export default ReviewScreen;
