import { describe, it, expect } from "vitest";
import { detectPushSupport, urlBase64ToUint8Array, subscriptionRow } from "./web-push";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

function env({
  ua = "Mozilla/5.0 (X11; Linux x86_64) Chrome/130",
  apis = false,
  standalone = false,
}: { ua?: string; apis?: boolean; standalone?: boolean }) {
  const navigator = {
    userAgent: ua,
    platform: "",
    maxTouchPoints: 0,
    standalone,
    ...(apis ? { serviceWorker: {} } : {}),
  } as unknown as Navigator;
  const window = {
    navigator,
    matchMedia: () => ({ matches: standalone }),
    ...(apis ? { PushManager: class {}, Notification: class {} } : {}),
  } as unknown as Window & typeof globalThis;
  return { window, navigator };
}

describe("detectPushSupport", () => {
  it("is supported when the push APIs exist", () => {
    expect(detectPushSupport(env({ apis: true }))).toBe("supported");
  });

  it("asks iPhone Safari tabs to use the Home Screen app", () => {
    expect(detectPushSupport(env({ ua: IPHONE_UA }))).toBe("needs-home-screen");
  });

  it("is supported in the iPhone Home Screen app", () => {
    expect(detectPushSupport(env({ ua: IPHONE_UA, apis: true, standalone: true }))).toBe(
      "supported",
    );
  });

  it("is unsupported on an old iOS Home Screen app without push", () => {
    expect(detectPushSupport(env({ ua: IPHONE_UA, standalone: true }))).toBe("unsupported");
  });

  it("is unsupported elsewhere without the APIs", () => {
    expect(detectPushSupport(env({}))).toBe("unsupported");
  });
});

describe("urlBase64ToUint8Array", () => {
  it("decodes unpadded base64url", () => {
    // 0xfb 0xff 0xbf → "-_-_" in base64url
    expect(Array.from(urlBase64ToUint8Array("-_-_"))).toEqual([0xfb, 0xff, 0xbf]);
    expect(Array.from(urlBase64ToUint8Array("AQ"))).toEqual([1]);
  });
});

describe("subscriptionRow", () => {
  it("maps a PushSubscription to a table row", () => {
    const sub = {
      endpoint: "https://web.push.apple.com/abc",
      toJSON: () => ({ keys: { p256dh: "P", auth: "A" } }),
    } as unknown as PushSubscription;
    expect(subscriptionRow("u1", sub)).toMatchObject({
      user_id: "u1",
      endpoint: "https://web.push.apple.com/abc",
      p256dh: "P",
      auth: "A",
    });
  });
});
