/**
 * Shared formatting for the report renderers (docs/09-ui-ux.md).
 *
 * Pure string helpers used by both the Ledger (broadsheet) and the Dossier so the two
 * screens speak the same visual language: metric labels, money, height, foot, ordinals.
 */

import { ATTRIBUTES } from "../domain/attributes.js";

const ATTR_LABEL = new Map<string, string>(ATTRIBUTES.map((a) => [a.id, a.name]));

const DERIVED_LABEL: Record<string, string> = {
  speed: "Speed",
  workEngine: "Work engine",
  aerial: "Aerial",
  pressResist: "Press-resistance",
  creativity: "Creativity",
  defActivity: "Defensive activity",
  defPosition: "Defensive positioning",
  finishingPkg: "Finishing",
  mobility: "Mobility",
  physicality: "Physicality",
};

export function metricLabel(id: string): string {
  return DERIVED_LABEL[id] ?? ATTR_LABEL.get(id) ?? id;
}

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  const suffix = s[(v - 20) % 10] ?? s[v] ?? "th";
  return `${n}${suffix}`;
}

/**
 * Compact transfer value. The export drops the currency symbol during parsing; FM26 exports
 * in the save's currency (euros for the sampled DB), so we prefix "€" and note the assumption.
 */
export function formatMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `€${trim(value / 1e9)}B`;
  if (abs >= 1e6) return `€${trim(value / 1e6)}M`;
  if (abs >= 1e3) return `€${Math.round(value / 1e3)}K`;
  return `€${Math.round(value)}`;
}

/** One decimal below 10 (so €8.5M reads precisely), whole numbers above. */
function trim(n: number): string {
  return Math.abs(n) < 10 ? String(Math.round(n * 10) / 10) : String(Math.round(n));
}

export function formatHeight(cm: number | null | undefined): string {
  return cm != null && Number.isFinite(cm) ? `${Math.round(cm)} cm` : "—";
}

export function footLabel(foot: "Right" | "Left" | "Either" | null | undefined): string {
  if (!foot) return "—";
  if (foot === "Either") return "Both feet";
  return `${foot} foot`;
}

/** Numeric rank for an FM letter grade (A+ = 12 … D- = 1); 0 when absent/invalid. Sort desc. */
export function scoutGradeRank(grade: string | null | undefined): number {
  if (!grade) return 0;
  const m = /^([ABCD])([+-]?)$/.exec(grade.trim().toUpperCase());
  if (!m) return 0;
  const base = { A: 10, B: 7, C: 4, D: 1 }[m[1] as "A" | "B" | "C" | "D"];
  const adj = m[2] === "+" ? 2 : m[2] === "-" ? 0 : 1;
  return base + adj;
}
