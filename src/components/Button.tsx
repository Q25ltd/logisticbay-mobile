import React from "react";
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle } from "react-native";
import { COLOURS } from "../theme";

interface ButtonProps {
  label:     string;
  onPress:   () => void;
  loading?:  boolean;
  disabled?: boolean;
  variant?:  "primary" | "danger" | "ghost";
  style?:    ViewStyle;
}

export function Button({ label, onPress, loading, disabled, variant = "primary", style }: ButtonProps) {
  const bg =
    variant === "danger" ? COLOURS.fail :
    variant === "ghost"  ? "transparent" :
    COLOURS.primary;

  const textColour = variant === "ghost" ? COLOURS.primary : COLOURS.white;
  const border     = variant === "ghost" ? { borderWidth: 1.5, borderColor: COLOURS.primary } : {};

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.button, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }, border, style]}
      activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator color={textColour} />
        : <Text style={[styles.text, { color: textColour }]}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical:   14,
    paddingHorizontal: 24,
    borderRadius:      10,
    alignItems:        "center",
    justifyContent:    "center",
  },
  text: {
    fontSize:   16,
    fontWeight: "700",
  },
});
