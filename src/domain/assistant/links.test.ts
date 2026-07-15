import { describe, it, expect } from "vitest";
import { ATTRIBUTES } from "../attributes.js";
import type { AttrVector } from "../attr-value.js";
import type { Player } from "../player.js";
import type { PositionSlot } from "../positions.js";
import { buildScores } from "../scoring/dataset.js";
import { getFormation } from "../squad/formations.js";
import { buildContext } from "./context.js";
import { evaluateLinks } from "./links.js";
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
  age?: number;
}): Player {
  const id = `p${seq++}`;
  return {
    id,
    name: `Player ${id}`,
    age: over.age ?? 25,
    positions: over.positions,
    attrs: attrs(over.base, over.overrides),
    club: null,
    nationality: null,
    value: null,
    heightCm: null,
    foot: null,
  };
}

// Matches 4-2-3-1's actual slots exactly (gk, dr, dcr, dcl, dl, dmr, dml, amr, amc, aml, st)
// so every formation slot has a natural, eligible starter and no link is left unevaluated.
function fullSquad(): Player[] {
  const slots: PositionSlot[] = ["GK", "D-R", "D-C", "D-C", "D-L", "DM-C", "DM-C", "AM-R", "AM-C", "AM-L", "ST-C"];
  return slots.map((slot) => player({ positions: [slot], base: 12 }));
}

function ctxFor(players: Player[]) {
  const scores = buildScores(players);
  const rows: PlayerRow[] = players.map((p) => ({ player: p, scores: scores.find((s) => s.playerId === p.id)! }));
  return buildContext({
    squad: rows,
    shortlist: [],
    formation: getFormation("4-2-3-1"),
    budget: 0,
    useFullBudget: true,
  });
}

describe("evaluateLinks", () => {
  it("scores a well-rounded centre-back pairing highly with nothing missing", () => {
    const players = fullSquad();
    // Boost both centre-backs on every capability the cb-pair link wants.
    for (const p of players) {
      if (p.positions.includes("D-C")) {
        p.attrs.tackling = { min: 15, max: 15 };
        p.attrs.aggression = { min: 15, max: 15 };
        p.attrs.anticipation = { min: 15, max: 15 };
        p.attrs.acceleration = { min: 14, max: 14 };
        p.attrs.pace = { min: 14, max: 14 };
        p.attrs.jumpingReach = { min: 15, max: 15 };
        p.attrs.heading = { min: 15, max: 15 };
        p.attrs.strength = { min: 15, max: 15 };
        p.attrs.passing = { min: 14, max: 14 };
      }
    }
    const board = evaluateLinks(ctxFor(players));
    const cb = board.links.find((l) => l.link.type === "cb-pair")!;
    expect(cb.missing.length).toBe(0);
    expect(cb.partnership).toBeGreaterThanOrEqual(70);
  });

  it("flags redundancy when both pivot players share the same archetype family", () => {
    const players = fullSquad();
    // Make both double-pivot players identical ball-winners (Destroyer family) and nothing else.
    for (const p of players) {
      if (p.positions.includes("DM-C")) {
        p.attrs.tackling = { min: 17, max: 17 };
        p.attrs.aggression = { min: 16, max: 16 };
        p.attrs.strength = { min: 16, max: 16 };
        p.attrs.bravery = { min: 16, max: 16 };
        // Starve the capabilities a pivot needs beyond ball-winning.
        p.attrs.passing = { min: 4, max: 4 };
        p.attrs.vision = { min: 4, max: 4 };
        p.attrs.flair = { min: 4, max: 4 };
        p.attrs.firstTouch = { min: 4, max: 4 };
        p.attrs.composure = { min: 4, max: 4 };
        p.attrs.balance = { min: 4, max: 4 };
        p.attrs.agility = { min: 4, max: 4 };
        p.attrs.workRate = { min: 8, max: 8 };
        p.attrs.stamina = { min: 8, max: 8 };
      }
    }
    const board = evaluateLinks(ctxFor(players));
    const pivot = board.links.find((l) => l.link.type === "pivot")!;
    expect(pivot.redundant).toBe(true);
    expect(pivot.read).toMatch(/same job/i);
  });

  it("skips a link when either side of it is a hole", () => {
    const players = fullSquad().filter((p) => !p.positions.includes("D-L"));
    const board = evaluateLinks(ctxFor(players));
    // The fb-cb link on the left side needs a left-back; with none, that link can't be evaluated.
    expect(board.links.every((l) => l.link.a !== "dl" && l.link.b !== "dl")).toBe(true);
  });
});
