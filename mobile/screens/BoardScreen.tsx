import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import DraggableFlatList, {
  type RenderItemParams,
} from "react-native-draggable-flatlist";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useWorkspace } from "../lib/store";
import { colors } from "../lib/theme";
import { positionForIndex } from "../lib/dnd";
import { Card } from "../components/task-card";
import type { RootStackParamList } from "../lib/navigation";
import type { Task } from "../lib/types";

const INBOX = "__inbox__";

export function BoardScreen() {
  const { tasks, sections, updateTask } = useWorkspace();
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

  function onReorder(data: Task[], from: number, to: number) {
    if (from === to) return;
    const moved = data[to];
    const position = positionForIndex(data, to);
    if (position !== moved.position) updateTask(moved.id, { position });
  }

  return (
    <ScrollView horizontal style={styles.flex} contentContainerStyle={styles.board}>
      {columns.map((col) => (
        <View key={col.id} style={styles.column}>
          <Text style={styles.colTitle}>
            {col.name} <Text style={styles.count}>{col.data.length}</Text>
          </Text>
          <DraggableFlatList
            data={col.data}
            keyExtractor={(t) => t.id}
            onDragEnd={({ data, from, to }) => onReorder(data, from, to)}
            activationDistance={12}
            ListEmptyComponent={<Text style={styles.empty}>No tasks</Text>}
            renderItem={({ item, drag, isActive }: RenderItemParams<Task>) => (
              <Card
                task={item}
                onPress={() => nav.navigate("TaskDetail", { taskId: item.id })}
                onLongPress={drag}
                active={isActive}
              />
            )}
          />
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
  empty: { color: colors.muted, fontSize: 13, padding: 8 },
});
