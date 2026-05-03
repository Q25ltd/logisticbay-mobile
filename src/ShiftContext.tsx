import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useState } from "react";
import {
  buildChecklist, getChecksForClass,
  type VehicleClass, type CheckEntry, type CheckResult,
} from "./constants";

export type { CheckEntry, CheckResult };

export interface DeliveryEntry {
  id:          string;
  materials:   string;
  collectFrom: string;
  deliverTo:   string;
  ticketNo:    string;
  startTime:   string;
  finishTime:  string;
  hours:       string;
  loadType:    "weight" | "pallets" | "hours" | "other";
  pallets:     string;
  tonnes:      string;
  kgs:         string;
  notes:       string;
}

export interface Segment {
  id:               string;
  segmentNumber:    number;
  vehicleClass:     VehicleClass;
  truckReg:         string;
  trailerReg:       string;
  hasTrailer:       boolean;
  needsTruckCheck:   boolean;
  needsTrailerCheck: boolean;
  odometerStart:    string;
  odometerEnd:      string;
  fuelDrawn:        string;
  adBlueDrawn:      string;
  truckChecks:      CheckEntry[];
  trailerChecks:    CheckEntry[];
  deliveries:       DeliveryEntry[];
  notes:            string;
  startTime:        Date;
}

export type OdometerUnit = "km" | "miles";

export interface ShiftDraft {
  shiftId:         number | null;
  lastScreen:      string;
  lastJobId:       number | null;
  odometerUnit:    OdometerUnit;
  shiftDate:       Date;
  oilWaterChecked: boolean;
  startTime:       string;
  finishTime:      string;
  breakMins:       number;
  poaMins:         number;
  totalHours:      string;
  totalMins:       number;
  workingMins:     number;
  fuelDrawn:       string;
  adBlueDrawn:     string;
  odometerEnd:     string;
  truckReg:        string;
  segments:        Segment[];
  nightOut:        boolean;
  expenses:        string;
  delaysNote:      string;
  defectsNote:     string;
}

function newSegment(
  vehicleClass:      VehicleClass  = "class1",
  truckReg:          string        = "",
  trailerReg:        string        = "",
  hasTrailer:        boolean       = true,
  needsTruckCheck:   boolean       = true,
  needsTrailerCheck: boolean       = true,
  segmentNumber:     number        = 1,
): Segment {
  return {
    id:               Math.random().toString(36).slice(2),
    segmentNumber,
    vehicleClass,
    truckReg,
    trailerReg,
    hasTrailer:        vehicleClass === "class1" ? hasTrailer : false,
    needsTruckCheck,
    needsTrailerCheck: vehicleClass === "class1" ? needsTrailerCheck : false,
    odometerStart:    "",
    odometerEnd:      "",
    fuelDrawn:        "",
    adBlueDrawn:      "",
    truckChecks:      needsTruckCheck ? buildChecklist(getChecksForClass(vehicleClass, "truck")) : [],
    trailerChecks:    (vehicleClass === "class1" && hasTrailer && needsTrailerCheck)
                        ? buildChecklist(getChecksForClass("class1", "trailer"))
                        : [],
    deliveries:       [],
    notes:            "",
    startTime:        new Date(),
  };
}

function emptyDraft(): ShiftDraft {
  return {
    shiftId:         null,
    lastScreen:      "StartShift",
    lastJobId:       null,
    odometerUnit:    "km",
    shiftDate:       new Date(),
    oilWaterChecked: false,
    startTime:       "",
    finishTime:      "",
    breakMins:       0,
    poaMins:         0,
    totalHours:      "",
    totalMins:       0,
    workingMins:     0,
    fuelDrawn:       "",
    adBlueDrawn:     "",
    odometerEnd:     "",
    truckReg:        "",
    segments:        [newSegment()],
    nightOut:        false,
    expenses:        "",
    delaysNote:      "",
    defectsNote:     "",
  };
}

interface ShiftContextType {
  draft:            ShiftDraft;
  draftRestored:    boolean;
  currentSegment:   Segment;
  setDraft:         (d: ShiftDraft) => void;
  updateShiftField: (field: keyof ShiftDraft, value: any) => void;
  updateSegment:    (updates: Partial<Segment>) => void;
  addDelivery:      (d: DeliveryEntry) => void;
  removeDelivery:   (id: string) => void;
  updateDelivery:   (id: string, updates: Partial<DeliveryEntry>) => void;
  addSegment:       (vehicleClass: VehicleClass, truckReg: string, trailerReg: string, hasTrailer: boolean, needsTruckCheck: boolean, needsTrailerCheck: boolean, odometerStartOverride?: string) => void;
  changeVehicle:    (prevOdomEnd: string, prevFuel: string, prevAdBlue: string, vehicleClass: VehicleClass, truckReg: string, trailerReg: string, hasTrailer: boolean, needsTruckCheck: boolean, needsTrailerCheck: boolean) => void;
  resetDraft:       () => void;
  setShiftId:       (id: number) => void;
  setVehicleClass:  (vc: VehicleClass) => void;
}

const ShiftContext = createContext<ShiftContextType | null>(null);

const DRAFT_KEY = "activeDraft";

