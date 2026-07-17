// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";

const state: { admin: unknown; stripe: unknown } = { admin: null, stripe: null };

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => state.admin) }));
vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => state.stripe),
  planFromPriceId: vi.fn(() => "pro"),
}));

const req = (sig?: string) =>
  new Request("http://x", {
    method: "POST",
    headers: sig ? { "stripe-signature": sig } : {},
    body: "raw",
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_1");
  state.admin = createSupabaseMock({ subscriptions: [] });
  state.stripe = {
    webhooks: { constructEvent: vi.fn() },
    subscriptions: {
      retrieve: vi.fn(async () => ({
        id: "sub_1",
        status: "active",
        customer: "cus_1",
        items: { data: [{ price: { id: "price_pro" }, quantity: 1, current_period_end: 111 }] },
        metadata: { user_id: "user-1" },
      })),
    },
  };
});
afterEach(() => vi.unstubAllEnvs());

const stripe = () => state.stripe as { webhooks: { constructEvent: ReturnType<typeof vi.fn> } };

describe("POST /api/billing/webhook", () => {
  it("501 when unconfigured", async () => {
    state.stripe = null;
    const { POST } = await import("./route");
    expect((await POST(req("sig"))).status).toBe(501);
  });

  it("400 without a signature", async () => {
    const { POST } = await import("./route");
    expect((await POST(req())).status).toBe(400);
  });

  it("400 on an invalid signature", async () => {
    stripe().webhooks.constructEvent.mockImplementation(() => {
      throw new Error("bad sig");
    });
    const { POST } = await import("./route");
    const res = await POST(req("sig"));
    expect(res.status).toBe(400);
  });

  it("syncs a subscription on checkout.session.completed", async () => {
    stripe().webhooks.constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { subscription: "sub_1", metadata: { user_id: "user-1" } } },
    });
    const { POST } = await import("./route");
    const res = await POST(req("sig"));
    expect(res.status).toBe(200);
    const admin = state.admin as ReturnType<typeof createSupabaseMock>;
    expect(admin._store.subscriptions).toHaveLength(1);
    expect(admin._store.subscriptions[0].plan).toBe("pro");
  });

  it("downgrades on customer.subscription.deleted", async () => {
    state.admin = createSupabaseMock({
      subscriptions: [{ user_id: "user-1", plan: "pro", status: "active" }],
    });
    stripe().webhooks.constructEvent.mockReturnValue({
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_1", metadata: { user_id: "user-1" } } },
    });
    const { POST } = await import("./route");
    await POST(req("sig"));
    const admin = state.admin as ReturnType<typeof createSupabaseMock>;
    expect(admin._store.subscriptions[0].plan).toBe("free");
    expect(admin._store.subscriptions[0].status).toBe("canceled");
  });

  it("handles customer.subscription.updated", async () => {
    stripe().webhooks.constructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_1",
          status: "active",
          customer: "cus_1",
          items: { data: [{ price: { id: "price_pro" }, quantity: 1, current_period_end: 222 }] },
          metadata: { user_id: "user-1" },
        },
      },
    });
    const { POST } = await import("./route");
    const res = await POST(req("sig"));
    expect(res.status).toBe(200);
    const admin = state.admin as ReturnType<typeof createSupabaseMock>;
    expect(admin._store.subscriptions).toHaveLength(1);
  });
});
