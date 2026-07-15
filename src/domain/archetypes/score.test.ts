import { describe, expect, it } from "vitest";
import {
  scoreArchetype,
  scoreAllArchetypes,
  badgeFor,
  generalArchetype,
  type ScoringContext,
} from "./score.js";
import { ARCHETYPES, getArchetype, isValidMetric } from "./registry.js";

/** Build a scoring context from plain percentile / raw maps. Unknown -> null. */
function ctxFrom(
  pctMap: Record<string, number>,
  rawMap: Record<string, number> = {},
): ScoringContext {
  return {
    pct: (m) => (m in pctMap ? (pctMap[m] as number) : null),
    raw: (m) => (m in rawMap ? (rawMap[m] as number) : null),
  };
}

describe("scoreArchetype — docs/06 §8 worked example (Deep Progressor)", () => {
  const ctx = ctxFrom({
    passing: 92, vision: 84, pressResist: 78, firstTouch: 80,
    technique: 75, decisions: 70, dribbling: 55, anticipation: 60,
    composure: 88,
  });

  it("scores 78.06 with gates passed", () => {
    const s = scoreArchetype(ctx, getArchetype("deepProgressor"));
    expect(s.gatesPassed).toBe(true);
    expect(s.score).toBeCloseTo(78.06, 1);
    expect(s.confidence).toBe(1);
  });

  it("tags the score as a Strong badge", () => {
    const s = scoreArchetype(ctx, getArchetype("deepProgressor"));
    expect(badgeFor(s.score, s.gatesPassed)).toBe("Strong");
  });
});

describe("scoreArchetype — gates", () => {
  it("caps the score at 40 when a percentile gate fails", () => {
    // Strong profile but passing percentile below the 70 gate.
    const ctx = ctxFrom({
      passing: 40, vision: 95, pressResist: 95, firstTouch: 95,
      technique: 95, decisions: 95, dribbling: 95, anticipation: 95,
      composure: 95,
    });
    const s = scoreArchetype(ctx, getArchetype("deepProgressor"));
    expect(s.gatesPassed).toBe(false);
    expect(s.score).toBe(40);
  });

  it("fails a gate whose metric is unknown (conservative)", () => {
    const ctx = ctxFrom({ vision: 95, pressResist: 95 }); // no passing/composure
    const s = scoreArchetype(ctx, getArchetype("deepProgressor"));
    expect(s.gatesPassed).toBe(false);
  });

  it("respects a raw gate independent of percentile (Roadrunner needs real pace)", () => {
    // Top percentile for pace in a slow division, but raw pace only 11 (< 14 floor).
    const ctx = ctxFrom({ speed: 99, pace: 99, acceleration: 90, offTheBall: 80, dribbling: 80, stamina: 80 });
    const withLowRaw = { ...ctx, raw: (m: string) => (m === "pace" ? 11 : null) };
    const s = scoreArchetype(withLowRaw, getArchetype("roadrunner"));
    expect(s.gatesPassed).toBe(false);
  });
});

describe("generalArchetype (doc 06 §9)", () => {
  it("returns the primary family and a close cross-family hybrid", () => {
    const scores = [
      { id: "deepProgressor", score: 82, gatesPassed: true, confidence: 1 },
      { id: "chanceArchitect", score: 78, gatesPassed: true, confidence: 1 }, // Creator, within 6
      { id: "pressMachine", score: 40, gatesPassed: false, confidence: 1 },
    ];
    const g = generalArchetype(scores);
    expect(g.family).toBe("Progressor");
    expect(g.hybridWith).toBe("Creator");
    expect(g.primaryId).toBe("deepProgressor");
  });

  it("is Utility when nothing reaches 60 with gates passed", () => {
    const scores = [{ id: "deepProgressor", score: 55, gatesPassed: true, confidence: 1 }];
    expect(generalArchetype(scores).family).toBe("Utility");
  });

  it("no hybrid when the runner-up is the same family or too far behind", () => {
    const scores = [
      { id: "deepProgressor", score: 88, gatesPassed: true, confidence: 1 },
      { id: "tempoDictator", score: 84, gatesPassed: true, confidence: 1 }, // same family
      { id: "chanceArchitect", score: 70, gatesPassed: true, confidence: 1 }, // >6 behind
    ];
    const g = generalArchetype(scores);
    expect(g.family).toBe("Progressor");
    expect(g.hybridWith).toBeNull();
  });
});

describe("registry integrity", () => {
  it("has 36 archetypes with unique ids", () => {
    expect(ARCHETYPES.length).toBe(36);
    expect(new Set(ARCHETYPES.map((a) => a.id)).size).toBe(36);
  });

  it("references only valid metrics in gates and weights", () => {
    for (const a of ARCHETYPES) {
      for (const g of a.gates) expect(isValidMetric(g.metric), `${a.id} gate ${g.metric}`).toBe(true);
      for (const m of [...a.core, ...a.major, ...a.minor]) {
        expect(isValidMetric(m), `${a.id} weight ${m}`).toBe(true);
      }
    }
  });

  it("scores only the requested population", () => {
    const outfield = scoreAllArchetypes(ctxFrom({}), "outfield");
    const gk = scoreAllArchetypes(ctxFrom({}), "gk");
    expect(outfield.length).toBe(32);
    expect(gk.length).toBe(4);
  });
});
