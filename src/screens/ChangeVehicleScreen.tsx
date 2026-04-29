import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, Alert, TextInput,
} from "react-native";
import { COLOURS, Button, Card } from "../components";
import { useShift } from "../ShiftContext";

const CHANGE_REASONS = [
  "Truck damaged / defect found",
  "Mechanical issue",
  "Planner changed verbally",
  "Assigned truck not available",
  "Adding vehicle at start of shift",
  "Other",
];

export default function ChangeVehicleScreen({ navigation }: { navigation: any }) {
  const { draft, updateShiftField, updateSegment, setVehicleClass } = useShift() as any;

  const currentTruck   = draft?.truckReg ?? "";
  const currentTrailer = draft?.currentSegment?.trailerReg ?? "";
  const currentClass   = draft?.currentSegment?.vehicleClass ?? "class1";

  const [changing,      setChanging]      = useState<"truck"|"trailer"|"both"|null>(null);
  const [newTruckReg,   setNewTruckReg]   = useState(currentTruck);
  const [newTrailerReg, setNewTrailerReg] = useState(currentTrailer);
  const [newClass,      setNewClass]      = useState<"class1"|"class2"|"van">(currentClass);
  const [reason,        setReason]        = useState("");

  function handleConfirm() {
    if (!changing) { Alert.alert("Required", "Please select what you are changing"); return; }
    if (!reason)   { Alert.alert("Required", "Please select a reason"); return; }
    if ((changing === "truck" || changing === "both") && !newTruckReg.trim()) {
      Alert.alert("Required", "Please enter the truck registration"); return;
    }

    const finalTruck   = (changing === "truck"   || changing === "both") ? newTruckReg.trim().toUpperCase()   : currentTruck;
    const finalTrailer = (changing === "trailer" || changing === "both") ? newTrailerReg.trim().toUpperCase() : currentTrailer;
    const truckChanged   = finalTruck   !== currentTruck;
    const trailerChanged = finalTrailer !== currentTrailer;

    if (changing === "truck" || changing === "both") {
      updateShiftField("truckReg", finalTruck);
      setVehicleClass(newClass);
    }

    updateSegment({
      vehicleClass:      newClass,
      truckReg:          finalTruck,
      trailerReg:        finalTrailer,
      hasTrailer:        !!finalTrailer,
      needsTruckCheck:   truckChanged,
      needsTrailerCheck: trailerChanged,
      odometerStart:     "",
    });

    if (truckChanged) {
      Alert.alert("Truck Check Required",
        `You must complete a check for ${finalTruck} before continuing.`,
        [{ text: "Do Check Now", onPress: () => navigation.replace("TruckChecklist", { truckReg: finalTruck }) }]
      );
    } else if (trailerChanged && finalTrailer) {
      Alert.alert("Trailer Check Required",
        `You must complete a check for ${finalTrailer} before continuing.`,
        [{ text: "Do Check Now", onPress: () => navigation.replace("TrailerChecklist", { trailerReg: finalTrailer }) }]
      );
    } else {
      navigation.goBack();
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Change Vehicle</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <Card style={{ marginBottom: 12 }}>
          <Text style={styles.sectionLabel}>Current Vehicle</Text>
          <Text style={styles.currentVehicle}>🚛 {currentTruck || "No truck set"}</Text>
          {currentTrailer
            ? <Text style={styles.currentVehicle}>🚚 {currentTrailer}</Text>
            : <Text style={styles.hint}>No trailer attached</Text>}
        </Card>

        <Card style={{ marginBottom: 12 }}>
          <Text style={styles.sectionLabel}>What are you changing?</Text>
          <View style={styles.btnRow}>
            {[
              { key: "truck",   label: "Truck only" },
              { key: "trailer", label: "Trailer only" },
              { key: "both",    label: "Both" },
            ].map(o => (
              <TouchableOpacity
                key={o.key}
                style={[styles.optBtn, changing === o.key && styles.optBtnActive]}
                onPress={() => setChanging(o.key as any)}
              >
                <Text style={[styles.optBtnText, changing === o.key && styles.optBtnTextActive]}>{o.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {changing && (
          <Card style={{ marginBottom: 12 }}>
            <Text style={styles.sectionLabel}>New Vehicle Details</Text>
            {(changing === "truck" || changing === "both") && (
              <>
                <Text style={styles.fieldLabel}>New Truck Registration</Text>
                <TextInput
                  style={styles.regInput}
                  value={newTruckReg}
                  onChangeText={t => setNewTruckReg(t.toUpperCase())}
                  placeholder="e.g. AB12 CDE"
                  autoCapitalize="characters"
                  placeholderTextColor={COLOURS.muted}
                />
                <Text style={styles.fieldLabel}>Vehicle Class</Text>
                <View style={styles.btnRow}>
                  {[{key:"class1",label:"Class 1"},{key:"class2",label:"Class 2"},{key:"van",label:"Van"}].map(v => (
                    <TouchableOpacity
                      key={v.key}
                      style={[styles.optBtn, newClass === v.key && styles.optBtnActive]}
                      onPress={() => setNewClass(v.key as any)}
                    >
                      <Text style={[styles.optBtnText, newClass === v.key && styles.optBtnTextActive]}>{v.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            {(changing === "trailer" || changing === "both") && (
              <>
                <Text style={styles.fieldLabel}>New Trailer Registration (blank = no trailer)</Text>
                <TextInput
                  style={styles.regInput}
                  value={newTrailerReg}
                  onChangeText={t => setNewTrailerReg(t.toUpperCase())}
                  placeholder="e.g. TRL123 or leave blank"
                  autoCapitalize="characters"
                  placeholderTextColor={COLOURS.muted}
                />
              </>
            )}
          </Card>
        )}

        {changing && (
          <Card style={{ marginBottom: 12 }}>
            <Text style={styles.sectionLabel}>Reason for Change</Text>
            {CHANGE_REASONS.map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.reasonBtn, reason === r && styles.reasonBtnActive]}
                onPress={() => setReason(r)}
              >
                <Text style={[styles.reasonBtnText, reason === r && { color: COLOURS.white }]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </Card>
        )}

        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            ⚠️ Any new vehicle requires a safety check before use.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.bottomNav}>
        <Button label="Confirm Vehicle Change →" onPress={handleConfirm} style={{ backgroundColor: COLOURS.primary }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLOURS.background },
  topBar:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLOURS.white, borderBottomWidth: 1, borderBottomColor: COLOURS.border },
  backText:        { color: COLOURS.accent, fontSize: 15, fontWeight: "700" },
  topTitle:        { fontSize: 17, fontWeight: "700", color: COLOURS.primary },
  sectionLabel:    { fontSize: 11, fontWeight: "700", color: COLOURS.primary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  currentVehicle:  { fontSize: 20, fontWeight: "900", color: COLOURS.primary, letterSpacing: 1, marginBottom: 4 },
  hint:            { fontSize: 12, color: COLOURS.muted, fontStyle: "italic" },
  fieldLabel:      { fontSize: 12, fontWeight: "600", color: COLOURS.primary, marginBottom: 6, marginTop: 10 },
  btnRow:          { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  optBtn:          { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderColor: COLOURS.border, backgroundColor: COLOURS.white },
  optBtnActive:    { backgroundColor: COLOURS.primary, borderColor: COLOURS.primary },
  optBtnText:      { fontSize: 13, fontWeight: "600", color: COLOURS.muted },
  optBtnTextActive:{ color: COLOURS.white },
  regInput:        { borderWidth: 1.5, borderColor: COLOURS.border, borderRadius: 8, padding: 12, fontSize: 18, fontWeight: "700", color: COLOURS.primary, textAlign: "center", letterSpacing: 2, marginBottom: 4 },
  reasonBtn:       { padding: 12, borderRadius: 8, borderWidth: 1.5, borderColor: COLOURS.border, marginBottom: 6 },
  reasonBtnActive: { backgroundColor: COLOURS.primary, borderColor: COLOURS.primary },
  reasonBtnText:   { fontSize: 13, color: COLOURS.muted, fontWeight: "600" },
  warningBox:      { backgroundColor: "#fef3c7", borderRadius: 8, padding: 12, marginBottom: 12 },
  warningText:     { fontSize: 12, color: "#92400e" },
  bottomNav:       { padding: 16, backgroundColor: COLOURS.white, borderTopWidth: 1, borderTopColor: COLOURS.border },
});
