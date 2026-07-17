// @vitest-environment node
import { describe, it, expect, afterEach, vi } from "vitest";
import { toolInput, textOf } from "./anthropic";
import type Anthropic from "@anthropic-ai/sdk";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("getAnthropic", () => {
  it("returns null without an API key", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.resetModules();
    const { getAnthropic } = await import("./anthropic");
    expect(getAnthropic()).toBeNull();
  });

  it("returns a client when configured", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    vi.resetModules();
    const { getAnthropic } = await import("./anthropic");
    expect(getAnthropic()).not.toBeNull();
  });

  it("defaults the model ids", async () => {
    vi.stubEnv("ANTHROPIC_MODEL", undefined as unknown as string);
    vi.stubEnv("ANTHROPIC_MODEL_FAST", undefined as unknown as string);
    vi.resetModules();
    const { AI_MODEL, AI_MODEL_FAST } = await import("./anthropic");
    expect(AI_MODEL).toContain("sonnet");
    expect(AI_MODEL_FAST).toContain("haiku");
  });
});

describe("toolInput", () => {
  it("extracts the first tool_use input", () => {
    const content = [
      { type: "text", text: "hi" },
      { type: "tool_use", id: "1", name: "t", input: { a: 1 } },
    ] as unknown as Anthropic.ContentBlock[];
    expect(toolInput(content)).toEqual({ a: 1 });
  });
  it("returns null when there is no tool_use block", () => {
    const content = [
      { type: "text", text: "hi" },
    ] as unknown as Anthropic.ContentBlock[];
    expect(toolInput(content)).toBeNull();
  });
});

describe("textOf", () => {
  it("concatenates text blocks only", () => {
    const content = [
      { type: "text", text: "Hello " },
      { type: "tool_use", id: "1", name: "t", input: {} },
      { type: "text", text: "world" },
    ] as unknown as Anthropic.ContentBlock[];
    expect(textOf(content)).toBe("Hello world");
  });
});
