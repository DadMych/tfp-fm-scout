/**
 * SLOT rules — per-position needs (docs/11-assistant-analytics.md §4). One insight per
 * non-solid slot, plus praise for elite starters. Every hole/weak/thin/ageing insight
 * carries a "scout for this" action — analysis generates the search.
 */

import type { PositionSlot } from "../../positions.js";
import type { AnalysisContext } from "../context.js";
import type { RawInsight } from "../types.js";
import { T } from "../thresholds.js";
import { surname } from "../phrases.js";
import { slotFit } from "../xi.js";
import { insightId, scoutAction } from "./helpers.js";

const WRONG_SIDE_GAP = 5;

/** Pure gate for SLOT-6 (doc 11 §4) — exported for tests. */
export function wrongSideGate(
  fitAOrig: number,
  fitAMirror: number,
  fitBOrig: number,
  fitBMirror: number,
): boolean {
  if (fitAMirror < fitAOrig + WRONG_SIDE_GAP) return false;
  return fitAMirror + fitBOrig > fitAOrig + fitBMirror;
}

function mirrorPosition(slot: PositionSlot): PositionSlot | null {
  if (slot.endsWith("-L")) return `${slot.slice(0, -1)}R` as PositionSlot;
  if (slot.endsWith("-R")) return `${slot.slice(0, -1)}L` as PositionSlot;
  return null;
}

function wrongSideInsights(ctx: AnalysisContext): RawInsight[] {
  const out: RawInsight[] = [];
  const byPosition = new Map(ctx.slots.map((s) => [s.slot.slot, s]));

  for (const s of ctx.slots) {
    if (!s.starter) continue;
    const mirrorPos = mirrorPosition(s.slot.slot);
    if (!mirrorPos) continue;
    const mirror = byPosition.get(mirrorPos);
    if (!mirror?.starter || mirror.slotKey === s.slotKey) continue;

    const rowA = ctx.byId.get(s.starter.id);
    const rowB = ctx.byId.get(mirror.starter.id);
    if (!rowA || !rowB) continue;

    const fitAOrig = s.starter.fit;
    const fitBOrig = mirror.starter.fit;
    const fitAMirror = slotFit(rowA, ctx.formation.id, mirror.slot);
    const fitBMirror = slotFit(rowB, ctx.formation.id, s.slot);
    if (!wrongSideGate(fitAOrig, fitAMirror, fitBOrig, fitBMirror)) continue;

    const swapGain = fitAMirror + fitBOrig - (fitAOrig + fitBMirror);

    const nameA = rowA.player.name;
    const nameB = rowB.player.name;
    out.push({
      id: insightId("slot.wrong-side", s.slotKey),
      cls: "slot",
      severity: "low",
      title: `${surname(nameA)} is on his weaker side`,
      detail: `Swap ${surname(nameA)} and ${surname(nameB)}: ${surname(nameA)} projects to ${fitAMirror} at ${mirror.label} and ${surname(nameB)} to ${fitBMirror} at ${s.label} — ${swapGain} points better than the current pairing.`,
      evidence: [
        { label: `${surname(nameA)} at ${s.label}`, value: `${fitAOrig}` },
        { label: `${surname(nameA)} at ${mirror.label}`, value: `${fitAMirror}` },
        { label: `${surname(nameB)} at ${mirror.label}`, value: `${fitBOrig}` },
        { label: `${surname(nameB)} at ${s.label}`, value: `${fitBMirror}` },
      ],
      subjects: [s.starter.id, mirror.starter.id],
      slotKey: s.slotKey,
    });
  }

  return out;
}

