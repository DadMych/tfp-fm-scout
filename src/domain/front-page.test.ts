import { describe, expect, it } from "vitest";
import type { Player } from "./player.js";
import type { PlayerScores } from "./scoring/dataset.js";
import { pickBargain, pickLead } from "./front-page.js";

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
