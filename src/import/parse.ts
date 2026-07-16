/**
 * FM26 export ingest (docs/03-data-import.md). Orchestrates detect → tokenize → normalize.
 */

import { ENGINE_VERSION } from "../domain/engine-version.js";
import type { AttrVector } from "../domain/attr-value.js";
import type { Player } from "../domain/player.js";
import { detectFormat } from "./detect.js";
import {
  coerceAttr,
  coerceDate,
  coerceGrade,
  coerceHeight,
  coerceInfFlags,
  coerceLastFee,
  coerceLoanEnd,
  coerceMoney,
  coercePreferredFoot,
  GK_ATTRS,
  mapHeader,
  normalizeRowCells,
  OUTFIELD_ATTRS,
  parsePositions,
  preferredFoot,
  validateTable,
} from "./normalize.js";
import { parseCsv, type Table } from "./parse-csv.js";
import { parseHtml } from "./parse-html.js";
import {
  IMPORT_ERROR_MESSAGE,
  ImportError,
  type ImportResult,
} from "./types.js";

export { parsePositions } from "./normalize.js";
export { decodeExportText, decodeExportString } from "./decode.js";
export { ImportError, IMPORT_ERROR_MESSAGE, type ImportReport, type ImportResult } from "./types.js";

function tokenize(text: string, format: ReturnType<typeof detectFormat>): Table {
  return format === "html" ? parseHtml(text) : parseCsv(text);
}

function bumpIssue(issues: Record<string, number>, key: string): void {
  issues[key] = (issues[key] ?? 0) + 1;
}

export function parseExport(text: string, idPrefix?: string): ImportResult {
  const detectedFormat = detectFormat(text);
  const table = tokenize(text, detectedFormat);

  if (table.headers.length < 2) {
    throw new ImportError("UNRECOGNIZED_FORMAT", IMPORT_ERROR_MESSAGE.UNRECOGNIZED_FORMAT);
  }

  const targets = table.headers.map((h) => mapHeader(h));
  const unmapped = new Set<string>();
  for (const h of table.headers) {
    if (h.trim() && !mapHeader(h)) unmapped.add(h.trim());
  }

  const validation = validateTable(targets);
  if (!validation.ok) {
    throw new ImportError(
      validation.code,
      IMPORT_ERROR_MESSAGE[validation.code],
      validation.details,
    );
  }

  const players: Player[] = [];
  const rowsSkipped: { row: number; reason: string }[] = [];
  const cellIssues: Record<string, number> = {};
  const seen = new Set<string>();
  let maskedCells = 0;
  let expectedCells = 0;
  let rowsWithoutPosition = 0;

  table.rows.forEach((rawCells, i) => {
    const rowNo = i + 2;
    const { cells, malformed } = normalizeRowCells(rawCells, table.headers.length);
    if (malformed) {
      rowsSkipped.push({ row: rowNo, reason: "MALFORMED_ROW" });
      return;
    }

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
    let footDirect: "Right" | "Left" | "Either" | null = null;
    let scoutGrade: string | null = null;
    let wage: number | null = null;
    let contractExpires: string | null = null;
    let onLoanFrom: string | null = null;
    let loanEnd: string | null = null;
    let lastTransferFee: number | null = null;
    let flags: ReturnType<typeof coerceInfFlags> = [];
    let playStyle: string | null = null;
    const attrs: AttrVector = {};

    targets.forEach((t, col) => {
      if (!t) return;
      const raw = (cells[col] ?? "").trim();
      if (t.kind === "attr") {
        const coerced = coerceAttr(raw);
        attrs[t.id] = coerced.value;
        if (coerced.badValue) bumpIssue(cellIssues, "BAD_ATTRIBUTE_VALUE");
      } else {
        switch (t.field) {
          case "name":
            name = raw || null;
            break;
          case "age": {
            const n = parseInt(raw, 10);
            age = Number.isFinite(n) ? n : null;
            break;
          }
          case "positions":
            if (raw) positionsRaw = raw;
            break;
          case "bestPosition":
            if (raw) bestPositionRaw = raw;
            break;
          case "club":
            club = raw || null;
            break;
          case "nationality":
            nationality = raw || null;
            break;
          case "value":
            value = coerceMoney(raw);
            break;
          case "height":
            heightCm = coerceHeight(raw);
            break;
          case "rightFoot":
            rightFootRaw = raw;
            break;
          case "leftFoot":
            leftFootRaw = raw;
            break;
          case "scoutGrade":
            if (scoutGrade == null) scoutGrade = coerceGrade(raw);
            break;
          case "preferredFoot":
            footDirect = coercePreferredFoot(raw);
            break;
          case "wage":
            wage = coerceMoney(raw);
            break;
          case "contractExpires":
            contractExpires = coerceDate(raw);
            break;
          case "onLoanFrom":
            onLoanFrom = raw && raw !== "-" ? raw : null;
            break;
          case "loanDuration":
            loanEnd = coerceLoanEnd(raw);
            break;
          case "lastTransferFee":
            lastTransferFee = coerceLastFee(raw);
            break;
          case "infFlags":
            flags = coerceInfFlags(raw);
            break;
          case "playStyle":
            playStyle = raw || null;
            break;
        }
      }
    });

    if (!name) {
      rowsSkipped.push({ row: rowNo, reason: "MISSING_NAME" });
      return;
    }

    const positions = parsePositions(positionsRaw || bestPositionRaw);
    const sig = `${(name as string).toLowerCase()}|${age ?? ""}|${positions.join(",")}`;
    if (seen.has(sig)) {
      rowsSkipped.push({ row: rowNo, reason: "DUPLICATE" });
      return;
    }
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
      foot: footDirect ?? preferredFoot(rightFootRaw, leftFootRaw),
      scoutGrade,
      wage,
      contractExpires,
      onLoanFrom,
      loanEnd,
      lastTransferFee,
      flags,
      playStyle,
    });
  });

  return {
    players,
    report: {
      rowsTotal: table.rows.length,
      rowsImported: players.length,
      rowsSkipped,
      unmappedColumns: [...unmapped],
      cellIssues,
      detectedFormat,
      maskedAttributeShare: expectedCells ? maskedCells / expectedCells : 0,
      rowsWithoutPosition,
      parserVersion: ENGINE_VERSION,
    },
  };
}
