import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Check, PriorityDot, PriorityBadge, DueBadge, Avatar } from "./ui";
import { makeProfile } from "@/test/factories";

describe("Check", () => {
  it("renders pressed state and toggles", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Check checked={true} onChange={onChange} />);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(btn).toHaveAttribute("title", "Mark incomplete");
    await user.click(btn);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("shows the unchecked title when not checked", () => {
    render(<Check checked={false} onChange={() => {}} />);
    expect(screen.getByRole("button")).toHaveAttribute("title", "Mark complete");
  });
});

describe("PriorityDot / PriorityBadge", () => {
  it("render nothing without a priority", () => {
    const { container } = render(<PriorityDot priority={null} />);
    expect(container).toBeEmptyDOMElement();
    const { container: c2 } = render(<PriorityBadge priority={null} />);
    expect(c2).toBeEmptyDOMElement();
  });
  it("render the priority label", () => {
    render(<PriorityBadge priority="high" />);
    expect(screen.getByText("High")).toBeInTheDocument();
  });
  it("dot exposes a title", () => {
    render(<PriorityDot priority="low" />);
    expect(screen.getByTitle("Low priority")).toBeInTheDocument();
  });
});

describe("DueBadge", () => {
  const NOW = new Date("2026-07-15T12:00:00Z");
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("renders nothing without a date", () => {
    const { container } = render(<DueBadge date={null} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("labels today", () => {
    render(<DueBadge date={NOW.toISOString()} />);
    expect(screen.getByText("Today")).toBeInTheDocument();
  });
  it("marks overdue dates in rose", () => {
    render(<DueBadge date="2026-07-10T09:00:00Z" />);
    const el = screen.getByText(/Jul 10/);
    expect(el.className).toContain("rose");
  });
});

describe("Avatar", () => {
  it("renders initials from a full name", () => {
    render(<Avatar profile={makeProfile({ full_name: "Ada Lovelace" })} />);
    expect(screen.getByText("AL")).toBeInTheDocument();
  });
  it("falls back to email, then '?'", () => {
    render(<Avatar profile={makeProfile({ full_name: null, email: "zoe@x.io" })} />);
    expect(screen.getByText("Z")).toBeInTheDocument();
    render(<Avatar profile={null} />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });
  it("renders an img when avatar_url is set", () => {
    render(
      <Avatar profile={makeProfile({ full_name: "Ada", avatar_url: "http://x/a.png" })} />,
    );
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "http://x/a.png");
  });
});
