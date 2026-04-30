import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLOURS } from "../theme";

/** Pass/fail badge for vehicle check results. */
export function Badge({ ok }: { ok: boolean }) {
  return (
    <View style={[styles.badge, { backgroundColor: ok ? COLOURS.pass : COLOURS.fail }]}>
      <Text style={styles.text}>{ok ? "PASS" : "FAIL"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  text:  { color: COLOURS.white, fontSize: 11, fontWeight: "700" },
});
