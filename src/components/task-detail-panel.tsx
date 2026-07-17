"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useWorkspace } from "./workspace-provider";
import { useUI } from "./ui-provider";
import { Check, Avatar } from "./ui";
import { toDateInputValue } from "@/lib/dates";
import { PRIORITY_META, RECURRENCE_OPTIONS, type Priority } from "@/lib/types";
import type { Tables } from "@/lib/database.types";

type CommentWithAuthor = Tables<"comments"> & { author?: Tables<"profiles"> };

export function TaskDetailPanel() {
  const { openTaskId, openTask, setPomodoroTaskId } = useUI();
  const {
    supabase,
    userId,
    allTasks,
    profiles,
    connectedProfiles,
    sections,
    projects,
    subtasksOf,
    projectIdsOf,
    updateTask,
    toggleComplete,
    deleteTask,
    createTask,
    setTaskProjects,
    refresh,
  } = useWorkspace();

  const task = allTasks.find((t) => t.id === openTaskId);
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [attachments, setAttachments] = useState<Tables<"attachments">[]>([]);
  const [commentText, setCommentText] = useState("");
  const [showProjects, setShowProjects] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mention, setMention] = useState<{ query: string; start: number } | null>(
    null,
  );
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);

  // Only offer people you're connected to (collaborators / project members).
  const mentionMatches = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return connectedProfiles
      .filter((p) => p.id !== userId)
      .filter((p) =>
        `${p.full_name ?? ""} ${p.email ?? ""}`.toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [mention, connectedProfiles, userId]);

  const loadDetail = useCallback(
    async (taskId: string) => {
      const [c, a] = await Promise.all([
        supabase
          .from("comments")
          .select("*")
          .eq("task_id", taskId)
          .order("created_at"),
        supabase
          .from("attachments")
          .select("*")
          .eq("task_id", taskId)
          .order("created_at"),
      ]);
      const withAuthors = (c.data ?? []).map((cm) => ({
        ...cm,
        author: profiles.find((p) => p.id === cm.author_id),
      }));
      setComments(withAuthors);
      setAttachments(a.data ?? []);
    },
    [supabase, profiles],
  );

  useEffect(() => {
    if (openTaskId) loadDetail(openTaskId);
    else {
      setComments([]);
      setAttachments([]);
    }
  }, [openTaskId, loadDetail]);

  if (!openTaskId) return null;
  if (!task) return null;

  const subtasks = subtasksOf(task.id);
  const linkedProjects = projectIdsOf(task.id);

  async function addSubtask(name: string) {
    if (!name.trim() || !task) return;
    const pos =
      subtasks.reduce((m, s) => Math.max(m, s.position), 0) + 1000;
    await createTask({
      name: name.trim(),
      parent_task_id: task.id,
      position: pos,
      section_id: task.section_id,
    });
  }

  async function postComment() {
    const body = commentText.trim();
    if (!body || !task) return;
    const { data } = await supabase
      .from("comments")
      .insert({ task_id: task.id, author_id: userId, body })
      .select("*")
      .single();
    if (data) {
      // Parse @mentions: match connected profiles' names present after an "@".
      const mentioned = connectedProfiles.filter((p) => {
        const name = (p.full_name ?? "").trim();
        if (!name) return false;
        return body.toLowerCase().includes("@" + name.toLowerCase());
      });
      if (mentioned.length) {
        await supabase.from("comment_mentions").insert(
          mentioned.map((m) => ({
            comment_id: data.id,
            mentioned_user_id: m.id,
          })),
        );
      }
      setComments((prev) => [
        ...prev,
        { ...data, author: profiles.find((p) => p.id === userId) },
      ]);
      setCommentText("");
      refresh();
    }
  }

  async function suggestPriority() {
    if (!task || aiBusy) return;
    setAiBusy(true);
    setAiNote(null);
    try {
      const res = await fetch("/api/ai/prioritize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiNote(j.error ?? "Couldn’t get a suggestion.");
        return;
      }
      await updateTask(task.id, {
        priority: j.priority ?? task.priority,
        due_date: j.suggested_due_date ?? task.due_date,
      });
      setAiNote(j.rationale ?? "Updated.");
    } catch {
      setAiNote("Something went wrong.");
    } finally {
      setAiBusy(false);
    }
  }

  function onCommentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setCommentText(val);
    const caret = e.target.selectionStart ?? val.length;
    const match = val.slice(0, caret).match(/(?:^|\s)@([^\s@]*)$/u);
    setMention(match ? { query: match[1], start: caret - match[1].length - 1 } : null);
  }

  function pickMention(name: string) {
    if (!mention) return;
    const end = mention.start + 1 + mention.query.length;
    const next =
      commentText.slice(0, mention.start) +
      "@" +
      name +
      " " +
      commentText.slice(end);
    setCommentText(next);
    setMention(null);
    requestAnimationFrame(() => commentRef.current?.focus());
  }

  async function onUpload(file: File) {
    if (!task) return;
    setUploading(true);
    const path = `${task.id}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage
      .from("attachments")
      .upload(path, file);
    if (!error) {
      const { data } = await supabase
        .from("attachments")
        .insert({
          task_id: task.id,
          uploaded_by: userId,
          storage_path: path,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
        })
        .select("*")
        .single();
      if (data) setAttachments((prev) => [...prev, data]);
    }
    setUploading(false);
  }

  async function openAttachment(path: string) {
    const { data } = await supabase.storage
      .from("attachments")
      .createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={() => openTask(null)}
      />
      <aside className="fixed right-0 top-0 h-full w-full sm:w-[440px] surface border-l border-app z-50 flex flex-col animate-slidein shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 h-12 border-b border-app">
          <button
            onClick={() =>
              setPomodoroTaskId(task.id)
            }
            className="text-xs surface-muted rounded-md px-2 py-1 hover:ring-1 ring-[var(--color-primary)]"
            title="Focus on this task with Pomodoro"
          >
            🍅 Focus
          </button>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => {
                if (confirm("Delete this task?")) {
                  deleteTask(task.id);
                  openTask(null);
                }
              }}
              className="text-muted hover:text-rose-500 px-2 py-1 text-sm"
              title="Delete task"
            >
              🗑
            </button>
            <button
              onClick={() => openTask(null)}
              className="text-muted hover:text-[var(--foreground)] px-2 py-1 text-lg"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Title */}
          <div className="flex items-start gap-3 px-4 pt-4">
            <div className="pt-0.5">
              <Check
                checked={task.completed}
                onChange={() => toggleComplete(task.id, !task.completed)}
              />
            </div>
            <textarea
              defaultValue={task.name}
              rows={1}
              className={`flex-1 text-lg font-medium bg-transparent outline-none resize-none ${
                task.completed ? "line-through text-muted" : ""
              }`}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== task.name) updateTask(task.id, { name: v });
              }}
            />
          </div>

          {/* Properties */}
          <div className="px-4 py-4 space-y-3 border-b border-app">
            <PropRow label="Assignee">
              <select
                value={task.assignee_id ?? ""}
                onChange={(e) =>
                  updateTask(task.id, { assignee_id: e.target.value || null })
                }
                className="bg-transparent text-sm outline-none cursor-pointer"
              >
                <option value="">Unassigned</option>
                {connectedProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name ?? p.email}
                  </option>
                ))}
                {/* Keep an out-of-network assignee visible if already set. */}
                {task.assignee_id &&
                  !connectedProfiles.some((p) => p.id === task.assignee_id) && (
                    <option value={task.assignee_id}>
                      {profiles.find((p) => p.id === task.assignee_id)
                        ?.full_name ?? "Unknown user"}
                    </option>
                  )}
              </select>
            </PropRow>

            <PropRow label="Due date">
              <input
                type="date"
                value={toDateInputValue(task.due_date)}
                onChange={(e) =>
                  updateTask(task.id, {
                    due_date: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null,
                  })
                }
                className="bg-transparent text-sm outline-none cursor-pointer"
              />
            </PropRow>

            <PropRow label="Priority">
              <select
                value={task.priority ?? ""}
                onChange={(e) =>
                  updateTask(task.id, {
                    priority: (e.target.value || null) as Priority | null,
                  })
                }
                className="bg-transparent text-sm outline-none cursor-pointer"
              >
                <option value="">None</option>
                {(["high", "medium", "low"] as Priority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </option>
                ))}
              </select>
            </PropRow>

            <PropRow label="Section">
              <select
                value={task.section_id ?? ""}
                onChange={(e) =>
                  updateTask(task.id, { section_id: e.target.value || null })
                }
                className="bg-transparent text-sm outline-none cursor-pointer"
              >
                <option value="">Inbox</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </PropRow>

            <PropRow label="Repeat">
              <select
                value={task.recurrence ?? ""}
                onChange={(e) =>
                  updateTask(task.id, { recurrence: e.target.value || null })
                }
                className="bg-transparent text-sm outline-none cursor-pointer"
              >
                <option value="">Never</option>
                {RECURRENCE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </PropRow>

            <PropRow label="Projects">
              <div className="relative">
                <button
                  onClick={() => setShowProjects((s) => !s)}
                  className="flex items-center gap-1.5 flex-wrap text-sm"
                >
                  {linkedProjects.length === 0 && (
                    <span className="text-muted">Add to project…</span>
                  )}
                  {linkedProjects.map((pid) => {
                    const pr = projects.find((p) => p.id === pid);
                    if (!pr) return null;
                    return (
                      <span
                        key={pid}
                        className="inline-flex items-center gap-1 surface-muted rounded-full px-2 py-0.5 text-xs"
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: pr.color }}
                        />
                        {pr.name}
                      </span>
                    );
                  })}
                </button>
                {showProjects && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowProjects(false)}
                    />
                    <div className="absolute right-0 mt-1 w-52 surface border border-app rounded-lg shadow-lg z-20 p-1 max-h-60 overflow-y-auto">
                      {projects.length === 0 && (
                        <p className="text-xs text-muted p-2">
                          No projects yet.
                        </p>
                      )}
                      {projects.map((pr) => {
                        const on = linkedProjects.includes(pr.id);
                        return (
                          <button
                            key={pr.id}
                            onClick={() => {
                              const next = on
                                ? linkedProjects.filter((x) => x !== pr.id)
                                : [...linkedProjects, pr.id];
                              setTaskProjects(task.id, next);
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:surface-muted"
                          >
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ background: pr.color }}
                            />
                            <span className="flex-1 text-left truncate">
                              {pr.name}
                            </span>
                            {on && <span className="text-[var(--color-primary)]">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </PropRow>

            <div className="pt-1">
              <button
                onClick={suggestPriority}
                disabled={aiBusy}
                className="inline-flex items-center gap-1.5 text-xs text-[var(--color-primary)] hover:underline disabled:opacity-60"
              >
                <span>✨</span>
                {aiBusy ? "Thinking…" : "Suggest priority & due date"}
              </button>
              {aiNote && <p className="text-xs text-muted mt-1">{aiNote}</p>}
            </div>
          </div>

          {/* Description */}
          <div className="px-4 py-4 border-b border-app">
            <p className="text-xs font-semibold text-muted mb-1.5">
              Description
            </p>
            <textarea
              defaultValue={task.description ?? ""}
              placeholder="Add a description…"
              rows={3}
              className="w-full bg-transparent text-sm outline-none resize-none"
              onBlur={(e) => {
                const v = e.target.value;
                if (v !== (task.description ?? ""))
                  updateTask(task.id, { description: v || null });
              }}
            />
          </div>

          {/* Subtasks */}
          <div className="px-4 py-4 border-b border-app">
            <p className="text-xs font-semibold text-muted mb-2">
              Subtasks{" "}
              {subtasks.length > 0 &&
                `· ${subtasks.filter((s) => s.completed).length}/${subtasks.length}`}
            </p>
            <div className="space-y-1">
              {subtasks.map((s) => (
                <div key={s.id} className="flex items-center gap-2.5">
                  <Check
                    size={16}
                    checked={s.completed}
                    onChange={() => toggleComplete(s.id, !s.completed)}
                  />
                  <input
                    defaultValue={s.name}
                    className={`flex-1 bg-transparent text-sm outline-none ${
                      s.completed ? "line-through text-muted" : ""
                    }`}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== s.name) updateTask(s.id, { name: v });
                    }}
                  />
                  <input
                    type="date"
                    value={toDateInputValue(s.due_date)}
                    onChange={(e) =>
                      updateTask(s.id, {
                        due_date: e.target.value
                          ? new Date(e.target.value).toISOString()
                          : null,
                      })
                    }
                    className="bg-transparent text-xs text-muted outline-none cursor-pointer w-[7.5rem]"
                    title="Due date"
                  />
                  <button
                    onClick={() => deleteTask(s.id)}
                    className="text-muted hover:text-rose-500 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <input
              placeholder="+ Add subtask"
              className="w-full mt-2 bg-transparent text-sm outline-none text-muted focus:text-[var(--foreground)]"
              onKeyDown={async (e) => {
                const input = e.currentTarget;
                if (e.key === "Enter" && input.value.trim()) {
                  await addSubtask(input.value);
                  input.value = "";
                }
              }}
            />
          </div>

          {/* Attachments */}
          <div className="px-4 py-4 border-b border-app">
            <p className="text-xs font-semibold text-muted mb-2">Attachments</p>
            <div className="space-y-1">
              {attachments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 text-sm surface-muted rounded-lg px-3 py-1.5"
                >
                  <span>📎</span>
                  <button
                    onClick={() => openAttachment(a.storage_path)}
                    className="flex-1 text-left truncate hover:underline"
                  >
                    {a.file_name}
                  </button>
                  {a.uploaded_by === userId && (
                    <button
                      onClick={async () => {
                        await supabase.storage
                          .from("attachments")
                          .remove([a.storage_path]);
                        await supabase.from("attachments").delete().eq("id", a.id);
                        setAttachments((prev) =>
                          prev.filter((x) => x.id !== a.id),
                        );
                      }}
                      className="text-muted hover:text-rose-500 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <label className="inline-block mt-2 text-sm text-[var(--color-primary)] cursor-pointer">
              {uploading ? "Uploading…" : "+ Add attachment"}
              <input
                type="file"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          {/* Comments */}
          <div className="px-4 py-4">
            <p className="text-xs font-semibold text-muted mb-3">Comments</p>
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2.5">
                  <Avatar profile={c.author} size={26} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs">
                      <span className="font-medium">
                        {c.author?.full_name ?? "User"}
                      </span>
                    </p>
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {c.body}
                    </p>
                  </div>
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-xs text-muted">No comments yet.</p>
              )}
            </div>
            <div className="mt-3 relative">
              {mention && mentionMatches.length > 0 && (
                <div className="absolute bottom-full mb-1 left-0 w-64 surface border border-app rounded-lg shadow-lg z-10 overflow-hidden">
                  {mentionMatches.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => pickMention(p.full_name ?? p.email ?? "")}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm hover:surface-muted text-left"
                    >
                      <Avatar profile={p} size={22} />
                      <span className="truncate">{p.full_name ?? p.email}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <textarea
                  ref={commentRef}
                  value={commentText}
                  onChange={onCommentChange}
                  placeholder="Comment… type @ to mention"
                  rows={1}
                  className="flex-1 surface-muted border border-app rounded-lg px-3 py-2 text-sm outline-none resize-none focus:border-[var(--color-primary)]"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setMention(null);
                    if (
                      e.key === "Enter" &&
                      (e.metaKey || e.ctrlKey)
                    ) {
                      postComment();
                    }
                  }}
                />
                <button
                  onClick={postComment}
                  className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-lg px-3 text-sm self-stretch"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function PropRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-muted w-20 shrink-0 pt-1">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
