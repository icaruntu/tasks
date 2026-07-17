import { describe, it, expect, vi, afterEach } from "vitest";
import { renderApp, screen } from "@/test/render";
import BillingSettingsPage from "./page";

afterEach(() => vi.restoreAllMocks());

describe("BillingSettingsPage", () => {
  it("shows the free plan with an upgrade link", async () => {
    await renderApp(<BillingSettingsPage />, { seed: { subscriptions: [] } });
    expect(screen.getByText("Billing")).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("Upgrade")).toBeInTheDocument();
  });

  it("shows manage billing for paid plans and opens the portal", async () => {
    const orig = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "" },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: "https://portal" }) }),
    );
    const { user } = await renderApp(<BillingSettingsPage />, {
      seed: { subscriptions: [{ user_id: "user-1", plan: "pro", status: "active" }] },
    });
    await user.click(screen.getByText("Manage billing"));
    expect(window.location.href).toBe("https://portal");
    Object.defineProperty(window, "location", { configurable: true, value: orig });
  });

  it("shows an error when the portal call fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "No billing account" }) }),
    );
    const { user } = await renderApp(<BillingSettingsPage />, {
      seed: { subscriptions: [{ user_id: "user-1", plan: "pro", status: "active" }] },
    });
    await user.click(screen.getByText("Manage billing"));
    expect(await screen.findByText("No billing account")).toBeInTheDocument();
  });
});
