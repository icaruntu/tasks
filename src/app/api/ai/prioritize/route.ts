import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, toolInput, AI_MODEL } from "@/lib/anthropic";
import { aiQuotaResponse, logAiUsage } from "@/lib/ai-usage";

export const runtime = "nodejs";

// Suggest a priority + due date for a task, given its content and the user's load.
export async function POST(req: Request) {
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

  const quota = await aiQuotaResponse(supabase, user.id);
  if (quota) return quota;

  const { taskId } = await req.json().catch(() => ({}));
  if (!taskId) return NextResponse.json({ error: "Missing taskId" }, { status: 400 });

  // RLS ensures the user can only read tasks they have access to.
  const { data: task } = await supabase
    .from("tasks")
    .select("id, name, description, due_date, priority, section_id")
    .eq("id", taskId)
    .single();
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const { data: siblings } = await supabase
    .from("tasks")
    .select("name, due_date, priority")
    .eq("completed", false)
    .not("due_date", "is", null)
    .neq("id", taskId)
    .limit(25);

  const now = new Date().toISOString();
  const load = (siblings ?? [])
    .map((s) => `- ${s.name} (due ${s.due_date}, ${s.priority ?? "no priority"})`)
    .join("\n");

  const resp = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 512,
    tools: [
      {
        name: "suggest",
        description: "Suggest a priority and due date for the task.",
        input_schema: {
          type: "object",
          properties: {
            priority: { type: "string", enum: ["high", "medium", "low"] },
            suggested_due_date: {
              type: ["string", "null"],
              description: "ISO 8601 datetime, or null to leave unchanged.",
            },
            rationale: {
              type: "string",
              description: "One short sentence explaining the suggestion.",
            },
          },
          required: ["priority", "rationale"],
          additionalProperties: false,
        },
      },
    ],
    tool_choice: { type: "tool", name: "suggest" },
    messages: [
      {
        role: "user",
        content:
          `Current time: ${now}.\n\nTask to assess:\n` +
          `Name: ${task.name}\nDescription: ${task.description ?? "(none)"}\n` +
          `Current due date: ${task.due_date ?? "(none)"}\n\n` +
          `The user's other upcoming tasks:\n${load || "(none)"}\n\n` +
          `Suggest a sensible priority and, if helpful, a due date that fits around their existing load.`,
      },
    ],
  });

  await logAiUsage(supabase, user.id, "prioritize", resp.usage);

  const parsed = toolInput(resp.content);
  return NextResponse.json(parsed ?? { error: "No suggestion" });
}
