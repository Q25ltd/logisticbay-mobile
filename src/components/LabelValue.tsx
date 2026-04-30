import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLOURS } from "../theme";

interface LabelValueProps {
  label: string;
  value: string;
}

export function LabelValue({ label, value }: LabelValueProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || "—"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  label: {
    fontSize:      11,
    color:         COLOURS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom:  2,
  },
  value: {
    fontSize:   15,
    fontWeight: "600",
    color:      COLOURS.primary,
  },
});
