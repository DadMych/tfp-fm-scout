/**
 * The prose brief (docs/11-assistant-analytics.md §10). Deterministic composition from
 * already-computed insights and packages — no new analysis happens here.
 */

import type { AnalysisContext } from "./context.js";
import type { Insight, TeamReport } from "./types.js";
import type { TransferPackage } from "./packages.js";
import { money } from "./phrases.js";

function findZoneExtremes(ctx: AnalysisContext): { best: string; worst: string } {
  const entries = Object.entries(ctx.zoneStrength) as [string, number][];
  const best = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  const worst = entries.reduce((a, b) => (b[1] < a[1] ? b : a));
  const label: Record<string, string> = { GK: "goalkeeping", DEF: "defence", MID: "midfield", ATT: "attack" };
  return { best: label[best[0]] ?? best[0], worst: label[worst[0]] ?? worst[0] };
}

export function buildTeamReport(
  ctx: AnalysisContext,
  insights: readonly Insight[],
  packages: readonly TransferPackage[],
): TeamReport {
  const zones = findZoneExtremes(ctx);
  const style = insights.find((i) => i.id.startsWith("dna.style-read"))?.detail ?? "";
  const shapeNote = insights.find((i) => i.id.startsWith("shape.better") || i.id.startsWith("shape.confirmed"));

  const p1 = [
    `${ctx.verdict} squad in ${ctx.formation.name}: your best XI rates ${ctx.avgFit}/100, strongest in ${zones.best} and weakest in ${zones.worst}.`,
    style,
    shapeNote ? shapeNote.detail : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Doc 12 §3.6: keep original casing, and market bargains are opportunities, not
  // problems — the priorities line leads with real squad issues only.
  const urgent = insights
    .filter((i) => (i.severity === "critical" || i.severity === "high") && i.cls !== "market")
    .slice(0, 3);
  let p2: string;
  if (urgent.length > 0) {
    p2 = `Top priorities: ${urgent.map((i) => i.title).join("; ")}.`;
  } else {
    const praise = insights.filter((i) => i.severity === "praise").slice(0, 2);
    p2 =
      praise.length > 0
        ? `What's working: ${praise.map((i) => i.title).join("; ")}.`
        : "No major alarms right now — the squad is solid without being spectacular.";
  }

  let p3: string;
  const top = packages[0];
  if (top) {
    const spendNote = insights.find((i) => i.id.startsWith("mkt.budget-power"))
      ? " Your budget covers this comfortably."
      : insights.find((i) => i.id.startsWith("risk.all-in-window"))
        ? " Every plan on the table spends close to the full budget — there's no slack left."
        : "";
    p3 = `Best move on the table: "${top.name}" — ${top.rationale}${spendNote}`;
  } else if (ctx.shortlist.length === 0) {
    const needs = insights.filter((i) => i.cls === "slot" && (i.severity === "critical" || i.severity === "high"));
    p3 =
      needs.length > 0
        ? `No shortlist loaded yet. Go scout: ${needs.map((i) => i.title.toLowerCase()).join(", ")}.`
        : "No shortlist loaded yet — load one to see concrete transfer plans.";
  } else {
    p3 = `Nothing on the current shortlist improves this XI within ${money(ctx.budgetCap)} — widen the search or raise the budget.`;
  }

  return {
    headline: `${ctx.verdict} · XI fit ${ctx.avgFit} · ${ctx.formation.name}`,
    paragraphs: [p1, p2, p3],
  };
}
