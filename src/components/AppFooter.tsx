import React from "react";
import { View, Text } from "react-native";

export function AppFooter() {
  return (
    <View style={{ paddingVertical: 6, alignItems: "center" }}>
      <Text style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 0.5 }}>
        LogisticBay · Q25 Ltd
      </Text>
    </View>
  );
}
