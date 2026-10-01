// Web thresholds (AGENTS.md: no magic numbers).
/** Every API route caps its body at 1 MB (TRD §7). */
export const MAX_BODY_BYTES = 1_000_000;
/** The health check reports db:false rather than hang when Postgres is slow. */
export const HEALTH_DB_TIMEOUT_MS = 3000;
/** Paste page limit (TRD §7, FR-01). */
export const REVIEW_FILE_MAX_LINES = 400;
