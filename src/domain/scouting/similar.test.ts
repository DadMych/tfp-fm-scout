import { describe, expect, it } from "vitest";
import { ATTRIBUTES } from "../attributes.js";
import type { AttrVector } from "../attr-value.js";
import type { AttributeId } from "../attributes.js";
import type { Player } from "../player.js";
import { buildScores } from "../scoring/dataset.js";
import { findSimilar, similarVector } from "./similar.js";
import type { PlayerRow } from "../assistant/xi.js";

function attrs(base: number, overrides: Partial<Record<AttributeId, number>> = {}): AttrVector {
  const out: AttrVector = {};
  for (const a of ATTRIBUTES) {
    const v = overrides[a.id] ?? base;
    out[a.id] = { min: v, max: v };
  }
  return out;
}

function player(over: Partial<Player> & { id: string; name: string; positions: Player["positions"]; attrs: AttrVector }): Player {
  return {
    age: 22,
    nationality: "Test",
    club: "FC",
    foot: "Right",
    heightCm: 180,
    value: 1e6,
    scoutGrade: null,
    ...over,
  };
}

function rows(ps: Player[]): PlayerRow[] {
  const scores = buildScores(ps);
  return ps.map((p) => ({ player: p, scores: scores.find((s) => s.playerId === p.id)! }));
}

describe("findSimilar", () => {
  it("ranks a near-clone above a distant player", () => {
    const bg = Array.from({ length: 20 }, (_, i) =>
      player({
        id: `bg${i}`,
        name: `bg${i}`,
        positions: ["M-C"],
        attrs: attrs(8 + i * 0.4),
      }),
    );
    const profile = {
      passing: 17,
      vision: 16,
      decisions: 15,
      firstTouch: 15,
      technique: 15,
      composure: 14,
    };
    const anchorP = player({
      id: "anchor",
      name: "anchor",
      positions: ["M-C"],
      attrs: attrs(13, profile),
    });
    const twinP = player({
      id: "twin",
      name: "twin",
      positions: ["M-C"],
      attrs: attrs(13, { ...profile, passing: 16, vision: 15 }),
    });
    const distantP = player({
      id: "far",
      name: "far",
      positions: ["M-C"],
      attrs: attrs(7),
    });
    const all = rows([...bg, anchorP, twinP, distantP]);
    const anchor = all.find((r) => r.player.id === "anchor")!;
    const twin = all.find((r) => r.player.id === "twin")!;
    const distant = all.find((r) => r.player.id === "far")!;
    const hits = findSimilar({ anchor, pool: [distant, twin], limit: 5 });
    expect(hits[0]?.playerId).toBe("twin");
    expect(hits[0]!.similarity).toBeGreaterThan(hits[1]?.similarity ?? 0);
  });

  it("builds a stable vector length", () => {
    const bg = Array.from({ length: 15 }, (_, i) =>
      player({
        id: `bg${i}`,
        name: `bg${i}`,
        positions: ["ST-C"],
        attrs: attrs(8 + i * 0.5),
      }),
    );
    const star = player({
      id: "a",
      name: "a",
      positions: ["ST-C"],
      attrs: attrs(12, { finishing: 17, offTheBall: 16, composure: 15 }),
    });
    const anchor = rows([...bg, star]).find((r) => r.player.id === "a")!;
    expect(similarVector(anchor.scores).length).toBeGreaterThan(10);
  });
});
