import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, textOf, AI_MODEL } from "@/lib/anthropic";
import { reserveAiRequest, recordAiTokens } from "@/lib/ai-usage";

export const runtime = "nodejs";

// "Plan my day": propose a realistic, ordered plan from the user's actionable tasks.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = getAnthropic();
  if (!client)
    return NextResponse.json(
      { error: "AI is not configured. Set ANTHROPIC_API_KEY." },
      { status: 501 },
    );

  const endOfTomorrow = new Date();
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
  endOfTomorrow.setHours(23, 59, 59, 999);

  // Actionable = incomplete, and either due by end of tomorrow or high priority.
  const { data: tasks } = await supabase
    .from("tasks")
    .select("name, description, due_date, priority")
    .eq("completed", false)
    .is("parent_task_id", null)
    .order("due_date", { ascending: true })
    .limit(40);

  const actionable = (tasks ?? []).filter(
    (t) =>
      t.priority === "high" ||
      (t.due_date && new Date(t.due_date) <= endOfTomorrow),
  );

  if (actionable.length === 0)
    return NextResponse.json({
      plan: "Nothing urgent on your plate — no overdue, due-soon, or high-priority tasks. Enjoy the breathing room, or pull something forward from *Later*.",
    });

  // Reserve quota only once we know we'll actually call the model.
  const reserved = await reserveAiRequest(supabase, user.id, "plan");
  if (!reserved.ok) return reserved.response;

  const list = actionable
    .map(
      (t) =>
        `- ${t.name}${t.priority ? ` [${t.priority}]` : ""}${
          t.due_date ? ` (due ${new Date(t.due_date).toLocaleString()})` : ""
        }`,
    )
    .join("\n");

  const resp = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 1024,
    system:
      "You are a concise productivity assistant. Given a list of tasks, produce a short, realistic plan for today: group or order the tasks sensibly, call out what's most urgent first, and keep it scannable. Use short markdown. Don't invent tasks.",
    messages: [
      {
        role: "user",
        content: `Here are my open tasks. Plan my day:\n\n${list}`,
      },
    ],
  });

  await recordAiTokens(supabase, reserved.usageId, resp.usage);

  return NextResponse.json({ plan: textOf(resp.content) });
}
