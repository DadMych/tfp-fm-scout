import { describe, expect, it } from "vitest";
import { percentileColor, percentileStep } from "./percentile-ramp.js";

describe("percentile ramp", () => {
  it("maps quintile boundaries to five discrete steps", () => {
    expect(percentileStep(0)).toBe(0);
    expect(percentileStep(19)).toBe(0);
    expect(percentileStep(20)).toBe(1);
    expect(percentileStep(55)).toBe(2);
    expect(percentileStep(65)).toBe(3);
    expect(percentileStep(85)).toBe(4);
    expect(percentileStep(95)).toBe(4);
  });

  it("uses the doc 09 palette at each step", () => {
    expect(percentileColor(55)).toBe("#6B6456");
    expect(percentileColor(85)).toBe("#B23B2E");
  });
});
