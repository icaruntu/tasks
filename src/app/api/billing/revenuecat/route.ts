import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Constant-time string comparison to avoid leaking the secret via timing. */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ENDED = new Set([
  "CANCELLATION",
  "EXPIRATION",
  "SUBSCRIPTION_PAUSED",
  "BILLING_ISSUE",
]);

// RevenueCat webhook (iOS/Android IAP) → provider-agnostic `subscriptions` row.
// The mobile app must set RevenueCat's appUserID to the Supabase user id.
export async function POST(req: Request) {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  const admin = createAdminClient();
  if (!secret || !admin)
    return NextResponse.json({ error: "Not configured" }, { status: 501 });

  if (!safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const e = body?.event;
  const userId: string | undefined = e?.app_user_id;
  // Ignore anonymous / non-mapped users; 200 so RevenueCat doesn't retry.
  if (!userId || !UUID_RE.test(userId))
    return NextResponse.json({ received: true });

  const provider = e.store === "PLAY_STORE" ? "google" : "apple";

  if (ENDED.has(e.type)) {
    await admin
      .from("subscriptions")
      .update({ plan: "free", status: "canceled" })
      .eq("user_id", userId);
    return NextResponse.json({ received: true });
  }

  const plan = String(e.product_id ?? "")
    .toLowerCase()
    .includes("team")
    ? "team"
    : "pro";

  await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      plan,
      status: "active",
      provider,
      customer_id: userId,
      subscription_id: String(e.transaction_id ?? e.id ?? ""),
      current_period_end: e.expiration_at_ms
        ? new Date(e.expiration_at_ms).toISOString()
        : null,
    },
    { onConflict: "user_id" },
  );

  return NextResponse.json({ received: true });
}
