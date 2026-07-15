import { describe, it, expect } from "vitest";
import { ATTRIBUTES } from "../attributes.js";
import type { AttrVector } from "../attr-value.js";
import type { Player } from "../player.js";
import type { PositionSlot } from "../positions.js";
import { buildScores } from "../scoring/dataset.js";
import { getFormation } from "../squad/formations.js";
import { buildContext, type AnalysisContext } from "./context.js";
import type { PlayerRow } from "./xi.js";
import { evaluateLinks } from "./links.js";
import * as slot from "./rules/slot.js";
import { wrongSideGate } from "./rules/slot.js";
import * as age from "./rules/age.js";
import * as dna from "./rules/dna.js";
import * as chemistry from "./rules/chemistry.js";
import * as market from "./rules/market.js";
import * as risk from "./rules/risk.js";
import * as shortlist from "./rules/shortlist.js";

function attrs(base: number, overrides: Partial<Record<string, number>> = {}): AttrVector {
  const out: AttrVector = {};
  for (const a of ATTRIBUTES) out[a.id] = { min: overrides[a.id] ?? base, max: overrides[a.id] ?? base };
  return out;
}

let seq = 0;
function player(opts: {
  positions: PositionSlot[];
  base?: number;
  overrides?: Partial<Record<string, number>>;
  age?: number | null;
  value?: number | null;
  scoutGrade?: string | null;
}): Player {
  const id = `p${seq++}`;
  return {
    id,
    name: `Player ${id}`,
    age: opts.age === undefined ? 25 : opts.age,
    positions: opts.positions,
    attrs: attrs(opts.base ?? 12, opts.overrides),
    club: null,
    nationality: null,
    value: opts.value ?? null,
    heightCm: null,
    foot: null,
    scoutGrade: opts.scoutGrade ?? null,
  };
}

// Matches 4-2-3-1's slots exactly so every position has a natural starter by default.
const FULL_4231: PositionSlot[] = ["GK", "D-R", "D-C", "D-C", "D-L", "DM-C", "DM-C", "AM-R", "AM-C", "AM-L", "ST-C"];

function rowsOf(players: Player[]): PlayerRow[] {
  const scores = buildScores(players);
  return players.map((p) => ({ player: p, scores: scores.find((s) => s.playerId === p.id)! }));
}

function ctxWith(squadPlayers: Player[], shortlistPlayers: Player[] = [], budget = 0, useFullBudget = true): AnalysisContext {
  return buildContext({
    squad: rowsOf(squadPlayers),
    shortlist: rowsOf(shortlistPlayers),
    formation: getFormation("4-2-3-1"),
    budget,
    useFullBudget,
  });
}

describe("SLOT rules", () => {
  it("fires slot.hole when no eligible player exists", () => {
    const squad = FULL_4231.filter((s) => s !== "ST-C").map((s) => player({ positions: [s], base: 14 }));
    const insights = slot.run(ctxWith(squad));
    expect(insights.some((i) => i.id.startsWith("slot.hole:st"))).toBe(true);
  });

  it("does not fire slot.hole when the slot is filled", () => {
    const squad = FULL_4231.map((s) => player({ positions: [s], base: 14 }));
    const insights = slot.run(ctxWith(squad));
    expect(insights.some((i) => i.id.startsWith("slot.hole"))).toBe(false);
  });

  it("fires slot.weak for a starter below the weak-fit threshold", () => {
    const squad = FULL_4231.map((s) => player({ positions: [s], base: s === "ST-C" ? 4 : 14 }));
    const insights = slot.run(ctxWith(squad));
    expect(insights.some((i) => i.id.startsWith("slot.weak:st"))).toBe(true);
  });

  it("fires slot.elite praise for a starter with no weaknesses and cover", () => {
    const squad = [
      ...FULL_4231.map((s) => player({ positions: [s], base: 16 })),
      player({ positions: ["ST-C"], base: 13 }), // backup so the elite slot isn't also thin
    ];
    const insights = slot.run(ctxWith(squad));
    expect(insights.some((i) => i.id.startsWith("slot.elite:st"))).toBe(true);
  });

  it("SLOT-6 gate accepts a beneficial L/R swap (doc 11)", () => {
    expect(wrongSideGate(64, 69, 74, 74)).toBe(true);
    expect(wrongSideGate(70, 72, 75, 73)).toBe(false);
    expect(wrongSideGate(64, 68, 74, 74)).toBe(false);
  });

  it("fires slot.wrong-side when wing presets differ and a swap wins (doc 11 SLOT-6)", () => {
    const crossWinger = player({
      positions: ["AM-R", "AM-L"],
      base: 12,
      overrides: { crossing: 16, dribbling: 16, pace: 16, offTheBall: 14, flair: 14 },
    });
    const otherWinger = player({
      positions: ["AM-L"],
      base: 15,
      overrides: { dribbling: 15, flair: 14, pace: 14 },
    });
    const squad = [
      ...FULL_4231.filter((s) => s !== "AM-L" && s !== "AM-R").map((s) => player({ positions: [s], base: 13 })),
      crossWinger,
      otherWinger,
    ];
    const insights = slot.run(ctxWith(squad));
    const wrong = insights.find((i) => i.id.startsWith("slot.wrong-side"));
    expect(wrong).toBeDefined();
    expect(wrong!.evidence).toHaveLength(4);
    expect(wrong!.detail).toMatch(/Swap/i);
  });
});

