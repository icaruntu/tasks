import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, toolInput, AI_MODEL_FAST } from "@/lib/anthropic";

export const runtime = "nodejs";

// Natural-language task capture: "remind me to call Sam next Tuesday, high priority"
// -> { name, due_date, priority }.
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

  const { text, timezone } = await req.json().catch(() => ({}));
  if (!text || !String(text).trim())
    return NextResponse.json({ error: "Empty input" }, { status: 400 });

  const tz = typeof timezone === "string" ? timezone : "UTC";
  const now = new Date().toLocaleString("en-US", { timeZone: tz });

  const resp = await client.messages.create({
    model: AI_MODEL_FAST,
    max_tokens: 512,
    tools: [
      {
        name: "create_task",
        description:
          "Turn the user's natural-language text into a single structured task.",
        input_schema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description:
                "Concise task title. Strip out date/time and priority words.",
            },
            due_date: {
              type: ["string", "null"],
              description:
                "ISO 8601 datetime in the user's timezone if a due date/time is implied, else null.",
            },
            priority: {
              type: ["string", "null"],
              enum: ["high", "medium", "low", null],
              description: "Priority if implied (e.g. 'urgent' -> high), else null.",
            },
          },
          required: ["name"],
          additionalProperties: false,
        },
      },
    ],
    tool_choice: { type: "tool", name: "create_task" },
    messages: [
      {
        role: "user",
        content: `Current date and time: ${now} (timezone ${tz}). Parse this into a task: "${text}"`,
      },
    ],
  });

  const parsed = toolInput(resp.content);
  return NextResponse.json(parsed ?? { name: String(text) });
}
