import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UpgradePrompt } from "./upgrade-prompt";

// Link needs no router in a plain render, but stub navigation just in case.
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("UpgradePrompt", () => {
  it("renders title/message and closes on 'Not now'", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<UpgradePrompt title="Go Pro" message="Unlock more" onClose={onClose} />);
    expect(screen.getByText("Go Pro")).toBeInTheDocument();
    expect(screen.getByText("Unlock more")).toBeInTheDocument();
    await user.click(screen.getByText("Not now"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("links to pricing", () => {
    render(<UpgradePrompt title="t" message="m" onClose={() => {}} />);
    expect(screen.getByText("See plans").closest("a")).toHaveAttribute("href", "/pricing");
  });
});
