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
    expect(s.summary).toContain("passers in this division");
  });

  it("gives the star a top passing percentile and a best role", () => {
    expect(s.percentiles.passing).toBeGreaterThan(80);
    expect(s.bestRole).not.toBeNull();
    expect(s.confidence).toBe(1);
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
