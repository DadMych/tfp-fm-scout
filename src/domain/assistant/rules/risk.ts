/**
 * RISK rules — fragility board (docs/11-assistant-analytics.md §7).
 */

import type { AnalysisContext } from "../context.js";
import type { TransferPackage } from "../packages.js";
import type { RawInsight } from "../types.js";
import { T } from "../thresholds.js";
import { surname } from "../phrases.js";
import { solveXI } from "../xi.js";
import { insightId } from "./helpers.js";

export function run(ctx: AnalysisContext, packages: readonly TransferPackage[]): RawInsight[] {
  const out: RawInsight[] = [];

  const shadow = solveXI(ctx.bench, ctx.formation);
  if (ctx.avgFit - shadow.avgFit >= 15) {
    out.push({
      id: insightId("risk.no-depth-anywhere", ctx.formation.id),
      cls: "risk",
      severity: "critical",
      title: "One bad month ends your season",
      detail: `Your second-choice XI in ${ctx.formation.name} only rates ${shadow.avgFit}, ${ctx.avgFit - shadow.avgFit} points below your first XI (${ctx.avgFit}). A run of injuries would be catastrophic.`,
      evidence: [
        { label: "First XI", value: `${ctx.avgFit}` },
        { label: "Second XI", value: `${shadow.avgFit}` },
      ],
      subjects: [],
    });
  }

  for (const s of ctx.slots) {
    if (!s.starter || s.starter.fit < T.GOOD_FIT) continue;
    const gap = s.starter.fit - (s.backup?.fit ?? 0);
    if (!s.backup || gap >= 12) {
      const name = ctx.byId.get(s.starter.id)?.player.name ?? "him";
      out.push({
        id: insightId("risk.spof", s.slotKey),
        cls: "risk",
        severity: "high",
        title: `Single point of failure: ${surname(name)}`,
        detail: `${surname(name)} rates ${s.starter.fit} at ${s.label} and no one else in the squad comes close (${s.backup ? `next best ${s.backup.fit}` : "no eligible cover at all"}).`,
        evidence: [
          { label: "Starter fit", value: `${s.starter.fit}` },
          { label: "Backup fit", value: s.backup ? `${s.backup.fit}` : "none" },
        ],
        subjects: [s.starter.id],
        slotKey: s.slotKey,
      });
    }
  }

  const gk = ctx.slots.find((s) => s.slot.slot === "GK");
  if (gk?.starter && (gk.starterAge ?? 0) >= T.AGE_RISK && (!gk.backup || gk.backup.fit < T.WEAK_FIT)) {
    const name = ctx.byId.get(gk.starter.id)?.player.name ?? "your keeper";
    out.push({
      id: insightId("risk.gk-cliff", "gk"),
      cls: "risk",
      severity: "high",
      title: "Goalkeeping cliff ahead",
      detail: `${surname(name)} is ${gk.starterAge} and your only reliable option between the posts — the backup rates ${gk.backup ? gk.backup.fit : "no cover at all"}. This needs a succession plan.`,
      evidence: [
        { label: "Starter age", value: `${gk.starterAge}` },
        { label: "Backup fit", value: gk.backup ? `${gk.backup.fit}` : "none" },
      ],
      subjects: [gk.starter.id],
      slotKey: gk.slotKey,
    });
  }

  if (packages.length > 0 && packages.every((p) => ctx.budgetCap > 0 && p.netSpend >= 0.9 * ctx.budgetCap)) {
    out.push({
      id: insightId("risk.all-in-window", "budget"),
      cls: "risk",
      severity: "low",
      title: "No slack in any plan",
      detail: "Every transfer plan on the table commits at least 90% of your budget cap in net spend — there's no room for a deadline-day opportunity or an injury replacement.",
      evidence: packages.map((p) => ({
        label: p.name,
        value: `${Math.round((p.netSpend / ctx.budgetCap) * 100)}%`,
      })),
      subjects: [],
    });
  }

  return out;
}
