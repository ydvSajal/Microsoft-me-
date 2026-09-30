import { describe, expect, it } from "vitest";
import { getModel, ProviderConfigError } from "./provider";

type ModelInfo = { provider: string; modelId: string };
const info = (m: unknown) => m as ModelInfo;

const gemini = {
  SIFT_AI_PROVIDER: "gemini",
  SIFT_MODEL: "gemini-2.5-flash",
  GOOGLE_GENERATIVE_AI_API_KEY: "k",
};

describe("getModel", () => {
  it("builds a Gemini model from env", () => {
    const m = info(getModel("review", gemini));
    expect(m.provider).toMatch(/google/);
    expect(m.modelId).toBe("gemini-2.5-flash");
  });

  it("builds an OpenRouter model from env", () => {
    const m = info(
      getModel("review", {
        SIFT_AI_PROVIDER: "openrouter",
        SIFT_MODEL: "meta-llama/llama-3.3-70b-instruct:free",
        OPENROUTER_API_KEY: "k",
      }),
    );
    expect(m.provider).toMatch(/openrouter/);
    expect(m.modelId).toBe("meta-llama/llama-3.3-70b-instruct:free");
  });

  it("uses SIFT_JUDGE_MODEL for the judge, falling back to SIFT_MODEL", () => {
    expect(info(getModel("judge", { ...gemini, SIFT_JUDGE_MODEL: "gemini-2.5-flash-lite" })).modelId).toBe(
      "gemini-2.5-flash-lite",
    );
    expect(info(getModel("judge", gemini)).modelId).toBe("gemini-2.5-flash");
  });

  it.each([
    [{ ...gemini, SIFT_AI_PROVIDER: "azure" }, /SIFT_AI_PROVIDER must be one of: gemini, openrouter/],
    [{ ...gemini, SIFT_AI_PROVIDER: "toString" }, /SIFT_AI_PROVIDER/],
    [{ ...gemini, SIFT_AI_PROVIDER: undefined }, /SIFT_AI_PROVIDER/],
    [{ ...gemini, SIFT_MODEL: undefined }, /SIFT_MODEL is not set/],
    [{ ...gemini, GOOGLE_GENERATIVE_AI_API_KEY: "" }, /GOOGLE_GENERATIVE_AI_API_KEY is not set/],
  ])("rejects bad config %#", (env, message) => {
    expect(() => getModel("review", env)).toThrow(ProviderConfigError);
    expect(() => getModel("review", env)).toThrow(message);
  });
});
