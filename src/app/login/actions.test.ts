// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const signInWithPassword = vi.fn();
const signUp = vi.fn();
const signOut = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { signInWithPassword, signUp, signOut },
  })),
}));
vi.mock("next/navigation", () => ({ redirect }));

function form(data: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

beforeEach(() => vi.clearAllMocks());

describe("signIn", () => {
  it("returns an error on failure", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "bad creds" } });
    const { signIn } = await import("./actions");
    const res = await signIn({}, form({ email: "a@b.c", password: "x" }));
    expect(res).toEqual({ error: "bad creds" });
  });

  it("redirects home on success", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    const { signIn } = await import("./actions");
    await expect(signIn({}, form({ email: "a@b.c", password: "x" }))).rejects.toThrow(
      "REDIRECT:/",
    );
  });
});

describe("signUp", () => {
  it("returns an error on failure", async () => {
    signUp.mockResolvedValue({ data: {}, error: { message: "taken" } });
    const { signUp: action } = await import("./actions");
    const res = await action({}, form({ email: "a@b.c", password: "x", full_name: "A" }));
    expect(res).toEqual({ error: "taken" });
  });

  it("redirects home when a session is returned immediately", async () => {
    signUp.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
    const { signUp: action } = await import("./actions");
    await expect(
      action({}, form({ email: "a@b.c", password: "x", full_name: "A" })),
    ).rejects.toThrow("REDIRECT:/");
  });

  it("returns a confirmation message when email confirmation is required", async () => {
    signUp.mockResolvedValue({ data: { session: null }, error: null });
    const { signUp: action } = await import("./actions");
    const res = await action({}, form({ email: "a@b.c", password: "x", full_name: "A" }));
    expect(res.message).toMatch(/Check your email/);
  });
});

describe("signOut", () => {
  it("signs out and redirects to /login", async () => {
    signOut.mockResolvedValue({ error: null });
    const { signOut: action } = await import("./actions");
    await expect(action()).rejects.toThrow("REDIRECT:/login");
    expect(signOut).toHaveBeenCalled();
  });
});
