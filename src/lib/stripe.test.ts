import { describe, it, expect, afterEach, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function freshStripe() {
  vi.resetModules();
  return import("./stripe");
}

describe("getStripe", () => {
  it("returns null when no secret key is set", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const { getStripe } = await freshStripe();
    expect(getStripe()).toBeNull();
  });

  it("returns a Stripe client when configured", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    const { getStripe } = await freshStripe();
    const client = getStripe();
    expect(client).not.toBeNull();
    expect(client!.checkout).toBeDefined();
  });
});

describe("planFromPriceId", () => {
  it("maps configured price ids to their plan, else free", async () => {
    vi.stubEnv("STRIPE_PRICE_TEAM", "price_team");
    vi.stubEnv("STRIPE_PRICE_PRO_MONTHLY", "price_pm");
    vi.stubEnv("STRIPE_PRICE_PRO_YEARLY", "price_py");
    const { planFromPriceId } = await freshStripe();
    expect(planFromPriceId("price_team")).toBe("team");
    expect(planFromPriceId("price_pm")).toBe("pro");
    expect(planFromPriceId("price_py")).toBe("pro");
    expect(planFromPriceId("price_unknown")).toBe("free");
    expect(planFromPriceId(undefined)).toBe("free");
  });
});

describe("PRICE_IDS", () => {
  it("exposes the three checkout keys", async () => {
    vi.stubEnv("STRIPE_PRICE_PRO_MONTHLY", "price_pm");
    const { PRICE_IDS } = await freshStripe();
    expect(PRICE_IDS.pro_monthly).toBe("price_pm");
    expect("pro_yearly" in PRICE_IDS).toBe(true);
    expect("team" in PRICE_IDS).toBe(true);
  });
});
