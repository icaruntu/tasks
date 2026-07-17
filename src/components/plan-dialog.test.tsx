import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanDialog } from "./plan-dialog";

afterEach(() => vi.restoreAllMocks());

describe("PlanDialog", () => {
  it("fetches and renders a plan", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ plan: "Do X then Y" }) }),
    );
    render(<PlanDialog onClose={() => {}} />);
    expect(await screen.findByText("Do X then Y")).toBeInTheDocument();
  });

  it("renders an error from the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Upgrade please" }) }),
    );
    render(<PlanDialog onClose={() => {}} />);
    expect(await screen.findByText("Upgrade please")).toBeInTheDocument();
  });

  it("renders a generic error when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    render(<PlanDialog onClose={() => {}} />);
    expect(await screen.findByText("Something went wrong.")).toBeInTheDocument();
  });

  it("closes on the ✕ button", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ plan: "ok" }) }),
    );
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<PlanDialog onClose={onClose} />);
    await screen.findByText("ok");
    await user.click(screen.getByText("✕"));
    expect(onClose).toHaveBeenCalled();
  });
});
