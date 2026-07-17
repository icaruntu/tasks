import { describe, it, expect } from "vitest";
import { renderApp, screen } from "@/test/render";
import SettingsPage from "./page";
import { makeProfile } from "@/test/factories";

const seed = () => ({
  profiles: [
    makeProfile({ id: "user-1", email: "me@test.dev", pomodoro_work_minutes: 25 }),
    makeProfile({ id: "u2", email: "friend@x.io", full_name: "Friend" }),
  ],
  collaborators: [],
});

describe("SettingsPage", () => {
  it("adds a collaborator by email", async () => {
    const { user, supabase } = await renderApp(<SettingsPage />, { seed: seed() });
    await user.type(screen.getByPlaceholderText("Add by email…"), "friend@x.io");
    await user.click(screen.getByText("Add"));
    expect(supabase._store.collaborators).toHaveLength(1);
    expect(await screen.findByText("Friend")).toBeInTheDocument();
  });

  it("shows an error for an unknown email", async () => {
    const { user } = await renderApp(<SettingsPage />, { seed: seed() });
    await user.type(screen.getByPlaceholderText("Add by email…"), "ghost@x.io");
    await user.click(screen.getByText("Add"));
    expect(await screen.findByText(/No user with that email/)).toBeInTheDocument();
  });

  it("removes a collaborator", async () => {
    const { user, supabase } = await renderApp(<SettingsPage />, {
      seed: {
        ...seed(),
        collaborators: [{ user_id: "user-1", collaborator_id: "u2" }],
      },
    });
    expect(screen.getByText("Friend")).toBeInTheDocument();
    await user.click(screen.getByTitle("Remove collaborator"));
    expect(supabase._store.collaborators).toHaveLength(0);
  });

  it("saves pomodoro durations", async () => {
    const { user, supabase } = await renderApp(<SettingsPage />, { seed: seed() });
    const focus = screen.getByLabelText("Focus");
    await user.clear(focus);
    await user.type(focus, "45");
    await user.click(screen.getByText("Save"));
    expect(supabase._store.profiles[0].pomodoro_work_minutes).toBe(45);
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
  });
});
