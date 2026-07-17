import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { formatDistanceToNow } from "date-fns";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useWorkspace } from "../lib/store";
import { colors } from "../lib/theme";
import type { RootStackParamList } from "../lib/navigation";

const ICON: Record<string, string> = {
  assigned: "📌",
  mentioned: "💬",
  comment: "💬",
  due_soon: "⏰",
  overdue: "🔴",
  daily_digest: "📅",
};

export function NotificationsScreen() {
  const { notifications, unreadCount, markAllNotificationsRead } = useWorkspace();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.flex}>
      {unreadCount > 0 && (
        <Pressable style={styles.markAll} onPress={markAllNotificationsRead}>
          <Text style={styles.markAllText}>Mark all read</Text>
        </Pressable>
      )}
      <ScrollView>
        {notifications.length === 0 && (
          <Text style={styles.empty}>You’re all caught up.</Text>
        )}
        {notifications.map((n) => (
          <Pressable
            key={n.id}
            style={[styles.row, !n.read_at && styles.unread]}
            onPress={() => {
              if (n.task_id) nav.navigate("TaskDetail", { taskId: n.task_id });
            }}
          >
            <Text style={styles.icon}>{ICON[n.type] ?? "🔔"}</Text>
            <View style={styles.flex}>
              <Text style={styles.title}>{n.title}</Text>
              {n.body && <Text style={styles.body}>{n.body}</Text>}
              <Text style={styles.time}>
                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
              </Text>
            </View>
            {!n.read_at && <View style={styles.dot} />}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  markAll: { padding: 12, alignItems: "flex-end" },
  markAllText: { color: colors.primary, fontSize: 13 },
  empty: { textAlign: "center", color: colors.muted, marginTop: 48 },
  row: { flexDirection: "row", gap: 10, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  unread: { backgroundColor: colors.bgMuted },
  icon: { fontSize: 16 },
  title: { fontSize: 14, fontWeight: "600", color: colors.text },
  body: { fontSize: 12, color: colors.muted, marginTop: 2 },
  time: { fontSize: 11, color: colors.muted, marginTop: 3 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 4 },
});
