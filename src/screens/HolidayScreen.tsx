import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, TextInput,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api";
import { COLOURS, Button, Card } from "../components";

// UK bank holidays England & Wales 2025–2026
const BANK_HOLIDAYS = new Set([
  "2025-01-01","2025-04-18","2025-04-21","2025-05-05","2025-05-26",
  "2025-08-25","2025-12-25","2025-12-26",
  "2026-01-01","2026-04-03","2026-04-06","2026-05-04","2026-05-25",
  "2026-08-31","2026-12-25","2026-12-28",
]);

const STATUS_COLOURS: Record<string, string> = {
  pending:  "#f59e0b",
  approved: COLOURS.pass,
  rejected: COLOURS.fail,
};

const REASONS = ["Annual leave", "Family / personal", "Medical", "Other"];
const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

interface AvailInfo { available: boolean; overLimit?: boolean; slotsLeft: number; count: number; }
type AvailMap = Record<string, AvailInfo>;

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseDateStr(s: string): [number, number, number] {
  const [y, m, d] = s.split("-").map(Number);
  return [y, m - 1, d];
}

function isPast(s: string): boolean {
  const [y, m, d] = parseDateStr(s);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(y, m, d) < today;
}

function isWeekend(s: string): boolean {
  const [y, m, d] = parseDateStr(s);
  const day = new Date(y, m, d).getDay();
  return day === 0 || day === 6;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  // Returns 0=Mon … 6=Sun for the 1st of the month
  const day = new Date(year, month, 1).getDay();
  return (day + 6) % 7;
}

type DayStatus = "past" | "weekend" | "bank-holiday" | "full" | "available" | "future";

function getDayStatus(dateStr: string, avail: AvailMap): DayStatus {
  if (isPast(dateStr))              return "past";
  if (isWeekend(dateStr))           return "weekend";
  if (BANK_HOLIDAYS.has(dateStr))   return "bank-holiday";
  if (avail[dateStr]) return avail[dateStr].available ? "available" : "full";
  return "future";
}

function isSelectable(status: DayStatus): boolean {
  return status === "available" || status === "future";
}

