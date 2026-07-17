import { describe, it, expect } from "vitest";
import { renderApp, screen } from "@/test/render";
import { NotificationBell } from "./notification-bell";
import { makeNotification } from "@/test/factories";

describe("NotificationBell", () => {
  it("shows the unread count badge", async () => {
    await renderApp(<NotificationBell />, {
      seed: {
        notifications: [
          makeNotification({ id: "n1", read_at: null }),
          makeNotification({ id: "n2", read_at: null }),
          makeNotification({ id: "n3", read_at: "2026-01-02" }),
        ],
      },
    });
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("caps the badge at 9+", async () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      makeNotification({ id: `n${i}`, read_at: null }),
    );
    await renderApp(<NotificationBell />, { seed: { notifications: many } });
    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("opens the panel and marks a notification read on click", async () => {
    const { user, supabase } = await renderApp(<NotificationBell />, {
      seed: {
        notifications: [
          makeNotification({ id: "n1", title: "Assigned!", read_at: null, task_id: null }),
        ],
      },
    });
    await user.click(screen.getByLabelText("Notifications"));
    expect(screen.getByText("Assigned!")).toBeInTheDocument();
    await user.click(screen.getByText("Assigned!"));
    expect(supabase._store.notifications[0].read_at).not.toBeNull();
  });

  it("marks all read", async () => {
    const { user, supabase } = await renderApp(<NotificationBell />, {
      seed: {
        notifications: [
          makeNotification({ id: "n1", read_at: null }),
          makeNotification({ id: "n2", read_at: null }),
        ],
      },
    });
    await user.click(screen.getByLabelText("Notifications"));
    await user.click(screen.getByText("Mark all read"));
    expect(supabase._store.notifications.every((n) => n.read_at)).toBe(true);
  });

  it("opens the linked task and renders the body", async () => {
    const { user, supabase } = await renderApp(<NotificationBell />, {
      seed: {
        notifications: [
          makeNotification({
            id: "n1",
            title: "New comment",
            body: "Take a look",
            read_at: null,
            task_id: "task-9",
          }),
        ],
      },
    });
    await user.click(screen.getByLabelText("Notifications"));
    expect(screen.getByText("Take a look")).toBeInTheDocument();
    await user.click(screen.getByText("New comment"));
    // marks read (panel also closes because task_id is set)
    expect(supabase._store.notifications[0].read_at).not.toBeNull();
  });

  it("shows an empty state", async () => {
    const { user } = await renderApp(<NotificationBell />, {
      seed: { notifications: [] },
    });
    await user.click(screen.getByLabelText("Notifications"));
    expect(screen.getByText(/all caught up/)).toBeInTheDocument();
  });
});
