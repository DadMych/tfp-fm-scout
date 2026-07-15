/**
 * Transfer packages v3 (doc 12 §4; supersedes doc 11 §8).
 *
 * Named, coherent transfer strategies. v3 changes vs v2:
 * - "spender" strategies must convert budget into quality: a two-pass assembly fills
 *   leftover cap with depth signings, and a spend floor discards token windows.
 * - Marquee means marquee: the signing must cost a real fraction of the cap.
 * - An overlap filter (Jaccard on player sets) kills permutation clones — no more five
 *   packages that are all the same three defenders shuffled.
 * - Every move carries a player profile and a full why-sentence; every package carries
 *   spend metrics, a depth-gain figure and a funding note built from unused bench value.
 */

import { midOf } from "../attr-value.js";
import type { AttributeId } from "../attributes.js";
import { getArchetype } from "../archetypes/registry.js";
import type { SlotNeed } from "./slots.js";
import { deriveSlots } from "./slots.js";
import { solveXI, slotFit, bestPresetFit, type PlayerRow } from "./xi.js";
import type { AnalysisContext } from "./context.js";
import { T } from "./thresholds.js";
import { surname, listNames, money, pct } from "./phrases.js";
import { raw } from "./rules/helpers.js";
import { unusedValueCandidates } from "./rules/market.js";
import { buildSales } from "./transfers/sales.js";
import { computePriceBand } from "./transfers/pricing.js";
import type { SaleRecommendation, SaleVerdict } from "./transfers/types.js";

export type SuggestionKind = "fill" | "upgrade" | "succession" | "depth" | "prospect";

export type MoveFate = "bench" | "sell" | "cover" | "loan" | "b-team";

export interface PackageMove {
  readonly playerId: string;
  readonly slotKey: string;
  readonly slotLabel: string;
  readonly kind: SuggestionKind;
  readonly currentFit: number;
  readonly newFit: number;
  readonly delta: number;
  readonly cost: number | null;
  readonly headline: string;
  readonly age: number | null;
  readonly profile: string;
  readonly why: string;
  readonly out: {
    readonly playerId: string;
    readonly name: string;
    readonly fate: MoveFate;
  } | null;
}

export interface XiSlotDiff {
  readonly slotLabel: string;
  readonly before: string;
  readonly after: string;
  readonly beforeId: string | null;
  readonly afterId: string | null;
  readonly changed: boolean;
}

/** A sale bundled into a package (doc 13 §7.1 / doc 20). */
export interface PackageSale {
  readonly playerId: string;
  readonly playerName: string;
  readonly fee: number;
  readonly verdict: SaleVerdict;
  readonly consequence: string;
}

/** A squad (or prospect) player leaving on loan / B-team — frees a registered place (doc 20). */
export type PackageExitDest = "loan" | "b-team";

export interface PackageLoan {
  readonly playerId: string;
  readonly playerName: string;
  readonly reason: string;
  readonly destination: PackageExitDest;
}

export interface TransferPackage {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  readonly moves: readonly PackageMove[];
  readonly totalCost: number;
  readonly beforeFit: number;
  readonly afterFit: number;
  /** Sum of slot fits before/after signings — gate for real XI lift when rounded avg ties. */
  readonly beforeTotalFit: number;
  readonly afterTotalFit: number;
  readonly afterVerdict: string;
  readonly displaced: readonly string[];
  readonly rationale: string;
  readonly capUsed: number;
  readonly remaining: number;
  readonly depthGain: number;
  readonly fundingNote: string | null;
  readonly solves: readonly string[];
  /** doc 13 §7.1 / doc 20 — sales bundled in to free places and fund buys. */
  readonly sales: readonly PackageSale[];
  readonly loans: readonly PackageLoan[];
  readonly income: number;
  readonly netSpend: number;
  readonly xiDiff: readonly XiSlotDiff[];
  readonly windowSummary: string;
  /** Registered size after the window (doc 20). */
  readonly squadAfter: number;
}

const NEED_SEVERITY: Record<SlotNeed, number> = { hole: 0, weak: 1, ageing: 2, thin: 3, solid: 9 };

function candidateKind(need: SlotNeed): SuggestionKind {
  switch (need) {
    case "hole":
      return "fill";
    case "ageing":
      return "succession";
    case "thin":
      return "depth";
    default:
      return "upgrade";
  }
}

function verdictOf(avg: number): string {
  if (avg >= 72) return "Strong";
  if (avg >= 62) return "Balanced";
  return "Needs work";
}

interface Candidate {
  readonly row: PlayerRow;
  readonly slotKey: string;
  readonly slotLabel: string;
  readonly currentFit: number;
  readonly newFit: number;
  readonly delta: number;
  readonly kind: SuggestionKind;
  readonly cost: number | null;
  readonly age: number | null;
}

function buildCandidates(ctx: AnalysisContext): Candidate[] {
  const out: Candidate[] = [];
  for (const slot of ctx.slots) {
      const currentFit = slot.starter?.fit ?? 0;
      const hasStarter = slot.starter != null;
      for (const row of ctx.shortlist) {
        if (!row.player.positions.includes(slot.slot.slot)) continue;
        const newFit = slotFit(row, ctx.formation.id, slot.slot);
        const delta = newFit - currentFit;
        const helpsNeed = !hasStarter && slot.need !== "solid" && newFit >= 62;
        if (!(delta >= 3 || helpsNeed)) continue;
      out.push({
        row,
        slotKey: slot.slotKey,
        slotLabel: slot.label,
        currentFit,
        newFit,
        delta,
        kind: candidateKind(slot.need),
        cost: row.player.value ?? null,
        age: row.player.age ?? null,
      });
    }
  }
  return out;
}

