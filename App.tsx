import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "./src/AuthContext";
import { ShiftProvider, useShift } from "./src/ShiftContext";
import { COLOURS } from "./src/theme";
import { useNetworkStatus } from "./src/hooks/useNetworkStatus";
import { OfflineBanner } from "./src/components/OfflineBanner";
import type { RootStackParamList } from "./src/navigation/types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import LoginScreen         from "./src/screens/LoginScreen";
import HomeScreen          from "./src/screens/HomeScreen";
import HistoryScreen       from "./src/screens/HistoryScreen";
import ShiftDetailScreen   from "./src/screens/ShiftDetailScreen";
import JobsScreen          from "./src/screens/JobsScreen";
import JobDetailScreen     from "./src/screens/JobDetail/index";
import ChangePinScreen     from "./src/screens/ChangePinScreen";
import StartShiftScreen    from "./src/screens/StartShiftScreen";
import EndShiftScreen      from "./src/screens/EndShiftScreen";
import ReviewScreen        from "./src/screens/ReviewScreen";
import HolidayScreen       from "./src/screens/HolidayScreen";
import ChangeVehicleScreen from "./src/screens/ChangeVehicleScreen";
import EndSegmentScreen    from "./src/screens/EndSegmentScreen";
import ChecklistScreen     from "./src/screens/ChecklistScreen";
import DeliveriesScreen    from "./src/screens/DeliveriesScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

type InitialScreenProps = NativeStackScreenProps<RootStackParamList, "Initial">;

// Shows spinner then redirects based on shift state
function InitialScreen({ navigation }: InitialScreenProps) {
  const { draft, draftRestored } = useShift();
  useEffect(() => {
    if (!draftRestored) return;
    if (draft?.shiftId) {
      navigation.replace("Jobs");
    } else {
      navigation.replace("Home");
    }
  }, [draftRestored]);
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLOURS.primary }}>
      <ActivityIndicator size="large" color="#fff" />
    </View>
  );
}

function AppNavigator() {
  const { user, loading } = useAuth();
  const { syncStatus, queueSize } = useNetworkStatus();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLOURS.primary }}>
        <ActivityIndicator size="large" color={COLOURS.white} />
      </View>
    );
  }

  return (
    <>
      <OfflineBanner syncStatus={syncStatus} queueSize={queueSize} />
      <NavigationContainer>
      {/* eslint-disable @typescript-eslint/no-explicit-any */}
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Initial"          component={InitialScreen as any} />
            <Stack.Screen name="Home"             component={HomeScreen as any} />
            <Stack.Screen name="StartShift"       component={StartShiftScreen as any} />
            <Stack.Screen name="TruckChecklist"   component={ChecklistScreen as any} initialParams={{ type: "truck" }} />
            <Stack.Screen name="TrailerChecklist" component={ChecklistScreen as any} initialParams={{ type: "trailer" }} />
            <Stack.Screen name="Deliveries"       component={DeliveriesScreen as any} />
            <Stack.Screen name="EndSegment"       component={EndSegmentScreen as any} />
            <Stack.Screen name="EndShift"         component={EndShiftScreen as any} />
            <Stack.Screen name="Review"           component={ReviewScreen as any} />
            <Stack.Screen name="History"          component={HistoryScreen as any} />
            <Stack.Screen name="ChangePin"        component={ChangePinScreen as any} />
            <Stack.Screen name="ShiftDetail"      component={ShiftDetailScreen as any} />
            <Stack.Screen name="Jobs"             component={JobsScreen as any} />
            <Stack.Screen name="JobDetail"        component={JobDetailScreen as any} />
            <Stack.Screen name="Holidays"         component={HolidayScreen as any} />
            <Stack.Screen name="ChangeVehicle"    component={ChangeVehicleScreen as any} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen as any} />
        )}
      </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ShiftProvider>
        <AppNavigator />
      </ShiftProvider>
    </AuthProvider>
  );
}
