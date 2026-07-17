import { describe, it, expect, vi } from "vitest";

const createBrowserClient = vi.fn(() => ({ browser: true }));
vi.mock("@supabase/ssr", () => ({ createBrowserClient }));

describe("supabase browser client", () => {
  it("constructs a browser client from public env vars", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    // Bypass the global mock of this module to exercise the real implementation.
    const actual = await vi.importActual<typeof import("./client")>("./client");
    const client = actual.createClient();
    expect(client).toEqual({ browser: true });
    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://x.supabase.co",
      "anon-key",
    );
    vi.unstubAllEnvs();
  });
});
