import { describe, expect, it } from "vitest";
import { ago, duration, percent, precision } from "./view";

describe("view helpers", () => {
  it("precision is accepted over decided, null with no samples", () => {
    expect(precision(3, 1)).toBe(0.75);
    expect(precision(0, 4)).toBe(0);
    expect(precision(0, 0)).toBeNull();
  });

  it("formats percent and duration", () => {
    expect(percent(0.934)).toBe("93%");
    expect(duration(850)).toBe("850 ms");
    expect(duration(41250)).toBe("41.3 s");
  });

  it("says how long ago", () => {
    const now = Date.parse("2026-10-01T12:00:00Z");
    expect(ago(new Date(now - 20_000), now)).toBe("just now");
    expect(ago(new Date(now - 3 * 60_000), now)).toBe("3 minutes ago");
    expect(ago(new Date(now - 2 * 3_600_000), now)).toBe("2 hours ago");
    expect(ago(new Date(now - 86_400_000), now)).toBe("yesterday");
  });
});
