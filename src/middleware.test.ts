// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

const updateSession = vi.fn(async () => "handled");
vi.mock("@/lib/supabase/middleware", () => ({ updateSession }));

const { middleware, config } = await import("./middleware");

const runsOn = (path: string) =>
  new RegExp(`^${config.matcher[0]}$`).test(path);

describe("middleware", () => {
  it("delegates to updateSession", async () => {
    const request = { nextUrl: new URL("http://localhost/board") };
    await expect(middleware(request as never)).resolves.toBe("handled");
    expect(updateSession).toHaveBeenCalledWith(request);
  });

  it("runs on app routes", () => {
    expect(runsOn("/")).toBe(true);
    expect(runsOn("/board")).toBe(true);
    expect(runsOn("/settings/billing")).toBe(true);
  });

  it("skips assets the browser fetches without cookies", () => {
    // These are requested uncredentialed, so an auth redirect would break
    // Add to Home Screen and the app icons.
    expect(runsOn("/manifest.webmanifest")).toBe(false);
    expect(runsOn("/apple-touch-icon.png")).toBe(false);
    expect(runsOn("/icon-192.png")).toBe(false);
    expect(runsOn("/icon.svg")).toBe(false);
    expect(runsOn("/favicon.ico")).toBe(false);
  });
});
