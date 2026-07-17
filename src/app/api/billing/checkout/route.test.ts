// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";

const state: { user: unknown; client: unknown; stripe: unknown } = {
  user: { id: "user-1", email: "me@x.io" },
  client: null,
  stripe: null,
};

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => state.client) }));
vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => state.stripe),
  PRICE_IDS: { pro_monthly: "price_pm", pro_yearly: "price_py", team: "price_team" },
}));

const req = (body: unknown) =>
  new Request("http://x", {
    method: "POST",
    headers: { origin: "http://app" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  const m = createSupabaseMock({ subscriptions: [] }, { userId: "user-1" });
  m.auth.getUser = vi.fn(async () => ({ data: { user: state.user }, error: null }));
  state.client = m;
  state.stripe = {
    customers: { create: vi.fn(async () => ({ id: "cus_1" })) },
    checkout: { sessions: { create: vi.fn(async () => ({ url: "https://pay" })) } },
  };
});

describe("POST /api/billing/checkout", () => {
  it("401 when signed out", async () => {
    state.user = null;
    const { POST } = await import("./route");
    expect((await POST(req({ priceKey: "pro_monthly" }))).status).toBe(401);
    state.user = { id: "user-1", email: "me@x.io" };
  });

  it("501 when billing unconfigured", async () => {
    state.stripe = null;
    const { POST } = await import("./route");
    expect((await POST(req({ priceKey: "pro_monthly" }))).status).toBe(501);
  });

  it("400 on unknown plan", async () => {
    const { POST } = await import("./route");
    expect((await POST(req({ priceKey: "nope" }))).status).toBe(400);
  });

  it("creates a customer and checkout session", async () => {
    const { POST } = await import("./route");
    const res = await POST(req({ priceKey: "pro_monthly" }));
    const json = await res.json();
    expect(json.url).toBe("https://pay");
    expect(
      (state.stripe as { customers: { create: ReturnType<typeof vi.fn> } }).customers.create,
    ).toHaveBeenCalled();
  });

  it("reuses an existing customer id", async () => {
    const m = createSupabaseMock(
      { subscriptions: [{ user_id: "user-1", customer_id: "cus_existing" }] },
      { userId: "user-1" },
    );
    m.auth.getUser = vi.fn(async () => ({
      data: { user: { id: "user-1", email: "me@x.io" } },
      error: null,
    }));
    state.client = m;
    const { POST } = await import("./route");
    await POST(req({ priceKey: "team" }));
    expect(
      (state.stripe as { customers: { create: ReturnType<typeof vi.fn> } }).customers.create,
    ).not.toHaveBeenCalled();
  });
});
