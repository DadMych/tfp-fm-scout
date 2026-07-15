import type { DatasetBundle } from "@/lib/store";
import { DEFAULT_BUDGET } from "@/src/domain/assistant/defaults.js";
import { buildContext } from "@/src/domain/assistant/context.js";
import type { PlayerRow } from "@/src/domain/assistant/xi.js";
import type { SlotNeed } from "@/src/domain/assistant/slots.js";
import { computeSquadFit, type SquadFitResult } from "@/src/domain/scouting/fit.js";
import { getFormation } from "@/src/domain/squad/formations.js";

export interface AssistantRunPrefs {
  readonly formationId?: string;
  readonly budget?: number;
  readonly useFull?: boolean;
}

export interface FitDeskContext {
  readonly formationId: string;
  readonly slots: ReturnType<typeof buildContext>["slots"];
  readonly nameById: ReadonlyMap<string, string>;
  readonly needBySlotKey: ReadonlyMap<string, SlotNeed>;
}

export function buildFitDeskContext(
  squad: DatasetBundle,
  shortlist: DatasetBundle,
  prefs: AssistantRunPrefs | null,
): FitDeskContext {
  const squadRows: PlayerRow[] = squad.dataset.players.map((p) => ({
    player: p,
    scores: squad.scoreById.get(p.id)!,
  }));
  const shortlistRows: PlayerRow[] = shortlist.dataset.players.map((p) => ({
    player: p,
    scores: shortlist.scoreById.get(p.id)!,
  }));
  const formation = getFormation(prefs?.formationId ?? "4-2-3-1");
  const ctx = buildContext({
    squad: squadRows,
    shortlist: shortlistRows,
    formation,
    budget: prefs?.budget ?? DEFAULT_BUDGET,
    useFullBudget: prefs?.useFull ?? true,
  });
  const nameById = new Map<string, string>();
  for (const r of squadRows) nameById.set(r.player.id, r.player.name);
  for (const r of shortlistRows) nameById.set(r.player.id, r.player.name);
  const needBySlotKey = new Map(ctx.slots.map((s) => [s.slotKey, s.need]));
  return {
    formationId: formation.id,
    slots: ctx.slots,
    nameById,
    needBySlotKey,
  };
}

export function squadFitForRow(row: PlayerRow, fitCtx: FitDeskContext): SquadFitResult | null {
  return computeSquadFit(row, fitCtx.formationId, fitCtx.slots, fitCtx.nameById);
}

export function fitsGap(fit: SquadFitResult, needBySlotKey: ReadonlyMap<string, SlotNeed>): boolean {
  const need = needBySlotKey.get(fit.slotKey);
  if (!need || need === "solid") return false;
  if (need === "hole" || need === "weak") {
    return fit.verdict === "Upgrade" || (fit.delta ?? 0) >= 8;
  }
  return fit.verdict !== "Not for you";
}
