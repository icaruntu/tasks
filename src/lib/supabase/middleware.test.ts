// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

let user: unknown = null;
const createServerClient = vi.fn(() => ({
  auth: { getUser: vi.fn(async () => ({ data: { user } })) },
}));
vi.mock("@supabase/ssr", () => ({ createServerClient }));

function makeRequest(pathname: string) {
  const base = new URL(`http://localhost${pathname}`);
  // NextURL exposes clone(); return a real URL so NextResponse.redirect works.
  const nextUrl = Object.assign(base, {
    clone: () => new URL(base.toString()),
  });
  return {
    nextUrl,
    cookies: { getAll: () => [], set: vi.fn() },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  user = null;
});

describe("updateSession", () => {
  it("redirects unauthenticated users to /login", async () => {
    const { updateSession } = await import("./middleware");
    const res = await updateSession(makeRequest("/board") as never);
    // NextResponse.redirect returns a response with a Location header.
    expect(res.headers.get("location")).toContain("/login");
  });

  it("allows unauthenticated access to auth routes", async () => {
    const { updateSession } = await import("./middleware");
    const res = await updateSession(makeRequest("/login") as never);
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects authenticated users away from /login", async () => {
    user = { id: "u1" };
    const { updateSession } = await import("./middleware");
    const res = await updateSession(makeRequest("/login") as never);
    expect(res.headers.get("location")).toMatch(/\/$/);
  });

  it("lets authenticated users through to app routes", async () => {
    user = { id: "u1" };
    const { updateSession } = await import("./middleware");
    const res = await updateSession(makeRequest("/board") as never);
    expect(res.headers.get("location")).toBeNull();
  });

  it("wires cookie getAll/setAll adapters onto request and response", async () => {
    const req = makeRequest("/board");
    const { updateSession } = await import("./middleware");
    await updateSession(req as never);
    const cfg = (createServerClient.mock.calls[0] as unknown[])[2] as {
      cookies: {
        getAll: () => unknown;
        setAll: (c: { name: string; value: string; options?: unknown }[]) => void;
      };
    };
    cfg.cookies.getAll();
    cfg.cookies.setAll([{ name: "sb", value: "v", options: {} }]);
    expect(req.cookies.set).toHaveBeenCalledWith("sb", "v");
  });
});
