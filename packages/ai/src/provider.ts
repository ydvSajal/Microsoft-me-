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

/**
 * Model for a role, chosen entirely by env: SIFT_AI_PROVIDER, SIFT_MODEL, SIFT_JUDGE_MODEL
 * (falls back to SIFT_MODEL) and the provider's API key.
 */
export function getModel(role: ModelRole, env: Env = process.env): LanguageModel {
  const name = env.SIFT_AI_PROVIDER ?? "";
  if (!isProviderName(name)) {
    throw new ProviderConfigError(
      `SIFT_AI_PROVIDER must be one of: ${PROVIDER_NAMES.join(", ")} (got "${name}")`,
    );
  }
  const provider = PROVIDERS[name];

  const modelId = (role === "judge" && env.SIFT_JUDGE_MODEL) || env.SIFT_MODEL;
  if (!modelId) throw new ProviderConfigError("SIFT_MODEL is not set (the model name to review with)");

  const apiKey = env[provider.keyVar];
  if (!apiKey) throw new ProviderConfigError(`${provider.keyVar} is not set (needed for provider "${name}")`);

  return provider.create(apiKey, modelId);
}
