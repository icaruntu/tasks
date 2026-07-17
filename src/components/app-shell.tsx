"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWorkspace } from "./workspace-provider";
import { useUI } from "./ui-provider";
import { TaskDetailPanel } from "./task-detail-panel";
import { PomodoroWidget } from "./pomodoro-widget";
import { NotificationBell } from "./notification-bell";
import { PlanDialog } from "./plan-dialog";
import { UpgradePrompt } from "./upgrade-prompt";
import { PLAN_META } from "@/lib/plans";
import { signOut } from "@/app/login/actions";

const NAV = [
  { href: "/", label: "List", icon: "☰" },
  { href: "/board", label: "Board", icon: "▦" },
  { href: "/calendar", label: "Calendar", icon: "▤" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { projects, me, createProject, plan, limits } = useWorkspace();
  const { setFilters, filters } = useUI();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [addingProject, setAddingProject] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState<string | null>(null);

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-2 flex items-center gap-2 font-semibold">
        <span className="h-7 w-7 rounded-lg bg-[var(--color-primary)] text-white grid place-items-center text-sm">
          ✓
        </span>
        TaskFlow
        <span className="ml-auto">
          <NotificationBell />
        </span>
      </div>

      <nav className="px-2 mt-2 space-y-0.5">
        {NAV.map((n) => {
          const active = pathname === n.href;
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => {
                setMobileOpen(false);
                if (n.href === "/")
                  setFilters((f) => ({ ...f, projectId: null }));
              }}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                active
                  ? "surface font-medium shadow-sm"
                  : "text-muted hover:surface-muted"
              }`}
            >
              <span className="w-4 text-center opacity-70">{n.icon}</span>
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-2 mt-2">
        <button
          onClick={() => {
            setPlanning(true);
            setMobileOpen(false);
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--color-primary)] hover:surface-muted"
        >
          <span className="w-4 text-center">✨</span> Plan my day
        </button>
      </div>

      <div className="px-4 mt-6 mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          Projects
        </span>
        <button
          onClick={() => {
            if (projects.length >= limits.maxProjects) {
              setUpgradeMsg(
                "The Free plan is limited to 5 projects. Upgrade to Pro for unlimited projects.",
              );
            } else {
              setAddingProject(true);
            }
          }}
          className="text-muted hover:text-[var(--foreground)] text-lg leading-none"
          title="New project"
        >
          +
        </button>
      </div>

      <div className="px-2 space-y-0.5 overflow-y-auto flex-1">
        {addingProject && (
          <input
            autoFocus
            placeholder="Project name…"
            className="w-full surface-muted border border-app rounded-lg px-3 py-1.5 text-sm outline-none"
            onKeyDown={async (e) => {
              if (e.key === "Enter" && e.currentTarget.value.trim()) {
                if (projects.length >= limits.maxProjects) {
                  setAddingProject(false);
                  setUpgradeMsg(
                    "The Free plan is limited to 5 projects. Upgrade to Pro for unlimited projects.",
                  );
                  return;
                }
                await createProject(
                  e.currentTarget.value.trim(),
                  PROJECT_COLORS[
                    Math.floor(Math.random() * PROJECT_COLORS.length)
                  ],
                );
                setAddingProject(false);
              }
              if (e.key === "Escape") setAddingProject(false);
            }}
            onBlur={() => setAddingProject(false)}
          />
        )}
        {projects.map((p) => {
          const active = filters.projectId === p.id && pathname === "/";
          return (
            <Link
              key={p.id}
              href="/"
              onClick={() => {
                setFilters((f) => ({ ...f, projectId: p.id }));
                setMobileOpen(false);
              }}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition ${
                active ? "surface shadow-sm font-medium" : "text-muted hover:surface-muted"
              }`}
            >
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: p.color }}
              />
              <span className="truncate">{p.name}</span>
            </Link>
          );
        })}
        {projects.length === 0 && !addingProject && (
          <p className="px-3 text-xs text-muted">No projects yet.</p>
        )}
      </div>

      <div className="p-2 border-t border-app">
        <PomodoroWidget />
      </div>

      <div className="px-2 pt-2">
        <Link
          href="/settings"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
            pathname === "/settings"
              ? "surface font-medium shadow-sm"
              : "text-muted hover:surface-muted"
          }`}
        >
          <span className="w-4 text-center opacity-70">⚙</span> Settings
        </Link>
        <Link
          href="/settings/billing"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
            plan === "free"
              ? "text-[var(--color-primary)] hover:surface-muted"
              : "text-muted hover:surface-muted"
          }`}
        >
          <span>{plan === "free" ? "✨ Upgrade" : `${PLAN_META[plan].name} plan`}</span>
          <span className="text-xs opacity-70">›</span>
        </Link>
      </div>

      <div className="p-3 border-t border-app flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {me?.full_name ?? "You"}
          </p>
          <p className="text-xs text-muted truncate">{me?.email}</p>
        </div>
        <form action={signOut}>
          <button
            className="text-xs text-muted hover:text-[var(--foreground)] px-2 py-1 rounded-md hover:surface-muted"
            title="Sign out"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-app surface-muted flex-col">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="w-64 surface-muted border-r border-app h-full">
            {sidebar}
          </div>
          <div
            className="flex-1 bg-black/30"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center gap-3 px-4 h-12 border-b border-app surface">
          <button onClick={() => setMobileOpen(true)} className="text-xl">
            ☰
          </button>
          <span className="font-semibold">TaskFlow</span>
          <span className="ml-auto">
            <NotificationBell />
          </span>
        </header>
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>

      <TaskDetailPanel />
      {planning && <PlanDialog onClose={() => setPlanning(false)} />}
      {upgradeMsg && (
        <UpgradePrompt
          title="Upgrade to Pro"
          message={upgradeMsg}
          onClose={() => setUpgradeMsg(null)}
        />
      )}
    </div>
  );
}

const PROJECT_COLORS = [
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
];
