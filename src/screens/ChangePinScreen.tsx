import React, { useState } from "react";
import {
  View, Text, StyleSheet,
  TouchableOpacity, Alert, TextInput,
  KeyboardAvoidingView, ScrollView, Platform,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLOURS, Button } from "../components";
import { api } from "../api";
import { useAuth } from "../AuthContext";

interface Props {
  navigation: any;
  route?: { params?: { forced?: boolean } };
}

export default function ChangePinScreen({ navigation, route }: Props) {
  const forced = route?.params?.forced ?? false;
  const { clearMustChangePin } = useAuth();

  const [currentPin, setCurrentPin] = useState("");
  const [newPin,     setNewPin]     = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading,    setLoading]    = useState(false);

  async function handleChange() {
    if (currentPin.length !== 6 || !/^\d+$/.test(currentPin)) {
      Alert.alert("Current PIN must be 6 digits"); return;
    }
    if (newPin.length !== 6 || !/^\d+$/.test(newPin)) {
      Alert.alert("New PIN must be 6 digits"); return;
    }
    if (newPin === "123456") {
      Alert.alert("Cannot use default PIN", "Please choose a different 6-digit PIN"); return;
    }
    if (newPin !== confirmPin) {
      Alert.alert("PINs do not match"); return;
    }

    setLoading(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword: currentPin,
        newPassword:     newPin,
      });

      Alert.alert(
        "PIN Changed ✓",
        "Your PIN has been updated successfully.",
        [{ text: "OK", onPress: () => {
          clearMustChangePin();
          navigation.reset({ index: 0, routes: [{ name: "Home" }] });
        }}]
      );
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.error ?? "Failed to change PIN");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
      <View style={styles.topBar}>
        {!forced && (
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.topTitle}>
          {forced ? "Set Your PIN" : "Change PIN"}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.content}>
        {forced && (
          <View style={styles.forcedBanner}>
            <Text style={styles.forcedTitle}>🔐 Set Your Personal PIN</Text>
            <Text style={styles.forcedText}>
              You're using the default PIN. Please set a personal 6-digit PIN before continuing.
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.label}>
            {forced ? "Default PIN (123456)" : "Current PIN"}
          </Text>
          <TextInput
            style={styles.pinInput}
            value={currentPin}
            onChangeText={setCurrentPin}
            placeholder="••••••"
            keyboardType="numeric"
            maxLength={6}
            secureTextEntry
            textAlign="center"
          />

          <Text style={styles.label}>New PIN</Text>
          <TextInput
            style={styles.pinInput}
            value={newPin}
            onChangeText={setNewPin}
            placeholder="••••••"
            keyboardType="numeric"
            maxLength={6}
            secureTextEntry
            textAlign="center"
          />
          <Text style={styles.hint}>6 digits — do not use 123456</Text>

          <Text style={styles.label}>Confirm New PIN</Text>
          <TextInput
            style={styles.pinInput}
            value={confirmPin}
            onChangeText={setConfirmPin}
            placeholder="••••••"
            keyboardType="numeric"
            maxLength={6}
            secureTextEntry
            textAlign="center"
          />
        </View>

        <Button
          label={loading ? "Saving..." : "Set PIN →"}
          onPress={handleChange}
          loading={loading}
          style={{ marginTop: 16 }}
        />
      </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: COLOURS.background },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLOURS.white,
    borderBottomWidth: 1, borderBottomColor: COLOURS.border,
  },
  backText:      { color: COLOURS.accent, fontSize: 15, fontWeight: "600" },
  topTitle:      { fontSize: 17, fontWeight: "700", color: COLOURS.primary },
  content:       { flex: 1, padding: 20 },
  forcedBanner: {
    backgroundColor: "#fff7ed", borderLeftWidth: 4, borderLeftColor: COLOURS.warning,
    padding: 16, borderRadius: 10, marginBottom: 20,
  },
  forcedTitle:   { fontSize: 15, fontWeight: "700", color: "#92400e", marginBottom: 6 },
  forcedText:    { fontSize: 13, color: "#92400e", lineHeight: 20 },
  card: {
    backgroundColor: COLOURS.white, borderRadius: 12, padding: 20,
    borderWidth: 1, borderColor: COLOURS.border,
  },
  label:         { fontSize: 12, fontWeight: "700", color: COLOURS.primary, marginBottom: 6, marginTop: 12, textTransform: "uppercase" },
  pinInput: {
    borderWidth: 2, borderColor: COLOURS.border, borderRadius: 12,
    padding: 16, fontSize: 28, fontWeight: "800", letterSpacing: 12,
    color: COLOURS.primary, backgroundColor: COLOURS.background,
    marginBottom: 4,
  },
  hint:          { fontSize: 11, color: COLOURS.muted, marginBottom: 8 },
});
