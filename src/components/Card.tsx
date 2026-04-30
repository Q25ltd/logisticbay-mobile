import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { COLOURS } from "../theme";

interface CardProps {
  children: React.ReactNode;
  style?:   ViewStyle;
}

export function Card({ children, style }: CardProps) {
  return (
    <View style={[styles.card, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLOURS.white,
    borderRadius:    12,
    padding:         16,
    marginBottom:    12,
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.06,
    shadowRadius:    4,
    elevation:       2,
  },
});
