import Stripe from "stripe";
import type { Plan } from "@/lib/plans";

/** Server-only Stripe client. Returns null when not configured. */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

// Checkout price keys → Stripe price IDs (set in env).
export const PRICE_IDS: Record<string, string | undefined> = {
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
  pro_yearly: process.env.STRIPE_PRICE_PRO_YEARLY,
  team: process.env.STRIPE_PRICE_TEAM,
};

/** Map a Stripe price ID back to our plan tier. */
export function planFromPriceId(priceId: string | undefined): Plan {
  if (!priceId) return "free";
  if (priceId === process.env.STRIPE_PRICE_TEAM) return "team";
  if (
    priceId === process.env.STRIPE_PRICE_PRO_MONTHLY ||
    priceId === process.env.STRIPE_PRICE_PRO_YEARLY
  )
    return "pro";
  return "free";
}
