import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useWorkspace } from "../lib/store";
import { colors } from "../lib/theme";
import { Avatar, Button } from "../components/common";

export function SettingsScreen() {
  const {
    me,
    collaborators,
    addCollaboratorByEmail,
    removeCollaborator,
    updateMyProfile,
    signOut,
  } = useWorkspace();

  const [email, setEmail] = useState("");
  const [collabErr, setCollabErr] = useState<string | null>(null);
  const [work, setWork] = useState(String(me?.pomodoro_work_minutes ?? 25));
  const [shortBreak, setShortBreak] = useState(String(me?.pomodoro_short_break_minutes ?? 5));
  const [longBreak, setLongBreak] = useState(String(me?.pomodoro_long_break_minutes ?? 15));
  const [saved, setSaved] = useState(false);

  async function addCollab() {
    setCollabErr(null);
    const err = await addCollaboratorByEmail(email);
    if (err) setCollabErr(err);
    else setEmail("");
  }

  function clamp(v: string, min: number, max: number, fallback: number) {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  async function savePomodoro() {
    await updateMyProfile({
      pomodoro_work_minutes: clamp(work, 1, 180, 25),
      pomodoro_short_break_minutes: clamp(shortBreak, 1, 60, 5),
      pomodoro_long_break_minutes: clamp(longBreak, 1, 120, 15),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Settings</Text>

      {/* Collaborators */}
      <View style={styles.card}>
        <Text style={styles.h2}>Collaborators</Text>
        <Text style={styles.hint}>
          Only collaborators show up when assigning tasks, sharing projects, or @mentioning.
        </Text>
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            placeholder="Add by email…"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={addCollab}
          />
          <Button label="Add" onPress={addCollab} />
        </View>
        {collabErr && <Text style={styles.error}>{collabErr}</Text>}
        {collaborators.map((p) => (
          <View key={p.id} style={styles.collabRow}>
            <Avatar profile={p} size={30} />
            <View style={styles.flex}>
              <Text style={styles.collabName}>{p.full_name ?? p.email}</Text>
              {p.full_name && <Text style={styles.collabEmail}>{p.email}</Text>}
            </View>
            <Pressable onPress={() => removeCollaborator(p.id)} hitSlop={8}>
              <Text style={styles.remove}>✕</Text>
            </Pressable>
          </View>
        ))}
        {collaborators.length === 0 && (
          <Text style={styles.hint}>No collaborators yet. Add someone by their email.</Text>
        )}
      </View>

      {/* Pomodoro */}
      <View style={styles.card}>
        <Text style={styles.h2}>🍅 Pomodoro</Text>
        <Text style={styles.hint}>Durations in minutes for the focus timer.</Text>
        <View style={styles.pomoRow}>
          <PomoField label="Focus" value={work} onChange={setWork} />
          <PomoField label="Short break" value={shortBreak} onChange={setShortBreak} />
          <PomoField label="Long break" value={longBreak} onChange={setLongBreak} />
        </View>
        <View style={styles.saveRow}>
          <Button label="Save" onPress={savePomodoro} />
          {saved && <Text style={styles.saved}>Saved.</Text>}
        </View>
      </View>

      {/* Account */}
      <View style={styles.card}>
        <Text style={styles.h2}>Account</Text>
        <Text style={styles.collabEmail}>{me?.email}</Text>
        <View style={{ marginTop: 12 }}>
          <Button label="Sign out" variant="ghost" onPress={signOut} />
        </View>
      </View>
    </ScrollView>
  );
}

function PomoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.flex}>
      <Text style={styles.pomoLabel}>{label}</Text>
      <TextInput
        style={styles.pomoInput}
        keyboardType="number-pad"
        value={value}
        onChangeText={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 16, backgroundColor: colors.bg },
  h1: { fontSize: 20, fontWeight: "700", color: colors.text },
  h2: { fontSize: 15, fontWeight: "700", color: colors.text },
  hint: { fontSize: 12, color: colors.muted, marginTop: 2, marginBottom: 8 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16 },
  addRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  error: { color: colors.rose, fontSize: 12, marginTop: 6 },
  collabRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  collabName: { fontSize: 15, color: colors.text },
  collabEmail: { fontSize: 12, color: colors.muted },
  remove: { color: colors.muted, fontSize: 16 },
  pomoRow: { flexDirection: "row", gap: 10 },
  pomoLabel: { fontSize: 12, color: colors.muted },
  pomoInput: { marginTop: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  saveRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 },
  saved: { color: colors.muted, fontSize: 13 },
});
