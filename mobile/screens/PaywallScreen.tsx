import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { PurchasesOffering } from "react-native-purchases";
import { useWorkspace } from "../lib/store";
import { colors } from "../lib/theme";
import { Button } from "../components/common";
import {
  configurePurchases,
  getCurrentOffering,
  purchaseFirstPackage,
  restorePurchases,
} from "../lib/purchases";

const PRO_FEATURES = [
  "Unlimited projects",
  "Due-date reminders & daily digest",
  "Recurring tasks",
  "AI: capture, prioritize, plan my day",
];

export function PaywallScreen() {
  const { userId } = useWorkspace();
  const nav = useNavigation();
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const ok = configurePurchases(userId);
    setAvailable(ok);
    if (ok) getCurrentOffering().then(setOffering);
  }, [userId]);

  async function buy() {
    if (!offering) return;
    setBusy(true);
    setMsg(null);
    try {
      const active = await purchaseFirstPackage(offering);
      setMsg(active ? "You’re now on Pro 🎉" : "Purchase not completed.");
      if (active) setTimeout(() => nav.goBack(), 1200);
    } catch {
      setMsg("Purchase cancelled or failed.");
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    setBusy(true);
    const active = await restorePurchases();
    setMsg(active ? "Purchases restored." : "No purchases to restore.");
    setBusy(false);
  }

  const price = offering?.availablePackages[0]?.product.priceString;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Upgrade to Pro</Text>
      <Text style={styles.subtitle}>Everything in Free, plus:</Text>
      <View style={styles.card}>
        {PRO_FEATURES.map((f) => (
          <Text key={f} style={styles.feature}>
            ✓ {f}
          </Text>
        ))}
      </View>

      {available === false && (
        <Text style={styles.note}>
          In-app purchases aren’t configured for this build. Set
          EXPO_PUBLIC_REVENUECAT_IOS_KEY and configure products in RevenueCat.
        </Text>
      )}

      {available && (
        <View style={{ gap: 10 }}>
          <Button
            label={busy ? "Please wait…" : price ? `Subscribe — ${price}` : "Subscribe"}
            onPress={buy}
            disabled={busy || !offering}
          />
          <Button label="Restore purchases" variant="ghost" onPress={restore} disabled={busy} />
        </View>
      )}
      {msg && <Text style={styles.msg}>{msg}</Text>}

      <Text style={styles.legal}>
        Subscriptions are billed through the App Store and managed in your Apple
        account settings.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 14 },
  title: { fontSize: 22, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 14, color: colors.muted },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 8 },
  feature: { fontSize: 15, color: colors.text },
  note: { fontSize: 13, color: colors.muted },
  msg: { fontSize: 14, color: colors.primary, textAlign: "center" },
  legal: { fontSize: 11, color: colors.muted, marginTop: 8 },
});
