import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseExport } from "../../import/parse.js";
import { buildScores } from "../scoring/dataset.js";
import { getFormation } from "../squad/formations.js";
import { buildAssistantReport } from "./report.js";
import type { PlayerRow } from "./xi.js";

function loadRows(path: string): PlayerRow[] {
  const { players } = parseExport(readFileSync(path, "utf8"));
  const scores = buildScores(players);
  return players.map((p) => ({ player: p, scores: scores.find((s) => s.playerId === p.id)! }));
}

const squad = loadRows("samples/real/fm26_squad_view.csv");
const shortlist = loadRows("samples/real/fm26_search_big.csv");

describe("buildAssistantReport (real data)", () => {
  const params = {
    squad,
    shortlist,
    formation: getFormation("4-2-3-1"),
    budget: 120e6,
    useFullBudget: false,
  };

  it("is deterministic across repeated runs", () => {
    const a = buildAssistantReport(params);
    const b = buildAssistantReport(params);
    expect(a.insights.map((i) => i.id)).toEqual(b.insights.map((i) => i.id));
    expect(a.avgFit).toBe(b.avgFit);
    expect(a.packages.map((p) => p.id)).toEqual(b.packages.map((p) => p.id));
  });

  it("produces a rich, well-formed insight feed", () => {
    const rep = buildAssistantReport(params);
    expect(rep.insights.length).toBeGreaterThan(10);
    for (const i of rep.insights) {
      expect(i.title.length).toBeGreaterThan(0);
      expect(i.detail.length).toBeGreaterThan(0);
      expect(i.score).toBeGreaterThan(0);
    }
    // Sorted by score, descending.
    for (let i = 1; i < rep.insights.length; i++) {
      expect(rep.insights[i - 1]!.score).toBeGreaterThanOrEqual(rep.insights[i]!.score);
    }
  });

  it("covers multiple insight classes, not just one", () => {
    const rep = buildAssistantReport(params);
    const classes = new Set(rep.insights.map((i) => i.cls));
    expect(classes.size).toBeGreaterThanOrEqual(4);
  });

  it("never proposes a package that breaches the budget cap", () => {
    const rep = buildAssistantReport(params);
    for (const pk of rep.packages) {
      expect(pk.totalCost).toBeLessThanOrEqual(rep.budgetCap);
      expect(pk.afterTotalFit).toBeGreaterThan(pk.beforeTotalFit);
    }
  });

  it("names every package distinctly and gives it a rationale", () => {
    const rep = buildAssistantReport(params);
    const names = rep.packages.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    for (const pk of rep.packages) expect(pk.rationale.length).toBeGreaterThan(10);
  });

  it("builds a three-paragraph team report", () => {
    const rep = buildAssistantReport(params);
    expect(rep.teamReport.paragraphs.length).toBe(3);
    for (const p of rep.teamReport.paragraphs) expect(p.length).toBeGreaterThan(0);
  });

  it("evaluates chemistry links for every formation slot pairing with two real starters", () => {
    const rep = buildAssistantReport(params);
    expect(rep.linkBoard.links.length).toBeGreaterThan(0);
    for (const l of rep.linkBoard.links) {
      expect(l.partnership).toBeGreaterThanOrEqual(0);
      expect(l.partnership).toBeLessThanOrEqual(100);
    }
  });

  it("runs fast enough for an interactive click (< 500ms on real data)", () => {
    const start = Date.now();
    buildAssistantReport(params);
    expect(Date.now() - start).toBeLessThan(500);
  });

  // Doc 12 acceptance criteria.

  it("caps bargains, market class and praise (doc 12 §3)", () => {
    const rep = buildAssistantReport(params);
    const bargains = rep.insights.filter((i) => i.id.startsWith("mkt.bargain"));
    expect(bargains.length).toBeLessThanOrEqual(4);
    // One bargain per player.
    const subjects = bargains.map((i) => i.subjects[0]);
    expect(new Set(subjects).size).toBe(subjects.length);
    expect(rep.insights.filter((i) => i.cls === "market").length).toBeLessThanOrEqual(6);
    expect(rep.insights.filter((i) => i.severity === "praise").length).toBeLessThanOrEqual(3);
    expect(rep.insights.filter((i) => i.id.startsWith("mkt.unused-value")).length).toBeLessThanOrEqual(1);
  });

  it("keeps the priorities paragraph free of market pitches and lowercase mangling (doc 12 §3.6)", () => {
    const rep = buildAssistantReport(params);
    const p2 = rep.teamReport.paragraphs[1]!;
    expect(p2).toMatch(/^(Top priorities:|What's working:|No major alarms)/);
    expect(p2).not.toMatch(/fraction of the price/);
  });

  it("counts DNA by family-best archetype on real data (doc 12 §3.4)", () => {
    // With top-archetype-only counting this dataset reported three false 0/2 deficits.
    const rep = buildAssistantReport(params);
    const zeroDeficits = rep.insights.filter(
      (i) => i.id.startsWith("dna.deficit") && i.detail.includes("you have 0"),
    );
    expect(zeroDeficits.length).toBe(0);
  });
});
