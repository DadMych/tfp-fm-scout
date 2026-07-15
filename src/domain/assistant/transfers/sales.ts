/**
 * Per-player sale verdicts (docs/13-sporting-director.md §4). One entry per squad player;
 * `board.ts` filters this down to the actionable board.
 */

import type { PositionSlot } from "../../positions.js";
import type { AnalysisContext } from "../context.js";
import { blockedBy } from "../rules/helpers.js";
import type { SlotAssignment } from "../slots.js";
import { T } from "../thresholds.js";
import { slotFit, solveXI, type PlayerRow } from "../xi.js";
import { physicalReliance, projectFit, projectValue } from "./ageing.js";
import { buildChain } from "./chains.js";
import { computePriceBand } from "./pricing.js";
import type { PriceBand, ReplacementChain, SaleRecommendation, SaleVerdict } from "./types.js";

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}

function bestFit(row: PlayerRow, ctx: AnalysisContext): number {
  let best = 0;
  for (const fs of ctx.formation.slots) {
    if (!row.player.positions.includes(fs.slot)) continue;
    const fit = slotFit(row, ctx.formation.id, fs);
    if (fit > best) best = fit;
  }
  return best || (row.scores.bestRole?.score ?? 0);
}

function materialDelta(ask: number, projected: number): boolean {
  const delta = ask - projected;
  return delta >= Math.max(500_000, ask * 0.08);
}

function money(v: number | null): string {
  if (v == null) return "an unknown fee";
  if (v >= 1e6) return `€${Math.round((v / 1e6) * 10) / 10}M`;
  if (v >= 1e3) return `€${Math.round(v / 1e3)}K`;
  return `€${Math.round(v)}`;
}

interface ArbitrageHit {
  readonly row: PlayerRow;
  readonly fit: number;
  readonly cost: number;
}

/** A shortlist player who matches the starter at a fraction of his value (doc §4.2-5b). */
function findArbitrage(ctx: AnalysisContext, slot: SlotAssignment, value: number): ArbitrageHit | null {
  if (!slot.starter) return null;
  const starterFit = slot.starter.fit;
  let best: ArbitrageHit | null = null;
  for (const r of ctx.shortlist) {
    if (!r.player.positions.includes(slot.slot.slot)) continue;
    const cost = r.player.value;
    if (cost == null || cost > T.ARBITRAGE_FRAC * value) continue;
    const fit = slotFit(r, ctx.formation.id, slot.slot);
    if (fit < starterFit - 2) continue;
    if (!best || fit > best.fit) best = { row: r, fit, cost };
  }
  return best;
}

function arbitrageChain(hit: ArbitrageHit, slot: PositionSlot, fitBefore: number, fee: number): ReplacementChain {
  return {
    source: "shortlist",
    playerId: hit.row.player.id,
    playerName: hit.row.player.name,
    slot,
    fitBefore,
    fitAfter: hit.fit,
    cost: hit.cost,
    netCost: hit.cost - fee,
    ready: true,
  };
}

function reasonsFor(
  verdict: SaleVerdict,
  row: PlayerRow,
  priceBand: PriceBand | null,
  fit: number,
  fitIn2: number,
  arbitrage: ArbitrageHit | null,
): string[] {
  const age = row.player.age;
  const value = row.player.value ?? null;
  switch (verdict) {
    case "untouchable":
      return ["Build around him. Hang up on anyone who calls."];
    case "sell-high": {
      const lines = ["His value will never be higher — the market pays for the player he was last season."];
      if (arbitrage) {
        lines.push(
          `${arbitrage.row.player.name} does the same job for ${money(arbitrage.cost)} — bank the difference.`,
        );
      } else if (priceBand != null && age != null && value != null) {
        const projected = projectValue(value, age + 1);
        if (materialDelta(priceBand.ask, projected)) {
          lines.push(`${money(priceBand.ask)} now vs ${money(projected)} in 12 months.`);
        }
      }
      return lines;
    }
    case "sell-now": {
      const lines = [
        `Every window he stays costs value: projected fit in 2 seasons is ${fitIn2}, down from ${Math.round(fit)} now.`,
      ];
      if (priceBand != null && age != null && value != null) {
        const projected = projectValue(value, age + 1);
        const loss = priceBand.ask - projected;
        if (loss > 0 && materialDelta(priceBand.ask, projected)) {
          lines.push(`Roughly ${money(loss)} evaporates if you wait a year.`);
        }
      }
      return lines;
    }
    case "release":
      return ["A fee is a bonus; the squad place is the win."];
    case "loan-out":
      return ["He needs minutes you can't give him."];
    default:
      return [];
  }
}

function xiImpactOf(ctx: AnalysisContext, playerId: string): number {
  const withoutPlayer = ctx.squad.filter((r) => r.player.id !== playerId);
  const shadow = solveXI(withoutPlayer, ctx.formation);
  return shadow.avgFit - ctx.avgFit;
}

