import { describe, expect, it } from "vitest";
import { scoreRoleById, pairScore } from "./score.js";
import { ROLES, getRole } from "./registry.js";
import type { AttrVector } from "../attr-value.js";
import type { AttributeId } from "../attributes.js";

function exact(values: Partial<Record<AttributeId, number>>): AttrVector {
  const out: AttrVector = {};
  for (const [id, v] of Object.entries(values)) {
    out[id as AttributeId] = { min: v as number, max: v as number };
  }
  return out;
}

describe("scoreRole — docs/05 §6 worked example (Midfield Playmaker IP)", () => {
  // Core passing16/vision15/firstTouch14/composure13; major technique14/decisions13/
  // anticipation13/flair11; minor dribbling12/teamwork14/agility14.
  const player = exact({
    passing: 16, vision: 15, firstTouch: 14, composure: 13,
    technique: 14, decisions: 13, anticipation: 13, flair: 11,
    dribbling: 12, teamwork: 14, agility: 14,
  });

  it("scores 68.7 (raw 316 / maxRaw 460)", () => {
    const { score } = scoreRoleById(player, "ip.midfieldPlaymaker");
    expect(score).toBeCloseTo(68.7, 1);
  });

  it("reports full confidence when all attributes are exact", () => {
    const { confidence, insufficient } = scoreRoleById(player, "ip.midfieldPlaymaker");
    expect(confidence).toBe(1);
    expect(insufficient).toBe(false);
  });
});

describe("scoreRole — masking", () => {
  it("scores over known attributes and flags insufficient when >50% masked", () => {
    // Only composure known out of the playmaker's weight mass -> insufficient.
    const sparse = exact({ composure: 20 });
    const { score, insufficient } = scoreRoleById(sparse, "ip.midfieldPlaymaker");
    expect(score).toBe(100); // the one known attribute is maxed
    expect(insufficient).toBe(true);
  });
});

describe("pairScore — stamina tax (docs/05 §4)", () => {
  it("taxes a low-work-engine player in two running-heavy roles", () => {
    // wingBack (core stamina/workRate) IP + pressingWingBack (core workRate/stamina) OOP.
    const lazy = exact({
      // give decent role attrs but low stamina/workRate -> workEngine 8 < 12
      stamina: 8, workRate: 8, crossing: 14, pace: 14, dribbling: 14, tackling: 14,
      acceleration: 14, offTheBall: 14, aggression: 14, anticipation: 14, bravery: 14,
      positioning: 14, determination: 14, marking: 14, concentration: 14, passing: 14,
      teamwork: 14,
    });
    const taxed = pairScore(lazy, "ip.wingBack", "oop.pressingWingBack");

    const fit = exact({ ...rawObj(lazy), stamina: 18, workRate: 18 });
    const untaxed = pairScore(fit, "ip.wingBack", "oop.pressingWingBack");
    // The fit player must score higher; and the tax on the lazy one is (12-8)*2 = 8 beyond
    // the raw stamina/workRate difference.
    expect(untaxed).toBeGreaterThan(taxed);
  });
});

describe("registry integrity", () => {
  it("has unique role ids and non-empty tiers", () => {
    const ids = new Set(ROLES.map((r) => r.id));
    expect(ids.size).toBe(ROLES.length);
    for (const r of ROLES) {
      expect(r.core.length).toBeGreaterThan(0);
      expect(getRole(r.id)).toBe(r);
    }
  });

  it("phase-prefixes every id consistently", () => {
    for (const r of ROLES) {
      expect(r.id.startsWith(r.phase === "IP" ? "ip." : "oop.")).toBe(true);
    }
  });
});

function rawObj(v: AttrVector): Partial<Record<AttributeId, number>> {
  const out: Partial<Record<AttributeId, number>> = {};
  for (const [k, val] of Object.entries(v)) {
    if (val) out[k as AttributeId] = val.min;
  }
  return out;
}
