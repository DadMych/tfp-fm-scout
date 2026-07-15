import { describe, it, expect } from "vitest";
import { ATTRIBUTES } from "../attributes.js";
import type { AttrVector } from "../attr-value.js";
import type { Player } from "../player.js";
import type { PositionSlot } from "../positions.js";
import { buildScores } from "../scoring/dataset.js";
import { getFormation } from "../squad/formations.js";
import type { Formation } from "../squad/formations.js";
import { slotFit, solveXI, legacySlotFit, type PlayerRow } from "./xi.js";

function attrs(v: number): AttrVector {
  const out: AttrVector = {};
  for (const a of ATTRIBUTES) out[a.id] = { min: v, max: v };
  return out;
}

let seq = 0;
function player(over: Partial<Player> & { v: number }): Player {
  const { v, ...rest } = over;
  const id = `p${seq++}`;
  return {
    id,
    name: `Player ${id}`,
    age: 25,
    positions: ["M-C"],
    attrs: attrs(v),
    club: null,
    nationality: null,
    value: null,
    heightCm: null,
    foot: null,
    ...rest,
  };
}

function rows(players: Player[]): PlayerRow[] {
  const scores = buildScores(players);
  return players.map((p) => ({ player: p, scores: scores.find((s) => s.playerId === p.id)! }));
}

function fullSquad(v: number): Player[] {
  const slots: PositionSlot[] = ["GK", "D-R", "D-C", "D-C", "D-L", "DM-C", "M-C", "M-C", "AM-R", "AM-L", "ST-C"];
  return slots.map((slot) => player({ v, positions: [slot] }));
}

describe("slotFit", () => {
  it("rates a strong player above a weak one at the same slot", () => {
    const squad = rows([
      player({ v: 16, positions: ["D-C"] }),
      player({ v: 5, positions: ["D-C"] }),
    ]);
    const good = squad[0]!;
    const bad = squad[1]!;
    const ref = { key: "dcr", slot: "D-C" as const };
    expect(slotFit(good, "4-3-3", ref)).toBeGreaterThan(slotFit(bad, "4-3-3", ref));
  });

  it("uses pairScore from the tactic preset", () => {
    const squad = rows([player({ v: 16, positions: ["M-C"] })]);
    const row = squad[0]!;
    const ref = { key: "mcr", slot: "M-C" as const };
    expect(slotFit(row, "4-3-3", ref)).toBeGreaterThan(legacySlotFit(row.scores, "M-C") - 5);
  });
});

describe("solveXI", () => {
  const formation = getFormation("4-3-3");

  it("assigns exactly one distinct player per slot when the squad is full", () => {
    const xi = solveXI(rows(fullSquad(14)), formation);
    expect(xi.holes.length).toBe(0);
    const ids = [...xi.assignment.values()].map((a) => a.id);
    expect(ids.length).toBe(11);
    expect(new Set(ids).size).toBe(11);
  });

  it("never assigns a player to a slot he can't play", () => {
    const squad = rows(fullSquad(14));
    const xi = solveXI(squad, formation);
    for (const [slotKey, a] of xi.assignment) {
      const fs = formation.slots.find((s) => s.key === slotKey)!;
      const p = squad.find((r) => r.player.id === a.id)!;
      expect(p.player.positions).toContain(fs.slot);
    }
  });

  it("reports a hole when no eligible player exists for a slot", () => {
    const squad = fullSquad(14).filter((p) => !p.positions.includes("ST-C"));
    const xi = solveXI(rows(squad), formation);
    expect(xi.holes).toContain("st");
  });

  it("beats a greedy assignment in the scarce-specialist trap", () => {
    // A single left-back who is marginally better at CB than at LB, plus a CB who is much
    // worse at LB than the specialist. Greedy (highest single fit first) burns the only LB
    // on the CB slot; the optimal solver keeps him at LB where the *total* is higher.
    const lbSpecialist = player({ v: 10, positions: ["D-L", "D-C"] });
    const cbOnly = player({ v: 14, positions: ["D-C"] });
    const rest = fullSquad(13).filter((p) => !p.positions.includes("D-C") && !p.positions.includes("D-L"));
    const squad = rows([lbSpecialist, cbOnly, ...rest, player({ v: 13, positions: ["D-C"] })]);

    const xi = solveXI(squad, formation);
    const lbAssignment = xi.assignment.get("dl");
    expect(lbAssignment?.id).toBe(lbSpecialist.id);
  });

  it("prefers a real eligible player over leaving a hole", () => {
    const squad = rows([player({ v: 3, positions: ["ST-C"] })]); // weak, but the only option
    const xi = solveXI(squad, formation);
    expect(xi.assignment.get("st")?.id).toBe(squad[0]!.player.id);
  });

  it("total/avg fit matches the sum of assigned slot fits", () => {
    const xi = solveXI(rows(fullSquad(14)), formation);
    const sum = [...xi.assignment.values()].reduce((s, a) => s + a.fit, 0);
    expect(xi.totalFit).toBe(sum);
    expect(xi.avgFit).toBe(Math.round(sum / formation.slots.length));
  });
});

