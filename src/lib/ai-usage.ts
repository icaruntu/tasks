import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getEntitlements } from "@/lib/entitlements";

type Reservation =
  | { ok: true; usageId: string }
  | { ok: false; response: NextResponse };

/**
 * Atomically reserve one AI request against the user's monthly quota *before*
 * the model call, closing the check-then-act race (#37). Returns the reserved
 * usage-row id, or a 402 response when the user is over their limit / on Free.
 */
export async function reserveAiRequest(
  supabase: SupabaseClient<Database>,
  userId: string,
  feature: string,
): Promise<Reservation> {
  const { plan, limits } = await getEntitlements(supabase, userId);
  const { data: usageId } = await supabase.rpc("reserve_ai_request", {
    p_feature: feature,
    p_limit: limits.aiRequestsPerMonth,
  });
  if (!usageId) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            plan === "free"
              ? "AI features are part of Pro — upgrade to use them."
              : "You’ve reached your monthly AI limit.",
          upgrade: true,
        },
        { status: 402 },
      ),
    };
  }
  return { ok: true, usageId: usageId as string };
}

/** Record token usage onto a previously reserved ai_usage row. */
export async function recordAiTokens(
  supabase: SupabaseClient<Database>,
  usageId: string,
  usage: { input_tokens?: number; output_tokens?: number } | undefined,
): Promise<void> {
  await supabase
    .from("ai_usage")
    .update({
      input_tokens: usage?.input_tokens ?? 0,
      output_tokens: usage?.output_tokens ?? 0,
    })
    .eq("id", usageId);
}
