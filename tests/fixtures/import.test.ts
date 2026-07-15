import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ENGINE_VERSION } from "../../src/domain/engine-version.js";
import { parseExport, ImportError } from "../../src/import/parse.js";
import type { ImportResult } from "../../src/import/types.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), ".");

function load(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf8");
}

function snapshot(result: ImportResult) {
  return {
    playerNames: result.players.map((p) => p.name),
    playerCount: result.players.length,
    report: {
      rowsTotal: result.report.rowsTotal,
      rowsImported: result.report.rowsImported,
      rowsSkipped: result.report.rowsSkipped,
      cellIssues: result.report.cellIssues,
      detectedFormat: result.report.detectedFormat,
      rowsWithoutPosition: result.report.rowsWithoutPosition,
      parserVersion: result.report.parserVersion,
    },
  };
}

describe("import fixtures (doc 03 §9)", () => {
  it("parses squad-small.html", () => {
    const result = parseExport(load("squad-small.html"));
    expect(snapshot(result)).toEqual({
      playerNames: ["Alpha One", "Bravo Two", "Charlie Keeper"],
      playerCount: 3,
      report: {
        rowsTotal: 3,
        rowsImported: 3,
        rowsSkipped: [],
        cellIssues: {},
        detectedFormat: "html",
        rowsWithoutPosition: 0,
        parserVersion: ENGINE_VERSION,
      },
    });
    expect(result.players[0]!.positions).toEqual(["DM-C", "M-C"]);
    expect(result.players[1]!.value).toBe(6.5e6);
    expect(result.report.rowsTotal).toBe(
      result.report.rowsImported + result.report.rowsSkipped.length,
    );
  });

  it("parses squad.csv (semicolon twin)", () => {
    const result = parseExport(load("squad.csv"));
    expect(result.report.detectedFormat).toBe("csv");
    expect(result.players.map((p) => p.name)).toEqual(["Alpha One", "Bravo Two", "Charlie Keeper"]);
    expect(result.players[0]!.positions).toEqual(["DM-C", "M-C"]);
    expect(result.players[1]!.value).toBe(6.5e6);
  });

  it("parses search-masked.html with ranges and masked cells", () => {
    const result = parseExport(load("search-masked.html"));
    expect(result.players).toHaveLength(1);
    expect(result.players[0]!.attrs.acceleration).toEqual({ min: 10, max: 14 });
    expect(result.players[0]!.attrs.agility).toBeNull();
    expect(result.report.maskedAttributeShare).toBeGreaterThan(0);
  });

  it("parses hostile.html with entities, bad values, and row quirks", () => {
    const result = parseExport(load("hostile.html"));
    expect(result.players.find((p) => p.name === "O'Neill")).toBeTruthy();
    expect(result.players.find((p) => p.name === "Script Tag")!.positions).toEqual([]);
    expect(result.report.rowsWithoutPosition).toBeGreaterThanOrEqual(1);
    expect(result.report.cellIssues.BAD_ATTRIBUTE_VALUE).toBeGreaterThanOrEqual(1);
    expect(result.report.rowsSkipped.some((s) => s.reason === "MALFORMED_ROW")).toBe(true);
    expect(result.players.find((p) => p.name === "Short Row")).toBeUndefined();
    expect(result.players.find((p) => p.name === "Wide Row")).toBeTruthy();
  });

  it("rejects not-an-export.html with UNRECOGNIZED_FORMAT", () => {
    expect(() => parseExport(load("not-an-export.html"))).toThrow(ImportError);
    try {
      parseExport(load("not-an-export.html"));
    } catch (e) {
      expect(e).toBeInstanceOf(ImportError);
      expect((e as ImportError).code).toBe("UNRECOGNIZED_FORMAT");
    }
  });

  it("rejects a CSV missing required columns", () => {
    const tiny = "Player;Position\nOnly;M (C)\n";
    expect(() => parseExport(tiny)).toThrow(ImportError);
    try {
      parseExport(tiny);
    } catch (e) {
      expect((e as ImportError).code).toBe("INSUFFICIENT_COLUMNS");
      expect((e as ImportError).details?.length).toBeGreaterThan(0);
    }
  });

  it("synthesizes a large HTML export without dropping rows", () => {
    const row = load("squad-small.html").match(/<tr>\s*<td>Alpha One[\s\S]*?<\/tr>/)![0]!;
    const header = load("squad-small.html").match(/<tr>[\s\S]*?<\/tr>/)![0]!;
    const body = Array.from({ length: 200 }, (_, i) => row.replace("Alpha One", `Bulk ${i}`)).join(
      "\n",
    );
    const html = `<table>${header}${body}</table>`;
    const result = parseExport(html);
    expect(result.report.rowsTotal).toBe(200);
    expect(result.report.rowsImported).toBe(200);
    expect(result.report.rowsTotal).toBe(
      result.report.rowsImported + result.report.rowsSkipped.length,
    );
  });
});