export function run(ctx: AnalysisContext): RawInsight[] {
  const out: RawInsight[] = [];

  for (const s of ctx.slots) {
    const starterName = s.starter ? ctx.byId.get(s.starter.id)?.player.name : null;
    const backupName = s.backup ? ctx.byId.get(s.backup.id)?.player.name : null;
    const subjects = [s.starter?.id, s.backup?.id].filter((x): x is string => !!x);

    switch (s.need) {
      case "hole":
        out.push({
          id: insightId("slot.hole", s.slotKey),
          cls: "slot",
          severity: "critical",
          title: `No natural ${s.label}`,
          detail: backupName
            ? `Nobody in the squad plays ${s.label} naturally. ${surname(backupName)} can fill in (fit ${s.backup!.fit}), but it's a patch, not a plan.`
            : `Nobody in the squad can even deputise at ${s.label}. This is a must-fix before the season starts.`,
          evidence: [{ label: "Eligible squad players", value: backupName ? "1 (makeshift)" : "0" }],
          subjects,
          slotKey: s.slotKey,
          action: scoutAction(s.slot.slot, { minFit: T.WEAK_FIT, maxValue: ctx.budgetCap }),
        });
        break;
      case "weak":
        out.push({
          id: insightId("slot.weak", s.slotKey),
          cls: "slot",
          severity: "high",
          title: `${s.label} is a weak spot`,
          detail: `${surname(starterName ?? "Your starter")} rates ${s.starter!.fit} at ${s.label} — below what a first-team slot needs (${T.WEAK_FIT}+).`,
          evidence: [{ label: `${surname(starterName ?? "Starter")} fit`, value: `${s.starter!.fit}` }],
          subjects,
          slotKey: s.slotKey,
          action: scoutAction(s.slot.slot, { minFit: s.starter!.fit + 4, maxValue: ctx.budgetCap }),
        });
        break;
      case "thin":
        out.push({
          id: insightId("slot.thin", s.slotKey),
          cls: "slot",
          severity: "medium",
          title: `One injury from trouble at ${s.label}`,
          detail: backupName
            ? `${surname(starterName ?? "Your starter")} (fit ${s.starter!.fit}) has no real deputy — ${surname(backupName)} drops to ${s.backup!.fit}.`
            : `${surname(starterName ?? "Your starter")} (fit ${s.starter!.fit}) has literally no cover at ${s.label}.`,
          evidence: [
            { label: "Starter fit", value: `${s.starter!.fit}` },
            { label: "Backup fit", value: s.backup ? `${s.backup.fit}` : "none" },
          ],
          subjects,
          slotKey: s.slotKey,
          action: scoutAction(s.slot.slot, { minFit: T.THIN_BACKUP, maxValue: ctx.budgetCap }),
        });
        break;
      case "ageing":
        out.push({
          id: insightId("slot.ageing", s.slotKey),
          cls: "slot",
          severity: "high",
          title: `${surname(starterName ?? "Your starter")} won't play forever`,
          detail: `${surname(starterName ?? "Your starter")} is ${s.starterAge} and still your best ${s.label} (fit ${s.starter!.fit}), with nobody ready to replace him.`,
          evidence: [
            { label: "Age", value: `${s.starterAge}` },
            { label: "Fit", value: `${s.starter!.fit}` },
          ],
          subjects,
          slotKey: s.slotKey,
          action: scoutAction(s.slot.slot, { minFit: s.starter!.fit - 6, maxAge: 27, maxValue: ctx.budgetCap }),
        });
        break;
      case "solid":
        if (s.starter && s.starter.fit >= T.ELITE_FIT) {
          out.push({
            id: insightId("slot.elite", s.slotKey),
            cls: "slot",
            severity: "praise",
            title: `${surname(starterName ?? "He")} owns ${s.label}`,
            detail: `${surname(starterName ?? "Your starter")} rates ${s.starter.fit} at ${s.label} — an elite starter with cover behind him.`,
            evidence: [{ label: "Fit", value: `${s.starter.fit}` }],
            subjects,
            slotKey: s.slotKey,
          });
        }
        break;
    }
  }

  out.push(...wrongSideInsights(ctx));

  return out;
}
