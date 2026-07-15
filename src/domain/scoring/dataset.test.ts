import { describe, expect, it } from "vitest";
import { buildScores } from "./dataset.js";
import { ARCHETYPES } from "../archetypes/registry.js";
import type { Player } from "../player.js";
import type { AttrVector } from "../attr-value.js";
import type { AttributeId } from "../attributes.js";
import type { PositionSlot } from "../positions.js";

function exact(values: Partial<Record<AttributeId, number>>): AttrVector {
  const out: AttrVector = {};
  for (const [id, v] of Object.entries(values)) {
    out[id as AttributeId] = { min: v as number, max: v as number };
  }
  return out;
}

/** A filler outfielder with every technical/mental/physical attribute at `base`. */
function filler(id: string, base: number, positions: PositionSlot[] = ["DM-C"]): Player {
  const ids: AttributeId[] = [
    "corners", "crossing", "dribbling", "finishing", "firstTouch", "freeKicks", "heading",
    "longShots", "longThrows", "marking", "passing", "penalties", "tackling", "technique",
    "aggression", "anticipation", "bravery", "composure", "concentration", "decisions",
    "determination", "flair", "leadership", "offTheBall", "positioning", "teamwork", "vision",
    "workRate", "acceleration", "agility", "balance", "jumpingReach", "naturalFitness", "pace",
    "stamina", "strength",
  ];
  const attrs: Partial<Record<AttributeId, number>> = {};
  for (const a of ids) attrs[a] = base;
  return { id, name: id, age: 25, positions, attrs: exact(attrs) };
}

describe("buildScores — dataset integration", () => {
  // Five weak fillers + one clear passing star, all defensive midfielders.
  const fillers = [1, 2, 3, 4, 5].map((i) => filler(`f${i}`, 7));
  const star: Player = {
    id: "star",
    name: "Star",
    age: 21,
    positions: ["DM-C"],
    // Same 7 baseline as the fillers, so ONLY the raised attributes stand out.
    attrs: exact({
      ...rawObj(filler("x", 7).attrs),
      passing: 18, vision: 17, firstTouch: 16, composure: 17, technique: 16,
      decisions: 16, teamwork: 15, concentration: 15, positioning: 15, balance: 14,
      agility: 14, jumpingReach: 6, heading: 6, // weak in the air on purpose
    }),
  };
  const scores = buildScores([...fillers, star]);
  const s = scores.find((x) => x.playerId === "star")!;

  it("classifies the star as an outfield Progressor with a passing identity", () => {
    expect(s.pop).toBe("outfield");
    expect(s.general.family).toBe("Progressor");
    // The strongest archetype should be a base-of-midfield Progressor
    // (deepProgressor / tempoDictator / pressResister), not the exact sub-type.
    const top = ARCHETYPES.find((a) => a.id === s.topArchetype?.id);
    expect(top?.family).toBe("Progressor");
  });

  it("writes a human summary naming the profile and the standout", () => {
    expect(s.summary).toContain("ball-progressing midfielder");
    expect(s.summary).toContain("passers among midfielders in this division");
  });

  it("gives the star a top passing percentile and a best role", () => {
    expect(s.percentiles.passing).toBeGreaterThan(80);
    expect(s.bestRole).not.toBeNull();
    expect(s.confidence).toBe(1);
  });

  it("ranks display percentiles within the position group cohort", () => {
    const highPassDm = [1, 2, 3, 4, 5, 6].map((i) => ({
      ...filler(`dm${i}`, 7, ["DM-C"]),
      attrs: exact({ ...rawObj(filler("x", 7, ["DM-C"]).attrs), passing: 18 }),
    }));
    const stFillers = [1, 2].map((i) => filler(`st${i}`, 8, ["ST-C"]));
    const stStar: Player = {
      id: "ststar",
      name: "ststar",
      age: 22,
      positions: ["ST-C"],
      attrs: exact({ ...rawObj(filler("x", 8, ["ST-C"]).attrs), passing: 12 }),
    };
    const withStar = buildScores([...highPassDm, ...stFillers, stStar]);
    const scored = withStar.find((x) => x.playerId === "ststar")!;
    expect(scored.percentiles.passing).toBeGreaterThan(scored.datasetPercentiles.passing ?? 0);
  });

  it("position export order does not change cohort percentiles (doc 17 §7.1)", () => {
    const attrs = exact({ ...rawObj(filler("x", 10, ["ST-C"]).attrs), passing: 14, crossing: 12 });
    const a = buildScores([filler("bg", 8, ["ST-C"]), { ...filler("p", 10, ["ST-C", "AM-R"]), id: "p", attrs }])[1]!;
    const b = buildScores([filler("bg", 8, ["ST-C"]), { ...filler("p", 10, ["AM-R", "ST-C"]), id: "p", attrs }])[1]!;
    expect(a.percentiles.passing).toBe(b.percentiles.passing);
    expect(a.percentiles.crossing).toBe(b.percentiles.crossing);
  });

  it("ignores insufficient roles when picking bestRole (doc 17 §7.7)", () => {
    const sparse: Player = {
      id: "ghost",
      name: "Ghost",
      age: 22,
      positions: ["M-C"],
      attrs: exact({ composure: 18 }),
    };
    const full = filler("full", 12, ["M-C"]);
    const scored = buildScores([full, sparse])[1]!;
    expect(scored.roles["ip.midfieldPlaymaker"]!.insufficient).toBe(true);
    expect(scored.bestRole?.id).not.toBe("ip.midfieldPlaymaker");
  });

  it("scores a goalkeeper against the GK population", () => {
    const gk: Player = {
      id: "gk1",
      name: "Keeper",
      age: 26,
      positions: ["GK"],
      attrs: exact({ reflexes: 16, handling: 15, positioning: 14, concentration: 14, oneOnOnes: 14, agility: 13, composure: 13 }),
    };
    const withGk = buildScores([...fillers, star, gk]);
    const gks = withGk.find((x) => x.playerId === "gk1")!;
    expect(gks.pop).toBe("gk");
    // GK archetypes only (4 of them) are scored for a keeper.
    expect(gks.archetypes.length).toBe(4);
  });
});

function rawObj(v: AttrVector): Partial<Record<AttributeId, number>> {
  const out: Partial<Record<AttributeId, number>> = {};
  for (const [k, val] of Object.entries(v)) if (val) out[k as AttributeId] = val.min;
  return out;
}
