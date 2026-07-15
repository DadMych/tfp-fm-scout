import { describe, expect, it } from "vitest";
import { ATTRIBUTES } from "../attributes.js";
import type { AttrVector } from "../attr-value.js";
import type { Player } from "../player.js";
import type { PositionSlot } from "../positions.js";
import { buildScores } from "../scoring/dataset.js";
import { getFormation } from "../squad/formations.js";
import { buildContext } from "./context.js";
import { evaluateLinks } from "./links.js";
import { buildTacticBrief } from "./tactic-brief.js";
import { buildAssistantReport } from "./report.js";
import type { PlayerRow } from "./xi.js";

function attrs(base: number, overrides: Partial<Record<string, number>> = {}): AttrVector {
  const out: AttrVector = {};
  for (const a of ATTRIBUTES) out[a.id] = { min: overrides[a.id] ?? base, max: overrides[a.id] ?? base };
  return out;
}

let seq = 0;
function player(over: {
  positions: PositionSlot[];
  base: number;
  overrides?: Partial<Record<string, number>>;
  name?: string;
}): Player {
  const id = `tb${seq++}`;
  return {
    id,
    name: over.name ?? `Player ${id}`,
    age: 25,
    positions: over.positions,
    attrs: attrs(over.base, over.overrides),
    club: null,
    nationality: null,
    value: null,
    heightCm: null,
    foot: null,
  };
}

function rowsOf(players: Player[]): PlayerRow[] {
  const scores = buildScores(players);
  return players.map((p) => ({ player: p, scores: scores.find((s) => s.playerId === p.id)! }));
}

describe("buildTacticBrief (doc 21)", () => {
  it("returns asymmetric flank advice for strong LB + weak RB", () => {
    const players: Player[] = [
      player({ positions: ["GK"], base: 12, name: "Keeper" }),
      player({
        positions: ["D-R"],
        base: 10,
        name: "Slow Right",
        overrides: {
          pace: 8,
          acceleration: 8,
          tackling: 8,
          aggression: 8,
          anticipation: 8,
          crossing: 8,
          stamina: 10,
        },
      }),
      player({ positions: ["D-C"], base: 13, name: "RCB" }),
      player({ positions: ["D-C"], base: 13, name: "LCB" }),
      player({
        positions: ["D-L"],
        base: 12,
        name: "Fast Left",
        overrides: {
          pace: 18,
          acceleration: 18,
          stamina: 17,
          workRate: 16,
          crossing: 16,
          tackling: 14,
          aggression: 13,
          anticipation: 13,
        },
      }),
      player({ positions: ["DM-C"], base: 13, name: "RDM" }),
      player({ positions: ["DM-C"], base: 13, name: "LDM" }),
      player({ positions: ["AM-R"], base: 13, name: "RW" }),
      player({ positions: ["AM-C"], base: 13, name: "AM" }),
      player({
        positions: ["AM-L"],
        base: 13,
        name: "Creator LW",
        overrides: { vision: 17, passing: 16, flair: 16, firstTouch: 15 },
      }),
      player({ positions: ["ST-C"], base: 13, name: "ST" }),
    ];
    const rows = rowsOf(players);
    const ctx = buildContext({
      squad: rows,
      shortlist: [],
      formation: getFormation("4-2-3-1"),
      budget: 40e6,
      useFullBudget: false,
    });
    const brief = buildTacticBrief(ctx, evaluateLinks(ctx));
    expect(brief.styles.length).toBe(3);
    expect(brief.formationId).toBe("4-2-3-1");

    const left = brief.flanks.find((f) => f.side === "left");
    const right = brief.flanks.find((f) => f.side === "right");
    expect(left).toBeTruthy();
    expect(right).toBeTruthy();
    expect(left!.text).not.toBe(right!.text);
    expect(left!.text.toLowerCase()).toMatch(/overlap|bomb|push|licence/);
    expect(right!.text.toLowerCase()).toMatch(/conservative|invert|underlap/);
  });

  it("wires tacticBrief into the assistant report", () => {
    const slots: PositionSlot[] = [
      "GK",
      "D-R",
      "D-C",
      "D-C",
      "D-L",
      "DM-C",
      "DM-C",
      "AM-R",
      "AM-C",
      "AM-L",
      "ST-C",
    ];
    const players = slots.map((slot) => player({ positions: [slot], base: 13 }));
    const report = buildAssistantReport({
      squad: rowsOf(players),
      shortlist: [],
      formation: getFormation("4-3-3"),
      budget: 50e6,
      useFullBudget: false,
    });
    expect(report.tacticBrief.styles.length).toBe(3);
    expect(report.styleReads).toEqual(report.tacticBrief.styleReads);
  });
});