describe("solveXI vs brute force", () => {
  // Small synthetic formation (3 slots) so we can exhaustively check every permutation.
  const tiny: Formation = {
    id: "tiny",
    name: "Tiny",
    links: [],
    slots: [
      { key: "a", label: "A", slot: "D-C", zone: "DEF", x: 0.3, y: 0.2 },
      { key: "b", label: "B", slot: "M-C", zone: "MID", x: 0.5, y: 0.5 },
      { key: "c", label: "C", slot: "ST-C", zone: "ATT", x: 0.5, y: 0.9 },
    ],
  };

  function bruteForceBestFit(squad: readonly PlayerRow[], f: Formation): number {
    let best = 0;
    const n = squad.length;
    // Try every way to assign up to 3 distinct players to the 3 slots (or leave a slot empty).
    function fitAt(row: PlayerRow, slotIdx: number): number {
      const s = f.slots[slotIdx]!;
      return row.player.positions.includes(s.slot) ? slotFit(row, f.id, s) : -1;
    }
    for (let ai = -1; ai < n; ai++) {
      for (let bi = -1; bi < n; bi++) {
        if (bi === ai && bi !== -1) continue;
        for (let ci = -1; ci < n; ci++) {
          if ((ci === ai || ci === bi) && ci !== -1) continue;
          const fa = ai === -1 ? 0 : Math.max(0, fitAt(squad[ai]!, 0));
          const fb = bi === -1 ? 0 : Math.max(0, fitAt(squad[bi]!, 1));
          const fc = ci === -1 ? 0 : Math.max(0, fitAt(squad[ci]!, 2));
          // Ineligible assignments are invalid, not zero — skip them entirely.
          if (ai !== -1 && fitAt(squad[ai]!, 0) < 0) continue;
          if (bi !== -1 && fitAt(squad[bi]!, 1) < 0) continue;
          if (ci !== -1 && fitAt(squad[ci]!, 2) < 0) continue;
          best = Math.max(best, fa + fb + fc);
        }
      }
    }
    return best;
  }

  it("matches brute force on random small squads", () => {
    const slotOptions: PositionSlot[][] = [["D-C"], ["M-C"], ["ST-C"], ["D-C", "M-C"], ["M-C", "ST-C"]];
    let rngState = 42;
    const rng = () => {
      rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
      return rngState / 0x7fffffff;
    };

    for (let seed = 0; seed < 25; seed++) {
      const n = 2 + Math.floor(rng() * 4); // 2..5 players
      const squad = rows(
        Array.from({ length: n }, () =>
          player({
            v: 3 + Math.floor(rng() * 15),
            positions: slotOptions[Math.floor(rng() * slotOptions.length)]!,
          }),
        ),
      );
      const xi = solveXI(squad, tiny);
      const expected = bruteForceBestFit(squad, tiny);
      expect(xi.totalFit).toBe(expected);
    }
  });
});
