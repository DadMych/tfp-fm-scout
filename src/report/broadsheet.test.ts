import { describe, it, expect } from "vitest";
import { ATTRIBUTES } from "../domain/attributes.js";
import type { AttrVector } from "../domain/attr-value.js";
import type { Player } from "../domain/player.js";
import { buildScores } from "../domain/scoring/dataset.js";
import { renderReport } from "./broadsheet.js";

function attrs(v: number): AttrVector {
  const out: AttrVector = {};
  for (const a of ATTRIBUTES) out[a.id] = { min: v, max: v };
  return out;
}

function player(id: string, name: string, v: number, positions: Player["positions"]): Player {
  return { id, name, age: 24, positions, attrs: attrs(v), club: "Test FC", nationality: "Nowhere" };
}

const META = {
  datasetLabel: "Test set",
  sourceFile: "test.csv",
  generatedAt: new Date("2026-07-04T00:00:00Z"),
  maskedAttributeShare: 0,
};

describe("broadsheet report", () => {
  const players = [
    player("1", "Alpha", 18, ["DM-C", "M-C"]),
    player("2", "Bravo", 12, ["ST-C"]),
    player("3", "Charlie", 15, ["D-C"]),
  ];
  const scores = buildScores(players);
  const html = renderReport(players, scores, META);

  it("emits a self-contained HTML document with every player", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    for (const p of players) expect(html).toContain(p.name);
  });

  it("never renders a percentile bar wider than 100% (0–100 scale)", () => {
    const widths = [...html.matchAll(/width:(\d+)%/g)].map((m) => Number(m[1]));
    expect(widths.length).toBeGreaterThan(0);
    for (const w of widths) expect(w).toBeLessThanOrEqual(100);
  });

  it("labels percentiles on the 0–100 scale, never inflated (no 3-digit percentile)", () => {
    // The scale bug rendered "9800th percentile" / num 9900; guard against its return.
    expect(html).not.toMatch(/\d{3,}(st|nd|rd|th) percentile/);
  });

  it("escapes HTML in player-supplied strings", () => {
    const nasty = [player("x", 'Evil <script>&"', 15, ["ST-C"])];
    const out = renderReport(nasty, buildScores(nasty), META);
    expect(out).toContain("Evil &lt;script&gt;&amp;&quot;");
    expect(out).not.toContain("<script>");
  });
});
