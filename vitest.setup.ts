import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// jsdom lacks these; components use them.
if (!("randomUUID" in globalThis.crypto)) {
  // @ts-expect-error -- test shim
  globalThis.crypto.randomUUID = () =>
    "00000000-0000-4000-8000-000000000000";
}

// next/navigation is used across client components.
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// window.confirm defaults to true in tests unless a test overrides it.
// Guarded because server-only test files run in the node environment.
if (typeof window !== "undefined") {
  vi.spyOn(window, "confirm").mockReturnValue(true);
}

// The browser Supabase client is swapped for an in-memory mock. render.tsx
// (or a test) sets `globalThis.__mockSupabase__` before rendering.
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => (globalThis as Record<string, unknown>).__mockSupabase__,
}));
