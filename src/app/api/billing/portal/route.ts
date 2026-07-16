import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

// Open the Stripe Customer Portal so the user can manage/cancel their subscription.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stripe = getStripe();
  if (!stripe)
    return NextResponse.json(
      { error: "Billing is not configured." },
      { status: 501 },
    );

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!sub?.customer_id)
    return NextResponse.json(
      { error: "No billing account yet." },
      { status: 400 },
    );

  const origin =
    req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.customer_id,
    return_url: `${origin}/settings/billing`,
  });

  return NextResponse.json({ url: session.url });
}
