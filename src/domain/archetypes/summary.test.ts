import { describe, expect, it } from "vitest";
import { generateSummary, type SummaryInput } from "./summary.js";

const BASE: SummaryInput = {
  age: 21,
  positionGroup: "DM/CM",
  family: "Progressor",
  primaryBlurb: "breaks lines from the base of midfield",
  secondaryBlurb: null,
  confidence: 1,
  metrics: [
    { metric: "passing", pct: 92 },
    { metric: "vision", pct: 84 },
    { metric: "pressResist", pct: 78 },
    { metric: "firstTouch", pct: 80 },
    { metric: "aerial", pct: 30 },
  ],
  profileMetrics: [
    "passing", "vision", "pressResist", "firstTouch", "technique", "decisions", "dribbling", "anticipation",
  ],
  atOrAbove: { passing: 4 },
};

describe("generateSummary — docs/06 §10 canonical string", () => {
  it("produces the exact documented sentence", () => {
    expect(generateSummary(BASE)).toBe(
      "A young ball-progressing midfielder who breaks lines from the base of midfield. One of the four best passers among midfielders in this division.",
    );
  });
});

describe("generateSummary — variations", () => {
  it("uses 'The best' for a sole leader and 'An' before a vowel age word", () => {
    const s = generateSummary({
      ...BASE,
      age: 31, // experienced
      atOrAbove: { passing: 1 },
    });
    expect(s).toContain("An experienced ball-progressing midfielder");
    expect(s).toContain("The best passers among midfielders in this division");
  });

  it("drops the age word for a peak-age player", () => {
    const s = generateSummary({ ...BASE, age: 27 });
    expect(s.startsWith("A ball-progressing midfielder who")).toBe(true);
  });

  it("appends an 'and also' clause for a hybrid", () => {
    const s = generateSummary({ ...BASE, secondaryBlurb: "unlocks defences with the final ball" });
    expect(s).toContain("breaks lines from the base of midfield and also unlocks defences with the final ball");
  });

  it("is blunt for a Utility profile", () => {
    const s = generateSummary({ ...BASE, family: "Utility", primaryBlurb: null });
    expect(s).toBe("A squad player; nothing here stands out against this division.");
  });

  it("hedges when confidence is low", () => {
    const s = generateSummary({ ...BASE, confidence: 0.3 });
    expect(s.endsWith("there aren't enough eyes on him yet to be sure.")).toBe(true);
  });

  it("omits the caveat when nothing is notably weak", () => {
    const s = generateSummary({
      ...BASE,
      metrics: [{ metric: "passing", pct: 92 }, { metric: "vision", pct: 84 }],
    });
    expect(s).toBe(
      "A young ball-progressing midfielder who breaks lines from the base of midfield. One of the four best passers among midfielders in this division.",
    );
  });

  it("flags a hard aerial hole before profile weaknesses (doc 06 §10)", () => {
    const s = generateSummary({
      ...BASE,
      profileMetrics: ["passing", "vision", "pressResist", "firstTouch", "technique", "decisions", "dribbling", "anticipation"],
      metrics: [
        { metric: "passing", pct: 92 },
        { metric: "vision", pct: 84 },
        { metric: "aerial", pct: 12 },
      ],
    });
    expect(s).toContain("though he offers nothing in the air");
  });

  it("picks the weakest profile metric, not an irrelevant one (doc 17 §7.6)", () => {
    const s = generateSummary({
      ...BASE,
      profileMetrics: ["passing", "vision", "pressResist", "firstTouch", "technique", "decisions", "dribbling", "anticipation"],
      metrics: [
        { metric: "passing", pct: 92 },
        { metric: "vision", pct: 84 },
        { metric: "dribbling", pct: 35 },
        { metric: "finishing", pct: 10 },
      ],
    });
    expect(s).toContain("though he is loose in possession");
    expect(s).not.toContain("wasteful in front of goal");
  });
});