describe("AGE rules", () => {
  it("fires age.youth-pipeline with three young, high-fit players", () => {
    const squad = [
      ...FULL_4231.map((s) => player({ positions: [s], base: 14 })),
      player({ positions: ["ST-C"], base: 16, age: 18 }),
      player({ positions: ["AM-C"], base: 16, age: 19 }),
      player({ positions: ["D-C"], base: 16, age: 20 }),
    ];
    const insights = age.run(ctxWith(squad));
    expect(insights.some((i) => i.id.startsWith("age.youth-pipeline"))).toBe(true);
  });
});

describe("DNA rules", () => {
  it("fires dna.deficit when a wanted family is entirely absent from the XI", () => {
    // Uniform, unremarkable attributes across the board -> no player has a strong top
    // archetype, so every family target for 4-2-3-1 should read as a deficit.
    const squad = FULL_4231.map((s) => player({ positions: [s], base: 10 }));
    const insights = dna.run(ctxWith(squad));
    expect(insights.some((i) => i.id.startsWith("dna.deficit"))).toBe(true);
  });

  it("always includes exactly one style-read insight", () => {
    const squad = FULL_4231.map((s) => player({ positions: [s], base: 12 }));
    const insights = dna.run(ctxWith(squad));
    expect(insights.filter((i) => i.id.startsWith("dna.style-read")).length).toBe(1);
  });
});

describe("CHEMISTRY rules (doc 12 §3.3)", () => {
  it("emits at most one praise card even when many links are great", () => {
    // Uniformly strong squad: every capability covered on every link.
    const squad = FULL_4231.map((s) => player({ positions: [s], base: 15 }));
    const ctx = ctxWith(squad);
    const insights = chemistry.run(ctx, evaluateLinks(ctx));
    expect(insights.filter((i) => i.severity === "praise").length).toBeLessThanOrEqual(1);
  });

  it("does not flag redundancy when the pair covers everything and scores well", () => {
    // Identical strong players → redundant by archetype, but full coverage and a high
    // partnership: doc 12 says that is not card-worthy.
    const squad = FULL_4231.map((s) => player({ positions: [s], base: 15 }));
    const ctx = ctxWith(squad);
    const insights = chemistry.run(ctx, evaluateLinks(ctx));
    for (const i of insights.filter((x) => x.id.startsWith("chem.redundant"))) {
      const linkKey = i.id.split(":")[1]!;
      const board = evaluateLinks(ctx);
      const ev = board.links.find((l) => `${l.link.a}-${l.link.b}` === linkKey)!;
      expect(ev.partnership < 70 || ev.missing.length > 0).toBe(true);
    }
  });
});

