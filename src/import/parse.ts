/**
 * Minimal FM26 export ingest (docs/03-data-import.md).
 *
 * Accepts the CSV or HTML file produced by "FM26 Player Export by vinteset" (or our
 * sample template) and turns it into scoreable `Player[]`. This is the MVP of the M1
 * import module: enough to run real exports through the engine from the CLI. It is not
 * yet the full streaming/save-series implementation described in doc 03 §7–§9.
 */

import { ATTRIBUTES, type AttributeId } from "../domain/attributes.js";
import type { AttrVector, AttrValue } from "../domain/attr-value.js";
import type { PositionSlot, Side, Strata } from "../domain/positions.js";
import type { Player } from "../domain/player.js";

export interface ImportReport {
  rowsTotal: number;
  rowsImported: number;
  rowsSkipped: { row: number; reason: string }[];
  unmappedColumns: string[];
  detectedFormat: "csv" | "html";
  /** Share of expected outfield/GK attribute cells that were masked or missing. */
  maskedAttributeShare: number;
  /** Imported players for whom no position slot could be parsed (scored position-agnostically). */
  rowsWithoutPosition: number;
}

export interface ImportResult {
  players: Player[];
  report: ImportReport;
}

// ---------------------------------------------------------------------------
// Header synonyms — generated from the attribute registry (doc 03 §5).
// ---------------------------------------------------------------------------

type FieldTarget =
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
  | "scoutGrade";
type HeaderTarget =
  | { kind: "attr"; id: AttributeId }
  | { kind: "field"; field: FieldTarget };

