import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useWorkspace } from "../lib/store";
import { colors } from "../lib/theme";
import { Check, PriorityDot, DueLabel } from "../components/common";
import type { RootStackParamList } from "../lib/navigation";
import type { Task } from "../lib/types";

const INBOX = "__inbox__";

export function BoardScreen() {
  const { tasks, sections, toggleComplete } = useWorkspace();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const columns = useMemo(() => {
    const cols = [
      { id: INBOX, name: "Inbox", data: [] as Task[] },
      ...sections.map((s) => ({ id: s.id, name: s.name, data: [] as Task[] })),
    ];
    for (const t of tasks) {
      if (t.completed) continue;
      const col = cols.find((c) => c.id === (t.section_id ?? INBOX)) ?? cols[0];
      col.data.push(t);
    }
    for (const c of cols) c.data.sort((a, b) => a.position - b.position);
    return cols;
  }, [tasks, sections]);

  return (
    <ScrollView horizontal style={styles.flex} contentContainerStyle={styles.board}>
      {columns.map((col) => (
        <View key={col.id} style={styles.column}>
          <Text style={styles.colTitle}>
            {col.name} <Text style={styles.count}>{col.data.length}</Text>
          </Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {col.data.map((t) => (
              <Pressable
                key={t.id}
                style={styles.card}
                onPress={() => nav.navigate("TaskDetail", { taskId: t.id })}
              >
                <View style={styles.cardTop}>
                  <Check size={18} checked={t.completed} onPress={() => toggleComplete(t.id, !t.completed)} />
                  <Text style={styles.cardName}>{t.name}</Text>
                </View>
                <View style={styles.cardMeta}>
                  <PriorityDot priority={t.priority} />
                  <DueLabel date={t.due_date} />
                  {t.subtask_count > 0 && (
                    <Text style={styles.metaText}>☑ {t.subtask_done}/{t.subtask_count}</Text>
                  )}
                </View>
              </Pressable>
            ))}
            {col.data.length === 0 && <Text style={styles.empty}>No tasks</Text>}
          </ScrollView>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  board: { padding: 12, gap: 12 },
  column: { width: 260, backgroundColor: colors.bgMuted, borderRadius: 12, padding: 10 },
  colTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 8, paddingHorizontal: 2 },
  count: { color: colors.muted, fontWeight: "400" },
  card: { backgroundColor: colors.bg, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  cardName: { flex: 1, fontSize: 15, color: colors.text },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, paddingLeft: 26 },
  metaText: { fontSize: 11, color: colors.muted },
  empty: { color: colors.muted, fontSize: 13, padding: 8 },
});
