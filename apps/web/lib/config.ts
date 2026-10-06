// Web thresholds (AGENTS.md: no magic numbers).
/** Every API route caps its body at 1 MB (TRD §7). */
export const MAX_BODY_BYTES = 1_000_000;
/** The health check reports db:false rather than hang when Postgres is slow. */
export const HEALTH_DB_TIMEOUT_MS = 3000;
/** Paste page limit (TRD §7, FR-01). */
export const REVIEW_FILE_MAX_LINES = 400;
/** Upload cap in bytes; 400 lines of code is far below this, it only stops huge files being read. */
export const UPLOAD_MAX_BYTES = 200_000;
/** Client-side hint only; the server still validates with REVIEWABLE_FILE (@sift/ai). */
export const UPLOAD_EXTENSIONS = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
/** GitHub REST API (T-38). Reads only; the token is a server-side read-only PAT until the App exists. */
export const GITHUB_API = "https://api.github.com";
export const GITHUB_PER_PAGE = 100;
/** Hard stop on pagination: 10 pages = 1000 repos or PRs, far beyond what the page can sensibly show. */
export const GITHUB_MAX_PAGES = 10;
/** Most repos one queue request may name (the work runs inside one function call). */
export const QUEUE_MAX_REPOS = 100;
/** Jobs returned by GET /api/queue. */
export const QUEUE_LIST_LIMIT = 50;
