import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { PLAN_LIMITS, type Plan, type PlanLimits } from "@/lib/plans";

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export type Entitlements = {
  plan: Plan;
  limits: PlanLimits;
  status: string;
  currentPeriodEnd: string | null;
};

/** Resolve a user's effective plan + limits. Defaults to free when no active row. */
export async function getEntitlements(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Entitlements> {
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  const active = data && ACTIVE_STATUSES.has(data.status);
  const plan: Plan = active ? ((data!.plan as Plan) ?? "free") : "free";

  return {
    plan,
    limits: PLAN_LIMITS[plan],
    status: data?.status ?? "none",
    currentPeriodEnd: data?.current_period_end ?? null,
  };
}

/** Count a user's AI requests in the current calendar month. */
export async function aiRequestsThisMonth(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<number> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("ai_usage")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", start.toISOString());
  return count ?? 0;
}
