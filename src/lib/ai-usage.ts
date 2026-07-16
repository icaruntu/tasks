import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getEntitlements, aiRequestsThisMonth } from "@/lib/entitlements";

/** Returns a 402 response if the user is over their monthly AI quota, else null. */
export async function aiQuotaResponse(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<NextResponse | null> {
  const { plan, limits } = await getEntitlements(supabase, userId);
  const used = await aiRequestsThisMonth(supabase, userId);
  if (used >= limits.aiRequestsPerMonth) {
    return NextResponse.json(
      {
        error:
          plan === "free"
            ? "AI features are part of Pro — upgrade to use them."
            : "You’ve reached your monthly AI limit.",
        upgrade: true,
      },
      { status: 402 },
    );
  }
  return null;
}

/** Record an AI call's token usage for metering. */
export async function logAiUsage(
  supabase: SupabaseClient<Database>,
  userId: string,
  feature: string,
  usage: { input_tokens?: number; output_tokens?: number } | undefined,
): Promise<void> {
  await supabase.from("ai_usage").insert({
    user_id: userId,
    feature,
    input_tokens: usage?.input_tokens ?? 0,
    output_tokens: usage?.output_tokens ?? 0,
  });
}
