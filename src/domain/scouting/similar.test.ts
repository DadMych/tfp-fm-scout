import { describe, expect, it } from "vitest";
import { ATTRIBUTES } from "../attributes.js";
import type { AttrVector } from "../attr-value.js";
import type { Player } from "../player.js";
import { buildScores } from "../scoring/dataset.js";
import { findSimilar, similarVector } from "./similar.js";
import type { PlayerRow } from "../assistant/xi.js";

function attrs(v: number): AttrVector {
  const out: AttrVector = {};
  for (const a of ATTRIBUTES) out[a.id] = { min: v, max: v };
  return out;
}

function rows(ps: Player[]): PlayerRow[] {
  const scores = buildScores(ps);
  return ps.map((p) => ({ player: p, scores: scores.find((s) => s.playerId === p.id)! }));
}

describe("findSimilar", () => {
  it("ranks a near-clone above a distant player", () => {
    const anchorP = {
      id: "anchor",
      name: "anchor",
      age: 22,
      nationality: "Test",
      club: "FC",
      foot: "Right" as const,
      heightCm: 180,
      value: 1e6,
      scoutGrade: null,
      positions: ["M-C"] as const,
      attrs: attrs(16),
    };
    const twinP = { ...anchorP, id: "twin", name: "twin", attrs: attrs(15) };
    const distantP = { ...anchorP, id: "far", name: "far", attrs: attrs(6) };
    const [anchor, twin, distant] = rows([anchorP, twinP, distantP]);
    const hits = findSimilar({ anchor: anchor!, pool: [distant!, twin!], limit: 5 });
    expect(hits[0]?.playerId).toBe("twin");
    expect(hits[0]!.similarity).toBeGreaterThan(hits[1]?.similarity ?? 0);
  });

  it("builds a stable vector length", () => {
    const p = {
      id: "a",
      name: "a",
      age: 22,
      nationality: "Test",
      club: "FC",
      foot: "Right" as const,
      heightCm: 180,
      value: 1e6,
      scoutGrade: null,
      positions: ["ST-C"] as const,
      attrs: attrs(14),
    };
    const anchor = rows([p])[0]!;
    expect(similarVector(anchor.scores).length).toBeGreaterThan(10);
  });
});
