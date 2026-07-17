import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PricingPage from "./page";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

afterEach(() => vi.restoreAllMocks());

describe("PricingPage", () => {
  it("renders all three plans", () => {
    render(<PricingPage />);
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("Team")).toBeInTheDocument();
    expect(screen.getByText("Most popular")).toBeInTheDocument();
  });

  it("toggles yearly pricing", async () => {
    const user = userEvent.setup();
    render(<PricingPage />);
    await user.click(screen.getByText("Yearly"));
    expect(screen.getByText("$50/yr")).toBeInTheDocument();
  });

  it("starts checkout and redirects", async () => {
    const orig = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "" },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: "https://checkout" }) }),
    );
    const user = userEvent.setup();
    render(<PricingPage />);
    await user.click(screen.getByText("Upgrade to Pro"));
    expect(window.location.href).toBe("https://checkout");
    Object.defineProperty(window, "location", { configurable: true, value: orig });
  });

  it("shows an error when checkout fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Unknown plan" }) }),
    );
    const user = userEvent.setup();
    render(<PricingPage />);
    await user.click(screen.getByText("Upgrade to Team"));
    expect(await screen.findByText("Unknown plan")).toBeInTheDocument();
  });
});
