import { describe, expect, it } from "vitest";
import { ATTRIBUTES } from "./attributes.js";
import { DERIVED_INPUTS } from "./derived.js";
import { isValidMetric } from "./metric-id.js";
import { ARCHETYPES } from "./archetypes/registry.js";
import { ROLES, getRole } from "./roles/registry.js";
import { TACTIC_PRESETS } from "./squad/tactic-presets.js";

describe("registry integrity", () => {
  it("has 36 archetypes with unique ids", () => {
    expect(ARCHETYPES.length).toBe(36);
    expect(new Set(ARCHETYPES.map((a) => a.id)).size).toBe(36);
  });

  it("references only valid metrics in archetype gates and weights", () => {
    for (const a of ARCHETYPES) {
      for (const g of a.gates) {
        expect(isValidMetric(g.metric), `${a.id} gate ${g.metric}`).toBe(true);
      }
      for (const m of [...a.core, ...a.major, ...a.minor]) {
        expect(isValidMetric(m), `${a.id} weight ${m}`).toBe(true);
      }
    }
  });

  it("has unique role ids with only registered attribute weights", () => {
    const attrIds = new Set(ATTRIBUTES.map((a) => a.id));
    const ids = new Set(ROLES.map((r) => r.id));
    expect(ids.size).toBe(ROLES.length);
    for (const r of ROLES) {
      expect(r.core.length).toBeGreaterThan(0);
      expect(getRole(r.id)).toBe(r);
      expect(r.id.startsWith(r.phase === "IP" ? "ip." : "oop.")).toBe(true);
      for (const tier of [r.core, r.major, r.minor] as const) {
        for (const id of tier) {
          expect(attrIds.has(id), `${r.id} weight ${id}`).toBe(true);
        }
      }
    }
  });

  it("derived inputs reference only registered attributes", () => {
    const attrIds = new Set(ATTRIBUTES.map((a) => a.id));
    for (const [derived, inputs] of Object.entries(DERIVED_INPUTS)) {
      for (const id of inputs) {
        expect(attrIds.has(id), `${derived} input ${id}`).toBe(true);
      }
    }
  });

  it("tactic presets reference registered role ids", () => {
    for (const preset of TACTIC_PRESETS) {
      for (const pair of Object.values(preset.slots)) {
        expect(getRole(pair.ip).id).toBe(pair.ip);
        expect(getRole(pair.oop).id).toBe(pair.oop);
      }
    }
  });

  it("scores only the requested archetype population", () => {
    expect(ARCHETYPES.filter((a) => a.pop === "outfield").length).toBe(32);
    expect(ARCHETYPES.filter((a) => a.pop === "gk").length).toBe(4);
  });
});
