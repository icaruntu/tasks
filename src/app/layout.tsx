import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TaskFlow",
  description:
    "Simple task management with projects, pomodoro, sharing, and reminders.",
  applicationName: "TaskFlow",
  manifest: "/manifest.webmanifest",
  // Added to the Home Screen from Safari, TaskFlow launches standalone (no
  // browser chrome) with its own icon and title.
  appleWebApp: {
    capable: true,
    title: "TaskFlow",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  other: {
    // Next emits only the modern `mobile-web-app-capable`; iOS before 16.4
    // needs the apple-prefixed one to launch standalone.
    "apple-mobile-web-app-capable": "yes",
  },
};

// iOS tints the standalone status bar with theme-color, so track the scheme.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#16161c" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
