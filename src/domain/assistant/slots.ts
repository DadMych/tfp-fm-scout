/**
 * Slot needs, zone strength and formation ranking, derived from the optimal XI
 * (docs/11-assistant-analytics.md §3.2, §4). Per-slot need classification for the XI
 * but keyed off the Hungarian-optimal assignment instead of the greedy one, so the
 * assistant's pitch, gap list and chemistry board all agree on who actually starts.
 */

import type { Player } from "../player.js";
import { FORMATIONS, type Formation, type Zone } from "../squad/formations.js";
import { T } from "./thresholds.js";
import { slotFit, solveXI, type PlayerRow, type XiSolution } from "./xi.js";

export type SlotNeed = "hole" | "weak" | "thin" | "ageing" | "solid";
export type Verdict = "Strong" | "Balanced" | "Needs work";

export interface SlotAssignment {
  readonly slotKey: string;
  readonly label: string;
  readonly slot: Formation["slots"][number];
  readonly starter: { readonly id: string; readonly fit: number } | null;
  readonly backup: { readonly id: string; readonly fit: number } | null;
  readonly need: SlotNeed;
  readonly starterAge: number | null;
}

export interface FormationFit {
  readonly id: string;
  readonly name: string;
  readonly avgFit: number;
  readonly holes: number;
  readonly weak: number;
}

function eligible(p: Player, slot: Formation["slots"][number]["slot"]): boolean {
  return p.positions.includes(slot);
}

function classifyNeed(
  starterFit: number | null,
  backupFit: number | null,
  starterAge: number | null,
): SlotNeed {
  if (starterFit == null) return "hole";
  if (starterFit < T.WEAK_FIT) return "weak";
  if (starterAge != null && starterAge >= T.AGE_RISK && (backupFit == null || backupFit < T.WEAK_FIT)) {
    return "ageing";
  }
  if (backupFit == null || backupFit < T.THIN_BACKUP || starterFit - backupFit >= T.THIN_DROP) {
    return "thin";
  }
  return "solid";
}

export function verdictOf(avg: number): Verdict {
  if (avg >= 72) return "Strong";
  if (avg >= 62) return "Balanced";
  return "Needs work";
}

export function deriveSlots(
  xi: XiSolution,
  squad: readonly PlayerRow[],
  formation: Formation,
): SlotAssignment[] {
  const byId = new Map(squad.map((r) => [r.player.id, r]));
  const starterIds = new Set([...xi.assignment.values()].map((a) => a.id));

  return formation.slots.map((fs) => {
    const st = xi.assignment.get(fs.key) ?? null;
    let backup: { id: string; fit: number } | null = null;
    for (const row of squad) {
      if (starterIds.has(row.player.id)) continue;
      if (!eligible(row.player, fs.slot)) continue;
      const f = slotFit(row, formation.id, fs);
      if (!backup || f > backup.fit) backup = { id: row.player.id, fit: f };
    }
    const starterAge = st ? (byId.get(st.id)?.player.age ?? null) : null;
    return {
      slotKey: fs.key,
      label: fs.label,
      slot: fs,
      starter: st,
      backup,
      need: classifyNeed(st?.fit ?? null, backup?.fit ?? null, starterAge),
      starterAge,
    };
  });
}

export function zoneStrengthOf(slots: readonly SlotAssignment[]): Record<Zone, number> {
  const agg = new Map<Zone, { sum: number; n: number }>();
  for (const s of slots) {
    const z = agg.get(s.slot.zone) ?? { sum: 0, n: 0 };
    z.sum += s.starter?.fit ?? 0;
    z.n += 1;
    agg.set(s.slot.zone, z);
  }
  const out = {} as Record<Zone, number>;
  for (const [z, { sum, n }] of agg) out[z] = Math.round(sum / n);
  return out;
}

export function avgFitOf(slots: readonly SlotAssignment[]): number {
  return Math.round(slots.reduce((s, a) => s + (a.starter?.fit ?? 0), 0) / slots.length);
}

export function rankFormations(squad: readonly PlayerRow[]): FormationFit[] {
  return FORMATIONS.map((f) => {
    const xi = solveXI(squad, f);
    let weak = 0;
    for (const fs of f.slots) {
      const a = xi.assignment.get(fs.key);
      if (a && a.fit < T.WEAK_FIT) weak += 1;
    }
    return { id: f.id, name: f.name, avgFit: xi.avgFit, holes: xi.holes.length, weak };
  }).sort((a, b) => b.avgFit - a.avgFit || a.holes - b.holes);
}
