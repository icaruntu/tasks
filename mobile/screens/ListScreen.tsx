import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useWorkspace } from "../lib/store";
import { colors, INBOX } from "../lib/theme";
import { Check, PriorityDot, DueLabel, Avatar } from "../components/common";
import type { RootStackParamList } from "../lib/navigation";
import type { Task } from "../lib/types";

const PROJECT_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"];

export function ListScreen() {
  const {
    tasks,
    sections,
    projects,
    subtasksOf,
    createTask,
    createSection,
    createProject,
    setTaskProjects,
    unreadCount,
  } = useWorkspace();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [adding, setAdding] = useState<string | null>(null); // section id being added to
  const [draft, setDraft] = useState("");

  const visible = useMemo(
    () =>
      tasks.filter((t) => {
        if (!showCompleted && t.completed) return false;
        if (projectFilter && !t.project_ids.includes(projectFilter)) return false;
        return true;
      }),
    [tasks, showCompleted, projectFilter],
  );

  const grouped = useMemo(() => {
    const groups: { title: string; sectionId: string | null; data: Task[] }[] = [
      { title: "Inbox", sectionId: null, data: [] },
      ...sections.map((s) => ({ title: s.name, sectionId: s.id, data: [] as Task[] })),
    ];
    for (const t of visible) {
      const g = groups.find((x) => x.sectionId === (t.section_id ?? null)) ?? groups[0];
      g.data.push(t);
    }
    for (const g of groups) g.data.sort((a, b) => a.position - b.position);
    return groups.filter((g) => g.data.length > 0 || g.sectionId !== null);
  }, [visible, sections]);

  async function submitTask(sectionId: string | null) {
    const name = draft.trim();
    if (!name) {
      setAdding(null);
      return;
    }
    const maxPos = tasks
      .filter((t) => (t.section_id ?? null) === sectionId)
      .reduce((m, t) => Math.max(m, t.position), 0);
    const created = await createTask({ name, section_id: sectionId, position: maxPos + 1000 });
    if (created && projectFilter) await setTaskProjects(created.id, [projectFilter]);
    setDraft("");
  }

  return (
    <View style={styles.flex}>
      {/* Project filter chips */}
      <View style={styles.topBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="All" active={!projectFilter} onPress={() => setProjectFilter(null)} />
          {projects.map((p) => (
            <Chip
              key={p.id}
              label={p.name}
              color={p.color}
              active={projectFilter === p.id}
              onPress={() => setProjectFilter(p.id)}
            />
          ))}
        </ScrollView>
        <Pressable onPress={() => nav.navigate("Notifications")} hitSlop={8} style={styles.bell}>
          <Text style={{ fontSize: 18 }}>🔔</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <SectionList
        sections={grouped}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>
            {section.title} <Text style={styles.count}>{section.data.length}</Text>
          </Text>
        )}
        renderItem={({ item }) => (
          <View>
            <TaskItem task={item} onOpen={() => nav.navigate("TaskDetail", { taskId: item.id })} />
            {subtasksOf(item.id)
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((s) => (
                <SubtaskItem key={s.id} sub={s} onOpen={() => nav.navigate("TaskDetail", { taskId: s.id })} />
              ))}
          </View>
        )}
        renderSectionFooter={({ section }) =>
          adding === (section.sectionId ?? "inbox") ? (
            <TextInput
              autoFocus
              style={styles.addInput}
              placeholder="Task name…"
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => submitTask(section.sectionId)}
              onBlur={() => submitTask(section.sectionId)}
              returnKeyType="done"
            />
          ) : (
            <Pressable
              onPress={() => {
                setDraft("");
                setAdding(section.sectionId ?? "inbox");
              }}
              style={styles.addBtn}
            >
              <Text style={styles.addBtnText}>＋ Add task</Text>
            </Pressable>
          )
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <Pressable
              onPress={() => {
                const name = `Section ${sections.length + 1}`;
                createSection(name);
              }}
            >
              <Text style={styles.footerLink}>＋ Add section</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                createProject(
                  `Project ${projects.length + 1}`,
                  PROJECT_COLORS[projects.length % PROJECT_COLORS.length],
                )
              }
            >
              <Text style={styles.footerLink}>＋ Add project</Text>
            </Pressable>
            <Pressable onPress={() => setShowCompleted((s) => !s)}>
              <Text style={styles.footerLink}>
                {showCompleted ? "Hide completed" : "Show completed"}
              </Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

function TaskItem({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { toggleComplete, profiles } = useWorkspace();
  const assignee = profiles.find((p) => p.id === task.assignee_id);
  return (
    <Pressable style={styles.row} onPress={onOpen}>
      <Check checked={task.completed} onPress={() => toggleComplete(task.id, !task.completed)} />
      <View style={styles.flex}>
        <Text style={[styles.name, task.completed && styles.done]}>{task.name}</Text>
        <View style={styles.meta}>
          <PriorityDot priority={task.priority} />
          {task.subtask_count > 0 && (
            <Text style={styles.metaText}>☑ {task.subtask_done}/{task.subtask_count}</Text>
          )}
          {task.comment_count > 0 && <Text style={styles.metaText}>💬 {task.comment_count}</Text>}
          {task.recurrence && <Text style={styles.metaText}>🔁</Text>}
        </View>
      </View>
      <DueLabel date={task.due_date} />
      {assignee && <Avatar profile={assignee} size={22} />}
    </Pressable>
  );
}

function SubtaskItem({ sub, onOpen }: { sub: Task | { id: string; name: string; completed: boolean; due_date: string | null; priority: Task["priority"] }; onOpen: () => void }) {
  const { toggleComplete } = useWorkspace();
  return (
    <Pressable style={[styles.row, styles.subRow]} onPress={onOpen}>
      <Text style={styles.subArrow}>↳</Text>
      <Check size={18} checked={sub.completed} onPress={() => toggleComplete(sub.id, !sub.completed)} />
      <View style={styles.flex}>
        <Text style={[styles.subName, sub.completed && styles.done]}>{sub.name}</Text>
      </View>
      <PriorityDot priority={sub.priority} />
      <DueLabel date={sub.due_date} />
    </Pressable>
  );
}

function Chip({
  label,
  color,
  active,
  onPress,
}: {
  label: string;
  color?: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      {color && <View style={[styles.chipDot, { backgroundColor: color }]} />}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: "row", alignItems: "center", paddingRight: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  chips: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexDirection: "row" },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.bgMuted },
  chipActive: { backgroundColor: colors.primary },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 13, color: colors.muted },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  bell: { padding: 4 },
  badge: { position: "absolute", top: -2, right: -2, backgroundColor: colors.rose, borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  sectionHeader: { fontSize: 13, fontWeight: "700", color: colors.muted, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 },
  count: { color: colors.muted, fontWeight: "400" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.bg },
  subRow: { paddingLeft: 44, paddingVertical: 8 },
  subArrow: { color: colors.muted, fontSize: 12 },
  name: { fontSize: 16, color: colors.text },
  subName: { fontSize: 15, color: colors.text },
  done: { textDecorationLine: "line-through", color: colors.muted },
  meta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  metaText: { fontSize: 11, color: colors.muted },
  addInput: { marginHorizontal: 20, marginTop: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  addBtn: { paddingHorizontal: 20, paddingVertical: 12 },
  addBtnText: { color: colors.muted, fontSize: 15 },
  footer: { padding: 20, gap: 14, marginTop: 10 },
  footerLink: { color: colors.primary, fontSize: 15 },
});
