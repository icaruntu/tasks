import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TaskFlow",
    short_name: "TaskFlow",
    description:
      "Simple task management with projects, pomodoro, sharing, and reminders.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Splash/status chrome matches the light app shell; the meta theme-color in
    // layout.tsx handles the dark-mode case, which a manifest can't express.
    background_color: "#f7f7f8",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Board", url: "/board" },
      { name: "Calendar", url: "/calendar" },
    ],
  };
}