function rawAttr(row: PlayerRow, id: AttributeId): number {
  return midOf(row.player.attrs, id) ?? -1;
}

interface Strategy {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  readonly max: number;
  readonly capFraction: number;
  /** Spenders exist to convert budget into quality: depth pass + spend floor apply. */
  readonly spender: boolean;
  readonly filter?: (c: Candidate, ctx: AnalysisContext) => boolean;
  readonly cmp: (a: Candidate, b: Candidate, ctx: AnalysisContext) => number;
}

function needSeverity(ctx: AnalysisContext, slotKey: string): number {
  return NEED_SEVERITY[ctx.slots.find((s) => s.slotKey === slotKey)?.need ?? "solid"];
}

/** Spenders break fit ties toward the *bigger* signing — that's the point of the window. */
const byFitThenCostDesc = (a: Candidate, b: Candidate) =>
  b.newFit - a.newFit || (b.cost ?? 0) - (a.cost ?? 0);

const STRATEGIES: readonly Strategy[] = [
  {
    id: "galactico",
    name: "The statement window",
    tagline: "One or two stars the whole league notices",
    max: 2,
    capFraction: 1,
    spender: true,
    // Stars only: each signing must be a real chunk of the cap.
    filter: (c, ctx) => c.cost != null && c.cost >= 0.3 * ctx.budgetCap,
    cmp: byFitThenCostDesc,
  },
  {
    id: "win-now",
    name: "Win now",
    tagline: "The best available talent, age no object",
    max: 6,
    capFraction: 1,
    spender: true,
    cmp: byFitThenCostDesc,
  },
  {
    id: "marquee",
    name: "Marquee signing",
    tagline: "One statement addition to headline the window",
    max: 1,
    capFraction: 1,
    spender: true,
    // A marquee costs real money — enforced via filter so "no candidate" = no package.
    filter: (c, ctx) => c.cost != null && c.cost >= T.MARQUEE_MIN_FRAC * ctx.budgetCap,
    cmp: (a, b) => b.newFit - a.newFit,
  },
  {
    id: "moneyball",
    name: "Moneyball",
    tagline: "Most improvement per euro spent",
    max: 5,
    capFraction: 1,
    spender: false,
    filter: (c) => c.cost != null && c.cost > 0 && c.delta > 0,
    cmp: (a, b) => b.delta / (b.cost || 1) - a.delta / (a.cost || 1),
  },
  {
    id: "foundations",
    name: "Fix the gaps",
    tagline: "The cheapest way to erase your weak spots",
    max: 5,
    capFraction: 1,
    spender: false,
    filter: (c, ctx) => ctx.slots.find((s) => s.slotKey === c.slotKey)?.need !== "solid",
    cmp: (a, b, ctx) =>
      needSeverity(ctx, a.slotKey) - needSeverity(ctx, b.slotKey) || (a.cost ?? Infinity) - (b.cost ?? Infinity),
  },
  {
    id: "future",
    name: "Build for the future",
    tagline: "Young talent to grow into the side",
    max: 5,
    capFraction: 1,
    spender: false,
    filter: (c) => c.age != null && c.age <= 23,
    cmp: (a, b) => b.newFit - a.newFit || (a.age ?? 99) - (b.age ?? 99),
  },
  {
    id: "youth-project",
    name: "The youth project",
    tagline: "Build around players who'll still be here in five years",
    max: 5,
    capFraction: 1,
    spender: false,
    filter: (c) => c.age != null && c.age <= 20,
    cmp: (a, b) => b.delta - a.delta || (a.age ?? 99) - (b.age ?? 99),
  },
  {
    id: "spine",
    name: "Rebuild the spine",
    tagline: "Strengthen down the middle — GK to striker",
    max: 4,
    capFraction: 1,
    spender: true,
    filter: (c) => isCentralSlotKey(c.slotKey),
    cmp: byFitThenCostDesc,
  },
  {
    id: "flanks",
    name: "Overhaul the flanks",
    tagline: "New pace and delivery down both sides",
    max: 4,
    capFraction: 1,
    spender: true,
    filter: (c) => isFlankSlotKey(c.slotKey),
    cmp: byFitThenCostDesc,
  },
  {
    id: "press-conversion",
    name: "The press conversion",
    tagline: "Recruit for a high-energy, front-foot press",
    max: 4,
    capFraction: 1,
    spender: false,
    filter: (c) => (raw(c.row, "workEngine") ?? 0) >= 13 && rawAttr(c.row, "aggression") >= 12,
    cmp: (a, b) => b.newFit - a.newFit,
  },
  {
    id: "half-budget",
    name: "The disciplined window",
    tagline: "The best XI lift for half the cap — keep dry powder",
    max: 3,
    capFraction: 0.5,
    spender: false,
    filter: (c) => c.cost != null,
    cmp: (a, b) => b.delta - a.delta,
  },
  {
    id: "prospects",
    name: "Prospect pipeline",
    tagline: "Young talent signed to develop out on loan",
    max: 4,
    capFraction: 0.4,
    spender: false,
    filter: (c) =>
      c.age != null &&
      c.age <= T.PROSPECT_AGE &&
      (c.row.scores.topArchetype?.score ?? 0) >= T.PROSPECT_ARCH_MIN,
    cmp: (a, b) =>
      (b.row.scores.topArchetype?.score ?? 0) - (a.row.scores.topArchetype?.score ?? 0) ||
      b.newFit - a.newFit,
  },
];

