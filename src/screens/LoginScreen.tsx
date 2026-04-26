import React, { useState } from "react";
import {
  View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { COLOURS, Button } from "../components";
import { useAuth } from "../AuthContext";

export default function LoginScreen({ navigation }: { navigation: any }) {
  const { login } = useAuth();
  const [email,    setEmail]    = useState("");
  const [pin,      setPin]      = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPin,  setShowPin]  = useState(false);

  async function handleLogin() {
    if (!email.trim()) { Alert.alert("Email is required"); return; }
    if (!pin.trim())   { Alert.alert("PIN is required"); return; }

    setLoading(true);
    try {
      const mustChangePin = await login(
        email.toLowerCase().trim(),
        pin.trim(),
      );
      // Navigation happens automatically via AuthContext user state
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.inner}
      >
        <View style={styles.header}>
          <Text style={styles.logo}>Logistic<Text style={{ color: COLOURS.accent }}>Bay</Text></Text>
          <Text style={styles.subtitle}>Driver App — Sign in to continue</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="driver@company.com"
            placeholderTextColor={COLOURS.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
          />

          <Text style={styles.label}>PIN</Text>
          <View style={styles.pinRow}>
            <TextInput
              style={[styles.input, styles.pinInput]}
              value={pin}
              onChangeText={setPin}
              placeholder="••••••"
              placeholderTextColor={COLOURS.muted}
              keyboardType="numeric"
              maxLength={6}
              secureTextEntry={!showPin}
              textAlign="center"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity style={styles.showPin} onPress={() => setShowPin(s => !s)}>
              <Text style={styles.showPinText}>{showPin ? "Hide" : "Show"}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>Enter your 6-digit PIN</Text>
        </View>

        <Button
          label={loading ? "Signing in..." : "Sign In →"}
          onPress={handleLogin}
          loading={loading}
          style={styles.loginBtn}
        />

        <Text style={styles.footer}>
          Forgot your PIN? Ask your manager to reset it.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLOURS.background },
  inner:        { flex: 1, padding: 24, justifyContent: "center" },
  header:       { alignItems: "center", marginBottom: 32 },
  logo:         { fontSize: 32, fontWeight: "900", color: COLOURS.primary, marginBottom: 8 },
  subtitle:     { fontSize: 14, color: COLOURS.muted },
  card: {
    backgroundColor: COLOURS.white, borderRadius: 16, padding: 24,
    borderWidth: 1, borderColor: COLOURS.border, marginBottom: 16,
  },
  label:        { fontSize: 12, fontWeight: "700", color: COLOURS.primary, marginBottom: 6, textTransform: "uppercase" },
  input: {
    borderWidth: 1.5, borderColor: COLOURS.border, borderRadius: 10,
    padding: 14, fontSize: 16, color: COLOURS.primary, marginBottom: 4,
    backgroundColor: COLOURS.background,
  },
  pinRow:       { flexDirection: "row", alignItems: "center", gap: 8 },
  pinInput:     { flex: 1, fontSize: 24, fontWeight: "800", letterSpacing: 10 },
  showPin:      { paddingHorizontal: 12, paddingVertical: 14 },
  showPinText:  { color: COLOURS.accent, fontWeight: "600", fontSize: 13 },
  hint:         { fontSize: 11, color: COLOURS.muted, marginBottom: 8 },
  loginBtn:     { marginBottom: 16 },
  footer:       { textAlign: "center", fontSize: 12, color: COLOURS.muted, lineHeight: 18 },
});
