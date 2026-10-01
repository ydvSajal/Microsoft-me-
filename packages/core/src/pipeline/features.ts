/** `SIFT_FEATURES` ("impact,stack"): the entry point reads the env and passes the set in. */
export const parseFeatures = (raw: string | undefined): ReadonlySet<string> =>
  new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
