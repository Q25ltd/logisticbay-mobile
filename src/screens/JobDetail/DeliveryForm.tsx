import React from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Alert,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card } from "../../components";
import { COLOURS } from "../../theme";
import { jobDetailStyles as s } from "./jobDetailStyles";

interface DeliveryFormProps {
  job:              { requirePOD?: boolean; requireDeliveryQty?: boolean; actualQuantity?: string; actualUnit?: string };
  deliveredQty:     string;
  podNumber:        string;
  deliveryNote:     string;
  saving:           boolean;
  onBack:           () => void;
  onChangeQty:      (v: string) => void;
  onChangePod:      (v: string) => void;
  onChangeNote:     (v: string) => void;
  onConfirm:        () => void;
}

export function DeliveryForm({
  job, deliveredQty, podNumber, deliveryNote, saving,
  onBack, onChangeQty, onChangePod, onChangeNote, onConfirm,
}: DeliveryFormProps) {
  function handleConfirm() {
    if (job.requirePOD && !podNumber.trim()) {
      Alert.alert("Required", "Planner requires a POD / delivery reference number");
      return;
    }
    if (job.requireDeliveryQty && !deliveredQty.trim()) {
      Alert.alert("Required", "Planner requires the actual delivery quantity");
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
        <Text style={s.topTitle}>Confirm Delivery</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <Card>
          {job.actualQuantity ? (
            <Text style={s.formInfo}>
              📦 Collected: <Text style={s.bold}>{job.actualQuantity} {job.actualUnit}</Text>
            </Text>
          ) : null}

          <Text style={s.sectionLabel}>Actual Quantity Delivered</Text>
          <TextInput
            style={s.input}
            value={deliveredQty}
            onChangeText={onChangeQty}
            placeholder="e.g. 4"
            keyboardType="decimal-pad"
            placeholderTextColor={COLOURS.muted}
          />

          <Text style={s.sectionLabel}>
            POD / Delivery Reference <Text style={s.optional}>(optional)</Text>
          </Text>
          <TextInput
            style={s.input}
            value={podNumber}
            onChangeText={onChangePod}
            placeholder="e.g. POD-12345"
            placeholderTextColor={COLOURS.muted}
          />

          <Text style={s.sectionLabel}>
            Delivery Note <Text style={s.optional}>(optional)</Text>
          </Text>
          <TextInput
            style={[s.input, s.multiline]}
            value={deliveryNote}
            onChangeText={onChangeNote}
            placeholder="e.g. left at reception, customer signed, short delivered 1..."
            placeholderTextColor={COLOURS.muted}
            multiline
          />
        </Card>
      </ScrollView>

      <View style={s.bottomNav}>
        <Button
          label={saving ? "Saving..." : "✅ Confirm Delivery"}
          onPress={handleConfirm}
          loading={saving}
          style={{ backgroundColor: COLOURS.pass }}
        />
      </View>
    </SafeAreaView>
  );
}
