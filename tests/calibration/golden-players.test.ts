import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseExport } from "../../src/import/parse.js";
import { buildScores } from "../../src/domain/scoring/dataset.js";
import { getArchetype } from "../../src/domain/archetypes/registry.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

interface GoldenAssertion {
  readonly archetype: string;
  readonly min?: number;
  readonly max?: number;
}

interface GoldenPlayer {
  readonly name: string;
  readonly assertions: readonly GoldenAssertion[];
  /** Minimum best-role score (doc 17 §11 role-ordering anchors). */
  readonly bestRoleMin?: number;
}

interface GoldenFixture {
  readonly source: string;
  readonly players: readonly GoldenPlayer[];
}

const fixture = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/golden-players.json"), "utf8"),
) as GoldenFixture;

describe("golden players — ordinal calibration (doc 05/06)", () => {
  const { players } = parseExport(readFileSync(join(ROOT, fixture.source), "utf8"));
  const scores = buildScores(players);
  const byName = new Map(players.map((p) => [p.name.toLowerCase(), p]));

  for (const row of fixture.players) {
    it(`${row.name} matches archetype inequalities`, () => {
      const player = byName.get(row.name.toLowerCase());
      expect(player, `player not found in ${fixture.source}`).toBeDefined();
      const ps = scores.find((s) => s.playerId === player!.id);
      expect(ps).toBeDefined();

      for (const a of row.assertions) {
        getArchetype(a.archetype);
        const arch = ps!.archetypes.find((x) => x.id === a.archetype);
        expect(arch, `missing archetype ${a.archetype}`).toBeDefined();
        if (a.min != null) expect(arch!.score).toBeGreaterThanOrEqual(a.min);
        if (a.max != null) expect(arch!.score).toBeLessThanOrEqual(a.max);
      }
      if (row.bestRoleMin != null) {
        expect(ps!.bestRole?.score ?? 0).toBeGreaterThanOrEqual(row.bestRoleMin);
      }
    });
  }
});
