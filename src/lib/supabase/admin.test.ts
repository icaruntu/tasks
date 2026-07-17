// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const createClient = vi.fn(() => ({ admin: true }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});
afterEach(() => vi.unstubAllEnvs());

describe("createAdminClient", () => {
  it("returns null when the service key is missing", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    const { createAdminClient } = await import("./admin");
    expect(createAdminClient()).toBeNull();
  });

  it("constructs a service-role client with session persistence off", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "svc-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    const { createAdminClient } = await import("./admin");
    const client = createAdminClient();
    expect(client).not.toBeNull();
    expect(createClient).toHaveBeenCalledWith(
      "https://x.supabase.co",
      "svc-key",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  });
});
