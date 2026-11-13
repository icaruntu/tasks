import { describe, it, expect, afterEach, vi } from "vitest";
import { renderApp, screen } from "@/test/render";
import { PushSettings } from "./push-settings";
import { makeProfile } from "@/test/factories";

const seed = () => ({ profiles: [makeProfile({ id: "user-1" })] });

function installPushApis({ subscribed = false } = {}) {
  const sub = {
    endpoint: "https://web.push.apple.com/device-1",
    toJSON: () => ({ keys: { p256dh: "P256", auth: "AUTH" } }),
    unsubscribe: vi.fn(async () => true),
  } as unknown as PushSubscription;
  let current: PushSubscription | null = subscribed ? sub : null;
  const pushManager = {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async () => {
      current = sub;
      return sub;
    }),
  };
  const reg = { pushManager };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      register: vi.fn(async () => reg),
      getRegistration: vi.fn(async () => reg),
      ready: Promise.resolve(reg),
    },
  });
  const Notification = {
    permission: subscribed ? "granted" : "default",
    requestPermission: vi.fn(async () => "granted"),
  };
  vi.stubGlobal("Notification", Notification);
  vi.stubGlobal("PushManager", class {});
  return { sub, pushManager, Notification };
}

afterEach(() => {
  vi.unstubAllGlobals();
  // @ts-expect-error -- remove the test double
  delete navigator.serviceWorker;
});

describe("PushSettings", () => {
  it("explains when the browser cannot do push", async () => {
    await renderApp(<PushSettings />, { seed: seed() });
    expect(screen.getByText(/does not support notifications/)).toBeInTheDocument();
  });

  it("turns notifications on and stores the subscription", async () => {
    const { pushManager } = installPushApis();
    const { user, supabase } = await renderApp(<PushSettings />, { seed: seed() });
    supabase.rpc.mockResolvedValueOnce({ data: "AQAB", error: null });

    await user.click(await screen.findByRole("button", { name: "Turn on notifications" }));

    expect(await screen.findByText("● On for this device")).toBeInTheDocument();
    expect(supabase.rpc).toHaveBeenCalledWith("get_web_push_public_key");
    expect(pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );
    expect(supabase._store.web_push_subscriptions).toEqual([
      expect.objectContaining({
        user_id: "user-1",
        endpoint: "https://web.push.apple.com/device-1",
        p256dh: "P256",
        auth: "AUTH",
      }),
    ]);
  });

  it("sends a test notification and can turn off", async () => {
    const { sub } = installPushApis({ subscribed: true });

    const { user, supabase } = await renderApp(<PushSettings />, { seed: seed() });
    expect(await screen.findByText("● On for this device")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Send test" }));
    expect(supabase._store.notifications).toEqual([
      expect.objectContaining({ user_id: "user-1", title: "Test notification" }),
    ]);

    await user.click(screen.getByRole("button", { name: "Turn off" }));
    expect(await screen.findByRole("button", { name: "Turn on notifications" })).toBeInTheDocument();
    expect(supabase._store.web_push_subscriptions ?? []).toHaveLength(0);
    expect(sub.unsubscribe).toHaveBeenCalled();
  });
});
