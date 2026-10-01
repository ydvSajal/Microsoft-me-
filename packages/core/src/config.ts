// Every pipeline threshold lives here (TRD §4). SEVERITY_WEIGHT is shared with file mode.
export { SEVERITY_WEIGHT } from "@sift/shared";

export const MAX_INLINE = 7;
export const MAX_FILES = 25;
export const LLM_CONCURRENCY = 4;
export const MIN_CONFIDENCE = 0.6;
export const MUTE_MIN_SAMPLES = 10;
export const MUTE_MAX_PRECISION = 0.3;
export const MUTABLE_SEVERITIES = ["low", "nit"] as const;
export const LARGE_PR_LINES = 400;
/** Lines of real file content shown to the model around each changed range. */
export const CONTEXT_LINES = 20;
/** Uses of one changed export passed to the model (TRD §4.8). */
export const IMPACT_REFS_PER_SYMBOL = 10;
/** Most callers listed in the summary; signature-changed symbols come first. */
export const IMPACT_LISTED = 10;
export const SENSITIVE_PATHS = [
  /auth/i,
  /payment|billing|refund/i,
  /migration/i,
  /security/i,
  /^\.github\/workflows\//,
];
export const SKIP_PATTERNS = [
  /(^|\/)pnpm-lock\.yaml$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /\.min\.(js|css)$/,
  /(^|\/)dist\//,
  /(^|\/)\.sift\//,
  /\.(png|jpg|svg|ico|pdf)$/,
];
