import Anthropic from "@anthropic-ai/sdk";

/** Server-only Anthropic client. Returns null when no API key is configured. */
export function getAnthropic(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

// Model IDs are configurable via env so you can tune cost/quality per deployment.
// Defaults: a fast/cheap tier for high-volume parsing, a balanced tier for reasoning.
export const AI_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
export const AI_MODEL_FAST = process.env.ANTHROPIC_MODEL_FAST ?? "claude-haiku-4-5";

/** Pull the first tool_use input out of a Messages response. */
export function toolInput<T = Record<string, unknown>>(
  content: Anthropic.ContentBlock[],
): T | null {
  const block = content.find((b) => b.type === "tool_use");
  return block && "input" in block ? (block.input as T) : null;
}

/** Concatenate the text blocks of a Messages response. */
export function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}
