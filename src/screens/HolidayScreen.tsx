import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, ActivityIndicator, Alert, TextInput,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api";
import { COLOURS, Button, Card } from "../components";

const STATUS_COLOURS: Record<string,string> = {
  pending:  "#f59e0b",
  approved: COLOURS.pass,
  rejected: COLOURS.fail,
};

const REASONS = ["Annual leave", "Family / personal", "Medical", "Other"];

export default function HolidayScreen({ navigation }: { navigation: any }) {
  const [data,       setData]       = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [startDate, setStartDate] = useState("");
  const [endDate,   setEndDate]   = useState("");
  const [reason,    setReason]    = useState("");
  const [note,      setNote]      = useState("");

  async function load() {
    try {
      const res = await api.get("/holiday-requests/my");
      setData(res.data);
    } catch {}
    setLoading(false);
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function handleSubmit() {
    if (!startDate || !endDate) {
      Alert.alert("Required", "Please enter start and end dates");
      return;
    }
    if (!reason) {
      Alert.alert("Required", "Please select a reason");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/holiday-requests", { startDate, endDate, reason, note });
      Alert.alert("✅ Request submitted", "Your holiday request has been sent to your planner for approval.");
      setShowForm(false);
      setStartDate(""); setEndDate(""); setReason(""); setNote("");
      await load();
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.error ?? "Could not submit request");
    }
    setSubmitting(false);
  }

  if (loading) return (
    <SafeAreaView style={styles.center}>
      <ActivityIndicator size="large" color={COLOURS.primary} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Holiday Requests</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

        {/* Allowance summary */}
        {data && (
          <Card style={{ marginBottom: 12 }}>
            <Text style={styles.sectionLabel}>Holiday Allowance</Text>
            <View style={styles.allowanceRow}>
              <View style={styles.allowanceStat}>
                <Text style={styles.allowanceValue}>{data.holidayAllowance}</Text>
                <Text style={styles.allowanceLabel}>Total Days</Text>
              </View>
              <View style={styles.allowanceDivider} />
              <View style={styles.allowanceStat}>
                <Text style={[styles.allowanceValue, { color: COLOURS.fail }]}>{data.holidayUsed}</Text>
                <Text style={styles.allowanceLabel}>Used</Text>
              </View>
              <View style={styles.allowanceDivider} />
              <View style={styles.allowanceStat}>
                <Text style={[styles.allowanceValue, { color: COLOURS.pass }]}>{data.holidayRemaining}</Text>
                <Text style={styles.allowanceLabel}>Remaining</Text>
              </View>
            </View>
            <Text style={styles.maxNote}>
              Max {data.maxPerDay} driver{data.maxPerDay !== 1 ? "s" : ""} on holiday per day
            </Text>
          </Card>
        )}

        {/* Request form */}
        {showForm ? (
          <Card style={{ marginBottom: 12 }}>
            <Text style={styles.sectionLabel}>New Holiday Request</Text>

            <Text style={styles.fieldLabel}>Start Date</Text>
            <TextInput
              style={styles.input}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD e.g. 2026-05-01"
              placeholderTextColor={COLOURS.muted}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.fieldLabel}>End Date</Text>
            <TextInput
              style={styles.input}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD e.g. 2026-05-05"
              placeholderTextColor={COLOURS.muted}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.fieldLabel}>Reason</Text>
            {REASONS.map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.reasonBtn, reason === r && styles.reasonBtnActive]}
                onPress={() => setReason(r)}
              >
                <Text style={[styles.reasonBtnText, reason === r && styles.reasonBtnTextActive]}>{r}</Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.fieldLabel}>Note <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={[styles.input, { minHeight: 60 }]}
              value={note}
              onChangeText={setNote}
              placeholder="Any additional information..."
              placeholderTextColor={COLOURS.muted}
              multiline
            />

            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <Button
                label={submitting ? "Submitting..." : "Submit Request"}
                onPress={handleSubmit}
                loading={submitting}
                style={{ flex: 1, backgroundColor: COLOURS.primary }}
              />
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowForm(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ) : (
          <TouchableOpacity
            style={styles.requestBtn}
            onPress={() => setShowForm(true)}
          >
            <Text style={styles.requestBtnText}>+ Request Holiday</Text>
          </TouchableOpacity>
        )}

        {/* Requests list */}
        <Text style={styles.sectionLabel}>Your Requests</Text>
        {!data?.data?.length ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏖️</Text>
            <Text style={styles.emptyText}>No holiday requests yet</Text>
          </View>
        ) : (
          data.data.map((r: any) => (
            <Card key={r.id} style={{ marginBottom: 10 }}>
              <View style={styles.requestHeader}>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOURS[r.status] + "20" }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLOURS[r.status] }]}>
                    {r.status.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.requestDays}>{r.totalDays} day{r.totalDays !== 1 ? "s" : ""}</Text>
              </View>
              <Text style={styles.requestDates}>
                {new Date(r.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                {" → "}
                {new Date(r.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </Text>
              <Text style={styles.requestReason}>{r.reason}</Text>
              {r.plannerNote ? (
                <View style={styles.plannerNote}>
                  <Text style={styles.plannerNoteText}>💬 {r.plannerNote}</Text>
                </View>
              ) : null}
              <Text style={styles.requestDate}>
                Submitted {new Date(r.createdAt).toLocaleDateString("en-GB")}
              </Text>
            </Card>
          ))
        )}
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
  sectionLabel:     { fontSize: 10, color: COLOURS.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  allowanceRow:     { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  allowanceStat:    { flex: 1, alignItems: "center" },
  allowanceValue:   { fontSize: 28, fontWeight: "900", color: COLOURS.primary },
  allowanceLabel:   { fontSize: 10, color: COLOURS.muted, textTransform: "uppercase" },
  allowanceDivider: { width: 1, height: 40, backgroundColor: COLOURS.border },
  maxNote:          { fontSize: 11, color: COLOURS.muted, textAlign: "center", fontStyle: "italic" },
  requestBtn: {
    borderWidth: 1.5, borderColor: COLOURS.primary, borderRadius: 10,
    padding: 14, alignItems: "center", marginBottom: 16, borderStyle: "dashed",
  },
  requestBtnText:   { fontSize: 14, fontWeight: "700", color: COLOURS.primary },
  fieldLabel:       { fontSize: 12, fontWeight: "600", color: COLOURS.primary, marginBottom: 4, marginTop: 8 },
  input: {
    borderWidth: 1.5, borderColor: COLOURS.border, borderRadius: 8,
    padding: 12, fontSize: 14, color: COLOURS.primary, marginBottom: 4,
  },
  reasonBtn: {
    padding: 10, borderRadius: 8, borderWidth: 1.5,
    borderColor: COLOURS.border, marginBottom: 6,
  },
  reasonBtnActive:     { backgroundColor: COLOURS.primary, borderColor: COLOURS.primary },
  reasonBtnText:       { fontSize: 13, color: COLOURS.muted, fontWeight: "600" },
  reasonBtnTextActive: { color: COLOURS.white },
  optional:            { fontWeight: "400", color: COLOURS.muted },
  cancelBtn: {
    borderWidth: 1.5, borderColor: COLOURS.border, borderRadius: 8,
    padding: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 20,
  },
  cancelBtnText:    { color: COLOURS.muted, fontWeight: "600" },
  emptyState:       { alignItems: "center", paddingVertical: 32 },
  emptyIcon:        { fontSize: 40, marginBottom: 8 },
  emptyText:        { fontSize: 14, color: COLOURS.muted },
  requestHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  statusBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText:       { fontSize: 10, fontWeight: "700" },
  requestDays:      { fontSize: 13, fontWeight: "700", color: COLOURS.primary },
  requestDates:     { fontSize: 14, fontWeight: "600", color: COLOURS.primary, marginBottom: 2 },
  requestReason:    { fontSize: 12, color: COLOURS.muted, marginBottom: 4 },
  plannerNote:      { backgroundColor: "#eff6ff", borderRadius: 6, padding: 8, marginBottom: 4 },
  plannerNoteText:  { fontSize: 12, color: "#1e40af" },
  requestDate:      { fontSize: 11, color: COLOURS.muted },
});
