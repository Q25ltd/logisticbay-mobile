import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// Colours
// ─────────────────────────────────────────────────────────────────────────────

export const COLOURS = {
  primary:    "#1a1a2e",
  accent:     "#e94560",
  pass:       "#16a34a",
  fail:       "#dc2626",
  muted:      "#6b7280",
  border:     "#e5e7eb",
  background: "#f9fafb",
  white:      "#ffffff",
  warning:    "#f59e0b",
};

// ─────────────────────────────────────────────────────────────────────────────
// Button
// ─────────────────────────────────────────────────────────────────────────────

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

  const textColour =
    variant === "ghost" ? COLOURS.primary : COLOURS.white;

  const border =
    variant === "ghost" ? { borderWidth: 1.5, borderColor: COLOURS.primary } : {};

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.button, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }, border, style]}
      activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator color={textColour} />
        : <Text style={[styles.buttonText, { color: textColour }]}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────────────────────────────────────

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.card, style]}>{children}</View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section header
// ─────────────────────────────────────────────────────────────────────────────

export function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Label + value row
// ─────────────────────────────────────────────────────────────────────────────

export function LabelValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.labelValue}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || "—"}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge
// ─────────────────────────────────────────────────────────────────────────────

export function Badge({ ok }: { ok: boolean }) {
  return (
    <View style={[styles.badge, { backgroundColor: ok ? COLOURS.pass : COLOURS.fail }]}>
      <Text style={styles.badgeText}>{ok ? "PASS" : "FAIL"}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  button: {
    paddingVertical:   14,
    paddingHorizontal: 24,
    borderRadius:      10,
    alignItems:        "center",
    justifyContent:    "center",
  },
  buttonText: {
    fontSize:   16,
    fontWeight: "700",
  },
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
  sectionHeader: {
    backgroundColor: COLOURS.primary,
    paddingVertical:   8,
    paddingHorizontal: 16,
    marginBottom:      2,
    borderRadius:      6,
  },
  sectionHeaderText: {
    color:      COLOURS.white,
    fontWeight: "700",
    fontSize:   12,
    letterSpacing: 1,
  },
  labelValue: {
    marginBottom: 12,
  },
  label: {
    fontSize:  11,
    color:     COLOURS.muted,
    textTransform: "uppercase",
    letterSpacing:  0.5,
    marginBottom:   2,
  },
  value: {
    fontSize:   15,
    fontWeight: "600",
    color:      COLOURS.primary,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical:    4,
    borderRadius:       4,
  },
  badgeText: {
    color:      COLOURS.white,
    fontSize:   11,
    fontWeight: "700",
  },
});

export function AppFooter() {
  return (
    <View style={{ paddingVertical: 6, alignItems: "center" }}>
      <Text style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 0.5 }}>
        LogisticBay · Q25 Ltd
      </Text>
    </View>
  );
}