// Slot-key classification across all formations in formations.ts.
const CENTRAL_SLOT_KEYS = new Set([
  "gk",
  "dc",
  "dcl",
  "dcr",
  "dm",
  "dml",
  "dmr",
  "amc",
  "st",
  "str",
  "stl",
  "mcl",
  "mcr",
]);
function isCentralSlotKey(key: string): boolean {
  return CENTRAL_SLOT_KEYS.has(key);
}
function isFlankSlotKey(key: string): boolean {
  return /^(dr|dl|mr|ml|amr|aml|wbr|wbl)$/.test(key);
}

function affordable(cost: number | null, remaining: number): boolean {
  return cost != null && cost <= remaining;
}

interface Assembled {
  readonly picks: Candidate[];
  readonly spent: number;
}

/**
 * Two-pass assembly (doc 12 §4.3). Pass 1 buys starters (one per slot). Pass 2, for
 * spender strategies, converts leftover budget into depth: either an unused slot at a
 * respectable fit, or first-choice cover behind a slot already strengthened.
 */
function assemble(pool: readonly Candidate[], cap: number, strat: Strategy): Assembled {
  const picks: Candidate[] = [];
  const usedPlayers = new Set<string>();
  const usedSlots = new Set<string>();
  let remaining = cap;

  for (const c of pool) {
    if (picks.length >= strat.max) break;
    if (usedPlayers.has(c.row.player.id) || usedSlots.has(c.slotKey)) continue;
    if (!affordable(c.cost, remaining)) continue;
    picks.push(c);
    usedPlayers.add(c.row.player.id);
    usedSlots.add(c.slotKey);
    remaining -= c.cost!;
  }

  if (strat.spender) {
    const coveredSlots = new Set<string>(); // at most one depth signing per slot
    for (const c of pool) {
      if (picks.length >= T.PKG_MAX_SIGNINGS) break;
      if (usedPlayers.has(c.row.player.id)) continue;
      if (!affordable(c.cost, remaining)) continue;
      const newSlot = !usedSlots.has(c.slotKey);
      if (!newSlot && coveredSlots.has(c.slotKey)) continue;
      const goodEnough = newSlot
        ? c.newFit >= T.DEPTH_PASS_MIN_FIT
        : c.newFit >= T.THIN_BACKUP; // cover behind a slot we already strengthened
      if (!goodEnough) continue;
      picks.push(newSlot ? c : { ...c, kind: "depth" });
      usedPlayers.add(c.row.player.id);
      if (newSlot) usedSlots.add(c.slotKey);
      else coveredSlots.add(c.slotKey);
      remaining -= c.cost!;
    }
  }

  return { picks, spent: cap - remaining };
}

function profileOf(row: PlayerRow, ctx: AnalysisContext): string {
  const age = row.player.age != null ? `${row.player.age}` : "—";
  const family = row.scores.topArchetype ? getArchetype(row.scores.topArchetype.id).family : null;
  const fit = bestPresetFit(row, ctx.formation.id);
  const role = fit > 0 ? `preset fit ${fit}` : null;
  return [age, family, role].filter(Boolean).join(" · ");
}

function headlineFor(c: Candidate): string {
  const pos = c.slotLabel;
  switch (c.kind) {
    case "fill":
      return `Fills the empty ${pos} slot (fit ${c.newFit}).`;
    case "upgrade":
      return `Upgrades ${pos}: ${c.newFit} vs ${c.currentFit} (+${c.delta}).`;
    case "succession":
      return `Succession at ${pos} — fit ${c.newFit}.`;
    case "depth":
      return `Depth at ${pos} at fit ${c.newFit}.`;
    case "prospect":
      return `Prospect for ${pos} — signed to develop on loan.`;
  }
}

function whyFor(c: Candidate, ctx: AnalysisContext, newStarterBySlot: ReadonlyMap<string, string>): string {
  const name = surname(c.row.player.name);
  const slot = ctx.slots.find((s) => s.slotKey === c.slotKey);
  const oldName = slot?.starter ? surname(ctx.byId.get(slot.starter.id)?.player.name ?? "") : null;
  switch (c.kind) {
    case "fill":
      return `${name} fills a slot nobody in the squad plays — fit ${c.newFit}.`;
    case "upgrade":
      return oldName
        ? `${name} takes ${c.slotLabel} from ${oldName}: ${c.currentFit} → ${c.newFit}.`
        : `${name} takes over ${c.slotLabel} at fit ${c.newFit}.`;
    case "succession":
      return oldName
        ? `${name} is the succession plan behind ${oldName} (${slot?.starterAge ?? "—"}).`
        : `${name} is the succession plan at ${c.slotLabel}.`;
    case "depth": {
      // If this package also buys a new starter for the slot, he is who this signing covers.
      const coverFor = newStarterBySlot.get(c.slotKey) ?? oldName;
      return coverFor
        ? `${name} comes in as first-choice cover behind ${coverFor} at ${c.slotLabel} (fit ${c.newFit}).`
        : `${name} comes in as first-choice cover at ${c.slotLabel} (fit ${c.newFit}).`;
    }
    case "prospect":
      return `${name} (${c.age}) joins as a prospect and leaves on loan — develops without eating a registered place.`;
  }
}

