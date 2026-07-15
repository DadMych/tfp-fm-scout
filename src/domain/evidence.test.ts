import { describe, expect, it } from "vitest";
import { pullQuoteMetric } from "./evidence.js";
import type { PlayerScores } from "./scoring/dataset.js";

function stubScores(percentiles: Record<string, number>): PlayerScores {
  return {
    playerId: "x",
    pop: "outfield",
    derived: {} as PlayerScores["derived"],
    percentiles,
    datasetPercentiles: percentiles,
    roles: {},
    archetypes: [],
    general: { family: "Creator", hybridWith: null, primaryId: "wideCreator", runnerUpId: null },
    summary: "",
    confidence: 1,
    topArchetype: { id: "wideCreator", score: 82, badge: "Strong" },
    bestRole: null,
  };
}

describe("pullQuoteMetric", () => {
  it("prefers an archetype core metric over an unrelated global max (doc 17 §4)", () => {
    const picked = pullQuoteMetric(
      stubScores({
        longShots: 100,
        crossing: 92,
        passing: 80,
        technique: 75,
      }),
    );
    expect(picked?.metric).toBe("crossing");
    expect(picked?.pct).toBe(92);
  });
});
