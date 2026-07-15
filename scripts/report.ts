/**
 * CLI: render an FM26 export as a Broadsheet scout site (docs/09-ui-ux.md).
 *
 *   pnpm report samples/real/fm26_squad_list.csv            # -> out/report/
 *   pnpm report data/players.csv "Serie B" out/serieb       # custom label + dir
 *
 * Reads the file, runs the pure engine, and writes a small static site: the Ledger index
 * plus one linked Dossier page per player. Self-contained HTML, openable via file://.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import { parseExport } from "../src/import/parse.js";
import { buildScores } from "../src/domain/scoring/dataset.js";
import { renderReport } from "../src/report/broadsheet.js";
import { renderDossier, dossierHref, dossierFileName } from "../src/report/dossier.js";

const [, , file, label, outArg] = process.argv;
if (!file) {
  console.error("usage: pnpm report <file.csv|file.html> [dataset-label] [out-dir]");
  process.exit(1);
}

const outDir = outArg ?? "out/report";
const text = readFileSync(file, "utf8");
const { players, report } = parseExport(text);

if (players.length === 0) {
  console.error("No players parsed — check the export has Name + attribute columns.");
  process.exit(1);
}

const scores = buildScores(players);
const scoreById = new Map(scores.map((s) => [s.playerId, s]));
const meta = {
  datasetLabel: label ?? basename(file),
  sourceFile: basename(file),
  generatedAt: new Date(),
  maskedAttributeShare: report.maskedAttributeShare,
};

mkdirSync(join(outDir, "p"), { recursive: true });

writeFileSync(join(outDir, "index.html"), renderReport(players, scores, meta, dossierHref), "utf8");

let dossiers = 0;
for (const p of players) {
  const s = scoreById.get(p.id);
  if (!s) continue;
  writeFileSync(join(outDir, "p", dossierFileName(p)), renderDossier(p, s, meta), "utf8");
  dossiers += 1;
}

console.log(
  `Wrote ${outDir}/ — ledger + ${dossiers} dossiers, ${players.length} players` +
    (report.rowsSkipped.length ? ` (${report.rowsSkipped.length} rows skipped)` : "") +
    (report.rowsWithoutPosition ? `, ${report.rowsWithoutPosition} without position` : ""),
);
