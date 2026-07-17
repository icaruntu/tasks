import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useWorkspace } from "../lib/store";
import { colors } from "../lib/theme";
import { PRIORITY_META, type Task } from "../lib/types";
import type { RootStackParamList } from "../lib/navigation";

export function CalendarScreen() {
  const { tasks } = useWorkspace();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [month, setMonth] = useState(() => new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.due_date || t.completed) continue;
      const key = format(new Date(t.due_date), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [tasks]);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Text style={styles.month}>{format(month, "MMMM yyyy")}</Text>
        <View style={styles.navBtns}>
          <Pressable style={styles.navBtn} onPress={() => setMonth((m) => addMonths(m, -1))}>
            <Text style={styles.navBtnText}>‹</Text>
          </Pressable>
          <Pressable style={styles.navBtn} onPress={() => setMonth(new Date())}>
            <Text style={styles.todayText}>Today</Text>
          </Pressable>
          <Pressable style={styles.navBtn} onPress={() => setMonth((m) => addMonths(m, 1))}>
            <Text style={styles.navBtnText}>›</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.weekRow}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <Text key={d} style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayTasks = byDay.get(key) ?? [];
          const dim = !isSameMonth(day, month);
          return (
            <View key={key} style={[styles.cell, dim && { opacity: 0.4 }]}>
              <View style={[styles.dayNum, isToday(day) && styles.today]}>
                <Text style={[styles.dayNumText, isToday(day) && { color: "#fff" }]}>
                  {format(day, "d")}
                </Text>
              </View>
              {dayTasks.slice(0, 3).map((t) => (
                <Pressable
                  key={t.id}
                  style={styles.chip}
                  onPress={() => nav.navigate("TaskDetail", { taskId: t.id })}
                >
                  {t.priority && (
                    <View style={[styles.chipDot, { backgroundColor: PRIORITY_META[t.priority].color }]} />
                  )}
                  <Text numberOfLines={1} style={styles.chipText}>
                    {t.name}
                  </Text>
                </Pressable>
              ))}
              {dayTasks.length > 3 && (
                <Text style={styles.more}>+{dayTasks.length - 3}</Text>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  month: { fontSize: 18, fontWeight: "700", color: colors.text },
  navBtns: { flexDirection: "row", gap: 6 },
  navBtn: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.bgMuted, borderRadius: 8 },
  navBtnText: { fontSize: 16, color: colors.text },
  todayText: { fontSize: 13, color: colors.text },
  weekRow: { flexDirection: "row", paddingHorizontal: 4 },
  weekday: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", color: colors.muted, paddingVertical: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 4 },
  cell: { width: `${100 / 7}%`, minHeight: 74, padding: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  dayNum: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  today: { backgroundColor: colors.primary },
  dayNumText: { fontSize: 11, color: colors.muted },
  chip: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.bgMuted, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2, marginBottom: 2 },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 10, color: colors.text, flex: 1 },
  more: { fontSize: 10, color: colors.muted, paddingLeft: 4 },
});
