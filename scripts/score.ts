/**
 * CLI: score an FM26 export (CSV or HTML) with the domain engine.
 *
 *   pnpm score data/players.csv            # top 25 by archetype strength
 *   pnpm score data/players.csv "Haaland"  # filter to names containing the term
 *
 * Reads nothing but the given file; prints a human report. No persistence.
 */

import { readFileSync } from "node:fs";
import { parseExport } from "../src/import/parse.js";
import { buildScores } from "../src/domain/scoring/dataset.js";
import { getArchetype } from "../src/domain/archetypes/registry.js";
import { bestPresetFit } from "../src/domain/assistant/xi.js";
import { DEFAULT_FORMATION_ID } from "../src/domain/assistant/defaults.js";

const [, , file, filter] = process.argv;
if (!file) {
  console.error("usage: pnpm score <file.csv|file.html> [name-filter]");
  process.exit(1);
}

const text = readFileSync(file, "utf8");
const { players, report } = parseExport(text);

console.log(`\nFormat: ${report.detectedFormat}  |  rows: ${report.rowsTotal}  |  imported: ${report.rowsImported}`);
if (report.rowsSkipped.length) {
  console.log(`Skipped ${report.rowsSkipped.length}: ` +
    report.rowsSkipped.slice(0, 5).map((s) => `row ${s.row} (${s.reason})`).join(", ") +
    (report.rowsSkipped.length > 5 ? " …" : ""));
}
if (report.unmappedColumns.length) {
  console.log(`Unmapped columns: ${report.unmappedColumns.join(", ")}`);
}
if (report.rowsWithoutPosition) {
  console.log(`Without position (scored position-agnostically): ${report.rowsWithoutPosition}`);
}
console.log(`Masked/unknown attribute share: ${(report.maskedAttributeShare * 100).toFixed(0)}%`);

if (players.length === 0) {
  console.log("\nNo players parsed. Check the export has Name + Position + attribute columns.");
  process.exit(0);
}

const scores = buildScores(players);
const byId = new Map(players.map((p) => [p.id, p]));

const term = filter?.toLowerCase();
const rows = scores
  .filter((s) => (term ? byId.get(s.playerId)!.name.toLowerCase().includes(term) : true))
  .sort((a, b) => (b.topArchetype?.score ?? 0) - (a.topArchetype?.score ?? 0))
  .slice(0, term ? 200 : 25);

console.log(`\nShowing ${rows.length} player(s):\n`);
for (const s of rows) {
  const p = byId.get(s.playerId)!;
  const arch = s.topArchetype ? getArchetype(s.topArchetype.id) : null;
  const archLabel = arch
    ? `${arch.name} ${Math.round(s.topArchetype!.score)}${s.topArchetype!.badge ? ` [${s.topArchetype!.badge}]` : ""}`
    : "—";
  const presetFit = bestPresetFit({ player: p, scores: s }, DEFAULT_FORMATION_ID);
  const pos = p.positions.join("/");
  const conf = `${Math.round(s.confidence * 100)}% known`;

  console.log(`${p.name}  (${p.age ?? "?"}, ${pos}${p.club ? `, ${p.club}` : ""})`);
  console.log(`  ${s.general.family} · top archetype: ${archLabel} · 4-2-3-1 fit: ${presetFit || "—"} · ${conf}`);
  console.log(`  ${s.summary}\n`);
}
