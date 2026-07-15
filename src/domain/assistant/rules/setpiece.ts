/**
 * SP rules — set-piece coverage (docs/11-assistant-analytics.md §5, docs/07 §6).
 */

import type { AnalysisContext } from "../context.js";
import type { PlayerRow } from "../xi.js";
import type { RawInsight } from "../types.js";
import { surname } from "../phrases.js";
import { raw, insightId } from "./helpers.js";

function best(rows: readonly PlayerRow[], metric: string): PlayerRow | null {
  let top: PlayerRow | null = null;
  let topVal = -1;
  for (const r of rows) {
    const v = raw(r, metric) ?? -1;
    if (v > topVal) {
      topVal = v;
      top = r;
    }
  }
  return top;
}

export function run(ctx: AnalysisContext): RawInsight[] {
  const out: RawInsight[] = [];
  const squad = ctx.squad;
  const xi = [...ctx.xi.assignment.values()].map((a) => ctx.byId.get(a.id)).filter((r): r is PlayerRow => !!r);

  const bestCorner = best(squad, "corners");
  const bestFk = best(squad, "freeKicks");
  const bestPen = best(squad, "penalties");

  out.push({
    id: insightId("sp.best-takers", ctx.formation.id),
    cls: "setpiece",
    severity: "low",
    title: "Your dead-ball unit",
    detail: [
      bestCorner ? `Corners: ${surname(bestCorner.player.name)} (${raw(bestCorner, "corners")})` : null,
      bestFk ? `Free kicks: ${surname(bestFk.player.name)} (${raw(bestFk, "freeKicks")})` : null,
      bestPen ? `Penalties: ${surname(bestPen.player.name)} (${raw(bestPen, "penalties")})` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    evidence: [
      bestCorner ? { label: "Best corners", value: `${surname(bestCorner.player.name)} ${raw(bestCorner, "corners")}` } : null,
      bestFk ? { label: "Best free kicks", value: `${surname(bestFk.player.name)} ${raw(bestFk, "freeKicks")}` } : null,
      bestPen ? { label: "Best penalties", value: `${surname(bestPen.player.name)} ${raw(bestPen, "penalties")}` } : null,
    ].filter((e): e is { label: string; value: string } => !!e),
    subjects: [bestCorner?.player.id, bestFk?.player.id, bestPen?.player.id].filter((x): x is string => !!x),
  });

  if ((bestCorner ? raw(bestCorner, "corners")! : 0) < 12 && (bestFk ? raw(bestFk, "freeKicks")! : 0) < 12) {
    out.push({
      id: insightId("sp.no-taker", ctx.formation.id),
      cls: "setpiece",
      severity: "medium",
      title: "Nobody to put the ball on a head",
      detail: "No one in the squad rates 12+ for corners or free kicks — your set-piece delivery is a weakness worth scouting for.",
      evidence: [
        { label: "Best corners", value: `${bestCorner ? raw(bestCorner, "corners") : "—"}` },
        { label: "Best free kicks", value: `${bestFk ? raw(bestFk, "freeKicks") : "—"}` },
      ],
      subjects: [],
    });
  }

  if (bestCorner) {
    const aerialRanked = [...xi].sort((a, b) => (raw(b, "aerial") ?? 0) - (raw(a, "aerial") ?? 0));
    const top2 = aerialRanked.slice(0, 2).map((r) => r.player.id);
    if (top2.includes(bestCorner.player.id)) {
      out.push({
        id: insightId("sp.taker-is-target", bestCorner.player.id),
        cls: "setpiece",
        severity: "medium",
        title: `Your aerial threat is taking the corners`,
        detail: `${surname(bestCorner.player.name)} is both your best corner taker and one of your best aerial targets — he can't do both at once. Consider a dedicated delivery specialist.`,
        evidence: [{ label: surname(bestCorner.player.name), value: `corners ${raw(bestCorner, "corners")}, aerial ${raw(bestCorner, "aerial")}` }],
        subjects: [bestCorner.player.id],
      });
    }
  }

  const throwers = squad.filter((r) => (raw(r, "longThrows") ?? 0) >= 14);
  if (throwers.length > 0) {
    out.push({
      id: insightId("sp.long-throw", throwers[0]!.player.id),
      cls: "setpiece",
      severity: "praise",
      title: "A long-throw weapon",
      detail: `${throwers.map((r) => surname(r.player.name)).join(", ")} rate${throwers.length === 1 ? "s" : ""} 14+ on long throws — a free set-piece source most teams don't have.`,
      evidence: throwers.map((r) => ({ label: surname(r.player.name), value: `${raw(r, "longThrows")}` })),
      subjects: throwers.map((r) => r.player.id),
    });
  }

  return out;
}
