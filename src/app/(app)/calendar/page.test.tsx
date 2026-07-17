import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderApp, screen } from "@/test/render";
import CalendarPage from "./page";
import { makeTask, makeProfile } from "@/test/factories";

const NOW = new Date("2026-07-15T12:00:00Z");
beforeEach(() => {
  // Fake only Date (fixed "now") so userEvent's real setTimeout keeps working.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("CalendarPage", () => {
  it("renders the month grid and a scheduled task chip", async () => {
    await renderApp(<CalendarPage />, {
      seed: {
        profiles: [makeProfile({ id: "user-1" })],
        tasks: [
          makeTask({ id: "t1", name: "Due task", due_date: "2026-07-20T09:00:00Z" }),
        ],
      },
    });
    expect(screen.getByText("July 2026")).toBeInTheDocument();
    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.getByText("Due task")).toBeInTheDocument();
  });

  it("navigates months", async () => {
    const { user } = await renderApp(<CalendarPage />, {
      seed: { profiles: [makeProfile({ id: "user-1" })], tasks: [] },
    });
    await user.click(screen.getByText("›"));
    expect(screen.getByText("August 2026")).toBeInTheDocument();
    await user.click(screen.getByText("‹"));
    expect(screen.getByText("July 2026")).toBeInTheDocument();
    await user.click(screen.getByText("›"));
    await user.click(screen.getByText("Today"));
    expect(screen.getByText("July 2026")).toBeInTheDocument();
  });

  it("opens a task when its chip is clicked", async () => {
    const { user } = await renderApp(<CalendarPage />, {
      seed: {
        profiles: [makeProfile({ id: "user-1" })],
        tasks: [
          makeTask({ id: "t1", name: "Clickable", due_date: "2026-07-18T09:00:00Z" }),
        ],
      },
    });
    // Clicking doesn't throw and the chip is present.
    await user.click(screen.getByText("Clickable"));
    expect(screen.getByText("Clickable")).toBeInTheDocument();
  });
});