function fmtDate(s: string): string {
  const [y, m, d] = parseDateStr(s);
  return new Date(y, m, d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function HolidayScreen({ navigation }: { navigation: any }) {
  const today = new Date();

  const [data,          setData]          = useState<any>(null);
  const [loading,       setLoading]       = useState(true);
  const [showForm,      setShowForm]      = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [viewYear,      setViewYear]      = useState(today.getFullYear());
  const [viewMonth,     setViewMonth]     = useState(today.getMonth());
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [selectedEnd,   setSelectedEnd]   = useState<string | null>(null);
  const [availability,  setAvailability]  = useState<AvailMap>({});
  const [availLoading,  setAvailLoading]  = useState(false);
  const [reason,        setReason]        = useState("");
  const [note,          setNote]          = useState("");

  async function load() {
    try {
      const res = await api.get("/holiday-requests/my");
      setData(res.data);
    } catch {}
    setLoading(false);
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  useEffect(() => {
    if (!showForm) return;
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const start = toDateStr(viewYear, viewMonth, 1);
    const end   = toDateStr(viewYear, viewMonth, daysInMonth);
    setAvailLoading(true);
    api.get(`/holiday-requests/availability?start=${start}&end=${end}`)
      .then(res => {
        const map: AvailMap = {};
        for (const d of (res.data.days ?? [])) {
          map[d.date] = { available: d.available, overLimit: d.overLimit, slotsLeft: d.slotsLeft, count: d.count };
        }
        setAvailability(map);
      })
      .catch(() => setAvailability({}))
      .finally(() => setAvailLoading(false));
  }, [viewYear, viewMonth, showForm]);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  function handleDayPress(dateStr: string) {
    const status = getDayStatus(dateStr, availability);
    if (!isSelectable(status)) return;

    if (!selectedStart || (selectedStart && selectedEnd)) {
      // Fresh start
      setSelectedStart(dateStr);
      setSelectedEnd(null);
    } else {
      // Start is set, picking end
      if (dateStr === selectedStart) {
        setSelectedStart(null);
      } else if (dateStr < selectedStart) {
        setSelectedStart(dateStr);
        setSelectedEnd(null);
      } else {
        setSelectedEnd(dateStr);
      }
    }
  }

  function isInRange(dateStr: string): boolean {
    if (!selectedStart || !selectedEnd) return false;
    return dateStr > selectedStart && dateStr < selectedEnd;
  }

  function buildCalendarDays(): (string | null)[] {
    const totalDays  = getDaysInMonth(viewYear, viewMonth);
    const firstDay   = getFirstDayOfWeek(viewYear, viewMonth);
    const days: (string | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= totalDays; d++) {
      days.push(toDateStr(viewYear, viewMonth, d));
    }
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }

  function hasFullDaysInRange(): boolean {
    if (!selectedStart || !selectedEnd) return false;
    const [sy, sm, sd] = parseDateStr(selectedStart);
    const [ey, em, ed] = parseDateStr(selectedEnd);
    const cur  = new Date(sy, sm, sd);
    const stop = new Date(ey, em, ed);
    while (cur <= stop) {
      const s = toDateStr(cur.getFullYear(), cur.getMonth(), cur.getDate());
      if (!isWeekend(s) && !BANK_HOLIDAYS.has(s) && !isPast(s)) {
        if (availability[s] && !availability[s].available) return true;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return false;
  }

  const fullDays  = hasFullDaysInRange();
  const canSubmit = !!selectedStart && !!selectedEnd && !!reason;

  async function handleSubmit() {
    if (!selectedStart || !selectedEnd) {
      Alert.alert("No dates selected", "Please tap a start date then an end date on the calendar.");
      return;
    }
    if (!reason) { Alert.alert("Required", "Please select a reason"); return; }

    if (fullDays) {
      Alert.alert(
        "Holiday limit warning",
        "One or more selected days are already at the company holiday limit. You can still send the request, but planner approval is needed as an exception.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Send anyway", onPress: () => submitHolidayRequest() },
        ],
      );
      return;
    }

    await submitHolidayRequest();
  }

  async function submitHolidayRequest() {
    if (!selectedStart || !selectedEnd) return;

    setSubmitting(true);
    try {
      const res = await api.post("/holiday-requests", { startDate: selectedStart, endDate: selectedEnd, reason, note });
      Alert.alert("Request received", res.data?.warning ?? "We've got your holiday request and will get back to you as soon as we can.");
      setShowForm(false);
      setSelectedStart(null); setSelectedEnd(null);
      setReason(""); setNote("");
      await load();
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.error ?? "Could not submit request");
    }
    setSubmitting(false);
  }

  if (loading) return (
    <SafeAreaView style={styles.center}>
      <ActivityIndicator size="large" color={COLOURS.primary} />
    </SafeAreaView>
  );

  const calendarDays = buildCalendarDays();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Holiday Requests</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

        {/* Allowance summary */}
        {data && (
          <Card style={{ marginBottom: 12 }}>
            <Text style={styles.sectionLabel}>Holiday Allowance</Text>
            <View style={styles.allowanceRow}>
              <View style={styles.allowanceStat}>
                <Text style={styles.allowanceValue}>{data.holidayAllowance}</Text>
                <Text style={styles.allowanceLabel}>Total Days</Text>
              </View>
              <View style={styles.allowanceDivider} />
              <View style={styles.allowanceStat}>
                <Text style={[styles.allowanceValue, { color: COLOURS.fail }]}>{data.holidayUsed}</Text>
                <Text style={styles.allowanceLabel}>Used</Text>
              </View>
              <View style={styles.allowanceDivider} />
              <View style={styles.allowanceStat}>
                <Text style={[styles.allowanceValue, { color: COLOURS.pass }]}>{data.holidayRemaining}</Text>
                <Text style={styles.allowanceLabel}>Remaining</Text>
              </View>
            </View>
            {data.maxPerDay != null && (
              <Text style={styles.maxNote}>
                Max {data.maxPerDay} driver{data.maxPerDay !== 1 ? "s" : ""} on holiday per day
              </Text>
            )}
          </Card>
        )}

        {/* New request — calendar form */}
        {showForm ? (
          <Card style={{ marginBottom: 12 }}>
            <Text style={styles.sectionLabel}>New Holiday Request</Text>

            {/* Month navigation */}
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={prevMonth} style={styles.monthArrowBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.monthArrow}>‹</Text>
              </TouchableOpacity>
              <View style={styles.monthTitleWrap}>
                {availLoading && <ActivityIndicator size="small" color={COLOURS.primary} style={{ marginRight: 8 }} />}
                <Text style={styles.monthTitle}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
              </View>
              <TouchableOpacity onPress={nextMonth} style={styles.monthArrowBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.monthArrow}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Weekday headers */}
            <View style={styles.calGrid}>
              {DAY_HEADERS.map(h => (
                <View key={h} style={styles.dayHeaderCell}>
                  <Text style={styles.dayHeaderText}>{h}</Text>
                </View>
              ))}

              {/* Day cells */}
              {calendarDays.map((dateStr, idx) => {
                if (!dateStr) {
                  return <View key={`gap-${idx}`} style={styles.dayCell} />;
                }

                const status    = getDayStatus(dateStr, availability);
                const isStart   = dateStr === selectedStart;
                const isEnd     = dateStr === selectedEnd;
                const inRange   = isInRange(dateStr);
                const selectable = isSelectable(status);
                const dayNum    = parseDateStr(dateStr)[2];

                let cellBg: string  = "transparent";
                let textCol: string = COLOURS.primary;
                let dotCol:  string | null = null;
                let textOpacity = 1;

                if (isStart || isEnd) {
                  cellBg  = COLOURS.primary;
                  textCol = "#fff";
                } else if (inRange) {
                  cellBg = COLOURS.primary + "30";
                }

                if (!isStart && !isEnd) {
                  if (status === "past" || status === "weekend") {
                    textCol     = COLOURS.muted;
                    textOpacity = 0.45;
                  } else if (status === "bank-holiday") {
                    textCol = "#7c3aed";
                    dotCol  = "#7c3aed";
                  } else if (status === "full") {
                    textCol = COLOURS.fail;
                    dotCol  = COLOURS.fail;
                  } else if (status === "available") {
                    dotCol = COLOURS.pass;
                  }
                }

                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={[styles.dayCell, { backgroundColor: cellBg }]}
                    onPress={() => handleDayPress(dateStr)}
                    disabled={!selectable}
                    activeOpacity={selectable ? 0.65 : 1}
                  >
                    <Text style={[styles.dayCellText, { color: textCol, opacity: textOpacity }]}>
                      {dayNum}
                    </Text>
                    {dotCol ? (
                      <View style={[styles.dot, { backgroundColor: isStart || isEnd ? "#fff" : dotCol }]} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Legend */}
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: COLOURS.pass }]} />
                <Text style={styles.legendText}>Available</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: COLOURS.fail }]} />
                <Text style={styles.legendText}>Full</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#7c3aed" }]} />
                <Text style={styles.legendText}>Bank holiday</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: COLOURS.muted, opacity: 0.45 }]} />
                <Text style={styles.legendText}>Unavailable</Text>
              </View>
            </View>

            {/* Selection summary */}
            <View style={styles.rangeSummary}>
              {!selectedStart ? (
                <Text style={styles.rangePlaceholder}>Tap a day to start your selection</Text>
              ) : !selectedEnd ? (
                <Text style={styles.rangeText}>From {fmtDate(selectedStart)} — tap an end date</Text>
              ) : (
                <>
                  <Text style={styles.rangeText}>
                    {fmtDate(selectedStart)} → {fmtDate(selectedEnd)}
                  </Text>
                  {fullDays && (
                    <Text style={styles.rangeWarn}>
                      One or more days are fully booked — speak to your manager
                    </Text>
                  )}
                </>
              )}
            </View>

            {/* Reason */}
            <Text style={styles.fieldLabel}>Reason</Text>
            {REASONS.map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.reasonBtn, reason === r && styles.reasonBtnActive]}
                onPress={() => setReason(r)}
              >
                <Text style={[styles.reasonBtnText, reason === r && styles.reasonBtnTextActive]}>{r}</Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.fieldLabel}>
              Note <Text style={styles.optional}>(optional)</Text>
            </Text>
            <TextInput
              style={[styles.input, { minHeight: 60 }]}
              value={note}
              onChangeText={setNote}
              placeholder="Any additional information..."
              placeholderTextColor={COLOURS.muted}
              multiline
            />

            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <Button
                label={submitting ? "Submitting..." : "Submit Request"}
                onPress={handleSubmit}
                loading={submitting}
                disabled={submitting || !canSubmit}
                style={{ flex: 1, backgroundColor: canSubmit ? COLOURS.primary : COLOURS.muted }}
              />
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowForm(false);
                  setSelectedStart(null); setSelectedEnd(null);
                  setReason(""); setNote("");
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ) : (
          <TouchableOpacity style={styles.requestBtn} onPress={() => setShowForm(true)}>
            <Text style={styles.requestBtnText}>+ Request Holiday</Text>
          </TouchableOpacity>
        )}

        {/* Past requests */}
        <Text style={styles.sectionLabel}>Your Requests</Text>
        {!data?.data?.length ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏖</Text>
            <Text style={styles.emptyText}>No holiday requests yet</Text>
          </View>
        ) : (
          data.data.map((r: any) => (
            <Card key={r.id} style={{ marginBottom: 10 }}>
              <View style={styles.requestHeader}>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOURS[r.status] + "20" }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLOURS[r.status] }]}>
                    {r.status.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.requestDays}>{r.totalDays} day{r.totalDays !== 1 ? "s" : ""}</Text>
              </View>
              <Text style={styles.requestDates}>
                {new Date(r.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                {" → "}
                {new Date(r.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </Text>
              <Text style={styles.requestReason}>{r.reason}</Text>
              {r.plannerNote ? (
                <View style={styles.plannerNote}>
                  <Text style={styles.plannerNoteText}>💬 {r.plannerNote}</Text>
                </View>
              ) : null}
              <Text style={styles.requestDate}>
                Submitted {new Date(r.createdAt).toLocaleDateString("en-GB")}
              </Text>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: COLOURS.background },
  center:           { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLOURS.white,
    borderBottomWidth: 1, borderBottomColor: COLOURS.border,
  },
  backText:         { color: COLOURS.accent, fontSize: 15, fontWeight: "600" },
  topTitle:         { fontSize: 17, fontWeight: "700", color: COLOURS.primary },
  sectionLabel:     { fontSize: 10, color: COLOURS.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  allowanceRow:     { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  allowanceStat:    { flex: 1, alignItems: "center" },
  allowanceValue:   { fontSize: 28, fontWeight: "900", color: COLOURS.primary },
  allowanceLabel:   { fontSize: 10, color: COLOURS.muted, textTransform: "uppercase" },
  allowanceDivider: { width: 1, height: 40, backgroundColor: COLOURS.border },
  maxNote:          { fontSize: 11, color: COLOURS.muted, textAlign: "center", fontStyle: "italic" },
  requestBtn: {
    borderWidth: 1.5, borderColor: COLOURS.primary, borderRadius: 10,
    padding: 14, alignItems: "center", marginBottom: 16, borderStyle: "dashed",
  },
  requestBtnText:   { fontSize: 14, fontWeight: "700", color: COLOURS.primary },
  // Calendar
  monthNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 10,
  },
  monthArrowBtn:    { padding: 4 },
  monthArrow:       { fontSize: 26, color: COLOURS.primary, fontWeight: "700", lineHeight: 30 },
  monthTitleWrap:   { flexDirection: "row", alignItems: "center" },
  monthTitle:       { fontSize: 16, fontWeight: "700", color: COLOURS.primary },
  calGrid: {
    flexDirection: "row", flexWrap: "wrap",
    marginBottom: 6,
  },
  dayHeaderCell:    { width: "14.285714%", alignItems: "center", paddingVertical: 5 },
  dayHeaderText:    { fontSize: 10, fontWeight: "700", color: COLOURS.muted },
  dayCell: {
    width: "14.285714%", aspectRatio: 1,
    alignItems: "center", justifyContent: "center", borderRadius: 8, padding: 2,
  },
  dayCellText:      { fontSize: 13, fontWeight: "600" },
  dot:              { width: 4, height: 4, borderRadius: 2, marginTop: 1 },
  legend: {
    flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10,
  },
  legendItem:       { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot:        { width: 8, height: 8, borderRadius: 4 },
  legendText:       { fontSize: 11, color: COLOURS.muted },
  rangeSummary: {
    backgroundColor: COLOURS.background, borderRadius: 8,
    padding: 10, marginBottom: 10, minHeight: 40, justifyContent: "center",
  },
  rangePlaceholder: { fontSize: 13, color: COLOURS.muted, fontStyle: "italic" },
  rangeText:        { fontSize: 13, fontWeight: "600", color: COLOURS.primary },
  rangeWarn:        { fontSize: 11, color: COLOURS.fail, marginTop: 4 },
  fieldLabel:       { fontSize: 12, fontWeight: "600", color: COLOURS.primary, marginBottom: 4, marginTop: 8 },
  input: {
    borderWidth: 1.5, borderColor: COLOURS.border, borderRadius: 8,
    padding: 12, fontSize: 14, color: COLOURS.primary, marginBottom: 4,
  },
  reasonBtn: {
    padding: 10, borderRadius: 8, borderWidth: 1.5,
    borderColor: COLOURS.border, marginBottom: 6,
  },
  reasonBtnActive:     { backgroundColor: COLOURS.primary, borderColor: COLOURS.primary },
  reasonBtnText:       { fontSize: 13, color: COLOURS.muted, fontWeight: "600" },
  reasonBtnTextActive: { color: COLOURS.white },
  optional:            { fontWeight: "400", color: COLOURS.muted },
  cancelBtn: {
    borderWidth: 1.5, borderColor: COLOURS.border, borderRadius: 8,
    padding: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 20,
  },
  cancelBtnText:    { color: COLOURS.muted, fontWeight: "600" },
  emptyState:       { alignItems: "center", paddingVertical: 32 },
  emptyIcon:        { fontSize: 40, marginBottom: 8 },
  emptyText:        { fontSize: 14, color: COLOURS.muted },
  requestHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  statusBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText:       { fontSize: 10, fontWeight: "700" },
  requestDays:      { fontSize: 13, fontWeight: "700", color: COLOURS.primary },
  requestDates:     { fontSize: 14, fontWeight: "600", color: COLOURS.primary, marginBottom: 2 },
  requestReason:    { fontSize: 12, color: COLOURS.muted, marginBottom: 4 },
  plannerNote:      { backgroundColor: "#eff6ff", borderRadius: 6, padding: 8, marginBottom: 4 },
  plannerNoteText:  { fontSize: 12, color: "#1e40af" },
  requestDate:      { fontSize: 11, color: COLOURS.muted },
});
