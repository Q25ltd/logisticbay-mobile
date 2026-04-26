import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";

import { AuthProvider, useAuth } from "./src/AuthContext";
import LoginScreen          from "./src/screens/LoginScreen";
import HomeScreen           from "./src/screens/HomeScreen";
import NewShiftScreen       from "./src/screens/NewShiftScreen";
import HistoryScreen        from "./src/screens/HistoryScreen";
import ChangePasswordScreen from "./src/screens/ChangePasswordScreen";
import { COLOURS } from "./src/components";

const Stack = createNativeStackNavigator();

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
            <Stack.Screen name="Home"           component={HomeScreen} />
            <Stack.Screen name="NewShift"        component={NewShiftScreen} />
            <Stack.Screen name="History"         component={HistoryScreen} />
            <Stack.Screen name="ChangePassword"  component={ChangePasswordScreen} />
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
      <AppNavigator />
    </AuthProvider>
  );
}
