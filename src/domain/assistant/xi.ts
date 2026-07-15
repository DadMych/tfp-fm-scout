/**
 * Optimal XI solver (docs/11-assistant-analytics.md §3).
 *
 * Fit at each slot uses the tactic preset's IP+OOP pair and pairScore (doc 05 §4),
 * not the old best-single-role ceiling.
 */

import type { Player } from "../player.js";
import type { PositionSlot } from "../positions.js";
import type { PlayerScores } from "../scoring/dataset.js";
import { ROLES } from "../roles/registry.js";
import { pairScore } from "../roles/score.js";
import { getSlotPair } from "../squad/tactic-presets.js";
import type { Formation } from "../squad/formations.js";

export interface PlayerRow {
  readonly player: Player;
  readonly scores: PlayerScores;
}

export interface SlotRef {
  readonly key: string;
  readonly slot: PositionSlot;
}

export interface XiSolution {
  readonly assignment: ReadonlyMap<string, { id: string; fit: number }>;
  readonly totalFit: number;
  readonly avgFit: number;
  readonly holes: readonly string[];
}

const ROLES_BY_SLOT: Map<PositionSlot, string[]> = (() => {
  const m = new Map<PositionSlot, string[]>();
  for (const role of ROLES) {
    for (const slot of role.slots) {
      const list = m.get(slot) ?? [];
      list.push(role.id);
      m.set(slot, list);
    }
  }
  return m;
})();

/** Legacy ceiling: best single role at a slot (tests / fallback only). */
export function legacySlotFit(scores: PlayerScores, slot: PositionSlot): number {
  let best = 0;
  for (const id of ROLES_BY_SLOT.get(slot) ?? []) {
    const s = scores.roles[id]?.score ?? 0;
    if (s > best) best = s;
  }
  return Math.round(best);
}

/** Product fit currency: pairScore for the preset IP+OOP at this formation slot. */
export function slotFit(row: PlayerRow, formationId: string, ref: SlotRef): number {
  const pair = getSlotPair(formationId, ref.key);
  if (!pair) return legacySlotFit(row.scores, ref.slot);
  return Math.round(pairScore(row.player.attrs, pair.ip, pair.oop));
}

const HOLE_COST = 1_000;
const INELIGIBLE_COST = 100_000;
const INF = Number.POSITIVE_INFINITY;

function hungarian(cost: readonly (readonly number[])[]): number[] {
  const n = cost.length;
  const m = cost[0]?.length ?? 0;
  const u = new Array(n + 1).fill(0);
  const v = new Array(m + 1).fill(0);
  const p = new Array(m + 1).fill(0);
  const way = new Array(m + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(m + 1).fill(INF);
    const used = new Array(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF;
      let j1 = -1;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1]![j - 1]! - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const rowToCol = new Array(n).fill(-1);
  for (let j = 1; j <= m; j++) {
    if (p[j] !== 0) rowToCol[p[j] - 1] = j - 1;
  }
  return rowToCol;
}

export function solveXI(rows: readonly PlayerRow[], formation: Formation): XiSolution {
  const slots = formation.slots;
  const n = slots.length;
  const realM = rows.length;
  const dummyCount = n;
  const m = realM + dummyCount;

  const fitCache: number[][] = slots.map((fs) =>
    rows.map((r) => slotFit(r, formation.id, fs)),
  );
  const eligible: boolean[][] = slots.map((fs) =>
    rows.map((r) => r.player.positions.includes(fs.slot)),
  );

  const cost: number[][] = slots.map((_, si) => {
    const row = new Array(m).fill(HOLE_COST);
    for (let pi = 0; pi < realM; pi++) {
      row[pi] = eligible[si]![pi] ? 100 - fitCache[si]![pi]! : INELIGIBLE_COST;
    }
    return row;
  });

  const rowToCol = hungarian(cost);

  const assignment = new Map<string, { id: string; fit: number }>();
  const holes: string[] = [];
  let totalFit = 0;
  slots.forEach((fs, si) => {
    const col = rowToCol[si]!;
    if (col < realM && eligible[si]![col]) {
      const fit = fitCache[si]![col]!;
      assignment.set(fs.key, { id: rows[col]!.player.id, fit });
      totalFit += fit;
    } else {
      holes.push(fs.key);
    }
  });

  return {
    assignment,
    totalFit,
    avgFit: Math.round(totalFit / n),
    holes,
  };
}
