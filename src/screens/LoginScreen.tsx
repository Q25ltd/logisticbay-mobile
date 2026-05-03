import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet,
  TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { COLOURS, Button } from "../components";
import { useAuth } from "../AuthContext";
import type { LoginScreenProps } from "../navigation/types";

const SAVED_EMAIL_KEY = "savedEmail";
const SAVED_PIN_KEY   = "savedPin";
const BIO_ENABLED_KEY = "biometricEnabled";

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const { login } = useAuth();
  const [email,       setEmail]       = useState("");
  const [pin,         setPin]         = useState("");
  const [loading,     setLoading]     = useState(false);
  const [showPin,     setShowPin]     = useState(false);
  const [companies,   setCompanies]   = useState<any[]>([]);
  const [showPicker,  setShowPicker]  = useState(false);
  const [savedEmail,  setSavedEmail]  = useState("");
  const [savedPass,   setSavedPass]   = useState("");
  const [hasBiometric, setHasBiometric] = useState(false);
  const [bioEnabled,  setBioEnabled]  = useState(false);
  const [bioChecked,  setBioChecked]  = useState(false);

  useEffect(() => {
    checkBiometric();
  }, []);

  async function checkBiometric() {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled   = await LocalAuthentication.isEnrolledAsync();
      const enabled    = await SecureStore.getItemAsync(BIO_ENABLED_KEY);
      const savedEmail = await SecureStore.getItemAsync(SAVED_EMAIL_KEY);

      if (compatible && enrolled) {
        setHasBiometric(true);
        if (enabled === "true" && savedEmail) {
          setBioEnabled(true);
          setEmail(savedEmail);
          // Auto-trigger biometric on load
          setTimeout(() => handleBiometric(), 500);
        }
      }
    } catch {}
    setBioChecked(true);
  }

  async function handleBiometric() {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Sign in to LogisticBay",
        fallbackLabel: "Use PIN instead",
      });

      if (result.success) {
        const savedEmail = await SecureStore.getItemAsync(SAVED_EMAIL_KEY);
        const savedPin   = await SecureStore.getItemAsync(SAVED_PIN_KEY);
        if (savedEmail && savedPin) {
          setLoading(true);
          try {
            await login(savedEmail, savedPin);
          } catch {
            Alert.alert("Sign in failed", "Please sign in with your PIN.");
          } finally {
            setLoading(false);
          }
        }
      }
    } catch {}
  }

  async function handleLogin() {
    if (!email.trim()) { Alert.alert("Email is required"); return; }
    if (!pin.trim())   { Alert.alert("PIN is required"); return; }

    setLoading(true);
    try {
      const result = await login(email.toLowerCase().trim(), pin.trim());
      if (result !== true && result !== false && result?.requiresCompanySelection) {
        setSavedEmail(email.toLowerCase().trim());
        setSavedPass(pin.trim());
        setCompanies(result.companies);
        setShowPicker(true);
        setLoading(false);
        return;
      }

      // After successful login, offer to enable biometric
      if (hasBiometric && !bioEnabled) {
        Alert.alert(
          "Enable Face ID / Touch ID?",
          "Sign in faster next time with biometrics.",
          [
            { text: "Not now", style: "cancel" },
            {
              text: "Enable",
              onPress: async () => {
                await SecureStore.setItemAsync(SAVED_EMAIL_KEY, email.toLowerCase().trim());
                await SecureStore.setItemAsync(SAVED_PIN_KEY,   pin.trim());
                await SecureStore.setItemAsync(BIO_ENABLED_KEY, "true");
              },
            },
          ]
        );
      }
    } catch (err: any) {
      Alert.alert("Sign in failed", err.response?.data?.error ?? "Check your email and PIN");
    } finally {
      setLoading(false);
    }
  }

  if (!bioChecked) return null;

  // Company picker screen
  if (showPicker) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.inner}>
          <View style={styles.header}>
            <Text style={styles.logo}>Logistic<Text style={{ color: COLOURS.accent }}>Bay</Text></Text>
            <Text style={styles.subtitle}>Where are you working today?</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Select Company</Text>
            {companies.map((c: any) => (
              <TouchableOpacity
                key={c.companyId}
                style={styles.companyBtn}
                onPress={async () => {
                  setLoading(true);
                  try {
                    await login(savedEmail, savedPass, c.companyId);
                  } catch {
                    Alert.alert("Error", "Could not sign in to this company");
                  }
                  setLoading(false);
                }}
              >
                <View>
                  <Text style={styles.companyBtnName}>{c.companyName}</Text>
                  <Text style={styles.companyBtnRole}>{c.role.replace("_", " ")}</Text>
                </View>
                <Text style={styles.companyBtnArrow}>→</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={() => setShowPicker(false)}>
            <Text style={styles.disableBio}>← Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
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

        {/* Biometric button — shown if enabled */}
        {bioEnabled && (
          <TouchableOpacity style={styles.bioBtn} onPress={handleBiometric} disabled={loading}>
            <Text style={styles.bioIcon}>🔐</Text>
            <Text style={styles.bioBtnText}>Sign in with Face ID / Touch ID</Text>
            <Text style={styles.bioBtnSub}>or enter your PIN below</Text>
          </TouchableOpacity>
        )}

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

        {/* Disable biometric option */}
        {bioEnabled && (
          <TouchableOpacity onPress={async () => {
            await SecureStore.deleteItemAsync(BIO_ENABLED_KEY);
            await SecureStore.deleteItemAsync(SAVED_PIN_KEY);
            setBioEnabled(false);
            Alert.alert("Biometrics disabled", "You can re-enable after signing in.");
          }}>
            <Text style={styles.disableBio}>Disable Face ID / Touch ID</Text>
          </TouchableOpacity>
        )}

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
  header:       { alignItems: "center", marginBottom: 24 },
  logo:         { fontSize: 32, fontWeight: "900", color: COLOURS.primary, marginBottom: 8 },
  subtitle:     { fontSize: 14, color: COLOURS.muted },
  bioBtn: {
    backgroundColor: COLOURS.primary, borderRadius: 14, padding: 18,
    alignItems: "center", marginBottom: 20,
  },
  bioIcon:      { fontSize: 32, marginBottom: 6 },
  bioBtnText:   { fontSize: 16, fontWeight: "700", color: COLOURS.white, marginBottom: 2 },
  bioBtnSub:    { fontSize: 12, color: "rgba(255,255,255,0.6)" },
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
  loginBtn:     { marginBottom: 12 },
  disableBio:   { textAlign: "center", fontSize: 12, color: COLOURS.muted, marginBottom: 12, textDecorationLine: "underline" },
  companyBtn:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderWidth: 1.5, borderColor: COLOURS.border, borderRadius: 10, marginBottom: 8, backgroundColor: COLOURS.background },
  companyBtnName: { fontSize: 15, fontWeight: "700", color: COLOURS.primary },
  companyBtnRole: { fontSize: 11, color: COLOURS.muted, marginTop: 2, textTransform: "capitalize" },
  companyBtnArrow:{ fontSize: 18, color: COLOURS.accent },
  footer:       { textAlign: "center", fontSize: 12, color: COLOURS.muted, lineHeight: 18 },
});
