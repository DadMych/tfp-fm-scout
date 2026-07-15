import { describe, it, expect } from "vitest";
import { ATTRIBUTES } from "../../attributes.js";
import type { AttrVector } from "../../attr-value.js";
import type { Player } from "../../player.js";
import type { PositionSlot } from "../../positions.js";
import { buildScores } from "../../scoring/dataset.js";
import { getFormation } from "../../squad/formations.js";
import { buildContext, type AnalysisContext } from "../context.js";
import type { PlayerRow } from "../xi.js";
import { physicalReliance, projectFit, projectValue } from "./ageing.js";
import { computePriceBand } from "./pricing.js";
import { buildChain } from "./chains.js";
import { buildSales } from "./sales.js";
import { buildSuccession } from "./succession.js";
import { buildHealth } from "./health.js";
import { buildBoard } from "./board.js";

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
    scoutGrade: null,
  };
}

const FULL_4231: PositionSlot[] = ["GK", "D-R", "D-C", "D-C", "D-L", "DM-C", "DM-C", "AM-R", "AM-C", "AM-L", "ST-C"];

function rowsOf(players: Player[]): PlayerRow[] {
  const scores = buildScores(players);
  return players.map((p) => ({ player: p, scores: scores.find((s) => s.playerId === p.id)! }));
}

function ctxWith(
  squadPlayers: Player[],
  shortlistPlayers: Player[] = [],
  budget = 0,
  useFullBudget = true,
): AnalysisContext {
  return buildContext({
    squad: rowsOf(squadPlayers),
    shortlist: rowsOf(shortlistPlayers),
    formation: getFormation("4-2-3-1"),
    budget,
    useFullBudget,
  });
}

describe("ageing model", () => {
  it("never decays fit while every projected season is 29 or under", () => {
    expect(projectFit(70, 24, 0.9, 3)).toBe(70); // seasons land on 25, 26, 27
    expect(projectFit(70, 28, 0.9, 1)).toBe(70); // season lands on 29
  });

  it("a sprinter declines faster than a technician at the same age", () => {
    const technician = projectFit(70, 30, 0.1, 3);
    const sprinter = projectFit(70, 30, 0.95, 3);
    expect(sprinter).toBeLessThan(technician);
  });

  it("null age is a no-op", () => {
    expect(projectFit(70, null, 0.9, 3)).toBe(70);
  });

  it("never projects growth", () => {
    expect(projectFit(70, 33, 0.5, 3)).toBeLessThanOrEqual(70);
  });

  it("physicalReliance is fixed and moderate for goalkeepers", () => {
    const gk = player({ positions: ["GK"], base: 10 });
    expect(physicalReliance(gk)).toBe(0.35);
  });

  it("projectValue table is exact and monotonically non-increasing with age", () => {
    expect(projectValue(100, 27)).toBe(100);
    expect(projectValue(100, 29)).toBe(90);
    expect(projectValue(100, 30)).toBe(75);
    expect(projectValue(100, 31)).toBe(55);
    expect(projectValue(100, 32)).toBe(40);
    expect(projectValue(100, 33)).toBe(25);
    expect(projectValue(100, 36)).toBe(10);
    const ages = [24, 27, 28, 29, 30, 31, 32, 33, 34, 36];
    for (let i = 1; i < ages.length; i++) {
      expect(projectValue(100, ages[i]!)).toBeLessThanOrEqual(projectValue(100, ages[i - 1]!));
    }
  });
});

describe("price bands", () => {
  it("returns null when value is unknown", () => {
    expect(computePriceBand(null, 25, false)).toBeNull();
  });

  it("bands bracket the ask and release halves the fee", () => {
    const band = computePriceBand(10e6, 25, false);
    expect(band).not.toBeNull();
    expect(band!.low).toBeLessThan(band!.ask);
    expect(band!.high).toBeGreaterThan(band!.ask);

    const released = computePriceBand(10e6, 25, true);
    expect(released!.ask).toBeLessThan(band!.ask);
  });
});

