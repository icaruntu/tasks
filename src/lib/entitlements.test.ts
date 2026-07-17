import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getEntitlements, aiRequestsThisMonth } from "./entitlements";
import { createSupabaseMock } from "@/test/supabase-mock";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const asClient = (m: unknown) => m as unknown as SupabaseClient<Database>;

describe("getEntitlements", () => {
  it("defaults to free with no subscription row", async () => {
    const m = createSupabaseMock({ subscriptions: [] });
    const ent = await getEntitlements(asClient(m), "user-1");
    expect(ent.plan).toBe("free");
    expect(ent.limits.aiRequestsPerMonth).toBe(0);
    expect(ent.status).toBe("none");
  });

  it("resolves an active pro subscription", async () => {
    const m = createSupabaseMock({
      subscriptions: [
        { user_id: "user-1", plan: "pro", status: "active", current_period_end: "2026-12-01" },
      ],
    });
    const ent = await getEntitlements(asClient(m), "user-1");
    expect(ent.plan).toBe("pro");
    expect(ent.limits.aiRequestsPerMonth).toBeGreaterThan(0);
    expect(ent.currentPeriodEnd).toBe("2026-12-01");
  });

  it("treats a canceled subscription as free", async () => {
    const m = createSupabaseMock({
      subscriptions: [{ user_id: "user-1", plan: "pro", status: "canceled" }],
    });
    const ent = await getEntitlements(asClient(m), "user-1");
    expect(ent.plan).toBe("free");
    expect(ent.status).toBe("canceled");
  });
});

describe("aiRequestsThisMonth", () => {
  const NOW = new Date("2026-07-15T12:00:00Z");
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("counts usage rows since the start of the month", async () => {
    const m = createSupabaseMock({
      ai_usage: [
        { user_id: "user-1", created_at: "2026-07-02T00:00:00Z" },
        { user_id: "user-1", created_at: "2026-07-10T00:00:00Z" },
        { user_id: "user-1", created_at: "2026-06-30T00:00:00Z" }, // last month
      ],
    });
    expect(await aiRequestsThisMonth(asClient(m), "user-1")).toBe(2);
  });
});
