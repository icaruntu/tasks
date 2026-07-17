// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";

const state: { user: unknown; client: unknown; quota: unknown; create: ReturnType<typeof vi.fn> } = {
  user: { id: "user-1" },
  client: null,
  quota: null,
  create: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => state.client),
}));
vi.mock("@/lib/anthropic", async (orig) => {
  const actual = await orig<typeof import("@/lib/anthropic")>();
  return {
    ...actual,
    getAnthropic: vi.fn(() => ({ messages: { create: state.create } })),
  };
});
vi.mock("@/lib/ai-usage", () => ({
  aiQuotaResponse: vi.fn(async () => state.quota),
  logAiUsage: vi.fn(async () => {}),
}));

function req(body: unknown) {
  return new Request("http://x/api/ai/parse-task", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  const m = createSupabaseMock({ ai_usage: [] }, { userId: "user-1" });
  m.auth.getUser = vi.fn(async () => ({ data: { user: state.user }, error: null }));
  state.client = m;
  state.quota = null;
  state.create.mockResolvedValue({
    content: [{ type: "tool_use", name: "create_task", input: { name: "Parsed", priority: "high" } }],
    usage: { input_tokens: 5, output_tokens: 2 },
  });
});

describe("POST /api/ai/parse-task", () => {
  it("401 when signed out", async () => {
    state.user = null;
    const { POST } = await import("./route");
    const res = await POST(req({ text: "x" }));
    expect(res.status).toBe(401);
    state.user = { id: "user-1" };
  });

  it("returns the quota response when over limit", async () => {
    const { NextResponse } = await import("next/server");
    state.quota = NextResponse.json({ error: "over" }, { status: 402 });
    const { POST } = await import("./route");
    const res = await POST(req({ text: "x" }));
    expect(res.status).toBe(402);
  });

  it("400 on empty input", async () => {
    const { POST } = await import("./route");
    const res = await POST(req({ text: "   " }));
    expect(res.status).toBe(400);
  });

  it("parses text into a structured task and logs usage", async () => {
    const { POST } = await import("./route");
    const { logAiUsage } = await import("@/lib/ai-usage");
    const res = await POST(req({ text: "call sam", timezone: "UTC" }));
    const json = await res.json();
    expect(json.name).toBe("Parsed");
    expect(logAiUsage).toHaveBeenCalled();
  });

  it("falls back to raw text when the model returns no tool call", async () => {
    state.create.mockResolvedValue({ content: [{ type: "text", text: "hi" }], usage: {} });
    const { POST } = await import("./route");
    const res = await POST(req({ text: "just text" }));
    const json = await res.json();
    expect(json.name).toBe("just text");
  });

  it("501 when AI is unconfigured", async () => {
    const anthropic = await import("@/lib/anthropic");
    vi.mocked(anthropic.getAnthropic).mockReturnValueOnce(null);
    const { POST } = await import("./route");
    const res = await POST(req({ text: "x" }));
    expect(res.status).toBe(501);
  });
});
