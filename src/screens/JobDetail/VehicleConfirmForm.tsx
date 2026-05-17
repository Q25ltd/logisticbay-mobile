import React from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Alert,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card } from "../../components";
import { COLOURS } from "../../theme";
import { jobDetailStyles as s } from "./jobDetailStyles";

interface PlannedJob {
  assignedTruck?:   string;
  assignedTrailer?: string;
}

interface VehicleConfirmFormProps {
  job:          PlannedJob;
  truckReg:     string;
  trailerReg:   string;
  vehicleClass: string;
  saving:       boolean;
  onBack:       () => void;
  onChangeTruck:   (v: string) => void;
  onChangeTrailer: (v: string) => void;
  onChangeClass:   (v: string) => void;
  onConfirm:    () => void;
}

const VEHICLE_CLASSES = [
  { key: "tractor", label: "Tractor unit" },
  { key: "rigid", label: "Rigid HGV" },
  { key: "van",    label: "Van" },
];

export function VehicleConfirmForm({
  job, truckReg, trailerReg, vehicleClass, saving,
  onBack, onChangeTruck, onChangeTrailer, onChangeClass, onConfirm,
}: VehicleConfirmFormProps) {
  function handleConfirm() {
    if (!truckReg.trim()) {
      Alert.alert("Required", "Please enter the truck registration");
      return;
    }
    onConfirm();
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={onBack}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.topTitle}>Confirm Vehicle</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <Card>
          {job.assignedTruck ? (
            <View style={styles.assignedBanner}>
              <Text style={styles.assignedLabel}>🚛 Assigned by planner</Text>
              <Text style={styles.assignedReg}>{job.assignedTruck}</Text>
              {job.assignedTrailer ? <Text style={styles.assignedReg}>{job.assignedTrailer}</Text> : null}
            </View>
          ) : (
            <View style={styles.noVehicleBanner}>
              <Text style={styles.noVehicleText}>⚠️ No vehicle assigned by planner</Text>
              <Text style={styles.noVehicleSub}>Please enter the vehicle details below</Text>
            </View>
          )}

          <Text style={s.sectionLabel}>Vehicle category</Text>
          <View style={s.unitRow}>
            {VEHICLE_CLASSES.map(v => (
              <TouchableOpacity
                key={v.key}
                style={[s.unitBtn, vehicleClass === v.key && s.unitBtnActive]}
                onPress={() => onChangeClass(v.key)}
              >
                <Text style={[s.unitBtnText, vehicleClass === v.key && s.unitBtnTextActive]}>
                  {v.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.sectionLabel}>Truck Registration</Text>
          <TextInput
            style={s.input}
            value={truckReg}
            onChangeText={t => onChangeTruck(t.toUpperCase())}
            placeholder="e.g. AB12 CDE"
            placeholderTextColor={COLOURS.muted}
            autoCapitalize="characters"
          />

          <Text style={s.sectionLabel}>
            Trailer Registration <Text style={s.optional}>(if applicable)</Text>
          </Text>
          <TextInput
            style={s.input}
            value={trailerReg}
            onChangeText={t => onChangeTrailer(t.toUpperCase())}
            placeholder="e.g. TRL123 or leave blank"
            placeholderTextColor={COLOURS.muted}
            autoCapitalize="characters"
          />
        </Card>
      </ScrollView>

      <View style={s.bottomNav}>
        <Button
          label={saving ? "Confirming..." : "✅ Confirm Vehicle & Start Job"}
          onPress={handleConfirm}
          loading={saving}
          style={{ backgroundColor: COLOURS.accent }}
        />
      </View>
    </SafeAreaView>
  );
}

import { StyleSheet } from "react-native";
const styles = StyleSheet.create({
  assignedBanner: { backgroundColor: "#dcfce7", borderRadius: 8, padding: 12, marginBottom: 12 },
  assignedLabel:  { fontSize: 11, color: "#14532d", fontWeight: "700", marginBottom: 4 },
  assignedReg:    { fontSize: 20, fontWeight: "900", color: "#14532d", letterSpacing: 1 },
  noVehicleBanner:{ backgroundColor: "#fef3c7", borderRadius: 8, padding: 12, marginBottom: 12 },
  noVehicleText:  { fontSize: 14, fontWeight: "700", color: "#92400e", marginBottom: 4 },
  noVehicleSub:   { fontSize: 12, color: "#92400e" },
});
