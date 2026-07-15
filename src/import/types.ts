import type { Player } from "../domain/player.js";

export type ImportRejectCode = "UNRECOGNIZED_FORMAT" | "INSUFFICIENT_COLUMNS";

export class ImportError extends Error {
  readonly code: ImportRejectCode;
  readonly details?: readonly string[] | undefined;

  constructor(code: ImportRejectCode, message: string, details?: readonly string[]) {
    super(message);
    this.name = "ImportError";
    this.code = code;
    this.details = details;
  }
}

export const IMPORT_ERROR_MESSAGE: Record<ImportRejectCode, string> = {
  UNRECOGNIZED_FORMAT:
    "This file doesn't look like an FM26 player export. Use the FM26 export plugin and upload the CSV or HTML it saves.",
  INSUFFICIENT_COLUMNS:
    "This export is missing required columns — we need a player name, positions, and at least 20 attributes.",
};

export interface ImportReport {
  rowsTotal: number;
  rowsImported: number;
  rowsSkipped: { row: number; reason: string }[];
  unmappedColumns: string[];
  cellIssues: Readonly<Partial<Record<string, number>>>;
  detectedFormat: "csv" | "html";
  maskedAttributeShare: number;
  rowsWithoutPosition: number;
  parserVersion: string;
}

export interface ImportResult {
  players: Player[];
  report: ImportReport;
}
