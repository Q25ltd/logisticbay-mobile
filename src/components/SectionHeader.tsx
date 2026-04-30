import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLOURS } from "../theme";

export function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.text}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor:   COLOURS.primary,
    paddingVertical:   8,
    paddingHorizontal: 16,
    marginBottom:      2,
    borderRadius:      6,
  },
  text: {
    color:         COLOURS.white,
    fontWeight:    "700",
    fontSize:      12,
    letterSpacing: 1,
  },
});
