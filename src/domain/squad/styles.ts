/**
 * Playing-style catalogue (doc 21). Each style scores how ready the current XI is,
 * carries formation affinities, and supplies a scout template for the desk.
 */

import type { GeneralFamily } from "../archetypes/registry.js";
import { getArchetype } from "../archetypes/registry.js";
import type { DerivedId } from "../derived.js";
import type { PositionGroup } from "../positions.js";
import type { AnalysisContext } from "../assistant/context.js";
import type { PlayerRow } from "../assistant/xi.js";

export type StyleId =
  | "tiki-taka"
  | "gegenpress"
  | "counter"
  | "direct"
  | "wing-play"
  | "low-block";

export interface StyleMetricReq {
  readonly metric: DerivedId;
  readonly min: number;
  readonly weight: number;
}

export interface StyleFamilyReq {
  readonly families: readonly GeneralFamily[];
  readonly minCount: number;
  readonly weight: number;
}

export interface StyleScoutTemplate {
  /** Derived metrics a scout should look for (desk filters on group percentiles ≥ 60). */
  readonly metrics: readonly DerivedId[];
  readonly groups: readonly PositionGroup[];
}

export interface PlayingStyle {
  readonly id: StyleId;
  readonly name: string;
  readonly blurb: string;
  readonly metrics: readonly StyleMetricReq[];
  readonly families: readonly StyleFamilyReq[];
  /** Formation id → affinity 0–1 (multiplies suitability). */
  readonly formationAffinity: Readonly<Record<string, number>>;
  readonly scout: StyleScoutTemplate;
}

export interface StyleEvidence {
  readonly label: string;
  readonly value: string;
  readonly ok: boolean;
}

export interface StyleSuitability {
  readonly style: PlayingStyle;
  readonly score: number;
  readonly evidence: readonly StyleEvidence[];
  readonly missing: readonly string[];
}

export const PLAYING_STYLES: readonly PlayingStyle[] = [
  {
    id: "tiki-taka",
    name: "Tiki-taka",
    blurb: "Short combinations, press-resistant midfield, patience in possession.",
    metrics: [
      { metric: "pressResist", min: 13, weight: 1.2 },
      { metric: "creativity", min: 13, weight: 1.2 },
      { metric: "mobility", min: 12, weight: 0.8 },
    ],
    families: [{ families: ["Progressor", "Creator"], minCount: 5, weight: 1.4 }],
    formationAffinity: { "4-3-3": 1, "4-2-3-1": 0.95, "3-5-2": 0.75, "4-4-2": 0.55 },
    scout: { metrics: ["pressResist", "creativity", "mobility"], groups: ["DM/CM", "AM/W"] },
  },
  {
    id: "gegenpress",
    name: "Gegenpress",
    blurb: "Front-foot press as a unit — win it high, go again.",
    metrics: [
      { metric: "workEngine", min: 13.5, weight: 1.4 },
      { metric: "speed", min: 13, weight: 1 },
      { metric: "defActivity", min: 12, weight: 0.8 },
    ],
    families: [{ families: ["Destroyer", "Engine"], minCount: 4, weight: 1.3 }],
    formationAffinity: { "4-3-3": 1, "4-2-3-1": 0.9, "3-5-2": 0.85, "4-4-2": 0.7 },
    scout: { metrics: ["workEngine", "speed", "defActivity"], groups: ["DM/CM", "AM/W", "ST"] },
  },
  {
    id: "counter",
    name: "Transition / counter",
    blurb: "Absorb, then explode into space with runners and vertical carriers.",
    metrics: [
      { metric: "speed", min: 14, weight: 1.4 },
      { metric: "workEngine", min: 12, weight: 0.8 },
      { metric: "finishingPkg", min: 12, weight: 0.9 },
    ],
    families: [{ families: ["Runner", "Engine", "Carrier"], minCount: 4, weight: 1.3 }],
    formationAffinity: { "4-4-2": 1, "4-2-3-1": 0.9, "3-5-2": 0.85, "4-3-3": 0.75 },
    scout: { metrics: ["speed", "finishingPkg", "workEngine"], groups: ["AM/W", "ST", "FB/WB"] },
  },
  {
    id: "direct",
    name: "Direct / target",
    blurb: "Early balls into a focal point who wins the first header.",
    metrics: [
      { metric: "aerial", min: 13, weight: 1.4 },
      { metric: "physicality", min: 13, weight: 1 },
      { metric: "finishingPkg", min: 12, weight: 0.8 },
    ],
    families: [
      { families: ["Focal Point"], minCount: 1, weight: 1.5 },
      { families: ["Finisher"], minCount: 1, weight: 0.8 },
    ],
    formationAffinity: { "4-4-2": 1, "3-5-2": 0.95, "4-2-3-1": 0.7, "4-3-3": 0.55 },
    scout: { metrics: ["aerial", "physicality", "finishingPkg"], groups: ["ST"] },
  },
  {
    id: "wing-play",
    name: "Wing play",
    blurb: "Stretch the pitch, overlap the full-backs, deliver from the touchline.",
    metrics: [
      { metric: "speed", min: 13, weight: 1.2 },
      { metric: "creativity", min: 12, weight: 0.9 },
      { metric: "mobility", min: 12, weight: 0.8 },
    ],
    families: [{ families: ["Runner", "Creator", "Carrier"], minCount: 4, weight: 1.2 }],
    formationAffinity: { "4-3-3": 1, "4-2-3-1": 0.95, "3-5-2": 0.9, "4-4-2": 0.8 },
    scout: { metrics: ["speed", "creativity", "mobility"], groups: ["AM/W", "FB/WB"] },
  },
  {
    id: "low-block",
    name: "Low block",
    blurb: "Compact shape, deny space in behind, break when they overcommit.",
    metrics: [
      { metric: "defPosition", min: 13, weight: 1.4 },
      { metric: "defActivity", min: 12, weight: 1 },
      { metric: "physicality", min: 12, weight: 0.8 },
    ],
    families: [{ families: ["Destroyer", "General"], minCount: 4, weight: 1.2 }],
    formationAffinity: { "4-4-2": 1, "4-2-3-1": 0.8, "5-3-2": 0.9, "3-5-2": 0.85, "4-3-3": 0.55 },
    scout: { metrics: ["defPosition", "defActivity", "physicality"], groups: ["CB", "DM/CM"] },
  },
];

