import { describe, expect, it } from "vitest";
import { ATTRIBUTES } from "../attributes.js";
import type { AttrVector } from "../attr-value.js";
import type { Player } from "../player.js";
import { buildScores } from "../scoring/dataset.js";
import { buildContext } from "../assistant/context.js";
import { getFormation } from "../squad/formations.js";
import { computeSquadFit } from "./fit.js";
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
    value: 1e6,
    scoutGrade: null,
    attrs: attrs(over.v),
    ...over,
  };
  return { player: p, scores: buildScores([p])[0]! };
}

describe("computeSquadFit", () => {
  it("flags a clear upgrade over the incumbent striker", () => {
    const squad = [
      row({ id: "gk", name: "GK", positions: ["GK"], v: 14 }),
      row({ id: "dr", name: "RB", positions: ["D-R"], v: 14 }),
      row({ id: "dcr", name: "RCB", positions: ["D-C"], v: 14 }),
      row({ id: "dcl", name: "LCB", positions: ["D-C"], v: 14 }),
      row({ id: "dl", name: "LB", positions: ["D-L"], v: 14 }),
      row({ id: "dm", name: "DM", positions: ["DM-C"], v: 14 }),
      row({ id: "mcr", name: "RCM", positions: ["M-C"], v: 14 }),
      row({ id: "mcl", name: "LCM", positions: ["M-C"], v: 14 }),
      row({ id: "amr", name: "RW", positions: ["AM-R"], v: 14 }),
      row({ id: "aml", name: "LW", positions: ["AM-L"], v: 14 }),
      row({ id: "weak", name: "Weak ST", positions: ["ST-C"], v: 8 }),
    ];
    const star = row({ id: "star", name: "Star ST", positions: ["ST-C"], v: 18, age: 24 });

    const ctx = buildContext({
      squad,
      shortlist: [star],
      formation: getFormation("4-3-3"),
      budget: 50e6,
      useFullBudget: true,
    });

    const names = new Map(squad.map((r) => [r.player.id, r.player.name]));
    const fit = computeSquadFit(star, ctx.formation.id, ctx.slots, names);
    expect(fit?.verdict).toBe("Upgrade");
    expect(fit?.slotLabel).toBe("ST");
    expect((fit?.delta ?? 0) >= 8).toBe(true);
  });

  it("prefers the empty slot with the largest delta over a high-fit rotation role (doc 17 §8.1)", () => {
    const squad = [
      row({ id: "gk", name: "GK", positions: ["GK"], v: 14 }),
      row({ id: "dr", name: "RB", positions: ["D-R"], v: 14 }),
      row({ id: "dcr", name: "RCB", positions: ["D-C"], v: 14 }),
      row({ id: "dcl", name: "LCB", positions: ["D-C"], v: 14 }),
      row({ id: "dl", name: "LB", positions: ["D-L"], v: 14 }),
      row({ id: "dm1", name: "DM1", positions: ["DM-C"], v: 14 }),
      row({ id: "dm2", name: "DM2", positions: ["DM-C"], v: 14 }),
      row({ id: "amr", name: "RW", positions: ["AM-R"], v: 17 }),
      row({ id: "amc", name: "AMC", positions: ["AM-C"], v: 14 }),
      row({ id: "st", name: "ST", positions: ["ST-C"], v: 14 }),
    ];
    const candidate = row({ id: "wide", name: "Wide", positions: ["AM-L", "AM-R"], v: 16 });

    const ctx = buildContext({
      squad,
      shortlist: [candidate],
      formation: getFormation("4-2-3-1"),
      budget: 50e6,
      useFullBudget: true,
    });

    const names = new Map(squad.map((r) => [r.player.id, r.player.name]));
    const fit = computeSquadFit(candidate, ctx.formation.id, ctx.slots, names);
    expect(fit?.slotLabel).toBe("LW");
    expect(fit?.verdict).toBe("Upgrade");
  });
});
