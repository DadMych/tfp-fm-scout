import { describe, expect, it } from "vitest";
import { ATTRIBUTES } from "../attributes.js";
import type { AttrVector } from "../attr-value.js";
import type { Player } from "../player.js";
import type { PositionSlot } from "../positions.js";
import { buildScores } from "../scoring/dataset.js";
import { getFormation } from "./formations.js";
import { buildContext } from "../assistant/context.js";
import type { PlayerRow } from "../assistant/xi.js";
import {
  PLAYING_STYLES,
  getPlayingStyle,
  playerMatchesStyle,
  rankStyles,
  styleSuitability,
} from "./styles.js";

function attrs(base: number, overrides: Partial<Record<string, number>> = {}): AttrVector {
  const out: AttrVector = {};
  for (const a of ATTRIBUTES) out[a.id] = { min: overrides[a.id] ?? base, max: overrides[a.id] ?? base };
  return out;
}

let seq = 0;
function player(over: {
  positions: PositionSlot[];
  base: number;
  overrides?: Partial<Record<string, number>>;
  name?: string;
}): Player {
  const id = `s${seq++}`;
  return {
    id,
    name: over.name ?? `Player ${id}`,
    age: 25,
    positions: over.positions,
    attrs: attrs(over.base, over.overrides),
    club: null,
    nationality: null,
    value: null,
    heightCm: null,
    foot: null,
  };
}

function ctxFor(players: Player[], formationId = "4-3-3") {
  const scores = buildScores(players);
  const rows: PlayerRow[] = players.map((p) => ({
    player: p,
    scores: scores.find((s) => s.playerId === p.id)!,
  }));
  return buildContext({
    squad: rows,
    shortlist: [],
    formation: getFormation(formationId),
    budget: 50e6,
    useFullBudget: false,
  });
}

function flatXi(base: number, overrides: Partial<Record<string, number>> = {}): Player[] {
  const slots: PositionSlot[] = [
    "GK",
    "D-R",
    "D-C",
    "D-C",
    "D-L",
    "DM-C",
    "M-C",
    "M-C",
    "AM-R",
    "AM-L",
    "ST-C",
  ];
  return slots.map((slot) => player({ positions: [slot], base, overrides }));
}

describe("playing styles (doc 21)", () => {
  it("catalogues six styles with scout templates", () => {
    expect(PLAYING_STYLES).toHaveLength(6);
    for (const s of PLAYING_STYLES) {
      expect(s.scout.metrics.length).toBeGreaterThan(0);
      expect(s.scout.groups.length).toBeGreaterThan(0);
    }
  });

  it("suitability is deterministic and in 0–100", () => {
    const ctx = ctxFor(flatXi(14));
    const a = styleSuitability(ctx, getPlayingStyle("tiki-taka"));
    const b = styleSuitability(ctx, getPlayingStyle("tiki-taka"));
    expect(a.score).toBe(b.score);
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeLessThanOrEqual(100);
    expect(a.evidence.length).toBeGreaterThan(0);
  });

  it("press-resistant creative XI ranks tiki-taka above low-block", () => {
    const ctx = ctxFor(
      flatXi(11, {
        firstTouch: 16,
        composure: 16,
        balance: 15,
        agility: 15,
        vision: 16,
        passing: 16,
        flair: 15,
        positioning: 10,
        marking: 9,
        concentration: 10,
      }),
      "4-3-3",
    );
    const ranked = rankStyles(ctx);
    expect(ranked[0]!.style.id).not.toBe("low-block");
    const tiki = ranked.find((r) => r.style.id === "tiki-taka")!;
    const low = ranked.find((r) => r.style.id === "low-block")!;
    expect(tiki.score).toBeGreaterThan(low.score);
  });

  it("playerMatchesStyle uses key-metric percentiles ≥ 60", () => {
    const strong = player({
      positions: ["DM-C"],
      base: 18,
      overrides: { workRate: 18, stamina: 18, acceleration: 17, pace: 17, tackling: 16, aggression: 15, anticipation: 15 },
    });
    const weaklings = Array.from({ length: 8 }, (_, i) =>
      player({ positions: ["DM-C"], base: 8, name: `Weak ${i}` }),
    );
    const scores = buildScores([strong, ...weaklings]);
    const strongScores = scores.find((s) => s.playerId === strong.id)!;
    expect(playerMatchesStyle(strongScores, "gegenpress")).toBe(true);
    const weakScores = scores.find((s) => s.playerId === weaklings[0]!.id)!;
    expect(playerMatchesStyle(weakScores, "gegenpress")).toBe(false);
  });
});
