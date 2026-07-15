import { describe, it, expect } from "vitest";
import { ATTRIBUTES } from "../domain/attributes.js";
import type { AttrVector } from "../domain/attr-value.js";
import type { Player } from "../domain/player.js";
import { buildScores } from "../domain/scoring/dataset.js";
import { dossierFileName, dossierHref, renderDossier } from "./dossier.js";

function attrs(v: number): AttrVector {
  const out: AttrVector = {};
  for (const a of ATTRIBUTES) out[a.id] = { min: v, max: v };
  return out;
}

const META = {
  datasetLabel: "Test set",
  sourceFile: "test.csv",
  generatedAt: new Date("2026-07-04T00:00:00Z"),
  maskedAttributeShare: 0,
};

function render(p: Player, cohort: Player[] = [p]) {
  const scores = buildScores(cohort);
  const s = scores.find((x) => x.playerId === p.id)!;
  return renderDossier(p, s, META);
}

describe("player dossier", () => {
  const base: Player = {
    id: "7",
    name: "Alpha Player",
    age: 21,
    positions: ["DM-C", "M-C"],
    attrs: attrs(15),
    club: "Test FC",
    nationality: "Nowhere",
    value: 42e6,
    heightCm: 183,
    foot: "Right",
  };

  it("emits a self-contained document carrying the identity facts", () => {
    const html = render(base);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Alpha Player");
    expect(html).toContain("€42M");
    expect(html).toContain("183 cm");
    expect(html).toContain("Right foot");
    // Links back to the ledger index.
    expect(html).toContain('href="../index.html"');
  });

  it("never renders a bar wider than 100%", () => {
    const html = render(base);
    const widths = [...html.matchAll(/width:(\d+)%/g)].map((m) => Number(m[1]));
    expect(widths.length).toBeGreaterThan(0);
    for (const w of widths) expect(w).toBeLessThanOrEqual(100);
  });

  it("renders ranged values as a band and masked values as a dash", () => {
    const ranged: Player = {
      ...base,
      id: "8",
      attrs: { ...attrs(15), finishing: { min: 12, max: 16 }, dribbling: null },
    };
    const html = render(ranged);
    expect(html).toContain("12–16");
    // Masked cell shows an en-dash value and a masked bar.
    expect(html).toContain('class="aval masked num">–');
    expect(html).toContain('class="pctbar masked"');
  });

  it("draws a radar when enough metrics are known", () => {
    const html = render(base);
    expect(html).toContain("aria-label=\"Percentile radar");
  });

  it("escapes player-supplied strings", () => {
    const nasty: Player = { ...base, id: "9", name: 'Evil <script>&"' };
    const html = render(nasty);
    expect(html).toContain("Evil &lt;script&gt;&amp;&quot;");
    expect(html).not.toContain("<script>");
  });

  it("builds safe, unique file names and hrefs", () => {
    expect(dossierFileName(base)).toBe("alpha-player-7.html");
    expect(dossierHref(base)).toBe("p/alpha-player-7.html");
    const accented: Player = { ...base, id: "3", name: "Beñat Türrientes" };
    expect(dossierFileName(accented)).toBe("benat-turrientes-3.html");
  });
});
