import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderApp, screen, act } from "@/test/render";
import { PomodoroWidget } from "./pomodoro-widget";
import { makeProfile } from "@/test/factories";

describe("PomodoroWidget", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows the user's configured focus duration", async () => {
    await renderApp(<PomodoroWidget />, {
      seed: { profiles: [makeProfile({ id: "user-1", pomodoro_work_minutes: 40 })] },
    });
    expect(screen.getByText("40:00")).toBeInTheDocument();
    expect(screen.getByText("Focus")).toBeInTheDocument();
  });

  it("defaults to 25:00 without a profile value", async () => {
    await renderApp(<PomodoroWidget />, {
      seed: { profiles: [makeProfile({ id: "user-1", pomodoro_work_minutes: 25 })] },
    });
    expect(screen.getByText("25:00")).toBeInTheDocument();
  });

  it("counts down when started and can pause", async () => {
    await renderApp(<PomodoroWidget />, {
      seed: { profiles: [makeProfile({ id: "user-1", pomodoro_work_minutes: 25 })] },
    });
    await act(async () => {
      screen.getByText("Start").click();
    });
    expect(screen.getByText("Pause")).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText("24:57")).toBeInTheDocument();
    await act(async () => {
      screen.getByText("Pause").click();
    });
    expect(screen.getByText("Start")).toBeInTheDocument();
  });

  it("switches phases via the phase dots", async () => {
    await renderApp(<PomodoroWidget />, {
      seed: {
        profiles: [
          makeProfile({
            id: "user-1",
            pomodoro_work_minutes: 25,
            pomodoro_short_break_minutes: 5,
          }),
        ],
      },
    });
    await act(async () => {
      screen.getByTitle("Short break").click();
    });
    expect(screen.getByText("05:00")).toBeInTheDocument();
    expect(screen.getByText("Short break")).toBeInTheDocument();
  });

  it("logs a session and advances to a break when focus completes", async () => {
    const { supabase } = await renderApp(<PomodoroWidget />, {
      seed: {
        profiles: [
          makeProfile({
            id: "user-1",
            pomodoro_work_minutes: 1,
            pomodoro_short_break_minutes: 5,
          }),
        ],
        pomodoro_sessions: [],
      },
    });
    await act(async () => {
      screen.getByText("Start").click();
    });
    // Run out the 1-minute focus phase.
    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });
    expect(supabase._store.pomodoro_sessions?.length ?? 0).toBeGreaterThan(0);
    expect(screen.getByText("Short break")).toBeInTheDocument();
    expect(screen.getByText(/focus session/)).toBeInTheDocument();
  });

  it("resets the timer", async () => {
    await renderApp(<PomodoroWidget />, {
      seed: { profiles: [makeProfile({ id: "user-1", pomodoro_work_minutes: 25 })] },
    });
    await act(async () => {
      screen.getByText("Start").click();
    });
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    await act(async () => {
      screen.getByText("Reset").click();
    });
    expect(screen.getByText("25:00")).toBeInTheDocument();
  });
});
