/**
 * DEV rules — development & versatility (docs/11-assistant-analytics.md §7).
 */

import { playerGroups } from "../../positions.js";
import type { AnalysisContext } from "../context.js";
import type { RawInsight } from "../types.js";
import { T } from "../thresholds.js";
import { surname } from "../phrases.js";
import { slotFit } from "../xi.js";
import { insightId } from "./helpers.js";

export function run(ctx: AnalysisContext): RawInsight[] {
  const out: RawInsight[] = [];

  // DEV-1: bench gems.
  for (const r of ctx.bench) {
    const age = r.player.age;
    const fit = r.scores.bestRole?.score ?? 0;
    if (age != null && age <= T.AGE_DEV && fit >= T.GEM_FIT) {
      out.push({
        id: insightId("dev.gem", r.player.id),
        cls: "development",
        severity: "praise",
        title: `Development gem: ${surname(r.player.name)}`,
        detail: `${surname(r.player.name)} is only ${age} but already rates ${Math.round(fit)} in his best role off the bench — ready to push for minutes.`,
        evidence: [{ label: "Best role fit", value: `${Math.round(fit)}` }],
        subjects: [r.player.id],
      });
    }
  }

  // DEV-2: retraining candidates for hole/weak slots.
  for (const s of ctx.slots) {
    if (s.need !== "hole" && s.need !== "weak") continue;
    let candidate: { id: string; fit: number } | null = null;
    for (const r of ctx.bench) {
      if (r.player.positions.includes(s.slot.slot)) continue; // already natural — not a retrain
      const fit = slotFit(r, ctx.formation.id, s.slot);
      if (fit >= T.WEAK_FIT - 4 && (!candidate || fit > candidate.fit)) {
        candidate = { id: r.player.id, fit };
      }
    }
    if (candidate) {
      const row = ctx.byId.get(candidate.id)!;
      out.push({
        id: insightId("dev.retrain", s.slotKey),
        cls: "development",
        severity: "medium",
        title: `Retrain ${surname(row.player.name)} as a ${s.label}`,
        detail: `${surname(row.player.name)} isn't natural at ${s.label} but already projects to fit ${candidate.fit} there — worth the retraining time given the gap in your squad.`,
        evidence: [{ label: "Projected fit", value: `${candidate.fit}` }],
        subjects: [candidate.id],
        slotKey: s.slotKey,
      });
    }
  }

  // DEV-3: versatile players.
  for (const r of ctx.squad) {
    const groups = new Set(playerGroups(r.player.positions));
    const fit = r.scores.bestRole?.score ?? 0;
    if (groups.size >= 3 && fit >= T.GOOD_FIT) {
      out.push({
        id: insightId("dev.swiss-knife", r.player.id),
        cls: "development",
        severity: "praise",
        title: `${surname(r.player.name)} covers half the pitch`,
        detail: `${surname(r.player.name)} can play across ${groups.size} position groups (${[...groups].join(", ")}) at a fit of ${Math.round(fit)} — a genuine tactical Swiss knife.`,
        evidence: [{ label: "Position groups", value: `${groups.size}` }],
        subjects: [r.player.id],
      });
    }
  }

  // DEV-4: starters out of role (pairFit currency — doc 17 §9.2).
  for (const s of ctx.slots) {
    if (!s.starter) continue;
    const row = ctx.byId.get(s.starter.id);
    if (!row) continue;
    const currentFit = s.starter.fit;
    let bestFit = currentFit;
    let bestLabel = s.label;
    for (const slot of ctx.slots) {
      if (!row.player.positions.includes(slot.slot.slot)) continue;
      const fit = slotFit(row, ctx.formation.id, slot.slot);
      if (fit > bestFit) {
        bestFit = fit;
        bestLabel = slot.label;
      }
    }
    if (bestFit - currentFit < 8) continue;
    out.push({
      id: insightId("dev.wasted-role", s.slotKey),
      cls: "development",
      severity: "medium",
      title: `${surname(row.player.name)} is playing out of role`,
      detail: `${surname(row.player.name)} projects to ${bestFit} at ${bestLabel}, well above the ${currentFit} he offers at ${s.label} — his attributes suit a different job than the one he has.`,
      evidence: [
        { label: `Best slot (${bestLabel})`, value: `${bestFit}` },
        { label: `Fit at ${s.label}`, value: `${currentFit}` },
      ],
      subjects: [row.player.id],
      slotKey: s.slotKey,
    });
  }

  return out;
}
