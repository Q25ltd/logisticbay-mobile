/**
 * React Navigation typed param list for the entire app.
 *
 * Every screen's params are declared here. TypeScript will enforce that
 * navigation.navigate() calls pass the right params, and that screens
 * read params with the correct types — no more `route: any` casts.
 */
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

export type RootStackParamList = {
  // Auth
  Login:          undefined;
  // Post-login routing
  Initial:        undefined;
  // Main screens
  Home:           undefined;
  // Shift flow
  StartShift:     undefined;
  TruckChecklist:   { type?: "truck" | "trailer"; returnTo?: string; onComplete?: () => void };
  TrailerChecklist: { type?: "truck" | "trailer"; returnTo?: string; onComplete?: () => void };
  Deliveries:     undefined;
  EndSegment:     undefined;
  EndShift:       undefined;
  Review:         undefined;
  ChangeVehicle:  { changeType?: "truck" | "trailer" };
  // Jobs
  Jobs:           undefined;
  JobDetail:      { jobId: number; viewOnly?: boolean };
  // History
  History:        undefined;
  ShiftDetail:    { shiftId: number };
  // Profile
  ChangePin:      { forced?: boolean };
  Holidays:       undefined;
};

// ── Per-screen prop types — import these in each screen file ──────────────────

export type LoginScreenProps          = NativeStackScreenProps<RootStackParamList, "Login">;
export type InitialScreenProps        = NativeStackScreenProps<RootStackParamList, "Initial">;
export type HomeScreenProps           = NativeStackScreenProps<RootStackParamList, "Home">;
export type StartShiftScreenProps     = NativeStackScreenProps<RootStackParamList, "StartShift">;
export type TruckChecklistScreenProps = NativeStackScreenProps<RootStackParamList, "TruckChecklist">;
export type DeliveriesScreenProps     = NativeStackScreenProps<RootStackParamList, "Deliveries">;
export type EndSegmentScreenProps     = NativeStackScreenProps<RootStackParamList, "EndSegment">;
export type EndShiftScreenProps       = NativeStackScreenProps<RootStackParamList, "EndShift">;
export type ReviewScreenProps         = NativeStackScreenProps<RootStackParamList, "Review">;
export type ChangeVehicleScreenProps  = NativeStackScreenProps<RootStackParamList, "ChangeVehicle">;
export type JobsScreenProps           = NativeStackScreenProps<RootStackParamList, "Jobs">;
export type JobDetailScreenProps      = NativeStackScreenProps<RootStackParamList, "JobDetail">;
export type HistoryScreenProps        = NativeStackScreenProps<RootStackParamList, "History">;
export type ShiftDetailScreenProps    = NativeStackScreenProps<RootStackParamList, "ShiftDetail">;
export type ChangePinScreenProps      = NativeStackScreenProps<RootStackParamList, "ChangePin">;
export type HolidaysScreenProps       = NativeStackScreenProps<RootStackParamList, "Holidays">;
