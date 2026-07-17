"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useWorkspace } from "./workspace-provider";
import { useUI } from "./ui-provider";
import type { Notification } from "@/lib/types";

const ICON: Record<Notification["type"], string> = {
  assigned: "📌",
  mentioned: "💬",
  comment: "💬",
  due_soon: "⏰",
  overdue: "🔴",
  daily_digest: "📅",
};

export function NotificationBell() {
  const {
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    reloadNotifications,
  } = useWorkspace();
  const { openTask } = useUI();
  const [open, setOpen] = useState(false);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) reloadNotifications();
  }

  return (
    <div className="relative">
      <button
        onClick={toggle}
        className="relative h-8 w-8 grid place-items-center rounded-lg hover:surface text-muted"
        title="Notifications"
        aria-label="Notifications"
      >
        <span className="text-base">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] grid place-items-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] surface border border-app rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-app">
              <span className="text-sm font-semibold">Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllNotificationsRead()}
                  className="text-xs text-[var(--color-primary)]"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 && (
                <p className="text-sm text-muted px-3 py-6 text-center">
                  You’re all caught up.
                </p>
              )}
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    if (!n.read_at) markNotificationRead(n.id);
                    if (n.task_id) {
                      openTask(n.task_id);
                      setOpen(false);
                    }
                  }}
                  className={`w-full text-left flex gap-2.5 px-3 py-2.5 border-b border-app hover:surface-muted ${
                    n.read_at ? "" : "surface-muted"
                  }`}
                >
                  <span className="text-base leading-none mt-0.5">
                    {ICON[n.type] ?? "🔔"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium truncate">
                      {n.title}
                    </span>
                    {n.body && (
                      <span className="block text-xs text-muted truncate">
                        {n.body}
                      </span>
                    )}
                    <span className="block text-[11px] text-muted mt-0.5">
                      {formatDistanceToNow(new Date(n.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </span>
                  {!n.read_at && (
                    <span className="h-2 w-2 rounded-full bg-[var(--color-primary)] mt-1.5 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
