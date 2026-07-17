// Supabase Edge Function: daily-digest
// Sends each user a morning email listing their actionable tasks (overdue + due today),
// and records due reminders as notifications for both the task owner and the assignee.
//
// Deploy:   supabase functions deploy daily-digest
// Schedule: create a cron job (Supabase Dashboard → Edge Functions → Schedules, or pg_cron)
//           to invoke it once a day, e.g. every day at 07:00 in the user's timezone.
//
// Required secrets (supabase secrets set ...):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (auto-injected in the Edge runtime)
//   RESEND_API_KEY   — from https://resend.com (or swap for your email provider)
//   DIGEST_FROM      — verified sender, e.g. "TaskFlow <tasks@yourdomain.com>"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type TaskRow = {
  id: string;
  name: string;
  due_date: string | null;
  priority: "high" | "medium" | "low" | null;
  completed: boolean;
  creator_id: string;
  assignee_id: string | null;
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const DIGEST_FROM = Deno.env.get("DIGEST_FROM") ?? "TaskFlow <onboarding@resend.dev>";
// Shared secret so the scheduler can invoke this without a user JWT.
const CRON_SECRET = Deno.env.get("CRON_SECRET");

/** Constant-time comparison to avoid leaking CRON_SECRET via timing. */
function safeEqual(a: string, b: string): boolean {
  const ba = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ba.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i];
  return diff === 0;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function isActionable(t: TaskRow): boolean {
  if (t.completed || !t.due_date) return false;
  const due = new Date(t.due_date);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return due <= endOfToday; // overdue or due today
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.log(`[dry-run] would email ${to}: ${subject}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: DIGEST_FROM, to, subject, html }),
  });
  if (!res.ok) console.error("email failed", to, await res.text());
}

Deno.serve(async (req) => {
  // Auth: require the shared cron secret (function is deployed with verify_jwt=false).
  if (!CRON_SECRET || !safeEqual(req.headers.get("x-cron-secret") ?? "", CRON_SECRET)) {
    return new Response("unauthorized", { status: 401 });
  }

  // Pull every incomplete task with a due date; fan out to owner + assignee.
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id,name,due_date,priority,completed,creator_id,assignee_id")
    .eq("completed", false)
    .not("due_date", "is", null);

  if (error) return new Response(error.message, { status: 500 });

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,email,full_name");
  const emailById = new Map((profiles ?? []).map((p) => [p.id, p]));

  // Group actionable tasks per recipient (owner + assignee, deduped).
  const byUser = new Map<string, TaskRow[]>();
  for (const t of (tasks ?? []) as TaskRow[]) {
    if (!isActionable(t)) continue;
    for (const uid of new Set([t.creator_id, t.assignee_id].filter(Boolean) as string[])) {
      const arr = byUser.get(uid) ?? [];
      arr.push(t);
      byUser.set(uid, arr);
    }
  }

  let sent = 0;
  for (const [uid, list] of byUser) {
    const profile = emailById.get(uid);
    if (!profile?.email) continue;

    const rows = list
      .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
      .map(
        (t) =>
          `<tr><td style="padding:6px 0">${escapeHtml(t.name)}</td>` +
          `<td style="padding:6px 0;color:#71717a">${new Date(t.due_date!).toLocaleDateString()}</td>` +
          `<td style="padding:6px 0">${t.priority ?? ""}</td></tr>`,
      )
      .join("");

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px">
        <h2>Good morning${profile.full_name ? ", " + escapeHtml(profile.full_name) : ""} 👋</h2>
        <p>You have <strong>${list.length}</strong> task${list.length > 1 ? "s" : ""} that need attention today:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr style="text-align:left;color:#71717a;border-bottom:1px solid #e5e5e5">
            <th style="padding:6px 0">Task</th><th>Due</th><th>Priority</th>
          </tr>
          ${rows}
        </table>
        <p style="margin-top:16px"><a href="${Deno.env.get("APP_URL") ?? "#"}">Open TaskFlow →</a></p>
      </div>`;

    await sendEmail(profile.email, `Your ${list.length} tasks for today`, html);

    // Record a daily_digest notification (idempotent per day would need a unique key).
    await supabase.from("notifications").insert({
      user_id: uid,
      type: "daily_digest",
      title: `${list.length} tasks need attention today`,
      emailed_at: new Date().toISOString(),
    });
    sent++;
  }

  return new Response(JSON.stringify({ recipients: sent }), {
    headers: { "Content-Type": "application/json" },
  });
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
