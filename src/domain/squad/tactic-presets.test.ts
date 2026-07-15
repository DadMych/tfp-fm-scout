import { describe, expect, it } from "vitest";
import { assertPresetCoverage, getSlotPair } from "./tactic-presets.js";
import { pairScore } from "../roles/score.js";
import type { AttrVector } from "../attr-value.js";
import type { AttributeId } from "../attributes.js";

function exact(values: Partial<Record<AttributeId, number>>): AttrVector {
  const out: AttrVector = {};
  for (const [id, v] of Object.entries(values)) {
    out[id as AttributeId] = { min: v as number, max: v as number };
  }
  return out;
}

describe("tactic presets", () => {
  it("covers every formation slot with valid role ids", () => {
    expect(() => assertPresetCoverage()).not.toThrow();
  });

  it("wires doc 05 §6 playmaker pair through a 4-4-2 RCM slot", () => {
    const pair = getSlotPair("4-4-2", "mcr");
    expect(pair).toBeTruthy();
    const player = exact({
      passing: 16,
      vision: 15,
      firstTouch: 14,
      composure: 13,
      technique: 14,
      decisions: 13,
      anticipation: 13,
      flair: 11,
      dribbling: 12,
      teamwork: 14,
      agility: 14,
    });
    const fit = Math.round(pairScore(player, pair!.ip, pair!.oop));
    expect(fit).toBeGreaterThan(60);
    expect(fit).toBeLessThan(85);
  });
});
