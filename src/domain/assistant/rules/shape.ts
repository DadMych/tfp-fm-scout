/**
 * SHAPE rules — formation & structure (docs/11-assistant-analytics.md §4).
 */

import type { AnalysisContext } from "../context.js";
import type { RawInsight, Zone } from "../types.js";
import { solveXI } from "../xi.js";
import { insightId } from "./helpers.js";

const ZONE_LABEL: Record<Zone, string> = { GK: "goalkeeping", DEF: "defence", MID: "midfield", ATT: "attack" };

export function run(ctx: AnalysisContext): RawInsight[] {
  const out: RawInsight[] = [];
  const ranking = ctx.formationRanking;
  const best = ranking[0];
  const chosen = ranking.find((f) => f.id === ctx.formation.id);

  if (best && chosen && best.id !== chosen.id && best.avgFit >= chosen.avgFit + 2) {
    out.push({
      id: insightId("shape.better", best.id),
      cls: "shape",
      severity: "high",
      title: `Your squad fits ${best.name} better`,
      detail: `${best.name} gives your current squad an XI fit of ${best.avgFit} against ${chosen.avgFit} in ${ctx.formation.name}. Worth trying before you spend a euro.`,
      evidence: ranking.map((f) => ({ label: f.name, value: `${f.avgFit}` })),
      subjects: [],
      action: { kind: "formation", formationId: best.id },
    });
  } else if (chosen && best && chosen.id === best.id) {
    out.push({
      id: insightId("shape.confirmed", chosen.id),
      cls: "shape",
      severity: "praise",
      title: `${ctx.formation.name} is the right shape`,
      detail: `Of the shapes tested, ${ctx.formation.name} gets the most out of this squad (XI fit ${chosen.avgFit}).`,
      evidence: ranking.map((f) => ({ label: f.name, value: `${f.avgFit}` })),
      subjects: [],
    });
  }

  const zoneEntries = Object.entries(ctx.zoneStrength) as [Zone, number][];
  if (zoneEntries.length > 0) {
    const strongest = zoneEntries.reduce((a, b) => (b[1] > a[1] ? b : a));
    const weakest = zoneEntries.reduce((a, b) => (b[1] < a[1] ? b : a));
    if (strongest[1] - weakest[1] >= 12) {
      out.push({
        id: insightId("shape.zone-imbalance", `${strongest[0]}-${weakest[0]}`),
        cls: "shape",
        severity: "medium",
        title: `Lopsided side: ${ZONE_LABEL[strongest[0]]} carries ${ZONE_LABEL[weakest[0]]}`,
        detail: `Your ${ZONE_LABEL[strongest[0]]} rates ${strongest[1]} but your ${ZONE_LABEL[weakest[0]]} only ${weakest[1]} — a ${strongest[1] - weakest[1]}-point gap that opponents will find.`,
        evidence: zoneEntries.map(([z, v]) => ({ label: ZONE_LABEL[z], value: `${v}` })),
        subjects: [],
      });
    }
  }

  const shadow = solveXI(ctx.bench, ctx.formation);
  if (ctx.bench.length >= ctx.formation.slots.length && shadow.avgFit >= ctx.avgFit - 8) {
    out.push({
      id: insightId("shape.bench-shape", ctx.formation.id),
      cls: "shape",
      severity: "praise",
      title: "You are two-deep in this shape",
      detail: `Even your second-choice XI in ${ctx.formation.name} rates ${shadow.avgFit}, only ${ctx.avgFit - shadow.avgFit} off your first XI (${ctx.avgFit}) — genuine squad depth.`,
      evidence: [
        { label: "First XI", value: `${ctx.avgFit}` },
        { label: "Second XI", value: `${shadow.avgFit}` },
      ],
      subjects: [],
    });
  }

  return out;
}
