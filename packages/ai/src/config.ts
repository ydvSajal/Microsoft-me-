/** Low temperature: reviews should be repeatable, not creative (TRD §5). */
export const REVIEW_TEMPERATURE = 0.2;
/** One try plus one retry when the model's output fails the schema. */
export const REVIEW_MAX_ATTEMPTS = 2;
/** The judge should be as deterministic as the provider allows. */
export const JUDGE_TEMPERATURE = 0;
