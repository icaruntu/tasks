import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import type { TaskRow } from "./types";

const DUE_NOTIFICATION_IDS = "taskflow.due-notification-ids";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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

/**
 * Keep a local iPhone notification aligned with each due task. Local scheduling
 * is reliable even when the app is closed and doesn't wait for a server cron.
 */
export async function syncDueNotifications(tasks: TaskRow[]): Promise<void> {
  const raw = await AsyncStorage.getItem(DUE_NOTIFICATION_IDS);
  const existing: Record<string, string> = raw ? JSON.parse(raw) : {};
  const next: Record<string, string> = {};

  for (const task of tasks) {
    const trigger = task.due_date ? new Date(task.due_date) : null;
    if (existing[task.id]) {
      await Notifications.cancelScheduledNotificationAsync(existing[task.id]).catch(() => {});
    }
    if (!trigger || task.completed || trigger <= new Date()) continue;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Task due",
        body: task.name,
        sound: "default",
        data: { taskId: task.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: trigger,
      },
    });
    next[task.id] = id;
  }

  await AsyncStorage.setItem(DUE_NOTIFICATION_IDS, JSON.stringify(next));
}
