// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";
import { makeTask } from "@/test/factories";

const state: { user: unknown; client: unknown; reservation: unknown; create: ReturnType<typeof vi.fn> } = {
  user: { id: "user-1" },
  client: null,
  reservation: { ok: true, usageId: "u1" },
  create: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => state.client) }));
vi.mock("@/lib/anthropic", async (orig) => ({
  ...(await orig<typeof import("@/lib/anthropic")>()),
  getAnthropic: vi.fn(() => ({ messages: { create: state.create } })),
}));
vi.mock("@/lib/ai-usage", () => ({
  reserveAiRequest: vi.fn(async () => state.reservation),
  recordAiTokens: vi.fn(async () => {}),
}));

const req = (body: unknown) =>
  new Request("http://x", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  const m = createSupabaseMock(
    { tasks: [makeTask({ id: "t1", name: "Task", creator_id: "user-1" })] },
    { userId: "user-1" },
  );
  m.auth.getUser = vi.fn(async () => ({ data: { user: state.user }, error: null }));
  state.client = m;
  state.reservation = { ok: true, usageId: "u1" };
  state.create.mockResolvedValue({
    content: [{ type: "tool_use", name: "suggest", input: { priority: "high", rationale: "urgent" } }],
    usage: { input_tokens: 3, output_tokens: 1 },
  });
});

describe("POST /api/ai/prioritize", () => {
  it("401 when signed out", async () => {
    state.user = null;
    const { POST } = await import("./route");
    expect((await POST(req({ taskId: "t1" }))).status).toBe(401);
    state.user = { id: "user-1" };
  });

  it("400 without a taskId", async () => {
    const { POST } = await import("./route");
    expect((await POST(req({}))).status).toBe(400);
  });

  it("404 when the task is not found", async () => {
    const { POST } = await import("./route");
    const res = await POST(req({ taskId: "missing" }));
    expect(res.status).toBe(404);
  });

  it("returns an AI suggestion", async () => {
    const { POST } = await import("./route");
    const res = await POST(req({ taskId: "t1" }));
    const json = await res.json();
    expect(json.priority).toBe("high");
    expect(json.rationale).toBe("urgent");
  });

  it("501 when AI unconfigured", async () => {
    const anthropic = await import("@/lib/anthropic");
    vi.mocked(anthropic.getAnthropic).mockReturnValueOnce(null);
    const { POST } = await import("./route");
    expect((await POST(req({ taskId: "t1" }))).status).toBe(501);
  });
});
