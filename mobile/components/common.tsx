import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, initialsOf, avatarHue } from "../lib/theme";
import { formatDueLabel, isOverdue } from "../lib/dates";
import { PRIORITY_META, type Priority, type Profile } from "../lib/types";

export function Check({
  checked,
  onPress,
  size = 22,
}: {
  checked: boolean;
  onPress: () => void;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={[
        styles.check,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: checked ? colors.emerald : "transparent",
          borderColor: checked ? colors.emerald : "#a1a1aa",
        },
      ]}
    >
      {checked && <Text style={styles.checkMark}>✓</Text>}
    </Pressable>
  );
}

export function PriorityDot({ priority }: { priority: Priority | null }) {
  if (!priority) return null;
  return <View style={[styles.dot, { backgroundColor: PRIORITY_META[priority].color }]} />;
}

export function DueLabel({ date }: { date: string | null }) {
  if (!date) return null;
  return (
    <Text style={[styles.due, isOverdue(date) && { color: colors.rose }]}>
      {formatDueLabel(date)}
    </Text>
  );
}

export function Avatar({ profile, size = 28 }: { profile?: Profile | null; size?: number }) {
  const name = profile?.full_name ?? profile?.email ?? "?";
  if (profile?.avatar_url) {
    return (
      <Image
        source={{ uri: profile.avatar_url }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  const hue = avatarHue(profile?.id ?? name);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: `hsl(${hue}, 55%, 50%)`,
      }}
    >
      <Text style={{ color: "#fff", fontSize: size * 0.4, fontWeight: "600" }}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost";
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.btn,
        variant === "primary" ? styles.btnPrimary : styles.btnGhost,
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text style={variant === "primary" ? styles.btnPrimaryText : styles.btnGhostText}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  check: { borderWidth: 2, alignItems: "center", justifyContent: "center" },
  checkMark: { color: "#fff", fontSize: 13, fontWeight: "800" },
  dot: { width: 10, height: 10, borderRadius: 5 },
  due: { fontSize: 12, color: colors.muted },
  btn: { borderRadius: 10, paddingVertical: 13, alignItems: "center", paddingHorizontal: 16 },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  btnGhost: { backgroundColor: colors.bgMuted },
  btnGhostText: { color: colors.text, fontWeight: "500", fontSize: 15 },
});