function norm(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const HEADER_SYNONYMS: Map<string, HeaderTarget> = (() => {
  const m = new Map<string, HeaderTarget>();
  for (const a of ATTRIBUTES) {
    m.set(norm(a.name), { kind: "attr", id: a.id });
    m.set(norm(a.code), { kind: "attr", id: a.id });
    // FM export headers drop the parenthetical qualifier the registry keeps, e.g.
    // registry "Punching (Tendency)" is exported as just "Punching".
    const bare = a.name.replace(/\(.*?\)/g, "").trim();
    if (bare) m.set(norm(bare), { kind: "attr", id: a.id });
  }
  const fields: Record<FieldTarget, string[]> = {
    name: ["name", "playername", "player"],
    age: ["age"],
    // "position" is the full playable list; "bestposition" is a single-slot fallback used
    // only when the full list is absent (see assembly below).
    positions: ["position", "positions", "pos", "posrolesduty"],
    bestPosition: ["bestposition"],
    club: ["club", "team"],
    nationality: ["nat", "nationality", "nation", "nationofbirth"],
    value: ["transfervalue", "value"],
    height: ["height"],
    rightFoot: ["rightfoot"],
    leftFoot: ["leftfoot"],
    scoutGrade: ["recommendation"],
  };
  for (const [field, aliases] of Object.entries(fields) as [FieldTarget, string[]][]) {
    for (const a of aliases) m.set(norm(a), { kind: "field", field });
  }
  return m;
})();

// ---------------------------------------------------------------------------
// Value coercion (doc 03 §6).
// ---------------------------------------------------------------------------

function coerceAttr(raw: string): AttrValue {
  const s = raw.trim();
  if (s === "" || s === "-" || s === "–" || s === "—") return null;
  const range = s.match(/^(\d{1,2})\s*[-–—]\s*(\d{1,2})$/);
  if (range) {
    const min = clamp(Number(range[1] ?? ""));
    const max = clamp(Number(range[2] ?? ""));
    return { min: Math.min(min, max), max: Math.max(min, max) };
  }
  if (/^\d{1,2}$/.test(s)) {
    const v = clamp(Number(s));
    return { min: v, max: v };
  }
  return null; // BAD_ATTRIBUTE_VALUE — treated as masked
}

function clamp(n: number): number {
  return Math.max(1, Math.min(20, n));
}

/** Parse an FM transfer value ("€56M - €82M", "€75M", "€500K") to a currency midpoint. */
function coerceMoney(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const nums: number[] = [];
  for (const m of s.matchAll(/(\d[\d.,]*)\s*([kmb])?/gi)) {
    let numStr = m[1] ?? "";
    // "8,2M" (comma decimal) vs "1,200" (thousands): a trailing 1–2 digit comma group is decimal.
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

function coerceHeight(raw: string): number | null {
  const m = raw.match(/(\d{2,3})/);
  return m ? Number(m[1]) : null;
}

/** FM letter grade (A+ … D-). Rejects status strings like "Unknown"/"Scouting Required". */
function coerceGrade(raw: string): string | null {
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

/** Preferred foot from the two strength ratings: strongest wins, "Either" when both are high. */
function preferredFoot(right: string, left: string): "Right" | "Left" | "Either" | null {
  const r = FOOT_RANK[right.trim().toLowerCase()] ?? 0;
  const l = FOOT_RANK[left.trim().toLowerCase()] ?? 0;
  if (!r && !l) return null;
  if (Math.abs(r - l) <= 1 && Math.min(r, l) >= 4) return "Either";
  return r >= l ? "Right" : "Left";
}

const STRATA: Record<string, Strata> = {
  D: "D", WB: "WB", DM: "DM", M: "M", AM: "AM", ST: "ST", S: "ST", F: "ST",
};

/** Parse an FM position string into canonical slots (doc 03 §6.2). */
export function parsePositions(raw: string): PositionSlot[] {
  const slots = new Set<PositionSlot>();
  for (const group of raw.split(",")) {
    const g = group.trim();
    if (!g) continue;
    if (/^gk$/i.test(g)) { slots.add("GK"); continue; }
    const m = g.match(/^([A-Za-z/]+)\s*(?:\(([RLCrlc]+)\))?$/);
    if (!m || !m[1]) continue;
    const strata = m[1].split("/").map((t) => STRATA[t.toUpperCase()]).filter(Boolean) as Strata[];
    const sides: Side[] = m[2]
      ? ([...m[2].toUpperCase()] as Side[])
      : ["C"]; // no parens → central
    for (const st of strata) for (const side of sides) slots.add(`${st}-${side}` as PositionSlot);
  }
  return [...slots];
}

// ---------------------------------------------------------------------------
// Format detection + tokenizing.
// ---------------------------------------------------------------------------

type Table = { headers: string[]; rows: string[][] };

function detectFormat(text: string): "csv" | "html" {
  return /<table/i.test(text.slice(0, 4096)) ? "html" : "csv";
}

function parseCsv(text: string): Table {
  const lines = splitCsvLines(text);
  const first = lines[0];
  if (first === undefined) return { headers: [], rows: [] };
  const delim = detectDelimiter(first);
  const headers = splitCsvRow(first, delim);
  const rows = lines.slice(1).filter((l) => l.trim() !== "").map((l) => splitCsvRow(l, delim));
  return { headers, rows };
}

function detectDelimiter(line: string): string {
  const counts: [string, number][] = [
    [",", (line.match(/,/g) ?? []).length],
    [";", (line.match(/;/g) ?? []).length],
    ["\t", (line.match(/\t/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  const best = counts[0];
  return best && best[1] > 0 ? best[0] : ",";
}

/** Split into logical CSV lines, respecting quoted newlines. */
function splitCsvLines(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') inQuotes = !inQuotes;
    if ((c === "\n" || c === "\r") && !inQuotes) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  if (cur !== "") out.push(cur);
  return out;
}

function splitCsvRow(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === delim && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseHtml(text: string): Table {
  const tableMatch = text.match(/<table[\s\S]*?<\/table>/i);
  const table = tableMatch ? tableMatch[0] : text;
  const rows: string[][] = [];
  const trRe = /<tr[\s\S]*?<\/tr>/gi;
  let tr: RegExpExecArray | null;
  while ((tr = trRe.exec(table)) !== null) {
    const cellRe = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
    const cells: string[] = [];
    let cell: RegExpExecArray | null;
    while ((cell = cellRe.exec(tr[0])) !== null) cells.push(decodeHtml(stripTags(cell[1] ?? "")));
    if (cells.length) rows.push(cells);
  }
  const header = rows[0];
  if (header === undefined) return { headers: [], rows: [] };
  return { headers: header, rows: rows.slice(1) };
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

// ---------------------------------------------------------------------------
// Assembly.
// ---------------------------------------------------------------------------

const OUTFIELD_ATTRS = ATTRIBUTES.filter((a) => a.category !== "goalkeeping").map((a) => a.id);
const GK_ATTRS = ATTRIBUTES.filter(
  (a) => a.category === "goalkeeping" || a.category === "mental" || a.category === "physical",
).map((a) => a.id);

export function parseExport(text: string, idPrefix?: string): ImportResult {
  const detectedFormat = detectFormat(text);
  const table = detectedFormat === "html" ? parseHtml(text) : parseCsv(text);

  const targets: (HeaderTarget | null)[] = [];
  const unmapped = new Set<string>();
  for (const h of table.headers) {
    const t = HEADER_SYNONYMS.get(norm(h)) ?? null;
    targets.push(t);
    if (!t && h.trim()) unmapped.add(h.trim());
  }

  const players: Player[] = [];
  const rowsSkipped: { row: number; reason: string }[] = [];
  // Virtualised FM lists re-emit the same row at different scroll offsets, so an export can
  // contain the same player twice. Collapse exact identity matches (doc 03 dedup).
  const seen = new Set<string>();
  let maskedCells = 0;
  let expectedCells = 0;
  let rowsWithoutPosition = 0;

  table.rows.forEach((cells, i) => {
    const rowNo = i + 2; // 1-based, +1 for header
    let name: string | null = null;
    let age: number | null = null;
    let positionsRaw = "";
    let bestPositionRaw = "";
    let club: string | null = null;
    let nationality: string | null = null;
    let value: number | null = null;
    let heightCm: number | null = null;
    let rightFootRaw = "";
    let leftFootRaw = "";
    let scoutGrade: string | null = null;
    const attrs: AttrVector = {};

    targets.forEach((t, col) => {
      if (!t) return;
      const raw = (cells[col] ?? "").trim();
      if (t.kind === "attr") {
        attrs[t.id] = coerceAttr(raw);
      } else {
        switch (t.field) {
          case "name": name = raw || null; break;
          case "age": { const n = parseInt(raw, 10); age = Number.isFinite(n) ? n : null; break; }
          case "positions": if (raw) positionsRaw = raw; break;
          case "bestPosition": if (raw) bestPositionRaw = raw; break;
          case "club": club = raw || null; break;
          case "nationality": nationality = raw || null; break;
          case "value": value = coerceMoney(raw); break;
          case "height": heightCm = coerceHeight(raw); break;
          case "rightFoot": rightFootRaw = raw; break;
          case "leftFoot": leftFootRaw = raw; break;
          // Two "Recommendation" columns can appear; keep the first valid grade.
          case "scoutGrade": if (scoutGrade == null) scoutGrade = coerceGrade(raw); break;
        }
      }
    });

    if (!name) { rowsSkipped.push({ row: rowNo, reason: "MISSING_NAME" }); return; }
    // Position is optional: a player without a parseable slot is still imported (scoring
    // falls back to a position-agnostic view) rather than dropped. Prefer the full playable
    // list; use the single-slot "Best Position" only when the full list is absent.
    const positions = parsePositions(positionsRaw || bestPositionRaw);

    // Identity signature guards against duplicate scrapes. Club/nationality are excluded: a
    // partially-rendered virtualised row can emit the same player with those cells still blank
    // (name/age/positions come from stable cells). Two real players sharing all three is
    // vanishingly unlikely, so this dedups artifacts without merging distinct namesakes.
    const sig = `${(name as string).toLowerCase()}|${age ?? ""}|${positions.join(",")}`;
    if (seen.has(sig)) { rowsSkipped.push({ row: rowNo, reason: "DUPLICATE" }); return; }
    seen.add(sig);

    if (positions.length === 0) rowsWithoutPosition += 1;

    const isGk = positions.includes("GK");
    const expected = isGk ? GK_ATTRS : OUTFIELD_ATTRS;
    for (const id of expected) {
      expectedCells++;
      if (attrs[id] == null) maskedCells++;
    }

    players.push({
      id: idPrefix ? `${idPrefix}-${rowNo}` : String(rowNo),
      name,
      age,
      positions,
      attrs,
      club,
      nationality,
      value,
      heightCm,
      foot: preferredFoot(rightFootRaw, leftFootRaw),
      scoutGrade,
    });
  });

  return {
    players,
    report: {
      rowsTotal: table.rows.length,
      rowsImported: players.length,
      rowsSkipped,
      unmappedColumns: [...unmapped],
      detectedFormat,
      maskedAttributeShare: expectedCells ? maskedCells / expectedCells : 0,
      rowsWithoutPosition,
    },
  };
}
