/**
 * MKT rules — market intelligence (docs/11-assistant-analytics.md §7). Needs `value` on
 * both datasets; entirely skipped fields (wage, contract) are out of scope (doc §12).
 */

import type { AnalysisContext } from "../context.js";
import type { PlayerRow } from "../xi.js";
import type { Evidence, RawInsight } from "../types.js";
import { T } from "../thresholds.js";
import { surname, money, pct, listNames } from "../phrases.js";
import { slotFit } from "../xi.js";
import { insightId } from "./helpers.js";
import type { TransferPackage } from "../packages.js";
import { saleProceeds } from "../transfers/pricing.js";

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}

const GOOD_GRADES = new Set(["A+", "A", "A-"]);

/**
 * Bench players carrying real transfer value (doc 12 §3.2). Shared with packages.ts,
 * which turns them into funding notes.
 */
export function unusedValueCandidates(ctx: AnalysisContext): { row: PlayerRow; value: number }[] {
  const squadValues = ctx.squad.map((r) => r.player.value).filter((v): v is number => v != null);
  const p75 = percentile(squadValues, 75);
  if (p75 <= 0) return [];
  return ctx.bench
    .filter((r) => r.player.value != null && r.player.value >= p75)
    .map((r) => ({ row: r, value: r.player.value! }))
    .sort((a, b) => b.value - a.value);
}

interface BargainHit {
  readonly slotKey: string;
  readonly slotLabel: string;
  readonly starterId: string;
  readonly starterName: string;
  readonly starterFit: number;
  readonly starterValue: number;
  readonly fit: number;
}

interface BargainGroup {
  readonly playerId: string;
  readonly value: number;
  readonly hits: BargainHit[];
}

