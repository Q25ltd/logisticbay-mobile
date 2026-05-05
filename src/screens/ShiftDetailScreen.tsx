import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from "../api";
import { COLOURS, Card } from "../components";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

function ResultBadge({ result, ok }: { result?: string; ok?: boolean }) {
  const r = result ?? (ok === false ? "fail" : "pass");
  const bg = r === "pass" ? COLOURS.pass : r === "na" ? "#9ca3af" : COLOURS.fail;
  return (
    <View style={[badge.box, { backgroundColor: bg }]}>
      <Text style={badge.text}>{r === "pass" ? "PASS" : r === "na" ? "N/A" : "FAIL"}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  box:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  text: { color: "#fff", fontSize: 10, fontWeight: "700" },
});

export default function ShiftDetailScreen({ navigation, route }: { navigation: any; route: any }) {
  const { shiftId } = route.params;
  const [shift,   setShift]   = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/shifts/${shiftId}`)
      .then(res => setShift(res.data))
      .catch(() => Alert.alert("Error", "Could not load shift details"))
      .finally(() => setLoading(false));
  }, [shiftId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={COLOURS.primary} />
      </SafeAreaView>
    );
  }

  if (!shift) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ color: COLOURS.muted }}>Shift not found</Text>
      </SafeAreaView>
    );
  }

  const segments     = shift.segments ?? [];
  const isSpareShift = segments.length === 0;
  const allChecks    = segments.flatMap((s: any) => [...(s.truckChecks ?? []), ...(s.trailerChecks ?? [])]);
  const hasDefects   = allChecks.some((c: any) => c.result === "fail" || c.ok === false);
  const totalMileage = (shift.segments ?? []).reduce((sum: number, s: any) => {
    if (s.odometerEnd && s.odometerStart && s.odometerEnd > s.odometerStart) {
      return sum + (s.odometerEnd - s.odometerStart);
    }
    return sum;
  }, 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Shift Details</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        {isSpareShift && (
          <View style={styles.spareBanner}>
            <Text style={styles.spareTitle}>Spare / standby shift</Text>
            <Text style={styles.spareText}>No vehicle was assigned, so no walkaround check was required.</Text>
          </View>
        )}

        {hasDefects && (
          <View style={styles.defectBanner}>
            <Text style={styles.defectTitle}>⚠ Defects were recorded on this shift</Text>
          </View>
        )}

        {/* Hours summary */}
        <View style={styles.hoursBar}>
          {[
            { label: "Start",    value: shift.startTime  || "—" },
            { label: "Finish",   value: shift.endTime    || "—" },
            { label: "Break",    value: shift.breakMins && parseInt(shift.breakMins) > 0 ? `${shift.breakMins}m` : "None" },
            { label: isSpareShift ? "Paid Hrs" : "Working Hrs", value: shift.totalHours || "—", accent: true },
          ].map((item, i, arr) => (
            <React.Fragment key={item.label}>
              <View style={styles.hoursBarItem}>
                <Text style={styles.hoursBarLabel}>{item.label}</Text>
                <Text style={[styles.hoursBarValue, (item as any).accent && { color: COLOURS.accent }]}>
                  {item.value}
                </Text>
              </View>
              {i < arr.length - 1 && <View style={styles.hoursBarDivider} />}
            </React.Fragment>
          ))}
        </View>

        {/* Shift info */}
        <Card style={{ marginBottom: 12 }}>
          <Text style={styles.sectionLabel}>Shift Summary</Text>
          <Text style={styles.row}>📅 {fmtDate(shift.shiftDate)}</Text>
          <Text style={styles.row}>👤 {shift.driver?.name ?? shift.driverName}</Text>
          <Text style={styles.row}>📍 Total mileage: <Text style={styles.bold}>{totalMileage > 0 ? totalMileage.toLocaleString() + " km" : "—"}</Text></Text>
          <Text style={styles.row}>✅ Checks: <Text style={{ color: isSpareShift ? COLOURS.muted : hasDefects ? COLOURS.fail : COLOURS.pass, fontWeight: "700" }}>{isSpareShift ? "No vehicle check required" : hasDefects ? "Defects recorded" : "All passed"}</Text></Text>
          {shift.fuelDrawn   ? <Text style={styles.row}>⛽ Fuel: {shift.fuelDrawn}</Text>   : null}
          {shift.adBlueDrawn ? <Text style={styles.row}>🔵 AdBlue: {shift.adBlueDrawn}</Text> : null}
          {shift.nightOut    ? <Text style={styles.row}>🌙 Night out</Text>                   : null}
          {shift.expenses    ? <Text style={styles.row}>💰 Expenses: {shift.expenses}</Text>  : null}
          {shift.delaysNote  ? <Text style={styles.row}>⏱ Delays: {shift.delaysNote}</Text>  : null}
          {shift.defectsNote ? <Text style={[styles.row, { color: COLOURS.fail }]}>⚠ Defects: {shift.defectsNote}</Text> : null}
        </Card>

        {/* Segments */}
        {(shift.segments ?? []).map((seg: any, i: number) => {
          const segMileage = seg.odometerEnd && seg.odometerStart && seg.odometerEnd > seg.odometerStart
            ? (seg.odometerEnd - seg.odometerStart).toLocaleString() + " km"
            : "—";
          const vehicleLabel =
            seg.vehicleClass === "class2" ? "Rigid" :
            seg.vehicleClass === "van"    ? "Van" :
            seg.trailerReg ? "" : "Solo";

          return (
            <Card key={seg.id} style={{ marginBottom: 12 }}>
              <Text style={styles.sectionLabel}>
                Segment {i + 1} — {seg.truckReg}
                {seg.trailerReg ? ` + ${seg.trailerReg}` : vehicleLabel ? ` (${vehicleLabel})` : ""}
              </Text>
              <Text style={styles.row}>Odometer: {seg.odometerStart?.toLocaleString()} → {seg.odometerEnd?.toLocaleString() ?? "—"} km</Text>
              <Text style={styles.row}>Segment mileage: <Text style={styles.bold}>{segMileage}</Text></Text>

              {/* Truck checks */}
              {(seg.truckChecks ?? []).length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, { marginTop: 10 }]}>
                    {seg.vehicleClass === "van" ? "Van" : seg.vehicleClass === "class2" ? "Rigid HGV" : "Truck"} Checks
                  </Text>
                  {(seg.truckChecks ?? []).map((c: any) => (
                    <View key={c.key} style={styles.checkRow}>
                      <Text style={styles.checkLabel}>{c.label}</Text>
                      <ResultBadge result={c.result} ok={c.ok} />
                    </View>
                  ))}
                </>
              )}

              {/* Trailer checks */}
              {(seg.trailerChecks ?? []).length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, { marginTop: 10 }]}>Trailer Checks</Text>
                  {(seg.trailerChecks ?? []).map((c: any) => (
                    <View key={c.key} style={styles.checkRow}>
                      <Text style={styles.checkLabel}>{c.label}</Text>
                      <ResultBadge result={c.result} ok={c.ok} />
                    </View>
                  ))}
                </>
              )}

              {/* Deliveries */}
              {(seg.deliveries ?? []).length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, { marginTop: 10 }]}>Jobs</Text>
                  {(seg.deliveries ?? []).map((d: any, di: number) => (
                    <View key={d.id} style={[styles.deliveryRow, di % 2 === 0 && { backgroundColor: COLOURS.background }]}>
                      <Text style={styles.bold}>{d.materials || "Job " + (di + 1)}</Text>
                      {d.collectFrom ? <Text style={styles.deliverySub}>From: {d.collectFrom}</Text> : null}
                      {d.deliverTo   ? <Text style={styles.deliverySub}>To: {d.deliverTo}</Text>     : null}
                      {d.ticketNo    ? <Text style={styles.deliverySub}>Ref: {d.ticketNo}</Text>     : null}
                      {d.loadType === "pallets" && d.pallets ? <Text style={styles.deliverySub}>📦 {d.pallets} pallets</Text> : null}
                      {d.loadType === "weight" && d.tonnes ? <Text style={styles.deliverySub}>⚖️ {d.tonnes}t{d.kgs ? ` / ${d.kgs}kg` : ""}</Text> : null}
                      {d.startTime ? <Text style={styles.deliverySub}>⏱ {d.startTime} – {d.finishTime}</Text> : null}
                    </View>
                  ))}
                </>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: COLOURS.background },
  center:           { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLOURS.white,
    borderBottomWidth: 1, borderBottomColor: COLOURS.border,
  },
  backText:         { color: COLOURS.accent, fontSize: 15, fontWeight: "600" },
  topTitle:         { fontSize: 17, fontWeight: "700", color: COLOURS.primary },
  scroll:           { flex: 1 },
  defectBanner: {
    backgroundColor: "#fef2f2", borderLeftWidth: 3, borderLeftColor: COLOURS.fail,
    padding: 12, borderRadius: 8, marginBottom: 12,
  },
  defectTitle:      { color: COLOURS.fail, fontWeight: "700", fontSize: 14 },
  spareBanner: {
    backgroundColor: "#eff6ff", borderLeftWidth: 3, borderLeftColor: COLOURS.accent,
    padding: 12, borderRadius: 8, marginBottom: 12,
  },
  spareTitle:       { color: COLOURS.primary, fontWeight: "700", fontSize: 14 },
  spareText:        { color: COLOURS.muted, fontSize: 13, marginTop: 4 },
  hoursBar: {
    flexDirection: "row", backgroundColor: COLOURS.primary,
    borderRadius: 12, padding: 14, marginBottom: 12,
  },
  hoursBarItem:     { flex: 1, alignItems: "center" },
  hoursBarLabel:    { color: "rgba(255,255,255,0.6)", fontSize: 9, textTransform: "uppercase", marginBottom: 4 },
  hoursBarValue:    { color: COLOURS.white, fontSize: 14, fontWeight: "800" },
  hoursBarDivider:  { width: 1, backgroundColor: "rgba(255,255,255,0.15)", marginHorizontal: 4 },
  sectionLabel:     { fontSize: 10, color: COLOURS.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  row:              { fontSize: 14, color: COLOURS.primary, marginBottom: 6 },
  bold:             { fontWeight: "700" },
  checkRow:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLOURS.border },
  checkLabel:       { fontSize: 12, color: COLOURS.primary, flex: 1, paddingRight: 8 },
  deliveryRow:      { padding: 10, borderRadius: 6, marginBottom: 4 },
  deliverySub:      { fontSize: 12, color: COLOURS.muted, marginTop: 2 },
});
