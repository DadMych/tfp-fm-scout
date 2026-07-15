/**
 * Upgrade finder (doc 08 §3): players who beat an incumbent at a tactic slot by pairScore.
 */

import { midOf, type AttrVector } from "../attr-value.js";
import { ATTRIBUTES, type AttributeId } from "../attributes.js";
import { slotFit, type PlayerRow, type SlotRef } from "../assistant/xi.js";

export const UPGRADE_MIN_DELTA = 5;

export interface UpgradeFinderOptions {
  readonly incumbent: PlayerRow;
  readonly formationId: string;
  readonly slot: SlotRef;
  readonly pool: readonly PlayerRow[];
  readonly budgetCap?: number;
  readonly minDelta?: number;
  readonly showUnaffordable?: boolean;
}

export interface AttributeEdge {
  readonly id: AttributeId;
  readonly name: string;
  readonly delta: number;
}

export interface UpgradeCandidate {
  readonly playerId: string;
  readonly name: string;
  readonly pairScore: number;
  readonly delta: number;
  readonly ageDelta: number | null;
  readonly value: number | null;
  readonly advantages: readonly AttributeEdge[];
  readonly downgrade: AttributeEdge | null;
  readonly rankScore: number;
}

function attributeEdges(incumbent: AttrVector, candidate: AttrVector): AttributeEdge[] {
  const out: AttributeEdge[] = [];
  for (const a of ATTRIBUTES) {
    const i = midOf(incumbent, a.id);
    const c = midOf(candidate, a.id);
    if (i == null || c == null) continue;
    out.push({ id: a.id, name: a.name, delta: c - i });
  }
  return out;
}

function affordabilityFactor(value: number | null | undefined, budgetCap: number | undefined): number {
  if (value == null || budgetCap == null) return 1;
  if (value <= budgetCap) return 1;
  return budgetCap / value;
}

export function findUpgrades(opts: UpgradeFinderOptions): UpgradeCandidate[] {
  const minDelta = opts.minDelta ?? UPGRADE_MIN_DELTA;
  const incumbentFit = slotFit(opts.incumbent, opts.formationId, opts.slot);
  const floor = incumbentFit + minDelta;

  const hits: UpgradeCandidate[] = [];
  for (const row of opts.pool) {
    if (row.player.id === opts.incumbent.player.id) continue;
    if (!row.player.positions.includes(opts.slot.slot)) continue;

    const pairScore = slotFit(row, opts.formationId, opts.slot);
    if (pairScore < floor) continue;

    const value = row.player.value ?? null;
    if (
      !opts.showUnaffordable &&
      opts.budgetCap != null &&
      value != null &&
      value > opts.budgetCap
    ) {
      continue;
    }

    const edges = attributeEdges(opts.incumbent.player.attrs, row.player.attrs);
    const advantages = [...edges]
      .filter((e) => e.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 3);
    const downgrade =
      [...edges]
        .filter((e) => e.delta < 0)
        .sort((a, b) => a.delta - b.delta)[0] ?? null;

    const delta = pairScore - incumbentFit;
    const aff = affordabilityFactor(value, opts.budgetCap);
    const ageDelta =
      opts.incumbent.player.age != null && row.player.age != null
        ? row.player.age - opts.incumbent.player.age
        : null;

    hits.push({
      playerId: row.player.id,
      name: row.player.name,
      pairScore,
      delta,
      ageDelta,
      value,
      advantages,
      downgrade,
      rankScore: delta * aff,
    });
  }

  return hits.sort((a, b) => b.rankScore - a.rankScore || b.pairScore - a.pairScore);
}
