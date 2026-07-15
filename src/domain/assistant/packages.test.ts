import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseExport } from "../../import/parse.js";
import { buildScores } from "../scoring/dataset.js";
import { getFormation } from "../squad/formations.js";
import { buildContext } from "./context.js";
import { buildPackages } from "./packages.js";
import { T } from "./thresholds.js";
import type { PlayerRow } from "./xi.js";

function loadRows(path: string): PlayerRow[] {
  const { players } = parseExport(readFileSync(path, "utf8"));
  const scores = buildScores(players);
  return players.map((p) => ({ player: p, scores: scores.find((s) => s.playerId === p.id)! }));
}

const squad = loadRows("samples/real/fm26_squad_view.csv");
const shortlist = loadRows("samples/real/fm26_search_big.csv");

const SPENDER_IDS = new Set(["galactico", "win-now", "marquee", "spine", "flanks"]);

function ctxFor(budget: number, useFullBudget = false) {
  return buildContext({
    squad,
    shortlist,
    formation: getFormation("4-2-3-1"),
    budget,
    useFullBudget,
  });
}

describe("buildPackages v3 (doc 12 §4, real data)", () => {
  const ctx = ctxFor(80e6); // cap = 64M

  it("spender packages hit the spend floor; at least one real spender exists", () => {
    const pkgs = buildPackages(ctx);
    const spenders = pkgs.filter((p) => SPENDER_IDS.has(p.id));
    expect(spenders.length).toBeGreaterThan(0);
    for (const p of spenders) {
      const strategyCap = p.netSpend + p.remaining;
      expect(p.totalCost).toBeGreaterThanOrEqual(T.PKG_SPEND_FLOOR * strategyCap);
    }
  });

  it("no two shown packages overlap by more than PKG_MAX_OVERLAP", () => {
    const pkgs = buildPackages(ctx);
    for (let i = 0; i < pkgs.length; i++) {
      for (let j = i + 1; j < pkgs.length; j++) {
        const a = new Set(pkgs[i]!.moves.map((m) => m.playerId));
        const b = new Set(pkgs[j]!.moves.map((m) => m.playerId));
        let inter = 0;
        for (const x of a) if (b.has(x)) inter += 1;
        const jaccard = inter / (a.size + b.size - inter);
        expect(jaccard).toBeLessThanOrEqual(T.PKG_MAX_OVERLAP);
      }
    }
  });

  it("a marquee, when shown, costs a real fraction of the cap", () => {
    const pkgs = buildPackages(ctx);
    const marquee = pkgs.find((p) => p.id === "marquee");
    if (marquee) {
      expect(marquee.totalCost).toBeGreaterThanOrEqual(T.MARQUEE_MIN_FRAC * ctx.budgetCap);
    }
  });

  it("drops spender strategies entirely when the cap is too big to fill", () => {
    // €1B budget → 35% marquee floor is €280M+: no such player exists, and no spender
    // can reach 60% of the cap. Value strategies survive.
    const bigCtx = ctxFor(1e9, true);
    const pkgs = buildPackages(bigCtx);
    expect(pkgs.some((p) => SPENDER_IDS.has(p.id))).toBe(false);
    expect(pkgs.length).toBeGreaterThan(0);
  });

  it("spender packages convert leftover budget into depth signings", () => {
    const pkgs = buildPackages(ctx);
    const withDepth = pkgs.filter((p) => p.moves.some((m) => m.kind === "depth"));
    expect(withDepth.length).toBeGreaterThan(0);
    for (const p of withDepth) {
      for (const m of p.moves.filter((m) => m.kind === "depth")) {
        expect(m.newFit).toBeGreaterThanOrEqual(T.THIN_BACKUP);
        expect(m.why).toMatch(/cover/);
      }
    }
  });

  it("every move carries a profile and a why-sentence; package metrics are coherent", () => {
    const pkgs = buildPackages(ctx);
    expect(pkgs.length).toBeGreaterThan(0);
    for (const p of pkgs) {
      expect(p.capUsed).toBeGreaterThanOrEqual(0);
      expect(p.capUsed).toBeLessThanOrEqual(1);
      expect(p.totalCost + p.remaining).toBeGreaterThan(0);
      expect(p.rationale.split(". ").length).toBeGreaterThanOrEqual(3);
      for (const m of p.moves) {
        expect(m.profile.length).toBeGreaterThan(0);
        expect(m.why.length).toBeGreaterThan(10);
      }
    }
  });

  it("never breaches the strategy cash cap on net spend (doc 20)", () => {
    const pkgs = buildPackages(ctx);
    for (const p of pkgs) {
      if (p.id === "churn") {
        expect(p.netSpend).toBeLessThanOrEqual(0);
        continue;
      }
      expect(p.netSpend).toBeLessThanOrEqual(ctx.budgetCap);
    }
  });

  it("keeps every package inside the squad cap with coherent cash (doc 20)", () => {
    const pkgs = buildPackages(ctx);
    expect(pkgs.length).toBeGreaterThan(0);
    for (const p of pkgs) {
      expect(p.squadAfter).toBeLessThanOrEqual(ctx.squadCap);
      expect(p.netSpend).toBe(p.totalCost - p.income);
      expect(p.netSpend).toBeLessThanOrEqual(ctx.budgetCap + 1);
      expect(p.windowSummary).toMatch(/squad \d+\/\d+/);
      expect(p.loans).toBeDefined();
    }
  });

  it("may attach sales or loans when the squad is over the registration cap (doc 20)", () => {
    const tight = buildContext({
      squad,
      shortlist,
      formation: getFormation("4-2-3-1"),
      budget: 80e6,
      useFullBudget: false,
      squadCap: 25,
    });
    const pkgs = buildPackages(tight);
    // Real FM squads are often >25; at least one plan should free places or stay under.
    expect(pkgs.every((p) => p.squadAfter <= 25)).toBe(true);
  });

  it("non-depth moves name displaced players and fate (doc 19 §5)", () => {
    const pkgs = buildPackages(ctx);
    const withMoves = pkgs.find((p) => p.moves.some((m) => m.kind !== "depth" && m.out != null));
    if (!withMoves) return;
    const starter = withMoves.moves.find((m) => m.kind !== "depth" && m.out);
    expect(starter?.out?.name.length).toBeGreaterThan(0);
    expect(["bench", "sell", "cover", "loan", "b-team"]).toContain(starter?.out?.fate);
  });

  it("window summary names the registration ledger (doc 20)", () => {
    const pkgs = buildPackages(ctx);
    for (const p of pkgs) {
      expect(p.windowSummary).toMatch(/\d+ in/);
      expect(p.windowSummary).toMatch(/squad \d+\/\d+/);
      expect(p.windowSummary).not.toMatch(/0 loaned/);
      expect(p.xiDiff.length).toBeGreaterThan(0);
      // Consequence names a person when a signing covers the sold starter.
      for (const s of p.sales) {
        expect(s.consequence).not.toMatch(/a signing in this package/);
      }
    }
  });

  it("never sells assets a plan doesn't need to sell (doc 20 three-pass exits)", () => {
    const pkgs = buildPackages(ctx);
    for (const p of pkgs) {
      if (p.id === "churn") continue; // churn's whole point is selling to fund
      const stratCap = p.netSpend + p.remaining;
      if (p.totalCost <= stratCap && p.sales.length > 0) {
        // Sales without funding pressure are only allowed for registration size,
        // and then only after loans: total exits must not overshoot the squeeze.
        const prospects = p.moves.filter((m) => m.kind === "prospect").length;
        const residents = p.moves.length - prospects;
        const needFree = Math.max(0, squad.length + residents - ctx.squadCap);
        expect(p.sales.length + p.loans.length - prospects).toBeLessThanOrEqual(needFree);
      }
    }
  });

  it("moneyball signs players with a future, not post-peak stopgaps", () => {
    const pkgs = buildPackages(ctx);
    const mb = pkgs.find((p) => p.id === "moneyball");
    if (!mb) return;
    for (const m of mb.moves) {
      expect(m.age).not.toBeNull();
      expect(m.age!).toBeLessThanOrEqual(T.AGE_PEAK_END);
    }
  });

  it("never admits a downgrade when the slot already has a starter (doc 17 §10.3)", () => {
    const pkgs = buildPackages(ctx);
    for (const p of pkgs) {
      for (const m of p.moves) {
        if (m.kind === "prospect") continue;
        if (m.currentFit > 0) expect(m.delta).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("press-conversion package filters on derived workEngine (doc 17 §10.5)", () => {
    const pkgs = buildPackages(ctx);
    const press = pkgs.find((p) => p.id === "press-conversion");
    if (!press) return;
    for (const m of press.moves) {
      const row = shortlist.find((r) => r.player.id === m.playerId)!;
      expect(row.scores.derived.workEngine).toBeGreaterThanOrEqual(13);
    }
  });
});
