import { useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { useWorkspace } from "../lib/store";
import { colors } from "../lib/theme";
import { Avatar, Check } from "../components/common";
import { PRIORITY_META, RECURRENCE_OPTIONS, type Comment, type Priority } from "../lib/types";
import type { RootStackScreenProps } from "../lib/navigation";

export function TaskDetailScreen({ route, navigation }: RootStackScreenProps<"TaskDetail">) {
  const { taskId } = route.params;
  const {
    allTasks,
    sections,
    projects,
    connectedProfiles,
    profiles,
    subtasksOf,
    projectIdsOf,
    updateTask,
    toggleComplete,
    deleteTask,
    createTask,
    setTaskProjects,
    commentsOf,
    addComment,
  } = useWorkspace();

  const task = allTasks.find((t) => t.id === taskId);
  const [name, setName] = useState(task?.name ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [newSub, setNewSub] = useState("");

  const linkedProjects = useMemo(() => (task ? projectIdsOf(task.id) : []), [task, projectIdsOf]);
  const subtasks = task ? subtasksOf(task.id) : [];

  useEffect(() => {
    if (task) {
      setName(task.name);
      setDescription(task.description ?? "");
    }
  }, [task?.id]);

  useEffect(() => {
    commentsOf(taskId).then(setComments);
  }, [taskId, commentsOf]);

  if (!task) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Task not found.</Text>
      </View>
    );
  }

  async function saveName() {
    const v = name.trim();
    if (v && v !== task!.name) await updateTask(task!.id, { name: v });
  }
  async function saveDescription() {
    if (description !== (task!.description ?? "")) {
      await updateTask(task!.id, { description: description || null });
    }
  }

  async function addSubtask() {
    const v = newSub.trim();
    if (!v) return;
    const pos = subtasks.reduce((m, s) => Math.max(m, s.position), 0) + 1000;
    await createTask({ name: v, parent_task_id: task!.id, position: pos, section_id: task!.section_id });
    setNewSub("");
  }

  async function postComment() {
    const body = commentText.trim();
    if (!body) return;
    await addComment(task!.id, body);
    setCommentText("");
    setComments(await commentsOf(task!.id));
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Title */}
      <View style={styles.titleRow}>
        <Check checked={task.completed} onPress={() => toggleComplete(task.id, !task.completed)} />
        <TextInput
          style={[styles.title, task.completed && styles.done]}
          value={name}
          onChangeText={setName}
          onBlur={saveName}
          multiline
          placeholder="Task name"
        />
      </View>

      {/* Properties */}
      <View style={styles.section}>
        <Prop label="Assignee">
          <ChipRow>
            <SelectChip
              label="Unassigned"
              active={!task.assignee_id}
              onPress={() => updateTask(task.id, { assignee_id: null })}
            />
            {connectedProfiles.map((p) => (
              <SelectChip
                key={p.id}
                label={p.full_name ?? p.email ?? "User"}
                active={task.assignee_id === p.id}
                onPress={() => updateTask(task.id, { assignee_id: p.id })}
              />
            ))}
          </ChipRow>
        </Prop>

        <Prop label="Due date">
          <Pressable onPress={() => setShowDatePicker(true)}>
            <Text style={styles.value}>
              {task.due_date ? format(new Date(task.due_date), "MMM d, yyyy") : "Set a date"}
            </Text>
          </Pressable>
          {task.due_date && (
            <Pressable onPress={() => updateTask(task.id, { due_date: null })}>
              <Text style={styles.clear}>Clear</Text>
            </Pressable>
          )}
          {showDatePicker && (
            <DateTimePicker
              value={task.due_date ? new Date(task.due_date) : new Date()}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              onChange={(_e, date) => {
                setShowDatePicker(Platform.OS === "ios");
                if (date) updateTask(task.id, { due_date: date.toISOString() });
              }}
            />
          )}
        </Prop>

        <Prop label="Priority">
          <ChipRow>
            <SelectChip label="None" active={!task.priority} onPress={() => updateTask(task.id, { priority: null })} />
            {(["high", "medium", "low"] as Priority[]).map((p) => (
              <SelectChip
                key={p}
                label={PRIORITY_META[p].label}
                color={PRIORITY_META[p].color}
                active={task.priority === p}
                onPress={() => updateTask(task.id, { priority: p })}
              />
            ))}
          </ChipRow>
        </Prop>

        <Prop label="Section">
          <ChipRow>
            <SelectChip label="Inbox" active={!task.section_id} onPress={() => updateTask(task.id, { section_id: null })} />
            {sections.map((s) => (
              <SelectChip
                key={s.id}
                label={s.name}
                active={task.section_id === s.id}
                onPress={() => updateTask(task.id, { section_id: s.id })}
              />
            ))}
          </ChipRow>
        </Prop>

        <Prop label="Repeat">
          <ChipRow>
            <SelectChip label="Never" active={!task.recurrence} onPress={() => updateTask(task.id, { recurrence: null })} />
            {RECURRENCE_OPTIONS.map((r) => (
              <SelectChip
                key={r.value}
                label={r.label}
                active={task.recurrence === r.value}
                onPress={() => updateTask(task.id, { recurrence: r.value })}
              />
            ))}
          </ChipRow>
        </Prop>

        <Prop label="Projects">
          <ChipRow>
            {projects.map((pr) => {
              const on = linkedProjects.includes(pr.id);
              return (
                <SelectChip
                  key={pr.id}
                  label={pr.name}
                  color={pr.color}
                  active={on}
                  onPress={() =>
                    setTaskProjects(
                      task.id,
                      on ? linkedProjects.filter((x) => x !== pr.id) : [...linkedProjects, pr.id],
                    )
                  }
                />
              );
            })}
            {projects.length === 0 && <Text style={styles.muted}>No projects yet.</Text>}
          </ChipRow>
        </Prop>
      </View>

      {/* Description */}
      <View style={styles.section}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.description}
          value={description}
          onChangeText={setDescription}
          onBlur={saveDescription}
          multiline
          placeholder="Add a description…"
        />
      </View>

      {/* Subtasks */}
      <View style={styles.section}>
        <Text style={styles.label}>
          Subtasks {subtasks.length > 0 && `· ${subtasks.filter((s) => s.completed).length}/${subtasks.length}`}
        </Text>
        {subtasks.map((s) => (
          <View key={s.id} style={styles.subRow}>
            <Check size={18} checked={s.completed} onPress={() => toggleComplete(s.id, !s.completed)} />
            <Text style={[styles.subName, s.completed && styles.done]}>{s.name}</Text>
            {s.due_date && <Text style={styles.subDue}>{format(new Date(s.due_date), "MMM d")}</Text>}
            <Pressable onPress={() => deleteTask(s.id)} hitSlop={6}>
              <Text style={styles.remove}>✕</Text>
            </Pressable>
          </View>
        ))}
        <TextInput
          style={styles.subInput}
          placeholder="＋ Add subtask"
          value={newSub}
          onChangeText={setNewSub}
          onSubmitEditing={addSubtask}
          returnKeyType="done"
        />
      </View>

      {/* Comments */}
      <View style={styles.section}>
        <Text style={styles.label}>Comments</Text>
        {comments.map((c) => {
          const author = profiles.find((p) => p.id === c.author_id);
          return (
            <View key={c.id} style={styles.comment}>
              <Avatar profile={author} size={26} />
              <View style={styles.flex}>
                <Text style={styles.commentAuthor}>{author?.full_name ?? "User"}</Text>
                <Text style={styles.commentBody}>{c.body}</Text>
              </View>
            </View>
          );
        })}
        {comments.length === 0 && <Text style={styles.muted}>No comments yet.</Text>}
        <View style={styles.commentRow}>
          <TextInput
            style={styles.commentInput}
            placeholder="Comment…"
            value={commentText}
            onChangeText={setCommentText}
            multiline
          />
          <Pressable style={styles.sendBtn} onPress={postComment}>
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>
      </View>

      {/* Delete */}
      <Pressable
        style={styles.deleteBtn}
        onPress={() => {
          deleteTask(task.id);
          navigation.goBack();
        }}
      >
        <Text style={styles.deleteText}>Delete task</Text>
      </Pressable>
    </ScrollView>
  );
}

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.prop}>
      <Text style={styles.propLabel}>{label}</Text>
      <View style={styles.flex}>{children}</View>
    </View>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {children}
    </ScrollView>
  );
}

