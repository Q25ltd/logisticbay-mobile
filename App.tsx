import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "./src/AuthContext";
import { ShiftProvider, useShift } from "./src/ShiftContext";
import LoginScreen          from "./src/screens/LoginScreen";
import HomeScreen           from "./src/screens/HomeScreen";
import HistoryScreen        from "./src/screens/HistoryScreen";
import ShiftDetailScreen    from "./src/screens/ShiftDetailScreen";
import JobsScreen           from "./src/screens/JobsScreen";
import JobDetailScreen      from "./src/screens/JobDetailScreen";
import ChangePinScreen      from "./src/screens/ChangePinScreen";
import NewStartShiftScreen  from "./src/screens/StartShiftScreen";
import HolidayScreen        from "./src/screens/HolidayScreen";
import { COLOURS } from "./src/components";
import {
  StartShiftScreen as OldStartShiftScreen,
  EndShiftScreen,
  ReviewScreen,
  EndSegmentScreen,
} from "./src/screens/ShiftScreens";
import ChecklistScreen   from "./src/screens/ChecklistScreen";
import DeliveriesScreen from "./src/screens/DeliveriesScreen";

const Stack = createNativeStackNavigator();

// Shows spinner then redirects based on shift state
function InitialScreen({ navigation }: { navigation: any }) {
  const { draft, draftRestored } = useShift() as any;
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

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLOURS.primary }}>
        <ActivityIndicator size="large" color={COLOURS.white} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Initial"          component={InitialScreen} />
            <Stack.Screen name="Home"             component={HomeScreen} />
            <Stack.Screen name="StartShift"       component={NewStartShiftScreen} />
            <Stack.Screen name="TruckChecklist"   component={ChecklistScreen} initialParams={{ type: "truck" }} />
            <Stack.Screen name="TrailerChecklist" component={ChecklistScreen} initialParams={{ type: "trailer" }} />
            <Stack.Screen name="Deliveries"       component={DeliveriesScreen} />
            <Stack.Screen name="EndSegment"       component={EndSegmentScreen} />
            <Stack.Screen name="EndShift"         component={EndShiftScreen} />
            <Stack.Screen name="Review"           component={ReviewScreen} />
            <Stack.Screen name="History"          component={HistoryScreen} />
            <Stack.Screen name="ChangePin"        component={ChangePinScreen} />
            <Stack.Screen name="ShiftDetail"      component={ShiftDetailScreen} />
            <Stack.Screen name="Jobs"             component={JobsScreen} />
            <Stack.Screen name="JobDetail"        component={JobDetailScreen} />
            <Stack.Screen name="Holidays"         component={HolidayScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
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
