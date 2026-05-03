import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Button } from "../../components";
import { COLOURS } from "../../theme";
import { jobDetailStyles as s } from "./jobDetailStyles";

interface ActionStep {
  label:       string;
  next:        string;
  colour:      string;
  description: string;
  needsForm?:  "collect" | "deliver";
}

interface JobActionBarProps {
  jobStatus:    string;
  action:       ActionStep | null;
  saving:       boolean;
  viewOnly:     boolean;
  onAction:     () => void;
  onStartShift: () => void;
  onBackToJobs: () => void;
}

export function JobActionBar({
  jobStatus, action, saving, viewOnly,
  onAction, onStartShift, onBackToJobs,
}: JobActionBarProps) {
  if (viewOnly && action) {
    return (
      <TouchableOpacity style={styles.noShiftBar} onPress={onStartShift} activeOpacity={0.8}>
        <Text style={styles.noShiftText}>🚛 Start a shift to update this job</Text>
        <Text style={styles.noShiftSub}>Tap here to begin your shift →</Text>
      </TouchableOpacity>
    );
  }

  if (action) {
    return (
      <View>
        <Text style={{ fontSize: 11, color: COLOURS.muted, textAlign: "center", marginBottom: 6 }}>
          {action.description}
        </Text>
        <Button
          label={saving ? "Updating..." : action.label}
          onPress={onAction}
          loading={saving}
          style={{ backgroundColor: action.colour }}
        />
      </View>
    );
  }

  if (jobStatus === "completed") {
    return (
      <View>
        <View style={styles.completedBar}>
          <Text style={styles.completedText}>✅ Job Delivered — well done!</Text>
        </View>
        <TouchableOpacity style={styles.nextJobBtn} onPress={onBackToJobs}>
          <Text style={styles.nextJobBtnText}>← Back to Jobs</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (jobStatus === "cancelled") {
    return (
      <View style={[styles.completedBar, { backgroundColor: "#f3f4f6" }]}>
        <Text style={[styles.completedText, { color: COLOURS.muted }]}>⛔ Job Cancelled</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  noShiftBar:       { backgroundColor: "#fff7ed", borderRadius: 10, padding: 16, alignItems: "center", borderWidth: 1.5, borderColor: "#f59e0b" },
  noShiftText:      { fontSize: 14, fontWeight: "700", color: "#92400e", marginBottom: 4 },
  noShiftSub:       { fontSize: 12, color: "#92400e", opacity: 0.7 },
  completedBar:     { backgroundColor: "#dcfce7", borderRadius: 10, padding: 16, alignItems: "center" },
  completedText:    { fontSize: 15, fontWeight: "700", color: "#14532d" },
  nextJobBtn:       { marginTop: 8, padding: 14, borderRadius: 10, backgroundColor: COLOURS.accent, alignItems: "center" },
  nextJobBtnText:   { fontSize: 14, fontWeight: "700", color: COLOURS.white },
});