const BY_ID = new Map(PLAYING_STYLES.map((s) => [s.id, s]));

export function getPlayingStyle(id: StyleId): PlayingStyle {
  const s = BY_ID.get(id);
  if (!s) throw new Error(`Unknown style: ${id}`);
  return s;
}

export function isStyleId(v: string): v is StyleId {
  return BY_ID.has(v as StyleId);
}

function startersOf(ctx: AnalysisContext): PlayerRow[] {
  return ctx.squad.filter((r) => ctx.starters.has(r.player.id));
}

function median(nums: readonly number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function familyCount(xi: readonly PlayerRow[], families: readonly GeneralFamily[]): number {
  let n = 0;
  for (const r of xi) {
    if (!r.scores.topArchetype) continue;
    const fam = getArchetype(r.scores.topArchetype.id).family;
    if (families.includes(fam)) n += 1;
  }
  return n;
}

function metricScore(have: number | null, min: number): number {
  if (have == null) return 40;
  if (have >= min) return Math.min(100, 70 + (have - min) * 8);
  return Math.max(0, 70 * (have / min));
}

/** How ready the current XI is to play this style in the active formation (0–100). */
export function styleSuitability(ctx: AnalysisContext, style: PlayingStyle): StyleSuitability {
  const xi = startersOf(ctx);
  const evidence: StyleEvidence[] = [];
  const missing: string[] = [];
  let weighted = 0;
  let weightSum = 0;

  for (const req of style.metrics) {
    const values = xi
      .map((r) => r.scores.derived[req.metric])
      .filter((v): v is number => v != null);
    const med = median(values);
    const part = metricScore(med, req.min);
    weighted += part * req.weight;
    weightSum += req.weight;
    const ok = med != null && med >= req.min;
    evidence.push({
      label: req.metric,
      value: med == null ? "—" : med.toFixed(1),
      ok,
    });
    if (!ok) missing.push(`${req.metric} (need ≥${req.min})`);
  }

  for (const req of style.families) {
    const have = familyCount(xi, req.families);
    const part = have >= req.minCount ? Math.min(100, 70 + (have - req.minCount) * 10) : (have / req.minCount) * 70;
    weighted += part * req.weight;
    weightSum += req.weight;
    const ok = have >= req.minCount;
    evidence.push({
      label: req.families.join("+"),
      value: `${have}/${req.minCount}`,
      ok,
    });
    if (!ok) missing.push(`${req.families.join("/")} count (need ≥${req.minCount})`);
  }

  const base = weightSum > 0 ? weighted / weightSum : 0;
  const affinity = style.formationAffinity[ctx.formation.id] ?? 0.7;
  const score = Math.round(Math.max(0, Math.min(100, base * affinity)));

  return { style, score, evidence, missing };
}

export function rankStyles(ctx: AnalysisContext): StyleSuitability[] {
  return PLAYING_STYLES.map((s) => styleSuitability(ctx, s)).sort(
    (a, b) => b.score - a.score || a.style.name.localeCompare(b.style.name),
  );
}

/** Player matches a style scout template if average key-metric group percentile ≥ 60. */
export function playerMatchesStyle(
  scores: { readonly percentiles: Readonly<Partial<Record<string, number | null>>> },
  styleId: StyleId,
): boolean {
  const style = getPlayingStyle(styleId);
  const pcts: number[] = [];
  for (const m of style.scout.metrics) {
    const p = scores.percentiles[m];
    if (p != null) pcts.push(p);
  }
  if (pcts.length === 0) return false;
  const avg = pcts.reduce((s, v) => s + v, 0) / pcts.length;
  return avg >= 60;
}
