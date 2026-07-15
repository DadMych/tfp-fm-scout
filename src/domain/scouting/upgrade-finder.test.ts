import { describe, expect, it } from "vitest";
import { ATTRIBUTES } from "../attributes.js";
import type { AttrVector } from "../attr-value.js";
import type { Player } from "../player.js";
import { buildScores } from "../scoring/dataset.js";
import { findUpgrades, UPGRADE_MIN_DELTA } from "./upgrade-finder.js";
import type { PlayerRow } from "../assistant/xi.js";

function attrs(v: number): AttrVector {
  const out: AttrVector = {};
  for (const a of ATTRIBUTES) out[a.id] = { min: v, max: v };
  return out;
}

function row(over: Partial<Player> & { id: string; name: string; positions: Player["positions"]; v: number }): PlayerRow {
  const p: Player = {
    age: 24,
    nationality: "Test",
    club: "FC",
    foot: "Right",
    heightCm: 180,
    value: null,
    scoutGrade: null,
    attrs: attrs(over.v),
    ...over,
  };
  const s = buildScores([p])[0]!;
  return { player: p, scores: s };
}

describe("findUpgrades", () => {
  const slot = { key: "dl", slot: "D-L" as const };
  const incumbent = row({ id: "inc", name: "Incumbent", positions: ["D-L"], v: 12, value: 10e6 });

  it("respects the +5 pairScore threshold", () => {
    const barely = row({ id: "b", name: "Barely", positions: ["D-L"], v: 12, value: 5e6 });
    const clear = row({ id: "c", name: "Clear", positions: ["D-L"], v: 17, value: 5e6 });
    const hits = findUpgrades({
      incumbent,
      formationId: "4-3-3",
      slot,
      pool: [barely, clear],
      budgetCap: 15e6,
      minDelta: UPGRADE_MIN_DELTA,
    });
    expect(hits.every((h) => h.delta >= UPGRADE_MIN_DELTA)).toBe(true);
    expect(hits.some((h) => h.playerId === "c")).toBe(true);
  });

  it("excludes candidates above budget unless showUnaffordable", () => {
    const dear = row({ id: "d", name: "Dear", positions: ["D-L"], v: 18, value: 20e6 });
    const cheap = row({ id: "ch", name: "Cheap", positions: ["D-L"], v: 18, value: 8e6 });
    const filtered = findUpgrades({
      incumbent,
      formationId: "4-3-3",
      slot,
      pool: [dear, cheap],
      budgetCap: 15e6,
    });
    expect(filtered.map((h) => h.playerId)).toEqual(["ch"]);
    const all = findUpgrades({
      incumbent,
      formationId: "4-3-3",
      slot,
      pool: [dear, cheap],
      budgetCap: 15e6,
      showUnaffordable: true,
    });
    expect(all.map((h) => h.playerId)).toContain("d");
  });
});
