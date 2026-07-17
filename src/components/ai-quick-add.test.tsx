import { describe, it, expect, vi, afterEach } from "vitest";
import { renderApp, screen } from "@/test/render";
import { AiQuickAdd } from "./ai-quick-add";
import { makeProject } from "@/test/factories";

function mockFetch(res: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: async () => res,
  });
}

afterEach(() => vi.restoreAllMocks());

describe("AiQuickAdd", () => {
  it("parses text into a task and creates it", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({ name: "Call Sam", due_date: null, priority: "high" }),
    );
    const { user, supabase } = await renderApp(<AiQuickAdd />, {
      seed: { tasks: [] },
    });
    await user.type(
      screen.getByPlaceholderText(/Email the vendor/),
      "call sam high priority",
    );
    await user.click(screen.getByText("Add"));
    expect(supabase._store.tasks.some((t) => t.name === "Call Sam")).toBe(true);
  });

  it("adds the new task to the active project when filtered", async () => {
    vi.stubGlobal("fetch", mockFetch({ name: "Scoped", due_date: null, priority: null }));
    // Seed a project and set the UI filter by rendering within a project context.
    const { user, supabase } = await renderApp(<AiQuickAdd />, {
      seed: { tasks: [], projects: [makeProject({ id: "pr1" })] },
    });
    await user.type(screen.getByPlaceholderText(/Email the vendor/), "scoped task");
    await user.click(screen.getByText("Add"));
    expect(supabase._store.tasks.some((t) => t.name === "Scoped")).toBe(true);
  });

  it("shows an error when the API returns one", async () => {
    vi.stubGlobal("fetch", mockFetch({ error: "AI is off" }, false));
    const { user } = await renderApp(<AiQuickAdd />, { seed: { tasks: [] } });
    await user.type(screen.getByPlaceholderText(/Email the vendor/), "x");
    await user.click(screen.getByText("Add"));
    expect(await screen.findByText("AI is off")).toBeInTheDocument();
  });

  it("shows a generic error when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const { user } = await renderApp(<AiQuickAdd />, { seed: { tasks: [] } });
    await user.type(screen.getByPlaceholderText(/Email the vendor/), "x");
    await user.click(screen.getByText("Add"));
    expect(await screen.findByText("Something went wrong.")).toBeInTheDocument();
  });

  it("does nothing for empty input (no Add button)", async () => {
    await renderApp(<AiQuickAdd />, { seed: { tasks: [] } });
    expect(screen.queryByText("Add")).not.toBeInTheDocument();
  });
});
