import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, SafeAreaView,
  TouchableOpacity, ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api";
import { COLOURS, Card } from "../components";

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

export default function JobsScreen({ navigation }: { navigation: any }) {
  const [jobs,    setJobs]    = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(refresh = false) {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.get("/jobs/my");
      setJobs(res.data.data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }

  useFocusEffect(useCallback(() => {
    load();
    // Poll every 30 seconds
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []));

  if (loading) return (
    <SafeAreaView style={styles.center}>
      <ActivityIndicator size="large" color={COLOURS.primary} />
    </SafeAreaView>
  );

  const pending   = jobs.filter(j => j.status === "pending"   || j.status === "accepted").length;
  const active    = jobs.filter(j => j.status === "in_progress" || j.status === "arrived_pickup").length;
  const completed = jobs.filter(j => j.status === "completed").length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Today's Jobs</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{jobs.length}</Text>
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

      {jobs.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No jobs today</Text>
          <Text style={styles.emptySub}>Your planner will assign jobs here</Text>
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => navigation.navigate("JobDetail", { jobId: item.id })}
              activeOpacity={0.7}
            >
              <Card style={styles.jobCard}>
                <View style={styles.jobHeader}>
                  <View style={[styles.statusDot, { backgroundColor: statusColour(item.status) }]} />
                  <Text style={[styles.statusText, { color: statusColour(item.status) }]}>
                    {statusLabel(item.status)}
                  </Text>
                </View>

                <Text style={styles.jobRoute}>
                  {item.pickupTextSnapshot || "—"}
                </Text>
                <Text style={styles.jobArrow}>↓</Text>
                <Text style={styles.jobRoute}>
                  {item.dropoffTextSnapshot || "—"}
                </Text>

                <View style={styles.jobMeta}>
                  {item.referenceNumber ? <Text style={styles.metaItem}>📋 {item.referenceNumber}</Text> : null}
                  {item.materialType    ? <Text style={styles.metaItem}>📦 {item.materialType}</Text>    : null}
                </View>

                {item.plannerNotes ? (
                  <Text style={styles.jobNotes}>💬 {item.plannerNotes}</Text>
                ) : null}

                <Text style={styles.tapHint}>Tap to view details →</Text>
              </Card>
            </TouchableOpacity>
          )}
        />
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
  topTitle:       { fontSize: 17, fontWeight: "700", color: COLOURS.primary },
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
  jobCard:        { marginBottom: 12 },
  jobHeader:      { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  statusDot:      { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText:     { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  jobRoute:       { fontSize: 15, fontWeight: "700", color: COLOURS.primary },
  jobArrow:       { fontSize: 16, color: COLOURS.muted, marginVertical: 2, marginLeft: 4 },
  jobMeta:        { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  metaItem:       { fontSize: 12, color: COLOURS.muted },
  jobNotes:       { fontSize: 12, color: COLOURS.muted, marginTop: 6, fontStyle: "italic" },
  tapHint:        { fontSize: 11, color: COLOURS.muted, marginTop: 8, fontStyle: "italic" },
});
