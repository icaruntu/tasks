import { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";

type Task = {
  id: string;
  name: string;
  completed: boolean;
  due_date: string | null;
  priority: "high" | "medium" | "low" | null;
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setSession(s),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready)
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );

  return (
    <View style={styles.flex}>
      <StatusBar style="auto" />
      {session ? <TaskList /> : <Auth />}
    </View>
  );
}

function Auth() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const fn =
      mode === "signin"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });
    const { error } = await fn;
    if (error) setError(error.message);
    setBusy(false);
  }

  return (
    <View style={styles.authWrap}>
      <Text style={styles.logo}>TaskFlow</Text>
      <Text style={styles.subtle}>Simple task management.</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.primaryBtn} onPress={submit} disabled={busy}>
        <Text style={styles.primaryBtnText}>
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
      >
        <Text style={styles.link}>
          {mode === "signin"
            ? "Need an account? Create one"
            : "Have an account? Sign in"}
        </Text>
      </Pressable>
    </View>
  );
}

function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("tasks")
      .select("id, name, completed, due_date, priority")
      .is("parent_task_id", null)
      .eq("completed", false)
      .order("position");
    setTasks((data as Task[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("mobile-tasks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  async function addTask() {
    const name = newName.trim();
    if (!name) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setNewName("");
    await supabase.from("tasks").insert({ name, creator_id: user.id });
    load();
  }

  async function complete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("tasks").update({ completed: true }).eq("id", id);
  }

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Text style={styles.title}>My Tasks</Text>
        <Pressable onPress={() => supabase.auth.signOut()}>
          <Text style={styles.link}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, styles.addInput]}
          placeholder="Add a task…"
          value={newName}
          onChangeText={setNewName}
          onSubmitEditing={addTask}
          returnKeyType="done"
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(t) => t.id}
          ListEmptyComponent={
            <Text style={styles.empty}>No open tasks. Nice.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.taskRow}>
              <Pressable style={styles.check} onPress={() => complete(item.id)} />
              <View style={styles.flex}>
                <Text style={styles.taskName}>{item.name}</Text>
                {item.due_date && (
                  <Text style={styles.due}>
                    {new Date(item.due_date).toLocaleDateString()}
                  </Text>
                )}
              </View>
              {item.priority && (
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        item.priority === "high"
                          ? "#f43f5e"
                          : item.priority === "medium"
                            ? "#f59e0b"
                            : "#0ea5e9",
                    },
                  ]}
                />
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  authWrap: { flex: 1, justifyContent: "center", padding: 24, gap: 10 },
  logo: { fontSize: 28, fontWeight: "700", textAlign: "center" },
  subtle: { color: "#71717a", textAlign: "center", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#e5e5ea",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  addInput: { flex: 1 },
  error: { color: "#e11d48", fontSize: 13 },
  primaryBtn: {
    backgroundColor: "#6366f1",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  primaryBtnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  link: { color: "#6366f1", textAlign: "center", marginTop: 8 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 12,
  },
  title: { fontSize: 22, fontWeight: "700" },
  addRow: { flexDirection: "row", paddingHorizontal: 16, marginBottom: 8 },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5ea",
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#a1a1aa",
  },
  taskName: { fontSize: 16 },
  due: { fontSize: 12, color: "#71717a", marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  empty: { textAlign: "center", color: "#71717a", marginTop: 48 },
});
