// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const exchangeCodeForSession = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { exchangeCodeForSession } })),
}));

beforeEach(() => vi.clearAllMocks());

describe("GET /auth/callback", () => {
  it("redirects to next after a successful exchange", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const { GET } = await import("./route");
    const res = await GET(new Request("http://app/auth/callback?code=abc&next=/board"));
    expect(res.headers.get("location")).toBe("http://app/board");
  });

  it("defaults next to /", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const { GET } = await import("./route");
    const res = await GET(new Request("http://app/auth/callback?code=abc"));
    expect(res.headers.get("location")).toBe("http://app/");
  });

  it("redirects to /login when the exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "bad" } });
    const { GET } = await import("./route");
    const res = await GET(new Request("http://app/auth/callback?code=abc"));
    expect(res.headers.get("location")).toBe("http://app/login");
  });

  it("redirects to /login when no code is present", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("http://app/auth/callback"));
    expect(res.headers.get("location")).toBe("http://app/login");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
