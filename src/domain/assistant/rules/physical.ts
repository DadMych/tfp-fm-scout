/**
 * PHYS rules — athletic profile of the XI (docs/11-assistant-analytics.md §5). All raw
 * attribute/derived values are on the 1–20 scale; comparisons stay within the XI.
 */

import type { AnalysisContext } from "../context.js";
import type { PlayerRow } from "../xi.js";
import type { RawInsight } from "../types.js";
import { surname } from "../phrases.js";
import { raw, insightId } from "./helpers.js";

function xiRows(ctx: AnalysisContext): PlayerRow[] {
  return [...ctx.xi.assignment.values()]
    .map((a) => ctx.byId.get(a.id))
    .filter((r): r is PlayerRow => !!r);
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function run(ctx: AnalysisContext): RawInsight[] {
  const out: RawInsight[] = [];
  const xi = xiRows(ctx);

  const defStarters = ctx.slots.filter((s) => s.slot.zone === "DEF" && s.starter);
  const defRows = defStarters
    .map((s) => ctx.byId.get(s.starter!.id))
    .filter((r): r is PlayerRow => !!r);
  if (defRows.length > 0 && defRows.every((r) => (raw(r, "speed") ?? 20) < 12)) {
    out.push({
      id: insightId("phys.slow-line", ctx.formation.id),
      cls: "physical",
      severity: "high",
      title: "A back line you can run past",
      detail: `Every starting defender rates below 12 for pace — ${defRows.map((r) => surname(r.player.name)).join(", ")}. Quick forwards will exploit this all season.`,
      evidence: defRows.map((r) => ({ label: surname(r.player.name), value: `${raw(r, "speed")}` })),
      subjects: defRows.map((r) => r.player.id),
    });
  }

  const engines = xi.map((r) => raw(r, "workEngine")).filter((v): v is number => v != null);
  const medEngine = median(engines);
  if (medEngine < 11) {
    out.push({
      id: insightId("phys.no-legs", ctx.formation.id),
      cls: "physical",
      severity: "medium",
      title: "This XI can't press for 90 minutes",
      detail: `Median work-rate/stamina across the XI is ${medEngine.toFixed(1)} — a high press will run out of legs well before full time.`,
      evidence: [{ label: "Median work engine", value: medEngine.toFixed(1) }],
      subjects: [],
    });
  }

  const outfielders = xi.filter((r) => !r.player.positions.includes("GK"));
  const aerialThreats = outfielders.filter((r) => (raw(r, "aerial") ?? 0) >= 13);
  if (aerialThreats.length < 2) {
    out.push({
      id: insightId("phys.aerial-soft", ctx.formation.id),
      cls: "physical",
      severity: "medium",
      title: "Set-piece defending will hurt",
      detail: `Only ${aerialThreats.length} outfield starter${aerialThreats.length === 1 ? "" : "s"} rate${aerialThreats.length === 1 ? "s" : ""} 13+ in the air. Opposition corners and long throws are a real threat.`,
      evidence: [{ label: "Aerial threats (13+)", value: `${aerialThreats.length}` }],
      subjects: aerialThreats.map((r) => r.player.id),
    });
  }

  const paceMerchants = xi.filter((r) => (raw(r, "speed") ?? 0) >= 15);
  if (paceMerchants.length >= 3) {
    out.push({
      id: insightId("phys.athletic-elite", ctx.formation.id),
      cls: "physical",
      severity: "praise",
      title: "Pace to burn",
      detail: `${paceMerchants.length} starters rate 15+ for pace: ${paceMerchants.map((r) => surname(r.player.name)).join(", ")}. Athletic outliers like this win matches on their own.`,
      evidence: paceMerchants.map((r) => ({ label: surname(r.player.name), value: `${raw(r, "speed")}` })),
      subjects: paceMerchants.map((r) => r.player.id),
    });
  }

  for (const s of ctx.slots) {
    if (!s.starter) continue;
    const isFlank = s.slot.slot.endsWith("-L") || s.slot.slot.endsWith("-R");
    if (!isFlank) continue;
    const row = ctx.byId.get(s.starter.id);
    if (!row?.player.foot || row.player.foot === "Either") continue;
    const side = s.slot.slot.endsWith("-L") ? "Left" : "Right";
    const opposite = side === "Left" ? "Right" : "Left";
    if (row.player.foot === opposite) {
      out.push({
        id: insightId("phys.one-footed-flanks", s.slotKey),
        cls: "physical",
        severity: "low",
        title: `${surname(row.player.name)} plays inverted`,
        detail: `${surname(row.player.name)} is ${row.player.foot}-footed on the ${side.toLowerCase()} — that can be a cutting-inside weapon, or just a player on the wrong side. Worth a look at his output.`,
        evidence: [
          { label: "Slot", value: side },
          { label: "Foot", value: row.player.foot },
        ],
        subjects: [row.player.id],
        slotKey: s.slotKey,
      });
    }
  }

  return out;
}
