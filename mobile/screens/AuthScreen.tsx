import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../lib/supabase";
import { colors } from "../lib/theme";
import { Button } from "../components/common";

export function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    setMessage(null);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) setError(error.message);
      else if (!data.session) setMessage("Account created. Check your email to confirm, then sign in.");
    }
    setBusy(false);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.logo}>TaskFlow</Text>
      <Text style={styles.subtle}>Simple task management, done together.</Text>

      {mode === "signup" && (
        <TextInput
          style={styles.input}
          placeholder="Full name"
          value={fullName}
          onChangeText={setFullName}
        />
      )}
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
      {message && <Text style={styles.message}>{message}</Text>}

      <Button
        label={busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        onPress={submit}
        disabled={busy}
      />
      <Text
        style={styles.link}
        onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
      >
        {mode === "signin" ? "Need an account? Create one" : "Have an account? Sign in"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", padding: 24, gap: 10, backgroundColor: colors.bg },
  logo: { fontSize: 30, fontWeight: "700", textAlign: "center", color: colors.text },
  subtle: { color: colors.muted, textAlign: "center", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: { color: colors.rose, fontSize: 13 },
  message: { color: colors.emerald, fontSize: 13 },
  link: { color: colors.primary, textAlign: "center", marginTop: 8, fontSize: 14 },
});
