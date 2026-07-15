/**
 * "Where he fits your side" (doc 08 §9): best tactic slot vs reference XI incumbent.
 */

import { slotFit, type PlayerRow } from "../assistant/xi.js";
import type { SlotAssignment } from "../assistant/slots.js";

export type FitVerdict = "Upgrade" | "Rotation" | "Project" | "Not for you";

export interface SquadFitResult {
  readonly verdict: FitVerdict;
  readonly slotKey: string;
  readonly slotLabel: string;
  readonly pairScore: number;
  readonly incumbentId: string | null;
  readonly incumbentName: string | null;
  readonly incumbentFit: number | null;
  readonly delta: number | null;
  readonly headline: string;
}

const PROJECT_AGE_MAX = 23;

function verdictFor(delta: number, age: number | null): FitVerdict {
  if (delta >= 5) return "Upgrade";
  if (delta >= -3) return "Rotation";
  if (delta < -3 && age != null && age <= PROJECT_AGE_MAX) return "Project";
  return "Not for you";
}

function headlineFor(
  verdict: FitVerdict,
  slotLabel: string,
  delta: number,
  incumbentName: string | null,
  age: number | null,
): string {
  switch (verdict) {
    case "Upgrade":
      return incumbentName
        ? `Straight into your XI at ${slotLabel}, ahead of ${incumbentName} (+${delta} pair fit).`
        : `Fills your ${slotLabel} slot at +${delta} over an empty chair.`;
    case "Rotation":
      return incumbentName
        ? `Even with ${incumbentName} at ${slotLabel} — squad depth, not a clear starter (${delta >= 0 ? "+" : ""}${delta}).`
        : `Covers ${slotLabel} without displacing anyone (${delta >= 0 ? "+" : ""}${delta}).`;
    case "Project":
      return incumbentName
        ? `Not ready to displace ${incumbentName} at ${slotLabel} yet, but he's ${age} (${delta}).`
        : `A ${age}-year-old project for ${slotLabel} (${delta}).`;
    case "Not for you":
      return incumbentName
        ? `Doesn't improve ${slotLabel} over ${incumbentName} (${delta}).`
        : `Doesn't move the needle at ${slotLabel} (${delta}).`;
  }
}

export function computeSquadFit(
  candidate: PlayerRow,
  formationId: string,
  slots: readonly SlotAssignment[],
  nameById: ReadonlyMap<string, string>,
): SquadFitResult | null {
  let best: {
    slot: SlotAssignment;
    fit: number;
    incumbentId: string | null;
    incumbentFit: number | null;
    delta: number;
  } | null = null;

  for (const slot of slots) {
    if (!candidate.player.positions.includes(slot.slot.slot)) continue;
    const fit = slotFit(candidate, formationId, slot.slot);
    const incumbentFit = slot.starter?.fit ?? null;
    const delta = incumbentFit != null ? fit - incumbentFit : fit;
    if (!best || delta > best.delta || (delta === best.delta && fit > best.fit)) {
      best = {
        slot,
        fit,
        incumbentId: slot.starter?.id ?? null,
        incumbentFit,
        delta,
      };
    }
  }

  if (!best) return null;

  const incumbentName = best.incumbentId ? (nameById.get(best.incumbentId) ?? null) : null;
  const verdict = verdictFor(best.delta, candidate.player.age ?? null);

  return {
    verdict,
    slotKey: best.slot.slotKey,
    slotLabel: best.slot.label,
    pairScore: best.fit,
    incumbentId: best.incumbentId,
    incumbentName,
    incumbentFit: best.incumbentFit,
    delta: best.incumbentFit != null ? best.delta : null,
    headline: headlineFor(
      verdict,
      best.slot.label,
      best.delta,
      incumbentName,
      candidate.player.age ?? null,
    ),
  };
}
