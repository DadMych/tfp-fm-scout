import { describe, it, expect } from "vitest";
import { ATTRIBUTES } from "./attributes.js";
import type { AttrVector } from "./attr-value.js";
import type { Player } from "./player.js";
import { buildScores } from "./scoring/dataset.js";
import { buildSquadContext, recommend } from "./recommendation.js";

function attrs(v: number): AttrVector {
  const out: AttrVector = {};
  for (const a of ATTRIBUTES) out[a.id] = { min: v, max: v };
  return out;
}

function player(id: string, over: Partial<Player> & { v: number }): Player {
  const { v, ...rest } = over;
  return {
    id,
    name: `P${id}`,
    age: 25,
    positions: ["M-C"],
    attrs: attrs(v),
    club: null,
    nationality: null,
    value: null,
    heightCm: null,
    foot: null,
    ...rest,
  };
}

/** A spread cohort (values low→high) so percentiles separate a player from the pack. */
function cohort(prefix: string, from: number, to: number, positions: Player["positions"]) {
  const n = 20;
  return Array.from({ length: n }, (_, i) =>
    player(`${prefix}${i}`, { v: from + ((to - from) * i) / (n - 1), positions }),
  );
}

/** Score `p` inside a background cohort, returning p's scores. */
function scoreIn(p: Player, bg: Player[]) {
  return buildScores([...bg, p]).find((s) => s.playerId === p.id)!;
}

describe("recommend", () => {
  it("flags a dominant young player as a priority target", () => {
    const bg = cohort("a", 4, 15, ["M-C"]);
    const star = player("star", { v: 20, age: 19, positions: ["M-C"] });
    const rec = recommend(star, scoreIn(star, bg));
    expect(rec.verdict).toBe("Priority target");
    expect(rec.tone).toBe("gold");
    expect(rec.reasons.length).toBeGreaterThan(0);
  });

  it("flags a weak player as not for us", () => {
    const bg = cohort("b", 8, 20, ["M-C"]);
    const weak = player("weak", { v: 5 });
    const rec = recommend(weak, scoreIn(weak, bg));
    expect(rec.verdict).toBe("Not for us");
    expect(rec.tone).toBe("muted");
  });

  it("calls a cheap, strong (non-elite) player a bargain", () => {
    const bg = cohort("c", 4, 20, ["M-C"]);
    const cheap = player("cheap", { v: 16, age: 26, value: 6e6 });
    const rec = recommend(cheap, scoreIn(cheap, bg));
    expect(rec.verdict).toBe("Bargain");
    expect(rec.tone).toBe("green");
  });

  it("recognises a squad upgrade against the user's squad (absolute role fit)", () => {
    const squad = [player("sq1", { v: 9, positions: ["D-C"] })];
    const ctx = buildSquadContext(squad, buildScores(squad));

    const bg = cohort("u", 4, 16, ["D-C"]);
    const target = player("t", { v: 18, positions: ["D-C"] });
    const rec = recommend(target, scoreIn(target, bg), ctx);
    expect(rec.verdict).toBe("Squad upgrade");
    expect(rec.reasons.some((r) => r.includes("best CB"))).toBe(true);
  });

  it("orders stronger recommendations with a lower rank", () => {
    const bg = cohort("o", 4, 16, ["M-C"]);
    const star = player("s2", { v: 20, age: 20 });
    const depth = player("d2", { v: 8 });
    expect(recommend(star, scoreIn(star, bg)).rank).toBeLessThan(
      recommend(depth, scoreIn(depth, bg)).rank,
    );
  });
});