describe("sale verdicts", () => {
  it("untouchable: elite young starter", () => {
    const squad = FULL_4231.map((s) => player({ positions: [s], base: s === "ST-C" ? 17 : 13, age: s === "ST-C" ? 24 : 25 }));
    const sales = buildSales(ctxWith(squad));
    const star = sales.find((s) => s.playerId === squad[squad.length - 1]!.id);
    expect(star?.verdict).toBe("untouchable");
  });

  it("release: fringe player with a poor fit and a better backup at the same slot", () => {
    const squad = [
      ...FULL_4231.map((s) => player({ positions: [s], base: 13 })),
      player({ positions: ["ST-C"], base: 4, age: 27, value: 2e6 }), // fringe, poor fit
      player({ positions: ["ST-C"], base: 12, age: 26 }), // better backup, takes the "backup" slot
    ];
    const sales = buildSales(ctxWith(squad));
    const fringe = sales.find((s) => s.playerId === squad[squad.length - 2]!.id);
    expect(fringe?.verdict).toBe("release");
    expect(fringe?.priceBand).not.toBeNull();
  });

  it("sell-now: old, declining starter with a ready internal backup", () => {
    const squad = [
      ...FULL_4231.filter((s) => s !== "ST-C").map((s) => player({ positions: [s], base: 13 })),
      player({ positions: ["ST-C"], base: 16, age: 33, value: 20e6 }),
      player({ positions: ["ST-C"], base: 15, age: 23, value: 10e6 }), // near-equal backup
    ];
    const sales = buildSales(ctxWith(squad));
    const veteran = sales.find((s) => s.playerId === squad[squad.length - 2]!.id);
    expect(veteran?.verdict).toBe("sell-now");
    expect(veteran?.priceBand).not.toBeNull();
    expect(veteran?.replacement?.ready).toBe(true);
  });

  it("projects sell-now decline from the starter slot pairFit, not bestRole (doc 17 §9.3)", () => {
    const squad = [
      ...FULL_4231.filter((s) => s !== "ST-C" && s !== "DM-C").map((s) => player({ positions: [s], base: 13, age: 25 })),
      player({ positions: ["DM-C"], base: 17, age: 25 }),
      player({ positions: ["DM-C"], base: 17, age: 25 }),
      player({
        positions: ["DM-C", "ST-C"],
        base: 16,
        overrides: { passing: 10, tackling: 10 },
        age: 33,
        value: 20e6,
      }),
      player({ positions: ["ST-C"], base: 15, age: 23, value: 10e6 }),
    ];
    const ctx = ctxWith(squad);
    const dual = squad[squad.length - 2]!;
    const row = ctx.byId.get(dual.id)!;
    const slot = ctx.slots.find((s) => s.starter?.id === dual.id);
    expect(slot).toBeTruthy();
    expect(row.scores.bestRole!.score).not.toBe(slot!.starter!.fit);

    const sales = buildSales(ctx);
    const rec = sales.find((s) => s.playerId === dual.id)!;
    expect(Number(rec.evidence.find((e) => e.label === "Fit")?.value)).toBe(slot!.starter!.fit);
  });

  it("does not name another actionable sell target as the replacement heir (doc 17 §10.2)", () => {
    const squad = [
      ...FULL_4231.filter((s) => s !== "ST-C").map((s) => player({ positions: [s], base: 13, age: 25, value: 1e6 })),
      player({ positions: ["ST-C"], base: 16, age: 33, value: 20e6 }),
      player({ positions: ["ST-C"], base: 15, age: 33, value: 18e6 }),
      player({ positions: ["ST-C"], base: 15, age: 22, value: 5e6 }),
    ];
    const sales = buildSales(ctxWith(squad));
    const veteran = squad[squad.length - 3]!;
    const heir = squad[squad.length - 2]!;
    const young = squad[squad.length - 1]!;
    expect(sales.find((s) => s.playerId === heir.id)?.verdict).toBe("sell-now");
    const veteranSale = sales.find((s) => s.playerId === veteran.id)!;
    expect(veteranSale.replacement?.playerId).toBe(young.id);
    expect(veteranSale.replacement?.playerId).not.toBe(heir.id);
  });

  it("sell-high via arbitrage: omits a null now-vs-12-months line and names the twin (doc 17 §3)", () => {
    const squad = [
      ...FULL_4231.filter((s) => s !== "ST-C").map((s) => player({ positions: [s], base: 13, value: 1e6, age: 25 })),
      player({ positions: ["ST-C"], base: 15, age: 26, value: 60e6 }),
    ];
    const shortlist = [player({ positions: ["ST-C"], base: 16, age: 24, value: 5e6 })];
    const sales = buildSales(ctxWith(squad, shortlist));
    const star = sales.find((s) => s.playerId === squad[squad.length - 1]!.id);
    expect(star?.verdict).toBe("sell-high");
    expect(star?.reasons.join(" ")).not.toMatch(/now vs .* in 12 months/i);
    expect(star?.reasons.some((r) => r.includes("does the same job"))).toBe(true);
  });

  it("sell-high in the sell-age window prints a material now-vs-12-months delta (doc 17 §3)", () => {
    // base 15 -> fit 75, comfortably under the untouchable elite-fit threshold (80).
    const squad = [
      ...FULL_4231.filter((s) => s !== "ST-C").map((s) => player({ positions: [s], base: 13, value: 1e6 })),
      player({ positions: ["ST-C"], base: 15, age: 29, value: 50e6 }),
      player({ positions: ["ST-C"], base: 15, age: 22, value: 5e6 }),
    ];
    const sales = buildSales(ctxWith(squad));
    const target = sales.find((s) => s.playerId === squad[squad.length - 2]!.id);
    expect(target?.verdict).toBe("sell-high");
    const line = target?.reasons.find((r) => r.includes("now vs"));
    expect(line).toBeTruthy();
    expect(line).toContain("€45M now vs");
    expect(line).toContain("€37.5M");
  });

  it("sell-high via arbitrage: a cheap shortlist replacement matches the starter", () => {
    const squad = [
      ...FULL_4231.filter((s) => s !== "ST-C").map((s) => player({ positions: [s], base: 13, value: 1e6, age: 25 })),
      // base 15 -> fit 75 (under the untouchable threshold); age 26 is outside the sell-age window.
      player({ positions: ["ST-C"], base: 15, age: 26, value: 60e6 }), // p90+ value
    ];
    const shortlist = [player({ positions: ["ST-C"], base: 16, age: 24, value: 5e6 })]; // better fit, much cheaper
    const sales = buildSales(ctxWith(squad, shortlist));
    const star = sales.find((s) => s.playerId === squad[squad.length - 1]!.id);
    expect(star?.verdict).toBe("sell-high");
    expect(star?.replacement?.source).toBe("shortlist");
    expect(star?.replacement?.netCost).toBeLessThan(0);
  });

  it("keep: an unremarkable, replaceable mid-squad player", () => {
    const squad = FULL_4231.map((s) => player({ positions: [s], base: 13, age: 25 }));
    const sales = buildSales(ctxWith(squad));
    expect(sales.every((s) => s.verdict === "keep" || s.verdict === "untouchable")).toBe(true);
  });

  it("value == null never yields a fee-based verdict (sell-now/sell-high)", () => {
    const squad = [
      ...FULL_4231.filter((s) => s !== "ST-C").map((s) => player({ positions: [s], base: 13 })),
      player({ positions: ["ST-C"], base: 16, age: 32, value: null }),
      player({ positions: ["ST-C"], base: 15, age: 23, value: null }),
    ];
    const sales = buildSales(ctxWith(squad));
    const noValue = sales.filter((s) => squad.find((p) => p.id === s.playerId)?.value == null);
    expect(noValue.length).toBeGreaterThan(0);
    for (const s of noValue) expect(["sell-now", "sell-high"]).not.toContain(s.verdict);
  });
});

