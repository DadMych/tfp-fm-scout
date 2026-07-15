import { describe, expect, it } from "vitest";
import { computeDerived } from "./derived.js";
import type { AttrVector } from "./attr-value.js";
import type { AttributeId } from "./attributes.js";

/** Build an exact-value vector from a plain {id: value} map (docs/04 worked example). */
function exact(values: Partial<Record<AttributeId, number>>): AttrVector {
  const out: AttrVector = {};
  for (const [id, v] of Object.entries(values)) {
    out[id as AttributeId] = { min: v as number, max: v as number };
  }
  return out;
}

// The canonical worked-example player from docs/04-data-model.md §4.
const EXAMPLE = exact({
  acceleration: 15,
  pace: 13,
  workRate: 16,
  stamina: 17,
  jumpingReach: 8,
  heading: 9,
  strength: 12,
  firstTouch: 14,
  composure: 13,
  balance: 12,
  agility: 14,
  vision: 15,
  passing: 16,
  flair: 11,
  tackling: 7,
  aggression: 9,
  anticipation: 13,
  positioning: 8,
  marking: 6,
  concentration: 12,
  finishing: 10,
  offTheBall: 12,
});

describe("computeDerived — docs/04 §4 worked example", () => {
  const d = computeDerived(EXAMPLE);

  it("matches the documented expected values", () => {
    expect(d.speed).toBe(14);
    expect(d.workEngine).toBe(16.5);
    expect(d.aerial).toBe(11.5); // (8+9)/2 + 12/4 = 8.5 + 3
    expect(d.pressResist).toBe(13.25);
    expect(d.creativity).toBe(14);
    expect(d.defActivity).toBeCloseTo(9.67, 2);
    expect(d.defPosition).toBeCloseTo(8.67, 2);
    expect(d.finishingPkg).toBeCloseTo(11.67, 2);
    expect(d.mobility).toBeCloseTo(13.67, 2);
    expect(d.physicality).toBe(12.25);
  });
});

describe("computeDerived — masking", () => {
  it("returns null for a metric when any input is masked", () => {
    const missingPace = exact({ acceleration: 15 }); // pace missing
    expect(computeDerived(missingPace).speed).toBeNull();
  });

  it("caps aerial at the attribute ceiling of 20", () => {
    const monster = exact({ jumpingReach: 20, heading: 20, strength: 20 });
    // (20+20)/2 + 20/4 = 25 -> capped to 20
    expect(computeDerived(monster).aerial).toBe(20);
  });
});
