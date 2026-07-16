import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, planFromPriceId } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Stripe webhook: keeps the provider-agnostic `subscriptions` row in sync.
export async function POST(req: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const admin = createAdminClient();
  if (!stripe || !webhookSecret || !admin)
    return NextResponse.json(
      { error: "Billing is not configured." },
      { status: 501 },
    );

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    return NextResponse.json(
      { error: `Invalid signature: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  async function syncSubscription(sub: Stripe.Subscription, userId?: string) {
    const uid = userId ?? (sub.metadata?.user_id as string | undefined);
    if (!uid) return;
    const item = sub.items.data[0];
    await admin!.from("subscriptions").upsert(
      {
        user_id: uid,
        plan: planFromPriceId(item?.price.id),
        status: sub.status,
        provider: "stripe",
        customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        subscription_id: sub.id,
        seats: item?.quantity ?? 1,
        current_period_end: new Date(
          (sub as unknown as { current_period_end: number }).current_period_end *
            1000,
        ).toISOString(),
      },
      { onConflict: "user_id" },
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(
          session.subscription as string,
        );
        await syncSubscription(sub, userId);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const uid = sub.metadata?.user_id;
      if (uid)
        await admin
          .from("subscriptions")
          .update({ plan: "free", status: "canceled" })
          .eq("user_id", uid);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
