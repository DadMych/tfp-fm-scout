import { describe, it, expect } from "vitest";
import { ATTRIBUTES } from "./attributes.js";
import type { AttrVector } from "./attr-value.js";
import type { Player } from "./player.js";
import { buildScores, type PlayerScores } from "./scoring/dataset.js";
import { buildSquadContext, recommend } from "./recommendation.js";

function attrs(v: number, bump?: Partial<Record<string, number>>): AttrVector {
  const out: AttrVector = {};
  for (const a of ATTRIBUTES) out[a.id] = { min: v, max: v };
  if (bump) {
    for (const [k, d] of Object.entries(bump)) {
      if (d == null) continue;
      out[k as keyof AttrVector] = { min: v + d, max: v + d };
    }
  }
  return out;
}

function player(
  id: string,
  over: Partial<Player> & { v: number; bump?: Partial<Record<string, number>> },
): Player {
  const { v, bump, ...rest } = over;
  return {
    id,
    name: `P${id}`,
    age: 25,
    positions: ["M-C"],
    attrs: attrs(v, bump),
    club: null,
    nationality: null,
    value: null,
    heightCm: null,
    foot: null,
    ...rest,
  };
}

/** Minimal scores stub for verdict logic tests. */
function stubScores(over: {
  score: number;
  badge?: "Elite" | "Strong" | "Notable" | null;
  roleFit?: number;
  confidence?: number;
  archName?: string;
}): PlayerScores {
  const id = "wideCreator";
  return {
    playerId: id,
    pop: "outfield",
    derived: {} as PlayerScores["derived"],
    percentiles: {},
    datasetPercentiles: {},
    roles: {},
    archetypes: [],
    general: { family: "Creator", hybridWith: null, primaryId: "wideCreator", runnerUpId: null },
    summary: "",
    confidence: over.confidence ?? 0.9,
    topArchetype: {
      id: "wideCreator",
      score: over.score,
      badge: over.badge ?? "Elite",
    },
    bestRole: { id: "ip.wideOutletWinger", score: over.roleFit ?? 80 },
  };
}

/** A spread cohort (values low→high) so percentiles separate a player from the pack. */
function cohort(prefix: string, from: number, to: number, positions: Player["positions"]) {
  const n = 20;
  return Array.from({ length: n }, (_, i) =>
    player(`${prefix}${i}`, { v: from + ((to - from) * i) / (n - 1), positions }),
  );
}

/** Score `p` inside a background cohort, returning p's scores. */
function scoreIn(p: Player, bg: Player[]) {
  return buildScores([...bg, p]).find((s) => s.playerId === p.id)!;
}

