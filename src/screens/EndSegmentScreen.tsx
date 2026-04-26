import React, { useState } from "react";
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, TextInput, Switch, Alert,
} from "react-native";
import { COLOURS, Button, Card } from "../components";
import { useShift } from "../ShiftContext";
import { VEHICLE_CLASSES, type VehicleClass } from "../constants";

interface Props { navigation: any }

export default function EndSegmentScreen({ navigation }: Props) {
  const { currentSegment, updateSegment, addSegment, updateShiftField } = useShift();

  React.useEffect(() => { updateShiftField("lastScreen", "EndSegment"); }, []);

  const [currentOdometer, setCurrentOdometer] = useState(currentSegment.odometerEnd || "");
  const [notes,           setNotes]           = useState(currentSegment.notes);
  const [showChange,      setShowChange]       = useState(false);

  const [truckChanged,    setTruckChanged]    = useState(false);
  const [trailerChanged,  setTrailerChanged]  = useState(false);
  const [newVehicleClass, setNewVehicleClass] = useState<VehicleClass>(currentSegment.vehicleClass);
  const [newTruckReg,     setNewTruckReg]     = useState(currentSegment.truckReg);
  const [newTrailerReg,   setNewTrailerReg]   = useState(currentSegment.trailerReg);
  const [hasTrailer,      setHasTrailer]      = useState(currentSegment.hasTrailer);
  const [newOdometerStart, setNewOdometerStart] = useState("");

  const classChanged     = newVehicleClass !== currentSegment.vehicleClass;
  const isClass1         = newVehicleClass === "class1";
  const needsTruckCheck  = truckChanged || classChanged;
  const needsTrailerCheck= (trailerChanged || classChanged) && isClass1 && hasTrailer;

  const mileage =
    currentOdometer && currentSegment.odometerStart
      ? parseInt(currentOdometer) - parseInt(currentSegment.odometerStart)
      : null;

  function handleEndShift() {
    if (!currentOdometer.trim()) {
      Alert.alert("Required", "Please enter the final odometer reading");
      return;
    }
    if (parseInt(currentOdometer) < parseInt(currentSegment.odometerStart)) {
      Alert.alert("Error", "Odometer cannot be less than segment start");
      return;
    }
    updateSegment({ odometerEnd: currentOdometer, notes });
    navigation.navigate("EndShift");
  }

  function handleChangeVehicle() {
    if (!truckChanged && !trailerChanged && !classChanged) {
      Alert.alert("Required", "Please select what has changed");
      return;
    }
    if (!currentOdometer.trim()) {
      Alert.alert("Required", "Enter the current odometer reading");
      return;
    }
    if (parseInt(currentOdometer) < parseInt(currentSegment.odometerStart)) {
      Alert.alert("Error", "Odometer cannot be less than segment start");
      return;
    }
    if (!newTruckReg.trim()) {
      Alert.alert("Required", "Vehicle registration is required");
      return;
    }
    if (isClass1 && hasTrailer && !newTrailerReg.trim()) {
      Alert.alert("Required", "Trailer registration is required");
      return;
    }

    // When truck changes, need starting odometer for new truck
    if (truckChanged && !newOdometerStart.trim()) {
      Alert.alert("Required", "Enter the starting odometer for the new truck");
      return;
    }
    if (truckChanged && isNaN(parseInt(newOdometerStart))) {
      Alert.alert("Error", "New truck odometer must be a number");
      return;
    }

    updateSegment({ odometerEnd: currentOdometer, notes });

    addSegment(
      newVehicleClass,
      newTruckReg.trim().toUpperCase(),
      isClass1 && hasTrailer ? newTrailerReg.trim().toUpperCase() : "",
      isClass1 && hasTrailer,
      needsTruckCheck,
      needsTrailerCheck,
      truckChanged ? newOdometerStart : currentOdometer, // new segment odometer start
    );

    if (needsTruckCheck) {
      navigation.navigate("TruckChecklist");
    } else if (needsTrailerCheck) {
      navigation.navigate("TrailerChecklist");
    } else {
      navigation.navigate("Deliveries");
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>End / Change Vehicle</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Current segment summary */}
        <Card style={{ margin: 16, marginBottom: 8 }}>
          <Text style={styles.sectionLabel}>Current Segment {currentSegment.segmentNumber}</Text>
          <Text style={styles.vehicleText}>
            {currentSegment.vehicleClass === "van" ? "🚐" : currentSegment.vehicleClass === "class2" ? "🚚" : "🚛"}{" "}
            {currentSegment.truckReg}
            {currentSegment.hasTrailer ? `  +  📦 ${currentSegment.trailerReg}` : ""}
          </Text>
          <Text style={styles.metaText}>
            Start: {currentSegment.odometerStart} km  ·  {currentSegment.deliveries.length} job{currentSegment.deliveries.length !== 1 ? "s" : ""}
          </Text>
        </Card>

        {/* Odometer — always required */}
        <Card style={{ marginHorizontal: 16, marginBottom: 8 }}>
          <Text style={styles.fieldLabel}>
            {showChange ? "Current Odometer Reading (km) *" : "Final Odometer Reading (km) *"}
          </Text>
          <Text style={styles.odomHint}>
            {showChange
              ? "Required to correctly calculate mileage per segment"
              : "Final reading at end of shift"}
          </Text>
          <TextInput
            style={styles.input}
            value={currentOdometer}
            onChangeText={setCurrentOdometer}
            placeholder="e.g. 10500"
            placeholderTextColor={COLOURS.muted}
            keyboardType="numeric"
          />
          {mileage !== null && mileage >= 0 && (
            <View style={styles.mileageBadge}>
              <Text style={styles.mileageLabel}>Segment mileage</Text>
              <Text style={styles.mileageValue}>{mileage} km</Text>
            </View>
          )}

          <Text style={styles.fieldLabel}>Segment Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any issues or notes..."
            placeholderTextColor={COLOURS.muted}
            multiline
          />
        </Card>

        {/* Options */}
        <View style={styles.optionButtons}>
          <TouchableOpacity style={styles.optionEnd} onPress={() => { setShowChange(false); }} activeOpacity={0.85}>
            <Text style={styles.optionIcon}>🏁</Text>
            <Text style={[styles.optionTitle, { color: COLOURS.white }]}>End Shift</Text>
            <Text style={[styles.optionSub, { color: "rgba(255,255,255,0.6)" }]}>Finish for the day</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionChange, showChange && styles.optionChangeActive]}
            onPress={() => setShowChange(!showChange)}
            activeOpacity={0.8}
          >
            <Text style={styles.optionIcon}>🔄</Text>
            <Text style={[styles.optionTitle, showChange && { color: COLOURS.white }]}>Change Vehicle</Text>
            <Text style={[styles.optionSub, showChange && { color: "rgba(255,255,255,0.6)" }]}>
              New truck, trailer or vehicle class
            </Text>
          </TouchableOpacity>
        </View>

        {/* Change vehicle form */}
        {showChange && (
          <Card style={{ marginHorizontal: 16, marginBottom: 8 }}>
            <Text style={styles.sectionLabel}>New Vehicle</Text>

            {/* Vehicle class selector */}
            <Text style={styles.fieldLabel}>Vehicle Class</Text>
            <View style={styles.classRow}>
              {VEHICLE_CLASSES.map(vc => (
                <TouchableOpacity
                  key={vc.key}
                  style={[styles.classBtn, newVehicleClass === vc.key && styles.classBtnActive]}
                  onPress={() => {
                    setNewVehicleClass(vc.key);
                    if (vc.key !== "class1") setHasTrailer(false);
                    if (vc.key !== currentSegment.vehicleClass) {
                      setTruckChanged(true);
                      setTrailerChanged(vc.key === "class1");
                    }
                  }}
                >
                  <Text style={styles.classIcon}>{vc.icon}</Text>
                  <Text style={[styles.classBtnText, newVehicleClass === vc.key && styles.classBtnTextActive]}>
                    {vc.label}
                  </Text>
                  <Text style={[styles.classBtnSub, newVehicleClass === vc.key && { color: "rgba(255,255,255,0.7)" }]}>
                    {vc.sub}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* What changed — only show if same class */}
            {!classChanged && (
              <>
                <Text style={styles.fieldLabel}>What has changed?</Text>
                <View style={styles.changedRow}>
                  <TouchableOpacity
                    style={[styles.changedBtn, truckChanged && styles.changedBtnActive]}
                    onPress={() => setTruckChanged(!truckChanged)}
                  >
                    <Text style={[styles.changedBtnText, truckChanged && styles.changedBtnTextActive]}>
                      🚛 Truck/Unit changed
                    </Text>
                  </TouchableOpacity>
                  {currentSegment.vehicleClass === "class1" && (
                    <TouchableOpacity
                      style={[styles.changedBtn, trailerChanged && styles.changedBtnActive]}
                      onPress={() => setTrailerChanged(!trailerChanged)}
                    >
                      <Text style={[styles.changedBtnText, trailerChanged && styles.changedBtnTextActive]}>
                        📦 Trailer changed
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}

            {/* Checks summary */}
            {(needsTruckCheck || needsTrailerCheck || (!needsTruckCheck && !needsTrailerCheck && (truckChanged || trailerChanged || classChanged))) && (
              <View style={styles.checksRequired}>
                <Text style={styles.checksRequiredLabel}>Checks required for new segment:</Text>
                {needsTruckCheck
                  ? <Text style={styles.checksRequiredItem}>✓ {newVehicleClass === "van" ? "Van" : newVehicleClass === "class2" ? "Rigid HGV" : "Truck"} walk round check</Text>
                  : <Text style={styles.checksRequiredSkip}>✗ Truck checks — skipped (no change)</Text>}
                {needsTrailerCheck
                  ? <Text style={styles.checksRequiredItem}>✓ Trailer walk round check</Text>
                  : isClass1
                    ? <Text style={styles.checksRequiredSkip}>✗ Trailer checks — skipped (no change)</Text>
                    : null}
                {!needsTruckCheck && !needsTrailerCheck && (truckChanged || trailerChanged || classChanged) && (
                  <Text style={styles.checksRequiredSkip}>No checks required — proceed to deliveries</Text>
                )}
              </View>
            )}

            {/* Vehicle registration fields */}
            <Text style={styles.fieldLabel}>{newVehicleClass === "van" ? "Van" : "Truck/Unit"} Registration *</Text>
            <TextInput
              style={styles.input}
              value={newTruckReg}
              onChangeText={setNewTruckReg}
              placeholder="AB12 CDE"
              placeholderTextColor={COLOURS.muted}
              autoCapitalize="characters"
            />

            {truckChanged && (
              <>
                <Text style={styles.fieldLabel}>New Truck Odometer Start (km) *</Text>
                <Text style={styles.odomHint}>Starting odometer reading of the new truck</Text>
                <TextInput
                  style={styles.input}
                  value={newOdometerStart}
                  onChangeText={setNewOdometerStart}
                  placeholder="e.g. 50000"
                  placeholderTextColor={COLOURS.muted}
                  keyboardType="numeric"
                />
              </>
            )}

            {newVehicleClass === "class1" && (
              <>
                <View style={styles.switchRow}>
                  <Text style={styles.fieldLabel}>Running with Trailer?</Text>
                  <Switch
                    value={hasTrailer}
                    onValueChange={v => { setHasTrailer(v); if (!v) setTrailerChanged(true); }}
                    trackColor={{ false: COLOURS.border, true: COLOURS.primary }}
                    thumbColor={COLOURS.white}
                  />
                </View>

                {hasTrailer && (
                  <>
                    <Text style={styles.fieldLabel}>Trailer Registration *</Text>
                    <TextInput
                      style={styles.input}
                      value={newTrailerReg}
                      onChangeText={setNewTrailerReg}
                      placeholder="XY34 FGH"
                      placeholderTextColor={COLOURS.muted}
                      autoCapitalize="characters"
                    />
                  </>
                )}
              </>
            )}

            <Button
              label={
                needsTruckCheck   ? "Start New Segment — Vehicle Check →" :
                needsTrailerCheck ? "Start New Segment — Trailer Check →" :
                (!truckChanged && !trailerChanged && !classChanged) ? "Select what changed above" :
                "Start New Segment — No Checks Needed →"
              }
              onPress={handleChangeVehicle}
              disabled={!truckChanged && !trailerChanged && !classChanged}
              style={{ marginTop: 8 }}
            />
          </Card>
        )}

        {!showChange && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <Button label="End Shift →" onPress={handleEndShift} style={{ backgroundColor: COLOURS.pass }} />
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLOURS.background },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLOURS.white,
    borderBottomWidth: 1, borderBottomColor: COLOURS.border,
  },
  backText:     { color: COLOURS.accent, fontSize: 15, fontWeight: "600" },
  topTitle:     { fontSize: 16, fontWeight: "700", color: COLOURS.primary },
  scroll:       { flex: 1 },
  sectionLabel: { fontSize: 11, color: COLOURS.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  vehicleText:  { fontSize: 16, fontWeight: "700", color: COLOURS.primary, marginBottom: 4 },
  metaText:     { fontSize: 13, color: COLOURS.muted },
  fieldLabel:   { fontSize: 12, fontWeight: "600", color: COLOURS.primary, marginBottom: 4, marginTop: 4 },
  odomHint:     { fontSize: 11, color: COLOURS.muted, marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: COLOURS.border, borderRadius: 10,
    padding: 12, fontSize: 15, color: COLOURS.primary, marginBottom: 12, backgroundColor: COLOURS.white,
  },
  multiline:    { minHeight: 60, textAlignVertical: "top" },
  mileageBadge: { backgroundColor: COLOURS.primary, borderRadius: 8, padding: 12, alignItems: "center", marginBottom: 12 },
  mileageLabel: { color: "rgba(255,255,255,0.6)", fontSize: 10, textTransform: "uppercase" },
  mileageValue: { color: COLOURS.accent, fontSize: 22, fontWeight: "800", marginTop: 2 },
  optionButtons:{ padding: 16, gap: 12 },
  optionEnd:    { borderRadius: 12, padding: 18, backgroundColor: COLOURS.primary },
  optionChange: { borderRadius: 12, padding: 18, backgroundColor: COLOURS.white, borderWidth: 1.5, borderColor: COLOURS.border },
  optionChangeActive: { backgroundColor: COLOURS.primary, borderColor: COLOURS.primary },
  optionIcon:   { fontSize: 28, marginBottom: 8 },
  optionTitle:  { fontSize: 16, fontWeight: "700", color: COLOURS.primary, marginBottom: 4 },
  optionSub:    { fontSize: 13, color: COLOURS.muted },
  switchRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  classRow:     { gap: 8, marginBottom: 14 },
  classBtn: {
    padding: 12, borderRadius: 10, borderWidth: 1.5,
    borderColor: COLOURS.border, backgroundColor: COLOURS.white,
  },
  classBtnActive:    { backgroundColor: COLOURS.primary, borderColor: COLOURS.primary },
  classIcon:         { fontSize: 22, marginBottom: 4 },
  classBtnText:      { fontSize: 14, fontWeight: "700", color: COLOURS.primary },
  classBtnTextActive:{ color: COLOURS.white },
  classBtnSub:       { fontSize: 11, color: COLOURS.muted, marginTop: 2 },
  changedRow:        { flexDirection: "row", gap: 10, marginBottom: 14 },
  changedBtn: {
    flex: 1, paddingVertical: 12, paddingHorizontal: 8,
    borderRadius: 10, borderWidth: 1.5, borderColor: COLOURS.border,
    backgroundColor: COLOURS.white, alignItems: "center",
  },
  changedBtnActive:     { backgroundColor: COLOURS.primary, borderColor: COLOURS.primary },
  changedBtnText:       { fontSize: 12, fontWeight: "600", color: COLOURS.primary, textAlign: "center" },
  changedBtnTextActive: { color: COLOURS.white },
  checksRequired: {
    backgroundColor: "#f0fdf4", borderRadius: 8, padding: 12,
    marginBottom: 14, borderLeftWidth: 3, borderLeftColor: COLOURS.pass,
  },
  checksRequiredLabel: { fontSize: 11, fontWeight: "700", color: COLOURS.primary, marginBottom: 6, textTransform: "uppercase" },
  checksRequiredItem:  { fontSize: 13, color: COLOURS.pass, fontWeight: "600", marginBottom: 3 },
  checksRequiredSkip:  { fontSize: 12, color: COLOURS.muted, marginBottom: 3 },
});