function toMove(
  c: Candidate,
  ctx: AnalysisContext,
  newStarterBySlot: ReadonlyMap<string, string>,
  pkgSales: readonly PackageSale[],
  pkgLoans: readonly PackageLoan[],
  allRows: readonly PlayerRow[],
): PackageMove {
  const base = {
    playerId: c.row.player.id,
    slotKey: c.slotKey,
    slotLabel: c.slotLabel,
    kind: c.kind,
    currentFit: c.currentFit,
    newFit: c.newFit,
    delta: c.delta,
    cost: c.cost,
    headline: headlineFor(c),
    age: c.age,
    profile: profileOf(c.row, ctx),
    why: whyFor(c, ctx, newStarterBySlot),
    out: outFor(c, ctx, pkgSales, pkgLoans, allRows),
  };
  return base;
}

function outFor(
  c: Candidate,
  ctx: AnalysisContext,
  pkgSales: readonly PackageSale[],
  pkgLoans: readonly PackageLoan[],
  allRows: readonly PlayerRow[],
): { playerId: string; name: string; fate: MoveFate } | null {
  if (c.kind === "depth" || c.kind === "prospect") return null;
  const slot = ctx.slots.find((s) => s.slotKey === c.slotKey);
  const incumbentId = slot?.starter?.id;
  if (!incumbentId) return null;
  const name = surname(ctx.byId.get(incumbentId)?.player.name ?? incumbentId);
  if (pkgSales.some((s) => s.playerId === incumbentId)) {
    return { playerId: incumbentId, name, fate: "sell" };
  }
  const loan = pkgLoans.find((l) => l.playerId === incumbentId);
  if (loan) {
    return {
      playerId: incumbentId,
      name,
      fate: loan.destination === "b-team" ? "b-team" : "loan",
    };
  }
  const newXi = solveXI(allRows, ctx.formation);
  const shadow = deriveSlots(newXi, allRows, ctx.formation).find((s) => s.slotKey === c.slotKey);
  if (shadow?.backup?.id === incumbentId) {
    return { playerId: incumbentId, name, fate: "cover" };
  }
  return { playerId: incumbentId, name, fate: "bench" };
}

function buildXiDiff(
  ctx: AnalysisContext,
  allRows: readonly PlayerRow[],
  newXi: ReturnType<typeof solveXI>,
): XiSlotDiff[] {
  const afterSlots = deriveSlots(newXi, allRows, ctx.formation);
  return ctx.slots.map((slot) => {
    const after = afterSlots.find((s) => s.slotKey === slot.slotKey);
    const beforeName = slot.starter ? surname(ctx.byId.get(slot.starter.id)?.player.name ?? "") : "—";
    const afterName = after?.starter ? surname(ctx.byId.get(after.starter.id)?.player.name ?? "") : "—";
    return {
      slotLabel: slot.label,
      before: beforeName,
      after: afterName,
      beforeId: slot.starter?.id ?? null,
      afterId: after?.starter?.id ?? null,
      changed: beforeName !== afterName,
    };
  });
}

function windowSummaryFor(
  ctx: AnalysisContext,
  picks: readonly Candidate[],
  pkgSales: readonly PackageSale[],
  squadLoans: readonly PackageLoan[],
  income: number,
): string {
  const signings = picks.length;
  const prospects = picks.filter((p) => p.kind === "prospect").length;
  const sold = pkgSales.length;
  const loaned = squadLoans.filter((l) => l.destination === "loan").length;
  const bTeam = squadLoans.filter((l) => l.destination === "b-team").length;
  const residents = signings - prospects;
  const squadAfter = ctx.squad.length + residents - sold - loaned - bTeam;
  const bits: string[] = [`${signings} in`];
  if (prospects > 0) {
    bits[0] += ` (${prospects} prospect${prospects === 1 ? "" : "s"} on loan)`;
  }
  if (sold > 0) bits.push(`${sold} sold for ${money(income)}`);
  if (loaned > 0) bits.push(`${loaned} loaned`);
  if (bTeam > 0) bits.push(`${bTeam} to B team`);
  bits.push(`squad ${squadAfter}/${ctx.squadCap}`);
  return bits.join(", ");
}

function fundingNoteFor(
  totalCost: number,
  strategyCap: number,
  unused: readonly { row: PlayerRow; value: number }[],
): string | null {
  if (totalCost <= strategyCap) return null;
  if (unused.length === 0 || totalCost < 0.3 * strategyCap) return null;
  const sellers: { name: string; value: number }[] = [];
  let covered = 0;
  for (const u of unused) {
    sellers.push({ name: surname(u.row.player.name), value: u.value });
    covered += u.value;
    if (covered >= totalCost) break;
  }
  const share = Math.min(100, (covered / totalCost) * 100);
  const names = listNames(sellers.map((s) => `${s.name} (${money(s.value)})`));
  return `To fund it: ${names} ${sellers.length === 1 ? "doesn't" : "don't"} make your XI — selling covers ${pct(share)} of this plan.`;
}