describe("replacement chains", () => {
  it("prefers a free internal backup over an external signing of the same fit", () => {
    const squad = [
      ...FULL_4231.filter((s) => s !== "ST-C").map((s) => player({ positions: [s], base: 13 })),
      player({ positions: ["ST-C"], base: 16, age: 27, value: 20e6 }),
      player({ positions: ["ST-C"], base: 16, age: 23, value: 5e6 }), // internal, same fit as the shortlist option
    ];
    const shortlist = [player({ positions: ["ST-C"], base: 16, age: 22, value: 200e6 })]; // same fit, but pricey
    const ctx = ctxWith(squad, shortlist, 300e6, true);
    const chain = buildChain(ctx, squad[squad.length - 2]!.id);
    expect(chain?.source).toBe("internal");
  });

  it("ignores an external replacement priced above budgetCap + outgoing fee", () => {
    const squad = [
      ...FULL_4231.filter((s) => s !== "ST-C").map((s) => player({ positions: [s], base: 8 })),
      player({ positions: ["ST-C"], base: 16, age: 27, value: 10e6 }), // fee ≈ €10M
    ];
    // Far too expensive for a ~€10M fee plus a €1M cap to ever cover.
    const shortlist = [player({ positions: ["ST-C"], base: 16, age: 24, value: 500e6 })];
    const ctx = ctxWith(squad, shortlist, 1e6, true);
    const chain = buildChain(ctx, squad[squad.length - 1]!.id);
    expect(chain?.source).not.toBe("shortlist");
  });

  it("never names another XI starter as the internal heir (doc 17 §10.1)", () => {
    const squad = [
      ...FULL_4231.filter((s) => s !== "ST-C" && s !== "AM-L").map((s) => player({ positions: [s], base: 13 })),
      player({ positions: ["ST-C"], base: 16, age: 27, value: 20e6 }),
      player({ positions: ["AM-L", "ST-C"], base: 16, age: 24, value: 5e6 }),
    ];
    const ctx = ctxWith(squad);
    const stStarter = squad.find((p) => p.positions[0] === "ST-C" && p.age === 27)!;
    const lwStarter = squad.find((p) => p.positions.includes("AM-L"))!;
    const chain = buildChain(ctx, stStarter.id);
    expect(chain?.playerId).not.toBe(lwStarter.id);
  });

  it("returns source 'none' when nobody can replace the player", () => {
    const squad = FULL_4231.map((s) => player({ positions: [s], base: 12, age: 25 }));
    const ctx = ctxWith(squad, [], 0, true);
    const lone = squad.find((p) => p.positions[0] === "GK")!;
    const chain = buildChain(ctx, lone.id);
    // Only one GK in the squad and no shortlist -> no successor.
    expect(chain?.source).toBe("none");
    expect(chain?.ready).toBe(false);
  });
});

