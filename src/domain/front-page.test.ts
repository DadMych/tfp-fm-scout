import { describe, expect, it } from "vitest";
import type { Player } from "./player.js";
import type { PlayerScores } from "./scoring/dataset.js";
import { pickBargain, pickBriefs, pickLead, standoutClause } from "./front-page.js";
import type { Recommendation } from "./recommendation.js";

function stubPlayer(id: string, name: string, age: number, value: number | null): Player {
  return {
    id,
    name,
    age,
    nationality: "Nowhere",
    club: "Test FC",
    positions: ["ST-C"],
    foot: "Right",
    heightCm: 180,
    value,
    scoutGrade: null,
    attrs: {},
  };
}

function stubScores(
  badge: "Elite" | "Strong" | null,
  score: number,
  confidence = 1,
): PlayerScores {
  return {
    playerId: "x",
    confidence,
    general: { family: "Forward", score: 80 },
    percentiles: {},
    topArchetype: badge ? { id: "poacher", score, badge } : null,
    bestRole: null,
    summary: "Test summary",
  } as unknown as PlayerScores;
}

describe("pickLead", () => {
  it("prefers the youngest Elite among known players", () => {
    const rows = [
      { p: stubPlayer("old", "Old Elite", 28, null), s: stubScores("Elite", 90) },
      { p: stubPlayer("young", "Young Elite", 19, null), s: stubScores("Elite", 88) },
    ];
    expect(pickLead(rows)?.p.name).toBe("Young Elite");
  });

  it("falls back to highest archetype score when no Elite", () => {
    const rows = [
      { p: stubPlayer("a", "A", 24, null), s: stubScores("Strong", 72) },
      { p: stubPlayer("b", "B", 24, null), s: stubScores("Strong", 81) },
    ];
    expect(pickLead(rows)?.p.name).toBe("B");
  });
});

describe("pickBargain", () => {
  it("returns null when no player has a fee and quality", () => {
    const rows = [{ p: stubPlayer("a", "A", 24, null), s: stubScores("Strong", 70) }];
    expect(pickBargain(rows)).toBeNull();
  });

  it("picks the best score-per-million euro", () => {
    const rows = [
      { p: stubPlayer("dear", "Dear", 24, 20e6), s: stubScores("Strong", 80) },
      { p: stubPlayer("cheap", "Cheap", 24, 5e6), s: stubScores("Strong", 75) },
    ];
    expect(pickBargain(rows)?.p.name).toBe("Cheap");
  });
});

function stubRec(verdict: Recommendation["verdict"], tone: Recommendation["tone"], rank: number): Recommendation {
  return { verdict, tone, headline: "Test", reasons: [], rank };
}

describe("pickBriefs", () => {
  it("returns at most two per verdict tone", () => {
    const rows = [1, 2, 3, 4, 5].map((n) => ({
      p: stubPlayer(`p${n}`, `P${n}`, 24, 5e6),
      s: stubScores("Strong", 80 - n),
      rec: stubRec("Bargain", "ink", n),
    }));
    const briefs = pickBriefs(rows, 4);
    expect(briefs.length).toBeLessThanOrEqual(4);
    expect(briefs.length).toBe(2);
  });
});

describe("standoutClause", () => {
  it("returns prose for a high percentile", () => {
    const s = {
      ...stubScores("Strong", 80),
      percentiles: { heading: 96 },
    } as unknown as PlayerScores;
    expect(standoutClause(s)).toMatch(/96th percentile/);
  });
});