function consequenceFor(
  sale: SaleRecommendation,
  picks: readonly Candidate[],
  ctx: AnalysisContext,
): string {
  const sellerSlot = ctx.slots.find((s) => s.starter?.id === sale.playerId);
  if (sellerSlot) {
    const covering = picks.find((p) => p.slotKey === sellerSlot.slotKey);
    if (covering) {
      return `replaced by ${surname(covering.row.player.name)} (fit ${covering.newFit})`;
    }
  }
  const rep = sale.replacement;
  if (rep?.playerId != null && rep.playerName) {
    return rep.source === "internal"
      ? `${surname(rep.playerName)} (fit ${rep.fitAfter}) steps in`
      : `replaced by ${surname(rep.playerName)} from the shortlist`;
  }
  if (!sellerSlot) return "frees a registered place";
  return "slot covered from within the squad";
}

function saleSlotCovered(
  ctx: AnalysisContext,
  allRows: readonly PlayerRow[],
  picks: readonly Candidate[],
  sellerId: string,
): boolean {
  const sellerSlot = ctx.slots.find((s) => s.starter?.id === sellerId);
  if (!sellerSlot?.starter) return true;
  if (picks.some((p) => p.slotKey === sellerSlot.slotKey)) return true;
  const without = allRows.filter((r) => r.player.id !== sellerId);
  const xi = solveXI(without, ctx.formation);
  const shadowSlots = deriveSlots(xi, without, ctx.formation);
  const slot = shadowSlots.find((s) => s.slotKey === sellerSlot.slotKey);
  const backupFit = slot?.backup?.fit ?? 0;
  return backupFit >= sellerSlot.starter.fit - T.SUCC_READY_GAP;
}

/**
 * Exits pass (doc 20): free registered places and raise cash.
 * Priority: sell-now → sell-high → loan-out → b-team → release (penny releases last).
 */
const EXIT_PRIORITY: Record<string, number> = {
  "sell-now": 0,
  "sell-high": 1,
  "loan-out": 2,
  "b-team": 3,
  release: 4,
};

const EXIT_VERDICTS = new Set<SaleVerdict>(["sell-now", "sell-high", "release", "loan-out", "b-team"]);
const FUNDABLE_VERDICTS = new Set<SaleVerdict>(["sell-now", "sell-high", "release"]);
const PLACE_ONLY_VERDICTS = new Set<SaleVerdict>(["loan-out", "b-team"]);

function exitRank(s: SaleRecommendation): number {
  const base = EXIT_PRIORITY[s.verdict] ?? 9;
  // Registration culls (synthesised from "keep") come after genuine board exits.
  const cull = s.reasons.some((r) => r.startsWith("Registration cull")) ? 5 : 0;
  return base + cull;
}

/**
 * Expand the board with registration culls (doc 20): when the squad is over the cap,
 * fringe "keep" players can be sold, loaned, or moved to the B team.
 */
function expandExitPool(
  ctx: AnalysisContext,
  board: readonly SaleRecommendation[],
): SaleRecommendation[] {
  const out: SaleRecommendation[] = board.filter((s) => EXIT_VERDICTS.has(s.verdict));
  const taken = new Set(out.map((s) => s.playerId));
  const keeps = board
    .filter((s) => s.verdict === "keep" && !taken.has(s.playerId))
    .slice()
    .sort((a, b) => {
      const aStart = ctx.starters.has(a.playerId) ? 1 : 0;
      const bStart = ctx.starters.has(b.playerId) ? 1 : 0;
      if (aStart !== bStart) return aStart - bStart;
      return a.xiImpact - b.xiImpact;
    });

  for (const k of keeps) {
    const row = ctx.byId.get(k.playerId);
    if (!row) continue;
    if (ctx.starters.has(k.playerId)) continue;
    const age = row.player.age;
    if (age != null && age <= T.PROSPECT_AGE) {
      out.push({
        ...k,
        verdict: "loan-out",
        reasons: ["Registration cull — develop on loan"],
        urgency: "this-window",
      });
    } else if (age != null && age <= T.B_TEAM_AGE) {
      out.push({
        ...k,
        verdict: "b-team",
        reasons: ["Registration cull — junior side"],
        urgency: "this-window",
      });
    } else {
      const value = row.player.value ?? null;
      // Don't synthesise penny releases — only cull when there is a real fee or no value listed.
      if (value != null && value < T.MIN_FUNDING_SALE) continue;
      out.push({
        ...k,
        verdict: "release",
        priceBand: value != null ? computePriceBand(value, age, true) : k.priceBand,
        reasons: ["Registration cull — frees a place"],
        urgency: "this-window",
      });
    }
  }
  return out;
}

