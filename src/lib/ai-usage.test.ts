import { describe, it, expect } from "vitest";
import { reserveAiRequest, recordAiTokens } from "./ai-usage";
import { createSupabaseMock } from "@/test/supabase-mock";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const asClient = (m: unknown) => m as unknown as SupabaseClient<Database>;

describe("reserveAiRequest", () => {
  it("blocks free users (402, upgrade)", async () => {
    const m = createSupabaseMock({ subscriptions: [], ai_usage: [] });
    const res = await reserveAiRequest(asClient(m), "user-1", "parse-task");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.response.status).toBe(402);
      const body = await res.response.json();
      expect(body.upgrade).toBe(true);
      expect(body.error).toMatch(/Pro/);
    }
  });

  it("blocks paid users over their monthly limit", async () => {
    const usage = Array.from({ length: 500 }, (_, i) => ({
      id: `u${i}`,
      user_id: "user-1",
      created_at: new Date().toISOString(),
    }));
    const m = createSupabaseMock({
      subscriptions: [{ user_id: "user-1", plan: "pro", status: "active" }],
      ai_usage: usage,
    });
    const res = await reserveAiRequest(asClient(m), "user-1", "plan");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const body = await res.response.json();
      expect(body.error).toMatch(/monthly AI limit/);
    }
  });

  it("reserves a usage row for paid users under their limit", async () => {
    const m = createSupabaseMock({
      subscriptions: [{ user_id: "user-1", plan: "pro", status: "active" }],
      ai_usage: [],
    });
    const res = await reserveAiRequest(asClient(m), "user-1", "prioritize");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.usageId).toBeTruthy();
      expect(m._store.ai_usage).toHaveLength(1);
      expect(m._store.ai_usage[0]).toMatchObject({ feature: "prioritize" });
    }
  });
});

describe("recordAiTokens", () => {
  it("updates the reserved row with token counts", async () => {
    const m = createSupabaseMock({
      ai_usage: [{ id: "u1", user_id: "user-1", input_tokens: 0, output_tokens: 0 }],
    });
    await recordAiTokens(asClient(m), "u1", { input_tokens: 12, output_tokens: 5 });
    expect(m._store.ai_usage[0]).toMatchObject({ input_tokens: 12, output_tokens: 5 });
  });

  it("defaults token counts to 0 when usage is undefined", async () => {
    const m = createSupabaseMock({
      ai_usage: [{ id: "u1", user_id: "user-1", input_tokens: 9, output_tokens: 9 }],
    });
    await recordAiTokens(asClient(m), "u1", undefined);
    expect(m._store.ai_usage[0]).toMatchObject({ input_tokens: 0, output_tokens: 0 });
  });
});
