/**
 * CONTRACT rules — expiring deals, wages, and loan traffic (docs/22-contracts-loans.md).
 * Only fires when the export carries the Wage / Expires / On Loan From columns.
 */

import { contractExpiring, contractPenultimate, shortDate } from "../../squad/status.js";
import type { AnalysisContext } from "../context.js";
import { listNames, money, surname } from "../phrases.js";
import { T } from "../thresholds.js";
import type { RawInsight } from "../types.js";
import { bestPresetFit } from "../xi.js";
import { insightId } from "./helpers.js";

function wageStr(w: number): string {
  return `${money(w)} p/w`;
}

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}

export function run(ctx: AnalysisContext): RawInsight[] {
  const out: RawInsight[] = [];
  if (ctx.seasonEnd == null) return out;

  // 1. Renew-or-lose: starters walking for free at the end of this season (risk, critical).
  const expiringStarters = ctx.squad.filter(
    (r) =>
      ctx.starters.has(r.player.id) &&
      !ctx.loanedIn.has(r.player.id) &&
      contractExpiring(r.player, ctx.seasonEnd),
  );
  for (const r of expiringStarters) {
    const name = surname(r.player.name);
    const value = r.player.value;
    out.push({
      id: insightId("con.renew-or-lose", r.player.id),
      cls: "risk",
      severity: "critical",
      title: `${name} walks for free this summer`,
      detail: `${name} starts for you and his contract ends ${shortDate(r.player.contractExpires!)}. Renew him now or ${value != null ? `watch ${money(value)} of value leave` : "lose him"} on a Bosman.`,
      evidence: [
        { label: "Contract ends", value: shortDate(r.player.contractExpires!) },
        ...(value != null ? [{ label: "Value at risk", value: money(value) }] : []),
        ...(r.player.wage != null ? [{ label: "Current wage", value: wageStr(r.player.wage) }] : []),
      ],
      subjects: [r.player.id],
      action: { kind: "player", playerId: r.player.id, dataset: "squad" },
    });
  }

  // 2. Final-year watch: starters entering their last season (risk, medium) — renew early.
  const penultimate = ctx.squad.filter(
    (r) =>
      ctx.starters.has(r.player.id) &&
      !ctx.loanedIn.has(r.player.id) &&
      contractPenultimate(r.player, ctx.seasonEnd),
  );
  if (penultimate.length > 0) {
    const names = penultimate.map((r) => surname(r.player.name));
    out.push({
      id: insightId("con.final-year", "starters"),
      cls: "risk",
      severity: "medium",
      title: `${penultimate.length === 1 ? `${names[0]} enters` : `${penultimate.length} starters enter`} the final contract year`,
      detail: `${listNames(names)} ${penultimate.length === 1 ? "has" : "have"} one season left after this one. Renew during this window — next summer the only options are a cut-price sale or a free exit.`,
      evidence: penultimate.map((r) => ({
        label: surname(r.player.name),
        value: shortDate(r.player.contractExpires!),
      })),
      subjects: penultimate.map((r) => r.player.id),
    });
  }

  // 3. Bosman targets: shortlist players whose contracts end this season (market).
  const bosman = ctx.shortlist
    .filter((r) => contractExpiring(r.player, ctx.seasonEnd))
    .map((r) => ({ row: r, fit: bestPresetFit(r, ctx.formation.id) || (r.scores.bestRole?.score ?? 0) }))
    .filter((x) => x.fit >= T.WEAK_FIT)
    .sort((a, b) => b.fit - a.fit)
    .slice(0, 4);
  if (bosman.length > 0) {
    const names = bosman.map((x) => surname(x.row.player.name));
    const totalValue = bosman.reduce((s, x) => s + (x.row.player.value ?? 0), 0);
    out.push({
      id: insightId("con.bosman", "shortlist"),
      cls: "market",
      severity: "high",
      title: `${bosman.length === 1 ? `${names[0]} is` : `${bosman.length} shortlist targets are`} out of contract this summer`,
      detail: `${listNames(names)} can sign pre-contracts from January and arrive for free — ${money(totalValue)} of talent without a fee. Negotiate wages, not transfers.`,
      evidence: bosman.map((x) => ({
        label: surname(x.row.player.name),
        value: `fit ${x.fit} · ${money(x.row.player.value)} · ends ${shortDate(x.row.player.contractExpires!)}`,
      })),
      subjects: bosman.map((x) => x.row.player.id),
      action: { kind: "player", playerId: bosman[0]!.row.player.id, dataset: "shortlist" },
    });
  }

  // 4. Wage dead weight: fringe players earning top-quartile money (market).
  const wages = ctx.squad
    .map((r) => r.player.wage)
    .filter((w): w is number => w != null && w > 0);
  if (wages.length >= 8) {
    const heavy = percentile(wages, T.WAGE_HEAVY_PCT);
    const deadWeight = ctx.squad
      .filter((r) => {
        if (ctx.starters.has(r.player.id) || ctx.loanedIn.has(r.player.id)) return false;
        if (ctx.slots.some((s) => s.backup?.id === r.player.id)) return false;
        const w = r.player.wage;
        return w != null && w >= heavy;
      })
      .sort((a, b) => (b.player.wage ?? 0) - (a.player.wage ?? 0))
      .slice(0, 4);
    if (deadWeight.length > 0) {
      const totalWeekly = deadWeight.reduce((s, r) => s + (r.player.wage ?? 0), 0);
      const names = deadWeight.map((r) => surname(r.player.name));
      out.push({
        id: insightId("con.wage-dead-weight", "fringe"),
        cls: "market",
        severity: "medium",
        title: `${wageStr(totalWeekly)} goes to players outside your matchday squad`,
        detail: `${listNames(names)} ${deadWeight.length === 1 ? "earns" : "earn"} top-quartile wages but ${deadWeight.length === 1 ? "doesn't" : "don't"} make your XI or the bench rotation. Moving them saves ≈${money(totalWeekly * 52)} a year in wages alone.`,
        evidence: [
          ...deadWeight.map((r) => ({ label: surname(r.player.name), value: wageStr(r.player.wage!) })),
          { label: "Yearly saving", value: money(totalWeekly * 52) },
        ],
        subjects: deadWeight.map((r) => r.player.id),
      });
    }
  }

  // 5. Returning loanees: our players away on loan, back next season (development).
  if (ctx.loanedOut.length > 0) {
    const ranked = ctx.loanedOut
      .map((r) => ({ row: r, fit: bestPresetFit(r, ctx.formation.id) || (r.scores.bestRole?.score ?? 0) }))
      .sort((a, b) => b.fit - a.fit);
    const names = ranked.map((x) => surname(x.row.player.name));
    const best = ranked[0]!;
    out.push({
      id: insightId("con.loan-returns", "squad"),
      cls: "development",
      severity: "low",
      title: `${ctx.loanedOut.length} of your players ${ctx.loanedOut.length === 1 ? "is" : "are"} out on loan`,
      detail: `${listNames(names)} ${ctx.loanedOut.length === 1 ? "returns" : "return"} when ${ctx.loanedOut.length === 1 ? "his loan ends" : "their loans end"}. Best of them: ${surname(best.row.player.name)} already rates ${best.fit} in this formation — plan next season's squad around the returns before buying in those positions.`,
      evidence: ranked.slice(0, 5).map((x) => ({
        label: surname(x.row.player.name),
        value: `fit ${x.fit}${x.row.player.club ? ` · at ${x.row.player.club}` : ""}${x.row.player.loanEnd ? ` · until ${shortDate(x.row.player.loanEnd)}` : ""}`,
      })),
      subjects: ranked.map((x) => x.row.player.id),
    });
  }

  return out;
}