async function persistDraft(d: ShiftDraft) {
  try { await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch {}
}

export async function clearPersistedDraft() {
  try { await AsyncStorage.removeItem(DRAFT_KEY); } catch {}
}

export function ShiftProvider({ children }: { children: React.ReactNode }) {
  const [draft,         setDraftState]  = useState<ShiftDraft>(emptyDraft());
  const [draftRestored, setDraftRestored] = useState(false);

  const currentSegment = draft.segments[draft.segments.length - 1];

  // Restore draft on app open
  React.useEffect(() => {
    AsyncStorage.getItem(DRAFT_KEY).then(val => {
      if (val) {
        try {
          const saved = JSON.parse(val);
          if (saved?.shiftId) {
            setDraftState(saved);
          }
        } catch {}
      }
      setDraftRestored(true);
    });
  }, []);

  // Wrap setDraft to auto-persist every change
  function setDraft(updater: ((d: ShiftDraft) => ShiftDraft) | ShiftDraft) {
    setDraftState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      persistDraft(next);
      return next;
    });
  }

  function updateShiftField(field: keyof ShiftDraft, value: any) {
    setDraft(d => ({ ...d, [field]: value }));
  }

  function updateSegment(updates: Partial<Segment>) {
    setDraft(d => {
      const segs = [...d.segments];
      segs[segs.length - 1] = { ...segs[segs.length - 1], ...updates };
      return { ...d, segments: segs };
    });
  }

  function setVehicleClass(vc: VehicleClass) {
    setDraft(d => {
      const segs = [...d.segments];
      const last = segs[segs.length - 1];
      const hasTrailer = vc === "class1" ? last.hasTrailer : false;
      segs[segs.length - 1] = {
        ...last,
        vehicleClass:  vc,
        hasTrailer,
        truckChecks:   buildChecklist(getChecksForClass(vc, "truck")),
        trailerChecks: (vc === "class1" && hasTrailer)
                         ? buildChecklist(getChecksForClass("class1", "trailer"))
                         : [],
      };
      return { ...d, segments: segs };
    });
  }

  function addDelivery(delivery: DeliveryEntry) {
    setDraft(d => {
      const segs = [...d.segments];
      const last = segs[segs.length - 1];
      segs[segs.length - 1] = { ...last, deliveries: [...last.deliveries, delivery] };
      return { ...d, segments: segs };
    });
  }

  function removeDelivery(id: string) {
    setDraft(d => {
      const segs = [...d.segments];
      const last = segs[segs.length - 1];
      segs[segs.length - 1] = { ...last, deliveries: last.deliveries.filter(x => x.id !== id) };
      return { ...d, segments: segs };
    });
  }

  function updateDelivery(id: string, updates: Partial<DeliveryEntry>) {
    setDraft(d => {
      const segs = [...d.segments];
      const last = segs[segs.length - 1];
      segs[segs.length - 1] = {
        ...last,
        deliveries: last.deliveries.map(x => x.id === id ? { ...x, ...updates } : x),
      };
      return { ...d, segments: segs };
    });
  }

  function addSegment(
    vehicleClass:      VehicleClass,
    truckReg:          string,
    trailerReg:        string,
    hasTrailer:        boolean,
    needsTruckCheck:   boolean,
    needsTrailerCheck: boolean,
    odometerStartOverride?: string, // used when truck changes — new truck has its own start reading
  ) {
    setDraft(d => {
      const prevSeg   = d.segments[d.segments.length - 1];
      // Use override if provided (truck change), otherwise carry over from previous segment
      const odomStart = odometerStartOverride || prevSeg?.odometerEnd || prevSeg?.odometerStart || "";
      const seg       = newSegment(vehicleClass, truckReg, trailerReg, hasTrailer, needsTruckCheck, needsTrailerCheck, d.segments.length + 1);
      seg.odometerStart = odomStart;
      return { ...d, segments: [...d.segments, seg] };
    });
  }

  function changeVehicle(
    prevOdomEnd: string,
    prevFuel:    string,
    prevAdBlue:  string,
    vehicleClass:      VehicleClass,
    truckReg:          string,
    trailerReg:        string,
    hasTrailer:        boolean,
    needsTruckCheck:   boolean,
    needsTrailerCheck: boolean,
  ) {
    setDraft(d => {
      const segs    = [...d.segments];
      const lastIdx = segs.length - 1;
      // Lock the departing vehicle's final readings atomically before creating the new segment
      segs[lastIdx] = {
        ...segs[lastIdx],
        odometerEnd: prevOdomEnd || segs[lastIdx].odometerEnd || "",
        fuelDrawn:   prevFuel    || segs[lastIdx].fuelDrawn   || "",
        adBlueDrawn: prevAdBlue  || segs[lastIdx].adBlueDrawn || "",
      };
      // Carry the departing truck's final odometer as the new truck's start reading
      const odomStart = segs[lastIdx].odometerEnd || segs[lastIdx].odometerStart || "";
      const newSeg    = newSegment(vehicleClass, truckReg, trailerReg, hasTrailer, needsTruckCheck, needsTrailerCheck, segs.length + 1);
      newSeg.odometerStart = odomStart;
      return { ...d, truckReg, segments: [...segs, newSeg] };
    });
  }

  function resetDraft() {
    setDraftState(emptyDraft());
    clearPersistedDraft();
  }
  function setShiftId(id: number) { setDraft(d => ({ ...d, shiftId: id })); }

  return (
    <ShiftContext.Provider value={{
      draft,
      draftRestored, currentSegment, setDraft,
      updateShiftField, updateSegment, setVehicleClass,
      addDelivery, removeDelivery, updateDelivery,
      addSegment, changeVehicle, resetDraft, setShiftId,
    }}>
      {children}
    </ShiftContext.Provider>
  );
}

export function useShift() {
  const ctx = useContext(ShiftContext);
  if (!ctx) throw new Error("useShift must be inside ShiftProvider");
  return ctx;
}
