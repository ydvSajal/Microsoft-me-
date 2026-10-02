// The only file allowed to import provider SDKs (enforced by scripts/check-boundaries.mjs).
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

export type ModelRole = "review" | "judge";
type Env = Record<string, string | undefined>;

/** Adding a provider = one entry here + its key in .env.example. */
const PROVIDERS = {
  gemini: {
    keyVar: "GOOGLE_GENERATIVE_AI_API_KEY",
    create: (apiKey: string, modelId: string) => createGoogleGenerativeAI({ apiKey })(modelId),
  },
  openrouter: {
    keyVar: "OPENROUTER_API_KEY",
    create: (apiKey: string, modelId: string) => createOpenRouter({ apiKey }).chat(modelId),
  },
} satisfies Record<string, { keyVar: string; create: (apiKey: string, modelId: string) => LanguageModel }>;

export type ProviderName = keyof typeof PROVIDERS;
export const PROVIDER_NAMES = Object.keys(PROVIDERS) as ProviderName[];

export class ProviderConfigError extends Error {
  override name = "ProviderConfigError";
}

const isProviderName = (name: string): name is ProviderName => Object.hasOwn(PROVIDERS, name);

function build(providerVar: string, modelVar: string, modelId: string | undefined, env: Env): LanguageModel {
  const name = env[providerVar] ?? "";
  if (!isProviderName(name)) {
    throw new ProviderConfigError(
      `${providerVar} must be one of: ${PROVIDER_NAMES.join(", ")} (got "${name}")`,
    );
  }
  const provider = PROVIDERS[name];
  if (!modelId) throw new ProviderConfigError(`${modelVar} is not set (the model name to review with)`);

  const apiKey = env[provider.keyVar];
  if (!apiKey) throw new ProviderConfigError(`${provider.keyVar} is not set (needed for provider "${name}")`);

  return provider.create(apiKey, modelId);
}

/**
 * Model for a role, chosen entirely by env: SIFT_AI_PROVIDER, SIFT_MODEL, SIFT_JUDGE_MODEL
 * (falls back to SIFT_MODEL) and the provider's API key.
 */
export function getModel(role: ModelRole, env: Env = process.env): LanguageModel {
  const modelId = (role === "judge" && env.SIFT_JUDGE_MODEL) || env.SIFT_MODEL;
  return build("SIFT_AI_PROVIDER", "SIFT_MODEL", modelId, env);
}

/** Optional second model for both roles: SIFT_FALLBACK_PROVIDER + SIFT_FALLBACK_MODEL. Unset = none. */
export function getFallbackModel(env: Env = process.env): LanguageModel | undefined {
  if (!env.SIFT_FALLBACK_PROVIDER) return undefined;
  return build("SIFT_FALLBACK_PROVIDER", "SIFT_FALLBACK_MODEL", env.SIFT_FALLBACK_MODEL, env);
}

/**
 * Runs `run` on the primary model; if it throws (outage, quota, auth, rate limit) and a fallback
 * is configured, runs it once more on the fallback. An injected `deps.model` (tests) skips both.
 */
export async function withFallback<T>(
  role: ModelRole,
  run: (model: LanguageModel) => Promise<T>,
  deps: { model?: LanguageModel } = {},
  env: Env = process.env,
): Promise<T> {
  if (deps.model) return run(deps.model);
  const primary = getModel(role, env);
  const fallback = getFallbackModel(env);
  if (!fallback) return run(primary);
  try {
    return await run(primary);
  } catch (err) {
    console.warn(
      `sift: primary ${role} model failed (${err instanceof Error ? err.name : "error"}), using fallback`,
    );
    return run(fallback);
  }
}
