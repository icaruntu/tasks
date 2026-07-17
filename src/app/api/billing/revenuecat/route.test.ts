// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";

const state: { admin: unknown } = { admin: null };
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => state.admin) }));

const UUID = "2dfbeec7-ca6c-490e-8709-c9ab2f05c6f6";

function req(body: unknown, auth = "Bearer secret") {
  return new Request("http://x", {
    method: "POST",
    headers: { authorization: auth },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("REVENUECAT_WEBHOOK_SECRET", "secret");
  state.admin = createSupabaseMock({ subscriptions: [] });
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/billing/revenuecat", () => {
  it("501 when unconfigured", async () => {
    vi.stubEnv("REVENUECAT_WEBHOOK_SECRET", "");
    const { POST } = await import("./route");
    expect((await POST(req({}))).status).toBe(501);
  });

  it("401 on a bad bearer token", async () => {
    const { POST } = await import("./route");
    expect((await POST(req({}, "Bearer wrong"))).status).toBe(401);
  });

  it("ignores anonymous / non-uuid app_user_id (200, no write)", async () => {
    const { POST } = await import("./route");
    const res = await POST(req({ event: { app_user_id: "anon-123" } }));
    expect(res.status).toBe(200);
    expect((state.admin as ReturnType<typeof createSupabaseMock>)._store.subscriptions).toHaveLength(0);
  });

  it("activates a pro subscription on purchase", async () => {
    const { POST } = await import("./route");
    await POST(
      req({
        event: {
          app_user_id: UUID,
          type: "INITIAL_PURCHASE",
          store: "APP_STORE",
          product_id: "pro_monthly",
          expiration_at_ms: 1893456000000,
        },
      }),
    );
    const admin = state.admin as ReturnType<typeof createSupabaseMock>;
    expect(admin._store.subscriptions[0].plan).toBe("pro");
    expect(admin._store.subscriptions[0].provider).toBe("apple");
  });

  it("maps team products and the play store", async () => {
    const { POST } = await import("./route");
    await POST(
      req({
        event: {
          app_user_id: UUID,
          type: "RENEWAL",
          store: "PLAY_STORE",
          product_id: "team_annual",
        },
      }),
    );
    const admin = state.admin as ReturnType<typeof createSupabaseMock>;
    expect(admin._store.subscriptions[0].plan).toBe("team");
    expect(admin._store.subscriptions[0].provider).toBe("google");
  });

  it("cancels on expiration", async () => {
    state.admin = createSupabaseMock({
      subscriptions: [{ user_id: UUID, plan: "pro", status: "active" }],
    });
    const { POST } = await import("./route");
    await POST(req({ event: { app_user_id: UUID, type: "EXPIRATION", store: "APP_STORE" } }));
    const admin = state.admin as ReturnType<typeof createSupabaseMock>;
    expect(admin._store.subscriptions[0].plan).toBe("free");
    expect(admin._store.subscriptions[0].status).toBe("canceled");
  });
});
