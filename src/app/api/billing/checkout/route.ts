import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, PRICE_IDS } from "@/lib/stripe";

export const runtime = "nodejs";

// Create a Stripe Checkout session for the signed-in user.
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

  const { priceKey } = await req.json().catch(() => ({}));
  const price = PRICE_IDS[priceKey as string];
  if (!price)
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });

  // Reuse the Stripe customer if we've seen one for this user.
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let customer = sub?.customer_id ?? undefined;
  if (!customer) {
    const created = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    });
    customer = created.id;
  }

  const origin =
    req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price, quantity: 1 }],
    success_url: `${origin}/?billing=success`,
    cancel_url: `${origin}/pricing?billing=cancelled`,
    metadata: { user_id: user.id },
    subscription_data: { metadata: { user_id: user.id } },
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
