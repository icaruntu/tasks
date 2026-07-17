import { Platform } from "react-native";
import Purchases, { type PurchasesOffering } from "react-native-purchases";

// RevenueCat public SDK keys (safe to ship). Set via EXPO_PUBLIC_* env vars.
const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

let configured = false;

/**
 * Configure RevenueCat with the Supabase user id as the appUserID (#23). The
 * revenuecat webhook (src/app/api/billing/revenuecat) already maps events by
 * app_user_id, so purchases flow into the shared `subscriptions` table.
 */
export function configurePurchases(userId: string): boolean {
  const key = Platform.OS === "ios" ? IOS_KEY : ANDROID_KEY;
  if (!key) return false; // IAP not configured for this build
  if (!configured) {
    Purchases.configure({ apiKey: key, appUserID: userId });
    configured = true;
  } else {
    Purchases.logIn(userId).catch(() => {});
  }
  return true;
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch {
    return null;
  }
}

/** Returns true if the user has any active entitlement after the purchase. */
export async function purchaseFirstPackage(offering: PurchasesOffering): Promise<boolean> {
  const pkg = offering.availablePackages[0];
  if (!pkg) return false;
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return Object.keys(customerInfo.entitlements.active).length > 0;
}

export async function restorePurchases(): Promise<boolean> {
  try {
    const info = await Purchases.restorePurchases();
    return Object.keys(info.entitlements.active).length > 0;
  } catch {
    return false;
  }
}