function exitsPass(
  ctx: AnalysisContext,
  allRows: readonly PlayerRow[],
  picks: readonly Candidate[],
  afterFit: number,
  totalCost: number,
  strategyCap: number,
  exitCandidates: readonly SaleRecommendation[],
): { sales: PackageSale[]; loans: PackageLoan[]; income: number; squadAfter: number } | null {
  const prospects = picks.filter((p) => p.kind === "prospect").length;
  const residents = picks.length - prospects;
  const needFree = Math.max(0, ctx.squad.length + residents - ctx.squadCap);
  const needIncome = Math.max(0, totalCost - strategyCap);

  const sorted = exitCandidates
    .slice()
    .sort((a, b) => {
      const pa = exitRank(a);
      const pb = exitRank(b);
      if (pa !== pb) return pa - pb;
      return (b.priceBand?.ask ?? 0) - (a.priceBand?.ask ?? 0);
    });

  const sales: PackageSale[] = [];
  const loans: PackageLoan[] = [];
  let income = 0;
  let freed = 0;
  const taken = new Set<string>();

  for (const s of sorted) {
    if (freed >= needFree && income >= needIncome) break;
    if (taken.has(s.playerId)) continue;

    if (PLACE_ONLY_VERDICTS.has(s.verdict)) {
      if (freed >= needFree) continue;
      const withoutHim = allRows.filter((r) => r.player.id !== s.playerId);
      const check = solveXI(withoutHim, ctx.formation).avgFit;
      if (check < afterFit - 1) continue;
      const row = ctx.byId.get(s.playerId);
      const dest: PackageExitDest = s.verdict === "b-team" ? "b-team" : "loan";
      loans.push({
        playerId: s.playerId,
        playerName: row?.player.name ?? s.playerId,
        reason:
          s.reasons[0] ??
          (dest === "b-team" ? "Moves to the junior side" : "Leaves on loan"),
        destination: dest,
      });
      taken.add(s.playerId);
      freed += 1;
      continue;
    }

    if (!FUNDABLE_VERDICTS.has(s.verdict)) continue;
    const helpsSize = freed < needFree;
    const helpsCash = income < needIncome;
    if (!helpsSize && !helpsCash) continue;

    const fee = s.priceBand?.ask ?? 0;
    // Skip penny sales when funding cash — prefer real sell-high / sell-now fees.
    if (helpsCash && !helpsSize && fee < T.MIN_FUNDING_SALE) continue;
    // Cheap releases only as a last resort for size pressure.
    if (s.verdict === "release" && helpsCash && !helpsSize && fee < T.MIN_FUNDING_SALE * 2) continue;

    const withoutHim = allRows.filter((r) => r.player.id !== s.playerId);
    const check = solveXI(withoutHim, ctx.formation).avgFit;
    if (check < afterFit) continue;
    if (!saleSlotCovered(ctx, allRows, picks, s.playerId)) continue;

    const row = ctx.byId.get(s.playerId);
    sales.push({
      playerId: s.playerId,
      playerName: row?.player.name ?? s.playerId,
      fee,
      verdict: s.verdict,
      consequence: consequenceFor(s, picks, ctx),
    });
    taken.add(s.playerId);
    income += fee;
    freed += 1;
  }

  const squadAfter = ctx.squad.length + residents - sales.length - loans.length;
  if (squadAfter > ctx.squadCap) return null;
  if (totalCost - income > strategyCap) return null;

  return { sales, loans, income, squadAfter };
}

function fundingNoteFromSales(sales: readonly PackageSale[], totalCost: number): string | null {
  if (sales.length === 0) return null;
  const income = sales.reduce((s, x) => s + x.fee, 0);
  const share = Math.min(100, (income / Math.max(1, totalCost)) * 100);
  const names = listNames(sales.map((s) => `${surname(s.playerName)} (${money(s.fee)})`));
  return `Funded by selling ${names} — covers ${pct(share)} of this plan.`;
}

function asProspectPicks(picks: readonly Candidate[], stratId: string): Candidate[] {
  if (stratId !== "prospects") return [...picks];
  return picks.map((p) => ({ ...p, kind: "prospect" as const }));
}

/** Rough sale income available to stretch the assemble cap (doc 20). */
function preIncomeFor(
  ctx: AnalysisContext,
  maxResidents: number,
  exitCandidates: readonly SaleRecommendation[],
): number {
  const needFree = Math.max(0, ctx.squad.length + maxResidents - ctx.squadCap);
  let freed = 0;
  let income = 0;
  let extras = 0;
  const sorted = exitCandidates
    .slice()
    .sort((a, b) => {
      const pa = exitRank(a);
      const pb = exitRank(b);
      if (pa !== pb) return pa - pb;
      return (b.priceBand?.ask ?? 0) - (a.priceBand?.ask ?? 0);
    });
  for (const s of sorted) {
    if (PLACE_ONLY_VERDICTS.has(s.verdict)) {
      if (freed < needFree) freed += 1;
      continue;
    }
    if (!FUNDABLE_VERDICTS.has(s.verdict)) continue;
    const fee = s.priceBand?.ask ?? 0;
    if (fee < T.MIN_FUNDING_SALE && s.verdict === "release") continue;
    if (freed < needFree) {
      income += fee;
      freed += 1;
      continue;
    }
    if (fee < T.MIN_FUNDING_SALE) continue;
    if (extras < 4) {
      income += fee;
      extras += 1;
    }
  }
  return income;
}

