import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseExport } from "../../import/parse.js";
import { buildScores } from "../scoring/dataset.js";
import { getFormation } from "../squad/formations.js";
import { buildContext } from "./context.js";
import { evaluateLinks } from "./links.js";
import { buildStyleReads } from "./style.js";
import type { PlayerRow } from "./xi.js";

function loadRows(path: string): PlayerRow[] {
  const { players } = parseExport(readFileSync(path, "utf8"));
  const scores = buildScores(players);
  return players.map((p) => ({ player: p, scores: scores.find((s) => s.playerId === p.id)! }));
}

const squad = loadRows("samples/real/fm26_squad_view.csv");

describe("buildStyleReads (doc 19 §3)", () => {
  it("returns prose reads with evidence on real squad data", () => {
    const ctx = buildContext({
      squad,
      shortlist: [],
      formation: getFormation("4-2-3-1"),
      budget: 50e6,
      useFullBudget: false,
    });
    const reads = buildStyleReads(ctx, evaluateLinks(ctx));
    expect(reads.length).toBeGreaterThan(0);
    expect(reads.length).toBeLessThanOrEqual(4);
    for (const r of reads) {
      expect(r.text.length).toBeGreaterThan(20);
      expect(r.evidence.length).toBeGreaterThan(0);
    }
  });
});