export function buildSales(ctx: AnalysisContext): SaleRecommendation[] {
  const values = ctx.squad.map((r) => r.player.value).filter((v): v is number => v != null);
  const p75V = percentile(values, 75);
  const p90V = percentile(values, 90);

  const results = ctx.squad.map((row) => buildOne(ctx, row, p75V, p90V));
  const actionable = new Set(
    results
      .filter((s) => s.verdict === "sell-now" || s.verdict === "sell-high" || s.verdict === "release")
      .map((s) => s.playerId),
  );

  return results.map((rec) => {
    const heirId = rec.replacement?.playerId;
    if (!heirId || !actionable.has(heirId)) return rec;
    const chain = buildChain(ctx, rec.playerId, actionable);
    const evidence = rec.evidence.filter((e) => e.label !== "Replacement");
    if (chain?.playerId) {
      evidence.push({ label: "Replacement", value: `${chain.playerName} (fit ${chain.fitAfter})` });
    }
    return {
      ...rec,
      replacement: chain?.source === "none" ? null : chain,
      evidence,
    };
  });
}

function buildOne(ctx: AnalysisContext, row: PlayerRow, p75V: number, p90V: number): SaleRecommendation {
  const id = row.player.id;
  const age = row.player.age;
  const value = row.player.value ?? null;

  const slotAssignment = ctx.slots.find((s) => s.starter?.id === id) ?? null;
  // Decline and elite checks use the assigned slot's pairFit — same currency as chains/succession (doc 17 §9.3).
  const fit = slotAssignment?.starter?.fit ?? bestFit(row, ctx);
  const reliance = physicalReliance(row.player);
  const fitIn2 = projectFit(fit, age, reliance, 2);

  const isStarter = slotAssignment != null;
  const isBackupSomewhere = ctx.slots.some((s) => s.backup?.id === id);
  const fringe = !isStarter && !isBackupSomewhere;

  let verdict: SaleVerdict = "keep";
  let arbitrage: ArbitrageHit | null = null;

  if (isStarter && fit >= T.ELITE_FIT && age != null && age <= T.AGE_PEAK_END) {
    verdict = "untouchable";
  } else if (!isStarter && age != null && age <= T.AGE_DEV && fit >= T.GEM_FIT && blockedBy(ctx, row)) {
    verdict = "loan-out";
  } else if (age != null && age >= 24 && fit < T.DEADWOOD_FIT && fringe) {
    verdict = "release";
  } else if (
    age != null &&
    value != null &&
    age >= T.SELL_NOW_AGE &&
    fit - fitIn2 >= 4 &&
    (buildChain(ctx, id)?.ready ?? false)
  ) {
    verdict = "sell-now";
  } else if (value != null && slotAssignment) {
    const starterFit = slotAssignment.starter!.fit;
    const ageWindow =
      age != null &&
      age >= T.SELL_AGE_LO &&
      age <= T.SELL_AGE_HI &&
      value >= p75V &&
      slotAssignment.backup != null &&
      slotAssignment.backup.fit >= starterFit - 5;
    if (ageWindow) {
      verdict = "sell-high";
    } else if (value >= p90V) {
      arbitrage = findArbitrage(ctx, slotAssignment, value);
      if (arbitrage) verdict = "sell-high";
    }
  }

  const isRelease = verdict === "release";
  const priceBand = computePriceBand(value, age, isRelease);

  let replacement: ReplacementChain | null = null;
  if (verdict === "sell-now" || verdict === "release" || verdict === "loan-out") {
    replacement = buildChain(ctx, id);
  } else if (verdict === "sell-high") {
    replacement = arbitrage
      ? arbitrageChain(arbitrage, slotAssignment!.slot.slot, slotAssignment!.starter!.fit, priceBand?.ask ?? 0)
      : buildChain(ctx, id);
  }

  const urgency: SaleRecommendation["urgency"] =
    verdict === "sell-now" || verdict === "release" || verdict === "loan-out"
      ? "this-window"
      : verdict === "sell-high"
        ? age === T.SELL_AGE_HI
          ? "this-window"
          : "next-window"
        : "no-rush";

  const xiImpact = verdict === "keep" || verdict === "untouchable" ? 0 : xiImpactOf(ctx, id);

  const evidence: { label: string; value: string }[] = [
    { label: "Age", value: age != null ? `${age}` : "—" },
    { label: "Fit", value: `${Math.round(fit)}` },
  ];
  if (priceBand) evidence.push({ label: "Ask", value: money(priceBand.ask) });
  if (replacement?.playerId) {
    evidence.push({ label: "Replacement", value: `${replacement.playerName} (fit ${replacement.fitAfter})` });
  }
  if (xiImpact !== 0) evidence.push({ label: "XI impact", value: `${xiImpact}` });

  return {
    playerId: id,
    verdict,
    reasons: reasonsFor(verdict, row, priceBand, fit, fitIn2, arbitrage),
    evidence,
    priceBand,
    xiImpact,
    replacement,
    urgency,
  };
}