function SelectChip({
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: colors.muted, fontSize: 13 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 16 },
  title: { flex: 1, fontSize: 20, fontWeight: "600", color: colors.text },
  done: { textDecorationLine: "line-through", color: colors.muted },
  section: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, gap: 10 },
  prop: { gap: 6 },
  propLabel: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  value: { fontSize: 15, color: colors.primary },
  clear: { fontSize: 12, color: colors.muted, marginTop: 2 },
  label: { fontSize: 12, color: colors.muted, fontWeight: "700" },
  chipRow: { gap: 6, flexDirection: "row", paddingVertical: 2 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: colors.bgMuted },
  chipActive: { backgroundColor: colors.primary },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 13, color: colors.muted },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  description: { fontSize: 15, color: colors.text, minHeight: 60, textAlignVertical: "top" },
  subRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  subName: { flex: 1, fontSize: 15, color: colors.text },
  subDue: { fontSize: 12, color: colors.muted },
  subInput: { fontSize: 15, color: colors.text, paddingVertical: 8 },
  remove: { color: colors.muted, fontSize: 14 },
  comment: { flexDirection: "row", gap: 10, paddingVertical: 6 },
  commentAuthor: { fontSize: 12, fontWeight: "600", color: colors.text },
  commentBody: { fontSize: 14, color: colors.text },
  commentRow: { flexDirection: "row", gap: 8, alignItems: "flex-end", marginTop: 8 },
  commentInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, maxHeight: 100 },
  sendBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  sendText: { color: "#fff", fontWeight: "600" },
  deleteBtn: { margin: 16, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  deleteText: { color: colors.rose, fontWeight: "600" },
});
