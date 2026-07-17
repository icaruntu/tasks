import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { supabase } from "./supabase";

/**
 * Register the device for push notifications and store the Expo push token so a
 * server function can fan out reminder/mention pushes (#42). No-op on simulators
 * and when permission is denied. Safe to call on every sign-in.
 *
 * A companion Supabase Edge Function (not included) should, when a
 * `notifications` row is inserted, look up push_tokens for that user and POST to
 * https://exp.host/--/api/v2/push/send.
 */
export async function registerForPush(userId: string): Promise<void> {
  if (!Device.isDevice) return; // push isn't available on simulators

  // The runtime object is a PermissionResponse ({ status, granted, ... }); the
  // shipped types are narrower, so read `status` through a minimal cast.
  const isGranted = (r: unknown) => (r as { status?: string }).status === "granted";
  let granted = isGranted(await Notifications.getPermissionsAsync());
  if (!granted) granted = isGranted(await Notifications.requestPermissionsAsync());
  if (!granted) return;

  // projectId is injected by EAS; undefined in bare/dev without EAS config.
  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
      ?.projectId || undefined;

  const tokenResponse = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  const token = tokenResponse?.data;
  if (!token) return;

  await supabase.from("push_tokens").upsert(
    {
      token,
      user_id: userId,
      platform: Platform.OS === "ios" ? "ios" : "android",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "token" },
  );
}