export function run(ctx: AnalysisContext): RawInsight[] {
  const out: RawInsight[] = [];

  const squadValues = ctx.squad.map((r) => r.player.value).filter((v): v is number => v != null);
  const squadTotal = squadValues.reduce((s, v) => s + v, 0);

  if (squadTotal > 0) {
    const jewel = ctx.squad
      .filter((r) => r.player.value != null)
      .sort((a, b) => (b.player.value ?? 0) - (a.player.value ?? 0))[0];
    if (jewel && (jewel.player.value ?? 0) >= T.VALUE_CONCENTRATION * squadTotal) {
      const share = ((jewel.player.value ?? 0) / squadTotal) * 100;
      out.push({
        id: insightId("mkt.crown-jewels", jewel.player.id),
        cls: "market",
        severity: "medium",
        title: `${surname(jewel.player.name)} is ${pct(share)} of your squad's value`,
        detail: `${surname(jewel.player.name)} alone accounts for ${pct(share)} of the squad's total transfer value (${money(jewel.player.value)} of ${money(squadTotal)}) — a single injury or exit is a real financial risk, not just a football one.`,
        evidence: [
          { label: "Player value", value: money(jewel.player.value) },
          { label: "Squad value", value: money(squadTotal) },
        ],
        subjects: [jewel.player.id],
      });
    }
  }

  // MKT-2 v2 (doc 12 §3.1): one insight per bargain *player*, listing every slot he
  // undercuts, capped at the top few by savings.
  const groups = new Map<string, BargainGroup>();
  for (const s of ctx.slots) {
    if (!s.starter) continue;
    const starterRow = ctx.byId.get(s.starter.id);
    const starterValue = starterRow?.player.value;
    if (starterValue == null || !starterRow) continue;
    for (const row of ctx.shortlist) {
      if (!row.player.positions.includes(s.slot.slot)) continue;
      const value = row.player.value;
      if (value == null) continue;
      const fit = slotFit(row, ctx.formation.id, s.slot);
      if (fit < s.starter.fit || value > starterValue * 0.5) continue;
      let g = groups.get(row.player.id);
      if (!g) {
        g = { playerId: row.player.id, value, hits: [] };
        groups.set(row.player.id, g);
      }
      g.hits.push({
        slotKey: s.slotKey,
        slotLabel: s.label,
        starterId: s.starter.id,
        starterName: starterRow.player.name,
        starterFit: s.starter.fit,
        starterValue,
        fit,
      });
    }
  }

  const savings = (g: BargainGroup) => Math.max(...g.hits.map((h) => h.starterValue - g.value));
  const topGroups = [...groups.values()]
    .sort((a, b) => savings(b) - savings(a))
    .slice(0, T.BARGAIN_MAX_SHOWN);

  for (const g of topGroups) {
    const row = ctx.byId.get(g.playerId)!;
    const name = surname(row.player.name);
    const labels = g.hits.map((h) => h.slotLabel);
    const title =
      g.hits.length === 1
        ? `${name} does ${labels[0]}'s job at a fraction of the price`
        : `${name} covers ${listNames(labels)} for a fraction of the price`;
    const detailParts = g.hits.map(
      (h) => `${surname(h.starterName)} at ${h.slotLabel} (fit ${h.fit} vs ${h.starterFit}, ${money(h.starterValue)})`,
    );
    const evidence: Evidence[] = [
      { label: `${name} value`, value: money(g.value) },
      ...g.hits.map((h) => ({
        label: `vs ${surname(h.starterName)} (${h.slotLabel})`,
        value: `fit ${h.fit} vs ${h.starterFit} · ${money(h.starterValue)}`,
      })),
    ];
    out.push({
      id: insightId("mkt.bargain", g.playerId),
      cls: "market",
      severity: "high",
      title,
      detail: `For ${money(g.value)}, ${name} matches or beats ${listNames(detailParts)}.`,
      evidence,
      subjects: [g.playerId, ...g.hits.map((h) => h.starterId)],
      action: { kind: "player", playerId: g.playerId, dataset: "shortlist" },
    });
  }

  const shortlistValues = ctx.shortlist.map((r) => r.player.value).filter((v): v is number => v != null);
  const p40 = percentile(shortlistValues, 40);
  const gradeGaps = ctx.shortlist.filter(
    (r) => GOOD_GRADES.has(r.player.scoutGrade ?? "") && r.player.value != null && r.player.value <= p40,
  );
  for (const r of gradeGaps.slice(0, 3)) {
    out.push({
      id: insightId("mkt.grade-value-gap", r.player.id),
      cls: "market",
      severity: "medium",
      title: `Scouts love ${surname(r.player.name)}, the market hasn't noticed`,
      detail: `${surname(r.player.name)} carries an FM scout grade of ${r.player.scoutGrade} but is valued at only ${money(r.player.value)} — near the bottom of your shortlist's price range.`,
      evidence: [
        { label: "Scout grade", value: r.player.scoutGrade ?? "—" },
        { label: "Value", value: money(r.player.value) },
      ],
      subjects: [r.player.id],
    });
  }

  // MKT-4 v2 (doc 12 §3.2): one card for all valuable non-starters — the funding plan.
  const unused = unusedValueCandidates(ctx);
  if (unused.length > 0) {
    const total = unused.reduce((s, u) => s + u.value, 0);
    const names = unused.map((u) => surname(u.row.player.name));
    out.push({
      id: insightId("mkt.unused-value", "bench"),
      cls: "market",
      severity: "medium",
      title: `${money(total)} of talent isn't making your XI`,
      detail: `${listNames(names)} ${unused.length === 1 ? "is" : "are"} worth ${money(total)} combined and ${unused.length === 1 ? "doesn't" : "none of them"} make your best XI. Selling even one funds most of the plans below.`,
      evidence: [
        ...unused.map((u) => ({ label: surname(u.row.player.name), value: money(u.value) })),
        { label: "Total", value: money(total) },
      ],
      subjects: unused.map((u) => u.row.player.id),
    });
  }

  if (ctx.budgetCap > 0 && shortlistValues.length > 0) {
    const maxShortlist = Math.max(...shortlistValues);
    if (ctx.budgetCap >= 1.5 * maxShortlist) {
      out.push({
        id: insightId("mkt.budget-power", "cap"),
        cls: "market",
        severity: "praise",
        title: "Your budget covers anyone on this list",
        detail: `At ${money(ctx.budgetCap)} you can afford even the most expensive shortlist target (${money(maxShortlist)}) with room to spare — spend selectively, not defensively.`,
        evidence: [
          { label: "Budget cap", value: money(ctx.budgetCap) },
          { label: "Most expensive target", value: money(maxShortlist) },
        ],
        subjects: [],
      });
    }
  }

  return out;
}

/** Optional headroom when plans are tight — sales are never assumed (doc 19 §4). */
export function headroomInsight(
  ctx: AnalysisContext,
  packages: readonly TransferPackage[],
): RawInsight | null {
  if (packages.length === 0 || ctx.budgetCap <= 0) return null;
  if (!packages.some((p) => p.capUsed > 0.8)) return null;
  const unused = unusedValueCandidates(ctx);
  if (unused.length === 0) return null;
  const top = unused[0]!;
  const fee = saleProceeds(top.value);
  const stretched = ctx.budgetCap + fee;
  const name = surname(top.row.player.name);
  return {
    id: insightId("mkt.headroom", top.row.player.id),
    cls: "market",
    severity: "low",
    title: `Selling ${name} stretches the window`,
    detail: `Selling ${name} (≈${money(fee)} after the usual haircut) would stretch the budget to ${money(stretched)} — optional, not assumed by the plans below.`,
    evidence: [
      { label: "Proceeds", value: money(fee) },
      { label: "Stretched cap", value: money(stretched) },
    ],
    subjects: [top.row.player.id],
  };
}