describe("MARKET rules", () => {
  it("fires mkt.bargain when a shortlist player matches a starter's fit for half the price", () => {
    const squad = FULL_4231.map((s) => player({ positions: [s], base: 12, value: 20e6 }));
    const cheapMatch = player({ positions: ["ST-C"], base: 12, value: 5e6 });
    const insights = market.run(ctxWith(squad, [cheapMatch]));
    expect(insights.some((i) => i.id.startsWith("mkt.bargain"))).toBe(true);
  });

  it("groups a multi-slot bargain into a single insight (doc 12 §3.1)", () => {
    const squad = FULL_4231.map((s) => player({ positions: [s], base: 12, value: 20e6 }));
    // One shortlist player eligible at both wings, undercutting both starters.
    const twoFooted = player({ positions: ["AM-L", "AM-R"], base: 13, value: 5e6 });
    const insights = market.run(ctxWith(squad, [twoFooted]));
    const bargains = insights.filter((i) => i.id.startsWith("mkt.bargain"));
    expect(bargains.length).toBe(1);
    expect(bargains[0]!.id).toBe(`mkt.bargain:${twoFooted.id}`);
    expect(bargains[0]!.detail).toContain("LW");
    expect(bargains[0]!.detail).toContain("RW");
  });

  it("caps bargain insights at BARGAIN_MAX_SHOWN", () => {
    const squad = FULL_4231.map((s) => player({ positions: [s], base: 12, value: 30e6 }));
    const shortlistPlayers = FULL_4231.map((s) => player({ positions: [s], base: 13, value: 2e6 }));
    const insights = market.run(ctxWith(squad, shortlistPlayers));
    const bargains = insights.filter((i) => i.id.startsWith("mkt.bargain"));
    expect(bargains.length).toBeLessThanOrEqual(4);
  });

  it("merges expensive bench players into a single unused-value insight (doc 12 §3.2)", () => {
    const squad = [
      ...FULL_4231.map((s) => player({ positions: [s], base: 14, value: 1e6 })),
      player({ positions: ["ST-C"], base: 6, value: 50e6 }),
      player({ positions: ["AM-C"], base: 6, value: 60e6 }),
      player({ positions: ["D-C"], base: 6, value: 70e6 }),
    ];
    const insights = market.run(ctxWith(squad));
    const unused = insights.filter((i) => i.id.startsWith("mkt.unused-value"));
    expect(unused.length).toBe(1);
    expect(unused[0]!.subjects.length).toBe(3);
    // Total pill present alongside per-player pills.
    expect(unused[0]!.evidence.some((e) => e.label === "Total")).toBe(true);
  });

  it("fires mkt.grade-value-gap for a highly graded, cheap shortlist player", () => {
    const squad = FULL_4231.map((s) => player({ positions: [s], base: 12 }));
    const shortlistPlayers = [
      player({ positions: ["ST-C"], value: 1e6, scoutGrade: "A" }),
      player({ positions: ["ST-C"], value: 40e6, scoutGrade: "C" }),
      player({ positions: ["ST-C"], value: 35e6, scoutGrade: "C" }),
    ];
    const insights = market.run(ctxWith(squad, shortlistPlayers));
    expect(insights.some((i) => i.id.startsWith("mkt.grade-value-gap"))).toBe(true);
  });
});

describe("RISK rules", () => {
  it("fires risk.gk-cliff for an old keeper with no reliable backup", () => {
    const squad = [
      ...FULL_4231.filter((s) => s !== "GK").map((s) => player({ positions: [s], base: 14 })),
      player({ positions: ["GK"], base: 16, age: 34 }),
      player({ positions: ["GK"], base: 3, age: 19 }),
    ];
    const insights = risk.run(ctxWith(squad), []);
    expect(insights.some((i) => i.id.startsWith("risk.gk-cliff"))).toBe(true);
  });

  it("fires risk.spof for an excellent starter nobody can replace", () => {
    const squad = [
      ...FULL_4231.filter((s) => s !== "ST-C").map((s) => player({ positions: [s], base: 14 })),
      player({ positions: ["ST-C"], base: 18 }),
    ];
    const insights = risk.run(ctxWith(squad), []);
    expect(insights.some((i) => i.id.startsWith("risk.spof:st"))).toBe(true);
  });
});

describe("SHORTLIST rules", () => {
  it("fires sl.uncovered-need when nothing on the shortlist can fix a hole", () => {
    const squad = FULL_4231.filter((s) => s !== "ST-C").map((s) => player({ positions: [s], base: 14 }));
    const shortlistPlayers = [player({ positions: ["D-C"], base: 16 })]; // wrong position entirely
    const insights = shortlist.run(ctxWith(squad, shortlistPlayers));
    expect(insights.some((i) => i.id.startsWith("sl.uncovered-need:st"))).toBe(true);
  });

  it("does not fire sl.uncovered-need when a shortlist player can plug the hole", () => {
    const squad = FULL_4231.filter((s) => s !== "ST-C").map((s) => player({ positions: [s], base: 14 }));
    const shortlistPlayers = [player({ positions: ["ST-C"], base: 16, value: 5e6 })];
    const insights = shortlist.run(ctxWith(squad, shortlistPlayers, 50e6, true));
    expect(insights.some((i) => i.id.startsWith("sl.uncovered-need:st"))).toBe(false);
  });
});
