import { describe, expect, it } from "vitest";
import { percentileRank, percentilesOf } from "./percentile.js";

describe("percentileRank — mid-rank definition", () => {
  it("ranks a value by strictly-below plus half of ties", () => {
    // population [10,20,30,40], value 30 -> (2 below + 0.5*1) / 4 = 62.5
    expect(percentileRank([10, 20, 30, 40], 30)).toBe(62.5);
  });

  it("gives 50 for the median of a symmetric ties-free set", () => {
    // value 20 in [10,20,30] -> (1 + 0.5)/3 = 50
    expect(percentileRank([10, 20, 30], 20)).toBe(50);
  });

  it("ignores nulls in the population", () => {
    expect(percentileRank([10, null, 30], 30)).toBe(percentileRank([10, 30], 30));
  });

  it("returns 0 for an empty population", () => {
    expect(percentileRank([], 5)).toBe(0);
  });
});

describe("percentilesOf — duplication invariance (docs/06 §7 property)", () => {
  it("is unchanged when every value is duplicated", () => {
    const base = [3, 8, 8, 14, 20, 5, null];
    const once = percentilesOf(base);
    const doubled = percentilesOf([...base, ...base]);
    // Each original value's percentile must be identical in the doubled set.
    for (let i = 0; i < base.length; i++) {
      expect(doubled[i]).toBe(once[i]);
    }
  });

  it("maps nulls to null", () => {
    expect(percentilesOf([1, null, 2])[1]).toBeNull();
  });
});
