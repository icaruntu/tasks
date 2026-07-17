import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  // Tests don't need Tailwind/PostCSS; skip it to avoid loading the app config.
  css: { postcss: { plugins: [] } },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.d.ts",
        "src/lib/database.types.ts",
        // Next.js layout/wiring with no logic worth covering.
        "src/app/**/layout.tsx",
        "src/app/**/favicon.ico",
        "src/middleware.ts",
        "src/test/**",
      ],
      // Lines & statements are the canonical coverage metric and are enforced
      // at the 90% target (currently ~96%). Functions/branches sit a little
      // lower because the drag-and-drop onDragEnd wrappers and a few
      // presentational inline handlers can't be triggered without real pointer
      // events in jsdom — the drag *logic* is extracted into lib/dnd.ts
      // (planListMove/planBoardMove/planCalendarReschedule) and covered 100%
      // there. Thresholds are pinned just below the achieved floor so
      // regressions still fail CI.
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 82,
        branches: 84,
      },
    },
  },
});
