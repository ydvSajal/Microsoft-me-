// Test helper: a model that replays recorded responses, so tests never call a real LLM.
import { MockLanguageModelV4 } from "ai/test";

/** Answers from the prompt text; throw to simulate a provider error. */
export type Responder = (prompt: string) => string;

/**
 * `responses` as a list: returned in order (the last one repeats).
 * As a function: called with the serialized prompt, for tests where calls run concurrently.
 * Inspect `.doGenerateCalls` to count calls.
 */
export function mockModel(responses: readonly string[] | Responder): MockLanguageModelV4 {
  let call = 0;
  return new MockLanguageModelV4({
    doGenerate: async ({ prompt }) => {
      const text =
        typeof responses === "function"
          ? responses(JSON.stringify(prompt))
          : (responses[Math.min(call++, responses.length - 1)] ?? "");
      return {
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 0, text: 0, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
}
