/**
 * TR rules — the sporting-director board surfaced as insights (docs/13-sporting-director.md §10).
 */

import type { TransferPackage } from "../packages.js";
import type { AnalysisContext } from "../context.js";
import { T } from "../thresholds.js";
import { surname, money, pct, listNames } from "../phrases.js";
import { projectValue } from "../transfers/ageing.js";
import type { TransferBoard } from "../transfers/types.js";
import type { RawInsight } from "../types.js";
import { insightId, scoutAction } from "./helpers.js";

function healthVerdict(index: number): string {
  if (index >= 75) return "healthy";
  if (index >= 60) return "stable";
  if (index >= 45) return "creaking";
  return "crisis";
}

function healthSeverity(index: number): RawInsight["severity"] {
  if (index >= 75) return "praise";
  if (index >= 60) return "low";
  if (index >= 45) return "medium";
  return "high";
}

export function run(ctx: AnalysisContext, board: TransferBoard, packages: readonly TransferPackage[] = []): RawInsight[] {
  const out: RawInsight[] = [];
  const nameOf = (id: string) => surname(ctx.byId.get(id)?.player.name ?? id);

  // TR-1: the board itself.
  const saleVerdicts = board.sales.filter((s) => s.verdict !== "loan-out");
  if (saleVerdicts.length > 0) {
    out.push({
      id: insightId("tr.board", "squad"),
      cls: "transfer",
      severity: "high",
      title: `${saleVerdicts.length} player${saleVerdicts.length === 1 ? "" : "s"} should leave this window`,
      detail: `${listNames(saleVerdicts.map((s) => nameOf(s.playerId)))} — worth ${money(board.expectedIncome)} combined if you move now.`,
      evidence: saleVerdicts.map((s) => ({ label: nameOf(s.playerId), value: money(s.priceBand?.ask ?? null) })),
      subjects: saleVerdicts.map((s) => s.playerId),
    });
  }

  // TR-2: sell-now, by fee desc, capped.
  const sellNow = board.sales
    .filter((s) => s.verdict === "sell-now")
    .sort((a, b) => (b.priceBand?.ask ?? 0) - (a.priceBand?.ask ?? 0));
  for (const s of sellNow.slice(0, 4)) {
    const row = ctx.byId.get(s.playerId);
    if (!row) continue;
    const age = row.player.age;
    const value = row.player.value;
    const nextSummer = value != null && age != null ? projectValue(value, age + 1) : null;
    out.push({
      id: insightId("tr.sell-now", s.playerId),
      cls: "transfer",
      severity: "high",
      title: `Sell ${surname(row.player.name)} now — he only gets cheaper`,
      detail: `${money(s.priceBand?.ask ?? null)} today${nextSummer != null ? `, ${money(nextSummer)} next summer` : ""} — ${surname(row.player.name)} loses you money every window he stays.`,
      evidence: [
        { label: "Ask", value: money(s.priceBand?.ask ?? null) },
        ...(nextSummer != null ? [{ label: "Next summer", value: money(nextSummer) }] : []),
      ],
      subjects: [s.playerId, ...(s.replacement?.playerId ? [s.replacement.playerId] : [])],
      action: { kind: "player", playerId: s.playerId, dataset: "squad" as const },
    });
  }

  // TR-3: arbitrage — sell high, buy the same fit cheaper.
  const arbitrage = board.sales.filter(
    (s) => s.verdict === "sell-high" && s.replacement?.source === "shortlist" && (s.replacement?.netCost ?? 0) < 0,
  );
  for (const s of arbitrage.slice(0, 4)) {
    const row = ctx.byId.get(s.playerId);
    const rep = s.replacement;
    if (!row || !rep || rep.playerId == null) continue;
    const profit = -(rep.netCost ?? 0);
    out.push({
      id: insightId("tr.arbitrage", s.playerId),
      cls: "transfer",
      severity: "high",
      title: `Sell ${surname(row.player.name)}, sign ${surname(rep.playerName ?? "")} instead`,
      detail: `Sell ${surname(row.player.name)} (${money(s.priceBand?.ask ?? null)}), sign ${surname(rep.playerName ?? "")} (${money(rep.cost)}, fit ${rep.fitAfter} vs ${rep.fitBefore}) — same XI, ${money(profit)} profit.`,
      evidence: [
        { label: "Sell for", value: money(s.priceBand?.ask ?? null) },
        { label: "Buy for", value: money(rep.cost) },
        { label: "Profit", value: money(profit) },
      ],
      subjects: [s.playerId, rep.playerId],
      action: { kind: "player", playerId: rep.playerId, dataset: "shortlist" as const },
    });
  }

  // TR-4: succession crisis.
  for (const entry of board.succession) {
    if (entry.status !== "crisis") continue;
    const slotAssignment = ctx.slots.find((s) => s.slotKey === entry.slotKey)!;
    const starterName = entry.starterId ? nameOf(entry.starterId) : null;
    out.push({
      id: insightId("tr.succession-crisis", entry.slotKey),
      cls: "transfer",
      severity: "critical",
      title: `${entry.slotLabel} falls off a cliff`,
      detail: starterName
        ? `${starterName} projects to ${entry.fitIn1} fit next season and nobody is ready to replace him at ${entry.slotLabel}.`
        : `${entry.slotLabel} has no starter and no successor lined up.`,
      evidence: [
        { label: "Fit now", value: `${entry.fitNow}` },
        { label: "Fit in 1 season", value: `${entry.fitIn1}` },
      ],
      subjects: entry.starterId ? [entry.starterId] : [],
      slotKey: entry.slotKey,
      action: scoutAction(slotAssignment.slot.slot, { minFit: T.WEAK_FIT }),
    });
  }

  // TR-5: value cliff — too much money trapped in 30+ legs.
  const values = ctx.squad.map((r) => r.player.value).filter((v): v is number => v != null);
  const squadTotal = values.reduce((s, v) => s + v, 0);
  const oldValue = ctx.squad
    .filter((r) => r.player.value != null && (r.player.age ?? 0) >= 30)
    .reduce((s, r) => s + (r.player.value ?? 0), 0);
  if (squadTotal > 0 && oldValue >= T.VALUE_CLIFF_FRAC * squadTotal) {
    const share = (oldValue / squadTotal) * 100;
    out.push({
      id: insightId("tr.value-cliff", "squad"),
      cls: "transfer",
      severity: "high",
      title: `${pct(share)} of your squad's value is 30+`,
      detail: `${money(oldValue)} — ${pct(share)} of your squad's worth — is in players 30 or older. That money evaporates if you don't move soon.`,
      evidence: [
        { label: "Value in 30+ players", value: money(oldValue) },
        { label: "Squad value", value: money(squadTotal) },
      ],
      subjects: [],
    });
  }

  // TR-6: self-funding window.
  const churn = packages.find((p) => p.id === "churn");
  if (churn) {
    out.push({
      id: insightId("tr.self-funding", "churn"),
      cls: "transfer",
      severity: "medium",
      title: "This window can pay for itself",
      detail: `${churn.rationale}`,
      evidence: [
        { label: "Net spend", value: money(churn.totalCost - churn.income) },
        {
          label: "XI lift",
          value: `+${churn.afterFit - churn.beforeFit || Math.max(1, Math.round((churn.afterTotalFit - churn.beforeTotalFit) / 11))}`,
        },
      ],
      subjects: [],
      action: { kind: "package", packageId: churn.id },
    });
  }

  // TR-7: squad health, always present.
  const h = board.health;
  const subscores: readonly [string, number][] = [
    ["XI quality", h.xiQuality],
    ["Depth", h.depth],
    ["Age balance", h.ageBalance],
    ["Succession", h.succession],
    ["Liquidity", h.liquidity],
  ];
  const weakest = subscores.reduce((min, cur) => (cur[1] < min[1] ? cur : min));
  out.push({
    id: insightId("tr.health", "squad"),
    cls: "transfer",
    severity: healthSeverity(h.index),
    title: `Squad health ${h.index}/100 (${healthVerdict(h.index)})`,
    detail: `Squad health reads ${h.index}/100 — ${healthVerdict(h.index)}. Weakest area: ${weakest[0]} (${weakest[1]}).`,
    evidence: subscores.map(([label, value]) => ({ label, value: `${value}` })),
    subjects: [],
  });

  return out;
}