function rationaleFor(args: {
  picks: readonly Candidate[];
  beforeFit: number;
  afterFit: number;
  afterVerdict: string;
  totalCost: number;
  cap: number;
  remaining: number;
  depthGain: number;
  displaced: readonly string[];
  fundingNote: string | null;
}): string {
  const names = args.picks.map((p) => surname(p.row.player.name));
  const depthNote = args.depthGain > 0 ? `, second XI +${args.depthGain}` : "";
  const s1 = `Sign ${listNames(names)} for ${money(args.totalCost)} — XI ${args.beforeFit} → ${args.afterFit} (${args.afterVerdict})${depthNote}.`;
  const s2 = `Uses ${pct((args.totalCost / args.cap) * 100)} of the ${money(args.cap)} budget, ${money(args.remaining)} left over.`;
  let s3 = "";
  if (args.displaced.length > 0) {
    s3 = `${listNames([...args.displaced])} drop${args.displaced.length === 1 ? "s" : ""} to the bench.`;
    if (args.fundingNote) s3 += ` ${args.fundingNote}`;
  } else if (args.fundingNote) {
    s3 = args.fundingNote;
  }
  return [s1, s2, s3].filter(Boolean).join(" ");
}

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function shadowAvg(rows: readonly PlayerRow[], excluded: ReadonlySet<string>, ctx: AnalysisContext): number {
  const leftover = rows.filter((r) => !excluded.has(r.player.id));
  return solveXI(leftover, ctx.formation).avgFit;
}

function prospectLoans(picks: readonly Candidate[]): PackageLoan[] {
  return picks
    .filter((p) => p.kind === "prospect")
    .map((p) => ({
      playerId: p.row.player.id,
      playerName: p.row.player.name,
      reason: "Prospect — develops on loan",
      destination: "loan" as const,
    }));
}

export function buildPackages(ctx: AnalysisContext, insightIds: readonly string[] = []): TransferPackage[] {
  if (ctx.shortlist.length === 0) return [];
  const candidates = buildCandidates(ctx);
  if (candidates.length === 0) return [];

  const unused = unusedValueCandidates(ctx);
  const exitCandidates = expandExitPool(ctx, buildSales(ctx));
  const oldStarterNames = new Map(
    [...ctx.xi.assignment.values()].map((a) => [a.id, ctx.byId.get(a.id)?.player.name ?? a.id] as const),
  );
  const oldStarterIds = new Set(oldStarterNames.keys());
  const beforeShadow = shadowAvg(ctx.squad, oldStarterIds, ctx);

  const built: TransferPackage[] = [];

  for (const strat of STRATEGIES) {
    const pool = (strat.filter ? candidates.filter((c) => strat.filter!(c, ctx)) : candidates.slice()).sort(
      (a, b) => strat.cmp(a, b, ctx),
    );

    const strategyCap = Math.round(ctx.budgetCap * strat.capFraction);
    if (strategyCap <= 0) continue;

    const stretch =
      strat.id === "prospects"
        ? 0
        : preIncomeFor(ctx, Math.min(strat.max, T.PKG_MAX_SIGNINGS), exitCandidates);
    const assembleCap = strategyCap + stretch;
    const assembled = assemble(pool, assembleCap, strat);
    if (assembled.picks.length === 0) continue;
    if (strat.spender && assembled.spent < T.PKG_SPEND_FLOOR * strategyCap) continue;

    const picks = asProspectPicks(assembled.picks, strat.id);
    // Prospects do not need XI lift — they are development deals.
    const boughtRows = picks.map((p) => p.row);
    const allRows = [...ctx.squad, ...boughtRows];
    const newXi = solveXI(allRows, ctx.formation);
    const afterFit = newXi.avgFit;
    if (strat.id !== "prospects" && newXi.totalFit <= ctx.xi.totalFit) continue;

    const newStarterIds = new Set([...newXi.assignment.values()].map((a) => a.id));
    const displaced = [...oldStarterIds]
      .filter((id) => !newStarterIds.has(id))
      .map((id) => surname(oldStarterNames.get(id)!));

    const afterShadow = shadowAvg(allRows, newStarterIds, ctx);
    const depthGain = Math.max(0, afterShadow - beforeShadow);

    const totalCost = picks.reduce((s, p) => s + (p.cost ?? 0), 0);
    const afterVerdict = verdictOf(afterFit);
    const exits = exitsPass(ctx, allRows, picks, afterFit, totalCost, strategyCap, exitCandidates);
    if (!exits) continue;

    const { sales: pkgSales, loans: squadLoans, income, squadAfter } = exits;
    const netSpend = totalCost - income;
    const remaining = strategyCap - netSpend;
    const fundingNote =
      pkgSales.length > 0
        ? fundingNoteFromSales(pkgSales, totalCost)
        : fundingNoteFor(totalCost, strategyCap, unused);
    const solves = insightIds.filter((id) => picks.some((p) => id.endsWith(`:${p.slotKey}`)));

    const newStarterBySlot = new Map<string, string>();
    for (const p of picks) {
      if (p.kind !== "depth" && p.kind !== "prospect") {
        newStarterBySlot.set(p.slotKey, surname(p.row.player.name));
      }
    }

    const allLoans = [...squadLoans, ...prospectLoans(picks)];

    built.push({
      id: strat.id,
      name: strat.name,
      tagline: strat.tagline,
      moves: picks.map((p) => toMove(p, ctx, newStarterBySlot, pkgSales, squadLoans, allRows)),
      totalCost,
      beforeFit: ctx.avgFit,
      afterFit,
      beforeTotalFit: ctx.xi.totalFit,
      afterTotalFit: newXi.totalFit,
      afterVerdict,
      displaced,
      rationale: rationaleFor({
        picks,
        beforeFit: ctx.avgFit,
        afterFit,
        afterVerdict,
        totalCost,
        cap: strategyCap,
        remaining,
        depthGain,
        displaced,
        fundingNote,
      }),
      capUsed: strategyCap > 0 ? Math.min(1, Math.max(0, netSpend) / strategyCap) : 0,
      remaining,
      depthGain,
      fundingNote,
      solves,
      sales: pkgSales,
      loans: allLoans,
      income,
      netSpend,
      xiDiff: buildXiDiff(ctx, allRows, newXi),
      windowSummary: windowSummaryFor(ctx, picks, pkgSales, squadLoans, income),
      squadAfter,
    });
  }

  const churn = buildChurnPackage(ctx, candidates, exitCandidates);
  if (churn) built.push(churn);

  built.sort((a, b) => b.afterFit - a.afterFit || b.depthGain - a.depthGain || a.totalCost - b.totalCost);
  const accepted: TransferPackage[] = [];
  const acceptedSets: Set<string>[] = [];
  for (const pkg of built) {
    const players = new Set(pkg.moves.map((m) => m.playerId));
    if (acceptedSets.some((s) => jaccard(players, s) > T.PKG_MAX_OVERLAP)) continue;
    accepted.push(pkg);
    acceptedSets.push(players);
  }
  return accepted;
}

