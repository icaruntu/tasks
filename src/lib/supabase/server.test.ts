// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const createServerClient = vi.fn(() => ({ ok: true }));
const store = new Map<string, string>();
const cookieStore = {
  getAll: vi.fn(() => [...store.entries()].map(([name, value]) => ({ name, value }))),
  set: vi.fn((name: string, value: string) => store.set(name, value)),
};

vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
});

describe("supabase server client", () => {
  it("wires cookie getAll/setAll adapters", async () => {
    const { createClient } = await import("./server");
    await createClient();
    expect(createServerClient).toHaveBeenCalledOnce();
    const cfg = (createServerClient.mock.calls[0] as unknown[])[2] as {
      cookies: {
        getAll: () => unknown;
        setAll: (c: { name: string; value: string; options?: unknown }[]) => void;
      };
    };
    cfg.cookies.setAll([{ name: "sb", value: "x", options: {} }]);
    expect(cookieStore.set).toHaveBeenCalledWith("sb", "x", {});
    cfg.cookies.getAll();
    expect(cookieStore.getAll).toHaveBeenCalled();
  });

  it("swallows setAll errors from server components", async () => {
    cookieStore.set.mockImplementationOnce(() => {
      throw new Error("read-only");
    });
    const { createClient } = await import("./server");
    await createClient();
    const cfg = (createServerClient.mock.calls[0] as unknown[])[2] as {
      cookies: { setAll: (c: { name: string; value: string }[]) => void };
    };
    expect(() => cfg.cookies.setAll([{ name: "a", value: "b" }])).not.toThrow();
  });
});
