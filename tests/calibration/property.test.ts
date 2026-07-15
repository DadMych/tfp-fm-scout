import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseExport } from "../../src/import/parse.js";
import { buildScores } from "../../src/domain/scoring/dataset.js";
import { ARCHETYPES } from "../../src/domain/archetypes/registry.js";
import type { Player } from "../../src/domain/player.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

/** Large division-style export for doc 06 §7 sanity properties. */
const LARGE_FIXTURE = join(ROOT, "samples/list407.csv");

const MIN_COHORT = 30;
const SPREAD_MIN = 25;
/** Doc 06 §7 #2 target; scouting-heavy exports may sit slightly above until v0.3 weight pass. */
const ELITE_SHARE_CEILING = 0.2;

function percentileAt(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor((sorted.length - 1) * p);
  return sorted[idx]!;
}

function loadPlayers(path: string): Player[] {
  return parseExport(readFileSync(path, "utf8")).players;
}

describe("archetype engine properties (doc 06 §7)", () => {
  const players = loadPlayers(LARGE_FIXTURE);
  const scores = buildScores(players);

  it("score distribution per archetype is not degenerate (p95 − p5 ≥ 25)", () => {
    for (const def of ARCHETYPES) {
      const values = scores
        .filter((ps) => ps.pop === def.pop)
        .map((ps) => ps.archetypes.find((a) => a.id === def.id)!.score);
      if (values.length < MIN_COHORT) continue;
      const spread = percentileAt(values, 0.95) - percentileAt(values, 0.05);
      expect(spread, `${def.id} spread ${spread.toFixed(1)}`).toBeGreaterThanOrEqual(SPREAD_MIN);
    }
  });

  it("elite archetype fits stay rare (< 20% of outfield players ≥ 85)", () => {
    const outfield = scores.filter((ps) => ps.pop === "outfield");
    const elite = outfield.filter((ps) =>
      ps.archetypes.some((a) => a.gatesPassed && a.score >= 85),
    ).length;
    const share = elite / outfield.length;
    expect(share).toBeLessThan(ELITE_SHARE_CEILING);
  });

  it("gate failures cap correctly (no gated player above 40)", () => {
    for (const ps of scores) {
      for (const a of ps.archetypes) {
        if (!a.gatesPassed) expect(a.score).toBeLessThanOrEqual(40);
      }
    }
  });

  it("percentile invariance: duplicating every player leaves scores unchanged", () => {
    const duplicated = [...players, ...players.map((p, i) => ({ ...p, id: `${p.id}-dup-${i}` }))];
    const base = buildScores(players);
    const doubled = buildScores(duplicated);
    for (const ps of base) {
      const match = doubled.find((x) => x.playerId === ps.playerId);
      expect(match).toBeDefined();
      for (const arch of ps.archetypes) {
        const other = match!.archetypes.find((a) => a.id === arch.id)!;
        expect(other.score).toBe(arch.score);
        expect(other.gatesPassed).toBe(arch.gatesPassed);
      }
    }
  });
});
