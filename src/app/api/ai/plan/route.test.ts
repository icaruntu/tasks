// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";
import { makeTask } from "@/test/factories";

const state: { user: unknown; client: unknown; quota: unknown; create: ReturnType<typeof vi.fn> } = {
  user: { id: "user-1" },
  client: null,
  quota: null,
  create: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => state.client) }));
vi.mock("@/lib/anthropic", async (orig) => ({
  ...(await orig<typeof import("@/lib/anthropic")>()),
  getAnthropic: vi.fn(() => ({ messages: { create: state.create } })),
}));
vi.mock("@/lib/ai-usage", () => ({
  aiQuotaResponse: vi.fn(async () => state.quota),
  logAiUsage: vi.fn(async () => {}),
}));

const soon = new Date(Date.now() + 3600_000).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  const m = createSupabaseMock(
    {
      tasks: [
        makeTask({ id: "t1", name: "Urgent", priority: "high", due_date: soon, completed: false }),
      ],
    },
    { userId: "user-1" },
  );
  m.auth.getUser = vi.fn(async () => ({ data: { user: state.user }, error: null }));
  state.client = m;
  state.quota = null;
  state.create.mockResolvedValue({
    content: [{ type: "text", text: "Do the urgent thing first." }],
    usage: { input_tokens: 4, output_tokens: 6 },
  });
});

describe("POST /api/ai/plan", () => {
  it("401 when signed out", async () => {
    state.user = null;
    const { POST } = await import("./route");
    expect((await POST()).status).toBe(401);
    state.user = { id: "user-1" };
  });

  it("returns a generated plan for actionable tasks", async () => {
    const { POST } = await import("./route");
    const res = await POST();
    const json = await res.json();
    expect(json.plan).toContain("urgent");
  });

  it("returns an encouraging message when nothing is actionable", async () => {
    const m = createSupabaseMock(
      { tasks: [makeTask({ id: "t1", priority: "low", due_date: null })] },
      { userId: "user-1" },
    );
    m.auth.getUser = vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null }));
    state.client = m;
    const { POST } = await import("./route");
    const json = await (await POST()).json();
    expect(json.plan).toMatch(/Nothing urgent/);
  });

  it("501 when AI unconfigured", async () => {
    const anthropic = await import("@/lib/anthropic");
    vi.mocked(anthropic.getAnthropic).mockReturnValueOnce(null);
    const { POST } = await import("./route");
    expect((await POST()).status).toBe(501);
  });
});