describe("succession board", () => {
  it("flags crisis for an old, declining starter with no cover", () => {
    const squad = [
      ...FULL_4231.filter((s) => s !== "ST-C").map((s) => player({ positions: [s], base: 13, age: 25 })),
      // Base 13 -> fit 65; at 38, next season's heavy age-decay drags him under the weak-fit line.
      player({ positions: ["ST-C"], base: 13, age: 38 }),
    ];
    const succession = buildSuccession(ctxWith(squad));
    const st = succession.find((e) => e.slotKey === "st");
    expect(st?.status).toBe("crisis");
  });

  it("is secure for a young starter with strong cover", () => {
    const squad = [
      ...FULL_4231.filter((s) => s !== "ST-C").map((s) => player({ positions: [s], base: 13, age: 25 })),
      player({ positions: ["ST-C"], base: 16, age: 23 }),
      player({ positions: ["ST-C"], base: 15, age: 21 }),
    ];
    const succession = buildSuccession(ctxWith(squad));
    const st = succession.find((e) => e.slotKey === "st");
    expect(st?.status).toBe("secure");
  });
});

describe("squad health index", () => {
  it("scores 50 liquidity when no player has a known value", () => {
    const squad = FULL_4231.map((s) => player({ positions: [s], base: 13, age: 25, value: null }));
    const ctx = ctxWith(squad);
    const succession = buildSuccession(ctx);
    const health = buildHealth(ctx, succession);
    expect(health.liquidity).toBe(50);
  });

  it("index is within 0-100 and each subscore is too", () => {
    const squad = FULL_4231.map((s) => player({ positions: [s], base: 13, age: 25, value: 5e6 }));
    const ctx = ctxWith(squad);
    const health = buildHealth(ctx, buildSuccession(ctx));
    for (const v of [health.index, health.xiQuality, health.depth, health.ageBalance, health.succession, health.liquidity]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});

describe("buildBoard", () => {
  it("is deterministic", () => {
    const squad = [
      ...FULL_4231.filter((s) => s !== "ST-C").map((s) => player({ positions: [s], base: 13, value: 1e6 })),
      player({ positions: ["ST-C"], base: 16, age: 29, value: 50e6 }),
      player({ positions: ["ST-C"], base: 15, age: 22, value: 5e6 }),
    ];
    const ctx = ctxWith(squad);
    const a = buildBoard(ctx);
    const b = buildBoard(ctx);
    expect(a.sales.map((s) => s.playerId + s.verdict)).toEqual(b.sales.map((s) => s.playerId + s.verdict));
    expect(a.health).toEqual(b.health);
    expect(a.expectedIncome).toBe(b.expectedIncome);
  });

  it("excludes keep/untouchable from the actionable sales list but keeps them in `all`", () => {
    const squad = FULL_4231.map((s) => player({ positions: [s], base: 17, age: 24 })); // all elite, all untouchable
    const ctx = ctxWith(squad);
    const board = buildBoard(ctx);
    expect(board.sales.length).toBe(0);
    expect(board.all.length).toBe(squad.length);
  });

  it("expected income is the sum of ask prices across the sales board", () => {
    const squad = [
      ...FULL_4231.filter((s) => s !== "ST-C").map((s) => player({ positions: [s], base: 13, value: 1e6 })),
      player({ positions: ["ST-C"], base: 16, age: 29, value: 50e6 }),
      player({ positions: ["ST-C"], base: 15, age: 22, value: 5e6 }),
    ];
    const ctx = ctxWith(squad);
    const board = buildBoard(ctx);
    const total = board.sales.reduce((s, r) => s + (r.priceBand?.ask ?? 0), 0);
    expect(board.expectedIncome).toBe(total);
  });
});