/**
 * Churn — the self-funding strategy (doc 13 §7.3 / doc 20): spend only what sales raise.
 */
function buildChurnPackage(
  ctx: AnalysisContext,
  candidates: readonly Candidate[],
  exitCandidates: readonly SaleRecommendation[],
): TransferPackage | null {
  const fundable = exitCandidates.filter((s) => FUNDABLE_VERDICTS.has(s.verdict) && s.priceBand != null);
  const availableFunds = fundable.reduce((s, x) => s + (x.priceBand?.ask ?? 0), 0);
  if (availableFunds <= 0) return null;

  const strat: Strategy = {
    id: "churn",
    name: "Self-funding rebuild",
    tagline: "Improves the XI and the bank balance at the same time",
    max: T.PKG_MAX_SIGNINGS,
    capFraction: 1,
    spender: true,
    cmp: byFitThenCostDesc,
  };
  const churnCap = ctx.budgetCap > 0 ? Math.min(availableFunds, ctx.budgetCap) : availableFunds;
  const pool = candidates.slice().sort((a, b) => strat.cmp(a, b, ctx));
  const { picks: rawPicks } = assemble(pool, Math.round(churnCap), strat);
  if (rawPicks.length === 0) return null;
  const picks = rawPicks;

  const boughtRows = picks.map((p) => p.row);
  const allRows = [...ctx.squad, ...boughtRows];
  const newXi = solveXI(allRows, ctx.formation);
  const afterFit = newXi.avgFit;
  if (newXi.totalFit <= ctx.xi.totalFit) return null;

  const totalCost = picks.reduce((s, p) => s + (p.cost ?? 0), 0);
  // Churn: strategy cap is 0 cash from budget — everything from sales.
  const exits = exitsPass(ctx, allRows, picks, afterFit, totalCost, 0, exitCandidates);
  if (!exits || exits.sales.length === 0) return null;
  const { sales: pkgSales, loans: squadLoans, income, squadAfter } = exits;
  const netSpend = totalCost - income;
  if (netSpend > 0) return null;

  const newStarterBySlot = new Map<string, string>();
  for (const p of picks) {
    if (p.kind !== "depth") newStarterBySlot.set(p.slotKey, surname(p.row.player.name));
  }
  const afterVerdict = verdictOf(afterFit);
  const fundingNote = fundingNoteFromSales(pkgSales, totalCost);
  const remaining = Math.max(0, income - totalCost);
  const rationale = [
    `Sell ${listNames(pkgSales.map((s) => surname(s.playerName)))} for ${money(income)}.`,
    `Sign ${listNames(picks.map((p) => surname(p.row.player.name)))} for ${money(totalCost)} — XI ${ctx.avgFit} → ${afterFit} (${afterVerdict}).`,
    `Net ${money(-netSpend)} banked after the window.`,
  ].join(" ");

  return {
    id: strat.id,
    name: strat.name,
    tagline: strat.tagline,
    moves: picks.map((p) => toMove(p, ctx, newStarterBySlot, pkgSales, squadLoans, allRows)),
    totalCost,
    beforeFit: ctx.avgFit,
    afterFit,
    beforeTotalFit: ctx.xi.totalFit,
    afterTotalFit: newXi.totalFit,
    afterVerdict,
    displaced: [],
    rationale,
    capUsed: income > 0 ? totalCost / income : 0,
    remaining,
    depthGain: 0,
    fundingNote,
    solves: [],
    sales: pkgSales,
    loans: squadLoans,
    income,
    netSpend,
    xiDiff: buildXiDiff(ctx, allRows, newXi),
    windowSummary: windowSummaryFor(ctx, picks, pkgSales, squadLoans, income),
    squadAfter,
  };
}
