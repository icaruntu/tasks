import {
  render,
  waitForElementToBeRemoved,
  screen,
  act,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { UIProvider } from "@/components/ui-provider";
import { createSupabaseMock, type Seed } from "./supabase-mock";
import type { ReactElement } from "react";

/**
 * Render a component tree inside the real Workspace + UI providers, backed by
 * the in-memory Supabase mock seeded with `seed`. Waits for the provider's
 * initial load to finish so `tasks`, `projects`, etc. are populated.
 */
export async function renderApp(
  ui: ReactElement,
  {
    seed = {},
    userId = "user-1",
    email = "me@test.dev",
  }: { seed?: Seed; userId?: string; email?: string } = {},
) {
  const supabase = createSupabaseMock(seed, { userId, email });
  (globalThis as Record<string, unknown>).__mockSupabase__ = supabase;

  // Make interactions work whether or not the test installs fake timers.
  const user = userEvent.setup({
    delay: null,
    advanceTimers: (ms) => {
      if (vi.isFakeTimers()) vi.advanceTimersByTime(ms);
    },
  });
  const utils = render(
    <WorkspaceProvider userId={userId}>
      <UIProvider>{ui}</UIProvider>
    </WorkspaceProvider>,
  );

  // Let the provider's async refresh() resolve and its state updates flush.
  // Drain the microtask queue in a loop (the mock resolves synchronously), so
  // this works whether or not the test installs fake timers.
  await act(async () => {
    for (let i = 0; i < 25; i++) await Promise.resolve();
  });

  return { supabase, user, ...utils };
}

export { screen, waitForElementToBeRemoved, waitFor, act };
