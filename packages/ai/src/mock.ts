// Test helper: a model that replays recorded responses, so tests never call a real LLM.
import { MockLanguageModelV4 } from "ai/test";

/** Returns `responses` in order (the last one repeats). Inspect `.doGenerateCalls` to count calls. */
export function mockModel(responses: readonly string[]): MockLanguageModelV4 {
  let call = 0;
  return new MockLanguageModelV4({
    doGenerate: async () => {
      const text = responses[Math.min(call++, responses.length - 1)] ?? "";
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
