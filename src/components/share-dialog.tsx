"use client";

import { useMemo, useState } from "react";
import { useWorkspace } from "./workspace-provider";
import { UpgradePrompt } from "./upgrade-prompt";
import { Avatar } from "./ui";
import type { MemberRole } from "@/lib/types";

export function ShareDialog({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const {
    userId,
    projects,
    profiles,
    membersOf,
    addMember,
    updateMemberRole,
    removeMember,
    limits,
  } = useWorkspace();
  const [query, setQuery] = useState("");
  const [upgrade, setUpgrade] = useState(false);

  const project = projects.find((p) => p.id === projectId);
  const members = membersOf(projectId);
  const isOwner = project?.owner_id === userId;
  const owner = profiles.find((p) => p.id === project?.owner_id);

  const memberIds = useMemo(
    () => new Set([project?.owner_id, ...members.map((m) => m.user_id)]),
    [members, project?.owner_id],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return profiles
      .filter((p) => !memberIds.has(p.id))
      .filter((p) =>
        `${p.full_name ?? ""} ${p.email ?? ""}`.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [query, profiles, memberIds]);

  if (!project) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 grid place-items-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md surface border border-app rounded-2xl shadow-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: project.color }}
              />
              Share “{project.name}”
            </h2>
            <button
              onClick={onClose}
              className="text-muted hover:text-[var(--foreground)] text-lg"
            >
              ✕
            </button>
          </div>

          {isOwner && (
            <div className="mb-4">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Invite by name or email…"
                className="w-full surface-muted border border-app rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
              />
              {matches.length > 0 && (
                <div className="mt-1 surface border border-app rounded-lg overflow-hidden">
                  {matches.map((p) => (
                    <button
                      key={p.id}
                      onClick={async () => {
                        if (members.length >= limits.maxMembersPerProject) {
                          setUpgrade(true);
                          return;
                        }
                        await addMember(projectId, p.id, "editor");
                        setQuery("");
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:surface-muted text-left"
                    >
                      <Avatar profile={p} size={26} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">
                          {p.full_name ?? p.email}
                        </span>
                        {p.full_name && (
                          <span className="block text-xs text-muted truncate">
                            {p.email}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-[var(--color-primary)]">
                        Add
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {query.trim() && matches.length === 0 && (
                <p className="text-xs text-muted mt-1 px-1">
                  No matching users. They need a TaskFlow account first.
                </p>
              )}
            </div>
          )}

          <p className="text-xs font-semibold text-muted mb-2">
            People with access
          </p>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {owner && (
              <div className="flex items-center gap-2.5 px-1 py-1.5">
                <Avatar profile={owner} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm truncate">
                    {owner.full_name ?? owner.email}
                    {owner.id === userId && " (you)"}
                  </span>
                </span>
                <span className="text-xs text-muted">Owner</span>
              </div>
            )}

            {members.map((m) => {
              const profile = profiles.find((p) => p.id === m.user_id);
              return (
                <div key={m.user_id} className="flex items-center gap-2.5 px-1 py-1.5">
                  <Avatar profile={profile} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm truncate">
                      {profile?.full_name ?? profile?.email ?? "User"}
                      {m.user_id === userId && " (you)"}
                    </span>
                  </span>
                  {isOwner ? (
                    <>
                      <select
                        value={m.role}
                        onChange={(e) =>
                          updateMemberRole(
                            projectId,
                            m.user_id,
                            e.target.value as MemberRole,
                          )
                        }
                        className="surface-muted border border-app rounded-md text-xs px-1.5 py-1 outline-none"
                      >
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        onClick={() => removeMember(projectId, m.user_id)}
                        className="text-muted hover:text-rose-500 text-sm px-1"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-muted capitalize">{m.role}</span>
                  )}
                </div>
              );
            })}

            {members.length === 0 && (
              <p className="text-xs text-muted px-1 py-2">
                Not shared with anyone yet.
              </p>
            )}
          </div>

          {!isOwner && members.some((m) => m.user_id === userId) && (
            <button
              onClick={async () => {
                await removeMember(projectId, userId);
                onClose();
              }}
              className="mt-4 w-full text-sm text-rose-600 border border-app rounded-lg py-2 hover:surface-muted"
            >
              Leave project
            </button>
          )}
        </div>
      </div>
      {upgrade && (
        <UpgradePrompt
          title="Upgrade to share more"
          message="The Free plan allows up to 2 collaborators per project. Upgrade to Pro for unlimited sharing."
          onClose={() => setUpgrade(false)}
        />
      )}
    </>
  );
}
