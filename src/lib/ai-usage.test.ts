import { describe, it, expect } from "vitest";
import { aiQuotaResponse, logAiUsage } from "./ai-usage";
import { createSupabaseMock } from "@/test/supabase-mock";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const asClient = (m: unknown) => m as unknown as SupabaseClient<Database>;

describe("aiQuotaResponse", () => {
  it("blocks free users (402, upgrade)", async () => {
    const m = createSupabaseMock({ subscriptions: [], ai_usage: [] });
    const res = await aiQuotaResponse(asClient(m), "user-1");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(402);
    const body = await res!.json();
    expect(body.upgrade).toBe(true);
    expect(body.error).toMatch(/Pro/);
  });

  it("blocks paid users who are over their monthly limit", async () => {
    const usage = Array.from({ length: 500 }, () => ({
      user_id: "user-1",
      created_at: new Date().toISOString(),
    }));
    const m = createSupabaseMock({
      subscriptions: [{ user_id: "user-1", plan: "pro", status: "active" }],
      ai_usage: usage,
    });
    const res = await aiQuotaResponse(asClient(m), "user-1");
    expect(res!.status).toBe(402);
    const body = await res!.json();
    expect(body.error).toMatch(/monthly AI limit/);
  });

  it("allows paid users under their limit (returns null)", async () => {
    const m = createSupabaseMock({
      subscriptions: [{ user_id: "user-1", plan: "pro", status: "active" }],
      ai_usage: [],
    });
    expect(await aiQuotaResponse(asClient(m), "user-1")).toBeNull();
  });
});

describe("logAiUsage", () => {
  it("inserts a usage row with token counts", async () => {
    const m = createSupabaseMock({ ai_usage: [] });
    await logAiUsage(asClient(m), "user-1", "parse-task", {
      input_tokens: 10,
      output_tokens: 4,
    });
    expect(m._store.ai_usage).toHaveLength(1);
    expect(m._store.ai_usage[0]).toMatchObject({
      user_id: "user-1",
      feature: "parse-task",
      input_tokens: 10,
      output_tokens: 4,
    });
  });

  it("defaults token counts to 0 when usage is undefined", async () => {
    const m = createSupabaseMock({ ai_usage: [] });
    await logAiUsage(asClient(m), "user-1", "plan", undefined);
    expect(m._store.ai_usage[0]).toMatchObject({
      input_tokens: 0,
      output_tokens: 0,
    });
  });
});
