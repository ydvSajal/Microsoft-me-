import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFallbackModel, getModel, ProviderConfigError, withFallback } from "./provider";

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

const withOpenRouterFallback = {
  ...gemini,
  SIFT_FALLBACK_PROVIDER: "openrouter",
  SIFT_FALLBACK_MODEL: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  OPENROUTER_API_KEY: "k",
};

describe("getFallbackModel", () => {
  it("is undefined when SIFT_FALLBACK_PROVIDER is unset", () => {
    expect(getFallbackModel(gemini)).toBeUndefined();
  });

  it("builds the fallback from env", () => {
    const m = info(getFallbackModel(withOpenRouterFallback));
    expect(m.provider).toMatch(/openrouter/);
    expect(m.modelId).toBe("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free");
  });

  it("rejects a half-configured fallback", () => {
    expect(() => getFallbackModel({ ...withOpenRouterFallback, SIFT_FALLBACK_MODEL: undefined })).toThrow(
      /SIFT_FALLBACK_MODEL is not set/,
    );
    expect(() => getFallbackModel({ ...withOpenRouterFallback, OPENROUTER_API_KEY: "" })).toThrow(
      /OPENROUTER_API_KEY is not set/,
    );
  });
});

describe("withFallback", () => {
  const ids: string[] = [];
  const run = (failFirst: boolean) => async (model: unknown) => {
    ids.push(info(model).modelId);
    if (failFirst && ids.length === 1) throw new Error("quota");
    return "ok";
  };
  beforeEach(() => {
    ids.length = 0;
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("uses only the primary when it succeeds", async () => {
    await withFallback("review", run(false), {}, withOpenRouterFallback);
    expect(ids).toEqual(["gemini-2.5-flash"]);
  });

  it("retries once on the fallback when the primary throws", async () => {
    await expect(withFallback("review", run(true), {}, withOpenRouterFallback)).resolves.toBe("ok");
    expect(ids).toEqual(["gemini-2.5-flash", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"]);
  });

  it("rethrows when no fallback is configured", async () => {
    await expect(withFallback("review", run(true), {}, gemini)).rejects.toThrow("quota");
  });

  it("rethrows when the fallback fails too", async () => {
    const alwaysFail = async () => {
      throw new Error("down");
    };
    await expect(withFallback("review", alwaysFail, {}, withOpenRouterFallback)).rejects.toThrow("down");
  });

  it("skips both when a model is injected", async () => {
    await withFallback("review", run(false), { model: { modelId: "mock" } as never }, withOpenRouterFallback);
    expect(ids).toEqual(["mock"]);
  });
});
