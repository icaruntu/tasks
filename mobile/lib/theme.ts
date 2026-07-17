// Minimal shared design tokens for the mobile app.
export const colors = {
  primary: "#6366f1",
  primaryDark: "#4f46e5",
  bg: "#ffffff",
  bgMuted: "#f4f4f5",
  border: "#e5e5ea",
  text: "#18181b",
  muted: "#71717a",
  rose: "#e11d48",
  emerald: "#10b981",
};

export const INBOX = "__inbox__";

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function avatarHue(seed: string): number {
  return [...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
}
