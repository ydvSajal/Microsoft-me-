import type { TFinding, TSeverity } from "@sift/shared";
import { fingerprint } from "@sift/shared/fingerprint";
import { fpMarker, renderInline } from "@sift/shared";
import { describe, expect, it } from "vitest";
import type { Candidate } from "../rank/rank";
import { groupFindings } from "./group";
import { dropPosted, postedFingerprints } from "./posted";

const c = (
  over: Partial<TFinding> & { severity?: TSeverity },
  placement: Candidate["placement"] = "inline",
): Candidate => {
  const base = {
    file: "a.ts",
    line: 1,
    severity: "medium" as TSeverity,
    category: "bug" as const,
    ruleKey: "some-rule",
    quotedCode: "x();",
    confidence: 0.9,
    ...over,
  };
  return {
    placement,
    finding: { ...base, title: "t", body: "b", alsoIn: [], fingerprint: fingerprint(base) },
  };
};

describe("groupFindings", () => {
  it("collapses a low/nit rule across files into one comment with 'also in'", () => {
    const files = ["a.ts", "b.ts", "c.ts"];
    const group = files.map((file, i) =>
      c({
        file,
        line: 10 + i,
        severity: "low",
        category: "naming",
        ruleKey: "unclear-name",
        quotedCode: `const d${i} = 1;`,
        confidence: 0.7 + i * 0.05,
      }),
    );
    const out = groupFindings(group);
    expect(out).toHaveLength(1);
    expect(out[0]?.finding.file).toBe("c.ts"); // highest score wins
    expect(out[0]?.finding.alsoIn).toEqual([
      { file: "b.ts", line: 11 },
      { file: "a.ts", line: 10 },
    ]);
  });

  it("keeps different medium+ findings apart even for the same rule", () => {
    const out = groupFindings([c({ quotedCode: "one();" }), c({ quotedCode: "two();", line: 2 })]);
    expect(out).toHaveLength(2);
  });

  it("merges critical/high/medium only on identical code", () => {
    const out = groupFindings([
      c({ file: "a.ts", line: 3, severity: "high" }),
      c({ file: "b.ts", line: 8, severity: "high" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.finding.alsoIn).toHaveLength(1);
  });

  it("takes the placement of the finding it keeps", () => {
    const out = groupFindings([
      c({ confidence: 0.6 }, "inline"),
      c({ file: "b.ts", confidence: 0.95 }, "summary"),
    ]);
    expect(out[0]).toMatchObject({ placement: "summary" });
    expect(out[0]?.finding.file).toBe("b.ts");
  });

  it("is a no-op for unique findings and empty input", () => {
    expect(groupFindings([])).toEqual([]);
    const only = c({});
    expect(groupFindings([only])).toEqual([only]);
  });
});

describe("postedFingerprints / dropPosted", () => {
  it("reads markers from inline comments and review summaries", () => {
    const inline = renderInline(c({}).finding);
    const summary = `intro\n- item ${fpMarker("aaaaaaaaaaaa")}\n<!-- sift:patch=zzz -->`;
    const posted = postedFingerprints([inline, summary, "plain human comment", "<!-- sift:fp=NOTHEX -->"]);
    expect(posted).toEqual(new Set([c({}).finding.fingerprint, "aaaaaaaaaaaa"]));
  });

  it("drops already-posted findings and counts them", () => {
    const old = c({ quotedCode: "old();" });
    const fresh = c({ quotedCode: "new();" });
    const r = dropPosted([old, fresh], postedFingerprints([renderInline(old.finding)]));
    expect(r.fresh).toEqual([fresh]);
    expect(r.repeats).toBe(1);
  });
});
