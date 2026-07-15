/**
 * Replacement chains — who steps in when a player leaves (docs/13-sporting-director.md §5).
 */

import type { PositionSlot } from "../../positions.js";
import type { AnalysisContext } from "../context.js";
import { T } from "../thresholds.js";
import { slotFit } from "../xi.js";
import { computePriceBand } from "./pricing.js";
import type { ReplacementChain } from "./types.js";

/** The formation slot a player's chain is built around: his starting slot, or (for
 * non-starters) the eligible formation slot where his ceiling is highest. */
function primarySlot(ctx: AnalysisContext, playerId: string): PositionSlot | null {
  const asStarter = ctx.slots.find((s) => s.starter?.id === playerId);
  if (asStarter) return asStarter.slot.slot;
  const row = ctx.byId.get(playerId);
  if (!row) return null;
  let best: { slot: PositionSlot; fit: number } | null = null;
  for (const fs of ctx.formation.slots) {
    if (!row.player.positions.includes(fs.slot)) continue;
    const fit = slotFit(row.scores, fs.slot);
    if (!best || fit > best.fit) best = { slot: fs.slot, fit };
  }
  return best?.slot ?? null;
}

const EMPTY_CHAIN = (slot: PositionSlot, fitBefore: number): ReplacementChain => ({
  source: "none",
  playerId: null,
  playerName: null,
  slot,
  fitBefore,
  fitAfter: 0,
  cost: null,
  netCost: null,
  ready: false,
});

/** Best succession path for a player if he left today: free from the bench, or bought
 * from the shortlist with the sale funding the purchase. */
export function buildChain(ctx: AnalysisContext, playerId: string): ReplacementChain | null {
  const row = ctx.byId.get(playerId);
  if (!row) return null;
  const slot = primarySlot(ctx, playerId);
  if (!slot) return null;
  const fitBefore = slotFit(row.scores, slot);
  const fee = computePriceBand(row.player.value ?? null, row.player.age ?? null, false)?.ask ?? 0;

  let internal: { id: string; name: string; fit: number } | null = null;
  for (const r of ctx.squad) {
    if (r.player.id === playerId) continue;
    if (!r.player.positions.includes(slot)) continue;
    const fit = slotFit(r.scores, slot);
    if (!internal || fit > internal.fit) internal = { id: r.player.id, name: r.player.name, fit };
  }

  let external: { id: string; name: string; fit: number; cost: number } | null = null;
  for (const r of ctx.shortlist) {
    if (!r.player.positions.includes(slot)) continue;
    const fit = slotFit(r.scores, slot);
    if (fit < fitBefore - T.SUCC_READY_GAP) continue;
    const cost = r.player.value;
    if (cost == null || cost > ctx.budgetCap + fee) continue;
    if (!external || fit > external.fit || (fit === external.fit && cost < external.cost)) {
      external = { id: r.player.id, name: r.player.name, fit, cost };
    }
  }

  if (!internal && !external) return EMPTY_CHAIN(slot, fitBefore);

  // Free beats marginal: only take the shortlist option if it clearly beats the internal one.
  const preferInternal = internal != null && (!external || internal.fit >= external.fit - 2);
  const chosen = preferInternal
    ? { source: "internal" as const, id: internal!.id, name: internal!.name, fit: internal!.fit, cost: 0 }
    : { source: "shortlist" as const, id: external!.id, name: external!.name, fit: external!.fit, cost: external!.cost };

  const netCost = chosen.source === "internal" ? -fee : chosen.cost - fee;
  const ready = chosen.fit >= fitBefore - T.SUCC_READY_GAP;

  return {
    source: chosen.source,
    playerId: chosen.id,
    playerName: chosen.name,
    slot,
    fitBefore,
    fitAfter: chosen.fit,
    cost: chosen.cost,
    netCost,
    ready,
  };
}
