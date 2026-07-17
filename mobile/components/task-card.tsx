import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../lib/theme";
import { Check, PriorityDot, DueLabel } from "./common";
import { useWorkspace } from "../lib/store";
import type { Task } from "../lib/types";

/** A board card. Long-press begins a drag (passed in as onLongPress). */
export function Card({
  task,
  onPress,
  onLongPress,
  active,
}: {
  task: Task;
  onPress: () => void;
  onLongPress?: () => void;
  active?: boolean;
}) {
  const { toggleComplete } = useWorkspace();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={180}
      style={[styles.card, active && styles.active]}
    >
      <View style={styles.top}>
        <Check size={18} checked={task.completed} onPress={() => toggleComplete(task.id, !task.completed)} />
        <Text style={styles.name}>{task.name}</Text>
      </View>
      <View style={styles.meta}>
        <PriorityDot priority={task.priority} />
        <DueLabel date={task.due_date} />
        {task.subtask_count > 0 && (
          <Text style={styles.metaText}>☑ {task.subtask_done}/{task.subtask_count}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.bg, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  active: { borderColor: colors.primary, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  name: { flex: 1, fontSize: 15, color: colors.text },
  meta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, paddingLeft: 26 },
  metaText: { fontSize: 11, color: colors.muted },
});
