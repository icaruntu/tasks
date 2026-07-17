// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock } from "@/test/supabase-mock";

const state: { user: unknown; client: unknown; stripe: unknown } = {
  user: { id: "user-1" },
  client: null,
  stripe: null,
};

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => state.client) }));
vi.mock("@/lib/stripe", () => ({ getStripe: vi.fn(() => state.stripe) }));

const req = () =>
  new Request("http://x", { method: "POST", headers: { origin: "http://app" } });

function setSub(sub: Record<string, unknown>[]) {
  const m = createSupabaseMock({ subscriptions: sub }, { userId: "user-1" });
  m.auth.getUser = vi.fn(async () => ({ data: { user: state.user }, error: null }));
  state.client = m;
}

beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: "user-1" };
  setSub([{ user_id: "user-1", customer_id: "cus_1" }]);
  state.stripe = {
    billingPortal: { sessions: { create: vi.fn(async () => ({ url: "https://portal" })) } },
  };
});

describe("POST /api/billing/portal", () => {
  it("401 when signed out", async () => {
    state.user = null;
    setSub([]);
    const { POST } = await import("./route");
    expect((await POST(req())).status).toBe(401);
  });

  it("501 when billing unconfigured", async () => {
    state.stripe = null;
    const { POST } = await import("./route");
    expect((await POST(req())).status).toBe(501);
  });

  it("400 when the user has no customer id yet", async () => {
    setSub([]);
    const { POST } = await import("./route");
    expect((await POST(req())).status).toBe(400);
  });

  it("opens a billing portal session", async () => {
    const { POST } = await import("./route");
    const json = await (await POST(req())).json();
    expect(json.url).toBe("https://portal");
  });
});