describe("recommend", () => {
  it("flags a dominant young player as a priority target", () => {
    const bg = cohort("a", 4, 15, ["M-C"]);
    const star = player("star", { v: 20, age: 19, positions: ["M-C"] });
    const rec = recommend(star, scoreIn(star, bg));
    expect(rec.verdict).toBe("Priority target");
    expect(rec.tone).toBe("gold");
    expect(rec.reasons.length).toBeGreaterThan(0);
  });

  it("flags a weak player as not for us", () => {
    const bg = cohort("b", 8, 20, ["M-C"]);
    const weak = player("weak", { v: 5 });
    const rec = recommend(weak, scoreIn(weak, bg));
    expect(rec.verdict).toBe("Not for us");
    expect(rec.tone).toBe("muted");
  });

  it("calls a cheap, strong (non-elite) player a bargain", () => {
    const bg = cohort("c", 4, 20, ["M-C"]);
    const cheap = player("cheap", { v: 16, age: 26, value: 6e6 });
    const rec = recommend(cheap, scoreIn(cheap, bg));
    expect(rec.verdict).toBe("Bargain");
    expect(rec.tone).toBe("ink");
  });

  it("recognises a squad upgrade against the user's squad (absolute role fit)", () => {
    const squad = [player("sq1", { v: 9, positions: ["D-C"] })];
    const ctx = buildSquadContext(squad, buildScores(squad));

    const bg = cohort("u", 4, 16, ["D-C"]);
    const target = player("t", { v: 18, positions: ["D-C"] });
    const rec = recommend(target, scoreIn(target, bg), ctx);
    expect(rec.verdict).toBe("Squad upgrade");
    expect(rec.reasons.some((r) => r.includes("best CB"))).toBe(true);
  });

  it("orders stronger recommendations with a lower rank", () => {
    const bg = cohort("o", 4, 16, ["M-C"]);
    const star = player("s2", { v: 20, age: 20 });
    const depth = player("d2", { v: 8 });
    expect(recommend(star, scoreIn(star, bg)).rank).toBeLessThan(
      recommend(depth, scoreIn(depth, bg)).rank,
    );
  });

  it("demotes an elite covered by the squad (doc 17 §1)", () => {
    const squad = [player("sq", { v: 18, positions: ["AM-R"] })];
    const target = player("t", { v: 17, age: 26, positions: ["AM-R"] });
    const ctx = buildSquadContext(squad, buildScores(squad));
    const rec = recommend(target, stubScores({ score: 96, roleFit: 80 }), ctx);
    expect(rec.verdict).not.toBe("Priority target");
    expect(rec.verdict).not.toBe("Squad upgrade");
    expect(rec.headline).toMatch(/already covered/i);
  });

  it("keeps priority target without squad context (regression guard)", () => {
    const target = player("t", { v: 20, age: 26, positions: ["AM-R"] });
    const rec = recommend(target, stubScores({ score: 96, roleFit: 80 }));
    expect(rec.verdict).toBe("Priority target");
  });

  it("caps marginal squad improvement at proven performer (doc 17 §1)", () => {
    const squad = [player("sq", { v: 17, positions: ["AM-R"] })];
    const target = player("t", {
      v: 17,
      bump: { dribbling: 1, pace: 1 },
      age: 27,
      positions: ["AM-R"],
    });
    const ctx = buildSquadContext(squad, buildScores(squad));
    const rec = recommend(target, stubScores({ score: 96, roleFit: 83 }), ctx);
    expect(rec.verdict).toBe("Proven performer");
    expect(rec.verdict).not.toBe("Priority target");
  });

  it("demotes a 35-year-old elite to proven performer with rental headline (doc 17 §2)", () => {
    const target = player("t", { v: 20, age: 35, positions: ["M-C"] });
    const rec = recommend(target, stubScores({ score: 96, roleFit: 90 }));
    expect(rec.verdict).toBe("Proven performer");
    expect(rec.headline).toMatch(/one-season rental/i);
  });

  it("keeps priority target for a 31-year-old bargain (doc 17 §2)", () => {
    const target = player("t", { v: 20, age: 31, positions: ["M-C"], value: 3.2e6 });
    const rec = recommend(target, stubScores({ score: 96, roleFit: 90 }));
    expect(rec.verdict).toBe("Priority target");
  });

  it("fills an empty position group as squad upgrade (doc 17 §8.2)", () => {
    const target = player("t", { v: 18, positions: ["D-C"] });
    const squad = [player("sq", { v: 12, positions: ["M-C"] })];
    const ctx = buildSquadContext(squad, buildScores(squad));
    const rec = recommend(target, stubScores({ score: 80, roleFit: 78 }), ctx);
    expect(rec.verdict).toBe("Squad upgrade");
    expect(rec.reasons.some((r) => r.includes("no natural cover"))).toBe(true);
  });

  it("demotes low-confidence squad upgrade (doc 17 §8.3)", () => {
    const squad = [player("sq", { v: 9, positions: ["D-C"] })];
    const ctx = buildSquadContext(squad, buildScores(squad));
    const target = player("t", { v: 18, positions: ["D-C"] });
    const rec = recommend(target, stubScores({ score: 80, roleFit: 85, confidence: 0.3 }), ctx);
    expect(rec.verdict).not.toBe("Squad upgrade");
  });
});
