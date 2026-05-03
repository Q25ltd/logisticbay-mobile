import React from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Alert,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card } from "../../components";
import { COLOURS } from "../../theme";
import { jobDetailStyles as s } from "./jobDetailStyles";

interface CollectionFormProps {
  job:           { quantityExpected?: string; quantityUnit?: string };
  actualQty:     string;
  actualUnit:    string;
  collectNote:   string;
  saving:        boolean;
  onBack:        () => void;
  onChangeQty:   (v: string) => void;
  onChangeUnit:  (v: string) => void;
  onChangeNote:  (v: string) => void;
  onConfirm:     () => void;
}

const UNITS = ["pallets", "kgs", "bags", "other"];

export function CollectionForm({
  job, actualQty, actualUnit, collectNote, saving,
  onBack, onChangeQty, onChangeUnit, onChangeNote, onConfirm,
}: CollectionFormProps) {
  function handleConfirm() {
    if (!actualQty.trim()) {
      Alert.alert("Required", "Please enter actual quantity collected");
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
        <Text style={s.topTitle}>Confirm Collection</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <Card>
          <Text style={s.formInfo}>
            📋 Planner expected:{" "}
            <Text style={s.bold}>{job.quantityExpected || "not specified"} {job.quantityUnit}</Text>
          </Text>

          <Text style={s.sectionLabel}>Actual Quantity Collected</Text>
          <TextInput
            style={s.input}
            value={actualQty}
            onChangeText={onChangeQty}
            placeholder="e.g. 4"
            keyboardType="decimal-pad"
            placeholderTextColor={COLOURS.muted}
          />

          <Text style={s.sectionLabel}>Unit of measurement</Text>
          <View style={s.unitRow}>
            {UNITS.map(u => (
              <TouchableOpacity
                key={u}
                style={[s.unitBtn, actualUnit === u && s.unitBtnActive]}
                onPress={() => onChangeUnit(u)}
              >
                <Text style={[s.unitBtnText, actualUnit === u && s.unitBtnTextActive]}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.sectionLabel}>
            Collection Note <Text style={s.optional}>(optional)</Text>
          </Text>
          <TextInput
            style={[s.input, s.multiline]}
            value={collectNote}
            onChangeText={onChangeNote}
            placeholder="e.g. 1 pallet damaged, refused by depot..."
            placeholderTextColor={COLOURS.muted}
            multiline
          />
        </Card>
      </ScrollView>

      <View style={s.bottomNav}>
        <Button
          label={saving ? "Saving..." : "✅ Confirm Collection"}
          onPress={handleConfirm}
          loading={saving}
          style={{ backgroundColor: "#f59e0b" }}
        />
      </View>
    </SafeAreaView>
  );
}
