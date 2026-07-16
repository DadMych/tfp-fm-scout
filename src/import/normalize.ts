import { ATTRIBUTES, type AttributeId } from "../domain/attributes.js";
import type { AttrValue } from "../domain/attr-value.js";
import type { PlayerFlag } from "../domain/player.js";
import type { PositionSlot, Side, Strata } from "../domain/positions.js";

export type FieldTarget =
  | "name"
  | "age"
  | "positions"
  | "bestPosition"
  | "club"
  | "nationality"
  | "value"
  | "height"
  | "rightFoot"
  | "leftFoot"
  | "preferredFoot"
  | "scoutGrade"
  | "wage"
  | "contractExpires"
  | "onLoanFrom"
  | "loanDuration"
  | "lastTransferFee"
  | "infFlags"
  | "playStyle";

export type HeaderTarget =
  | { kind: "attr"; id: AttributeId }
  | { kind: "field"; field: FieldTarget };

export function norm(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const HEADER_SYNONYMS: Map<string, HeaderTarget> = (() => {
  const m = new Map<string, HeaderTarget>();
  for (const a of ATTRIBUTES) {
    m.set(norm(a.name), { kind: "attr", id: a.id });
    m.set(norm(a.code), { kind: "attr", id: a.id });
    const bare = a.name.replace(/\(.*?\)/g, "").trim();
    if (bare) m.set(norm(bare), { kind: "attr", id: a.id });
  }
  m.set(norm("Penalty Taking"), { kind: "attr", id: "penalties" });
  const fields: Record<FieldTarget, string[]> = {
    name: ["name", "playername", "player"],
    age: ["age"],
    positions: ["position", "positions", "pos", "posrolesduty"],
    bestPosition: ["bestposition"],
    club: ["club", "team"],
    nationality: ["nat", "nationality", "nation", "nationofbirth"],
    value: ["transfervalue", "value"],
    height: ["height"],
    rightFoot: ["rightfoot"],
    leftFoot: ["leftfoot"],
    preferredFoot: ["preferredfoot"],
    scoutGrade: ["recommendation"],
    wage: ["wage", "salary"],
    contractExpires: ["expires", "contractexpires", "contractexpiry"],
    onLoanFrom: ["onloanfrom"],
    loanDuration: ["loanduration"],
    lastTransferFee: ["lasttransferfee", "lastfee"],
    infFlags: ["inf"],
    playStyle: ["style", "playstyle"],
  };
  for (const [field, aliases] of Object.entries(fields) as [FieldTarget, string[]][]) {
    for (const a of aliases) m.set(norm(a), { kind: "field", field });
  }
  return m;
})();

export function mapHeader(header: string): HeaderTarget | null {
  return HEADER_SYNONYMS.get(norm(header)) ?? null;
}

export interface CoerceAttrResult {
  readonly value: AttrValue;
  readonly badValue: boolean;
}

export function coerceAttr(raw: string): CoerceAttrResult {
  const s = raw.trim();
  if (s === "" || s === "-" || s === "–" || s === "—") return { value: null, badValue: false };
  const range = s.match(/^(\d{1,2})\s*[-–—]\s*(\d{1,2})$/);
  if (range) {
    const min = clamp(Number(range[1] ?? ""));
    const max = clamp(Number(range[2] ?? ""));
    return { value: { min: Math.min(min, max), max: Math.max(min, max) }, badValue: false };
  }
  if (/^\d{1,2}$/.test(s)) {
    const v = clamp(Number(s));
    return { value: { min: v, max: v }, badValue: false };
  }
  return { value: null, badValue: true };
}

function clamp(n: number): number {
  return Math.max(1, Math.min(20, n));
}

export function coerceMoney(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const nums: number[] = [];
  for (const m of s.matchAll(/(\d[\d.,]*)\s*([kmb])?/gi)) {
    let numStr = m[1] ?? "";
    if (/,\d{1,2}$/.test(numStr) && !numStr.includes(".")) numStr = numStr.replace(",", ".");
    numStr = numStr.replace(/,/g, "");
    const n = parseFloat(numStr);
    if (!Number.isFinite(n)) continue;
    const suf = (m[2] ?? "").toLowerCase();
    const mult = suf === "k" ? 1e3 : suf === "m" ? 1e6 : suf === "b" ? 1e9 : 1;
    nums.push(n * mult);
  }
  if (nums.length === 0) return null;
  return nums.length >= 2 ? (nums[0]! + nums[1]!) / 2 : nums[0]!;
}

export function coerceHeight(raw: string): number | null {
  const m = raw.match(/(\d{2,3})/);
  return m ? Number(m[1]) : null;
}

/** Parse FM dates like "30/6/2028" or "30/6/26" (day/month/year) into ISO "2028-06-30". */
export function coerceDate(raw: string): string | null {
  const m = raw.trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Loan Duration exports "14/7/25 - 30/6/26" — the spell's end date is what matters. */
export function coerceLoanEnd(raw: string): string | null {
  const s = raw.trim();
  if (!s || s === "-") return null;
  const parts = s.split(/\s+-\s+/);
  return coerceDate(parts[parts.length - 1] ?? "");
}

/**
 * Fees like "(€1)" are loan-deal nominals and "€0" free moves — both carry no
 * information about what the player cost, so they normalize to null.
 */
export function coerceLastFee(raw: string): number | null {
  const fee = coerceMoney(raw);
  if (fee == null || fee <= 1) return null;
  return fee;
}

const INF_FLAG: Record<string, PlayerFlag> = {
  inj: "injured",
  wnt: "wanted",
  loa: "loan-listed",
  trn: "transfer-listed",
};

/** The Inf column packs status codes ("Inj", "Wnt, Loa" …) — keep the ones we understand. */
export function coerceInfFlags(raw: string): PlayerFlag[] {
  const out: PlayerFlag[] = [];
  for (const part of raw.split(/[,\s]+/)) {
    const flag = INF_FLAG[part.trim().toLowerCase()];
    if (flag && !out.includes(flag)) out.push(flag);
  }
  return out;
}

/** "Right-Footed" / "Left-Footed" from the direct Preferred Foot column. */
export function coercePreferredFoot(raw: string): "Right" | "Left" | "Either" | null {
  const s = raw.trim().toLowerCase();
  if (s.startsWith("right")) return "Right";
  if (s.startsWith("left")) return "Left";
  if (s.startsWith("either") || s.startsWith("both")) return "Either";
  return null;
}

export function coerceGrade(raw: string): string | null {
  const s = raw.trim().toUpperCase();
  return /^[ABCD][+-]?$/.test(s) ? s : null;
}

const FOOT_RANK: Record<string, number> = {
  "very weak": 1,
  weak: 2,
  reasonable: 3,
  "fairly strong": 4,
  strong: 5,
  "very strong": 6,
};

export function preferredFoot(
  right: string,
  left: string,
): "Right" | "Left" | "Either" | null {
  const r = FOOT_RANK[right.trim().toLowerCase()] ?? 0;
  const l = FOOT_RANK[left.trim().toLowerCase()] ?? 0;
  if (!r && !l) return null;
  if (Math.abs(r - l) <= 1 && Math.min(r, l) >= 4) return "Either";
  return r >= l ? "Right" : "Left";
}

const STRATA: Record<string, Strata> = {
  D: "D",
  WB: "WB",
  DM: "DM",
  M: "M",
  AM: "AM",
  ST: "ST",
  S: "ST",
  F: "ST",
};

export function parsePositions(raw: string): PositionSlot[] {
  const slots = new Set<PositionSlot>();
  for (const group of raw.split(",")) {
    const g = group.trim();
    if (!g) continue;
    if (/^gk$/i.test(g)) {
      slots.add("GK");
      continue;
    }
    const m = g.match(/^([A-Za-z/]+)\s*(?:\(([RLCrlc]+)\))?$/);
    if (!m || !m[1]) continue;
    const strata = m[1].split("/").map((t) => STRATA[t.toUpperCase()]).filter(Boolean) as Strata[];
    const sides: Side[] = m[2] ? ([...m[2].toUpperCase()] as Side[]) : ["C"];
    for (const st of strata) for (const side of sides) slots.add(`${st}-${side}` as PositionSlot);
  }
  return [...slots];
}

export const OUTFIELD_ATTRS = ATTRIBUTES.filter((a) => a.category !== "goalkeeping").map(
  (a) => a.id,
);
export const GK_ATTRS = ATTRIBUTES.filter(
  (a) => a.category === "goalkeeping" || a.category === "mental" || a.category === "physical",
).map((a) => a.id);

export function normalizeRowCells(
  cells: string[],
  headerLen: number,
): { cells: string[]; malformed: boolean } {
  const diff = cells.length - headerLen;
  if (diff === 0) return { cells, malformed: false };
  if (diff > 0 && diff <= 2) return { cells: cells.slice(0, headerLen), malformed: false };
  if (diff < 0 && diff >= -2) {
    return { cells: [...cells, ...Array(-diff).fill("")], malformed: false };
  }
  return { cells, malformed: true };
}

export function validateTable(targets: readonly (HeaderTarget | null)[]): {
  readonly ok: true;
} | {
  readonly ok: false;
  readonly code: "UNRECOGNIZED_FORMAT" | "INSUFFICIENT_COLUMNS";
  readonly details: string[];
} {
  const recognized = targets.filter((t): t is HeaderTarget => t != null);
  if (recognized.length === 0) {
    return { ok: false, code: "UNRECOGNIZED_FORMAT", details: [] };
  }

  const hasName = recognized.some((t) => t.kind === "field" && t.field === "name");
  const hasPositions = recognized.some(
    (t) => t.kind === "field" && (t.field === "positions" || t.field === "bestPosition"),
  );
  const attrCount = new Set(
    recognized.filter((t) => t.kind === "attr").map((t) => t.id),
  ).size;

  const missing: string[] = [];
  if (!hasName) missing.push("name");
  if (!hasPositions) missing.push("positions");
  if (attrCount < 20) missing.push(`attributes (found ${attrCount}, need 20)`);

  if (missing.length > 0) {
    return { ok: false, code: "INSUFFICIENT_COLUMNS", details: missing };
  }

  return { ok: true };
}
