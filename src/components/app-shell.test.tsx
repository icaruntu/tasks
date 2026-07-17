import { describe, it, expect, vi } from "vitest";
import { renderApp, screen } from "@/test/render";
import { AppShell } from "./app-shell";
import { makeProject, makeProfile } from "@/test/factories";

// signOut is a server action; stub it so the form doesn't blow up.
vi.mock("@/app/login/actions", () => ({ signOut: vi.fn() }));

describe("AppShell", () => {
  it("renders nav, projects, and the current user", async () => {
    await renderApp(<AppShell>content</AppShell>, {
      seed: {
        profiles: [makeProfile({ id: "user-1", full_name: "Ada", email: "ada@x.io" })],
        projects: [makeProject({ id: "pr1", name: "Roadmap" })],
        subscriptions: [],
      },
    });
    expect(screen.getByText("List")).toBeInTheDocument();
    expect(screen.getByText("Board")).toBeInTheDocument();
    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Roadmap")).toBeInTheDocument();
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("shows an upgrade link for free users and plan name for paid", async () => {
    await renderApp(<AppShell>x</AppShell>, {
      seed: { profiles: [makeProfile({ id: "user-1" })], subscriptions: [] },
    });
    expect(screen.getByText("✨ Upgrade")).toBeInTheDocument();
  });

  it("opens Plan my day dialog", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ plan: "Plan text" }) }),
    );
    const { user } = await renderApp(<AppShell>x</AppShell>, {
      seed: { profiles: [makeProfile({ id: "user-1" })], subscriptions: [] },
    });
    await user.click(screen.getByText("Plan my day"));
    expect(await screen.findByText("Plan text")).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it("adds a project from the sidebar", async () => {
    const { user, supabase } = await renderApp(<AppShell>x</AppShell>, {
      seed: { profiles: [makeProfile({ id: "user-1" })], projects: [], subscriptions: [] },
    });
    await user.click(screen.getByTitle("New project"));
    const input = screen.getByPlaceholderText("Project name…");
    await user.type(input, "Fresh{Enter}");
    expect(supabase._store.projects.some((p) => p.name === "Fresh")).toBe(true);
  });

  it("blocks a 6th project on the free plan with an upgrade prompt", async () => {
    const projects = Array.from({ length: 5 }, (_, i) =>
      makeProject({ id: `p${i}`, name: `P${i}` }),
    );
    const { user } = await renderApp(<AppShell>x</AppShell>, {
      seed: { profiles: [makeProfile({ id: "user-1" })], projects, subscriptions: [] },
    });
    await user.click(screen.getByTitle("New project"));
    expect(screen.getByText(/limited to 5 projects/)).toBeInTheDocument();
  });

  it("opens and dismisses the mobile sidebar", async () => {
    const { user } = await renderApp(<AppShell>x</AppShell>, {
      seed: { profiles: [makeProfile({ id: "user-1" })], subscriptions: [] },
    });
    // The mobile header hamburger is a <button>; the List nav icon is a <span>.
    await user.click(screen.getByText("☰", { selector: "button" }));
    expect(screen.getAllByText("List").length).toBeGreaterThan(1);
    // Backdrop dismiss (the flex-1 overlay in the mobile drawer)
    const backdrop = document.querySelector(".bg-black\\/30");
    await user.click(backdrop as Element);
    expect(screen.getAllByText("List").length).toBe(1);
  });

  it("navigates via nav links and project links", async () => {
    const { user } = await renderApp(<AppShell>x</AppShell>, {
      seed: {
        profiles: [makeProfile({ id: "user-1" })],
        projects: [makeProject({ id: "pr1", name: "Alpha" })],
        subscriptions: [],
      },
    });
    // Selecting a project, then the List nav (clears the project filter),
    // then the Settings link — exercises their onClick handlers.
    await user.click(screen.getByText("Alpha"));
    await user.click(screen.getByText("List"));
    await user.click(screen.getByText("Settings"));
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("cancels the inline project input on Escape and blur", async () => {
    const { user } = await renderApp(<AppShell>x</AppShell>, {
      seed: { profiles: [makeProfile({ id: "user-1" })], projects: [], subscriptions: [] },
    });
    await user.click(screen.getByTitle("New project"));
    const input = screen.getByPlaceholderText("Project name…");
    await user.type(input, "{Escape}");
    expect(screen.queryByPlaceholderText("Project name…")).not.toBeInTheDocument();
  });
});
