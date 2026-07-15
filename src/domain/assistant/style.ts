import type { AnalysisContext } from "./context.js";
import type { LinkBoard } from "./links.js";
import { getArchetype } from "../archetypes/registry.js";
import { T } from "./thresholds.js";
import { surname } from "./phrases.js";

export interface StyleRead {
  readonly text: string;
  readonly evidence: readonly { readonly label: string; readonly value: string }[];
}

function pctOf(row: import("./xi.js").PlayerRow, metric: string): number | null {
  const p = row.scores.percentiles[metric as keyof typeof row.scores.percentiles];
  return p ?? null;
}

/** Deterministic "how to play this shape" reads (doc 19 §3). */
export function buildStyleReads(ctx: AnalysisContext, linkBoard: LinkBoard): StyleRead[] {
  const reads: StyleRead[] = [];

  const wideLinks = linkBoard.links.filter((l) => l.link.type === "wide");
  const centralLinks = linkBoard.links.filter((l) =>
    ["pivot", "spine", "cb-pair"].includes(l.link.type),
  );
  const wideAvg =
    wideLinks.length > 0
      ? wideLinks.reduce((s, l) => s + l.partnership, 0) / wideLinks.length
      : 0;
  const centralAvg =
    centralLinks.length > 0
      ? centralLinks.reduce((s, l) => s + l.partnership, 0) / centralLinks.length
      : 0;
  if (wideLinks.length >= 2 && wideAvg >= centralAvg + 8) {
    reads.push({
      text: "Your width is stronger than your middle — build through the flanks and let the centre hold shape.",
      evidence: [
        { label: "Wide pairs", value: `${Math.round(wideAvg)}/100` },
        { label: "Central pairs", value: `${Math.round(centralAvg)}/100` },
      ],
    });
  }

  for (const ev of wideLinks) {
    const fbSlot = ctx.slots.find((s) => s.slotKey === ev.link.a || s.slotKey === ev.link.b);
    const wSlot = ctx.slots.find(
      (s) => s.slotKey === (ev.link.a === fbSlot?.slotKey ? ev.link.b : ev.link.a),
    );
    if (!fbSlot?.starter || !wSlot?.starter) continue;
    const fb = ctx.byId.get(fbSlot.starter.id);
    const w = ctx.byId.get(wSlot.starter.id);
    if (!fb || !w) continue;
    const fbPace = pctOf(fb, "pace") ?? 0;
    const wArch = w.scores.topArchetype ? getArchetype(w.scores.topArchetype.id) : null;
    const inverted = wArch?.family === "Creator";
    if (fbPace >= 75 && inverted && ev.partnership >= T.PARTNERSHIP_GOOD) {
      reads.push({
        text: `Push ${surname(fb.player.name)} on as the overlapping outlet on the ${fbSlot.label.toLowerCase()} flank; ${surname(w.player.name)} cuts in and leaves him the whole channel.`,
        evidence: [
          { label: `${surname(fb.player.name)} pace`, value: `p${Math.round(fbPace)}` },
          { label: "Flank pair", value: `${ev.partnership}/100` },
        ],
      });
      break;
    }
  }

  const workRates = ctx.squad
    .filter((r) => ctx.starters.has(r.player.id))
    .map((r) => r.scores.derived.workEngine)
    .filter((v): v is number => v != null);
  const avgWork =
    workRates.length > 0 ? workRates.reduce((s, v) => s + v, 0) / workRates.length : 0;
  const cbSlots = ctx.slots.filter((s) => s.label === "LCB" || s.label === "RCB");
  const cbPace = cbSlots
    .map((s) => (s.starter ? pctOf(ctx.byId.get(s.starter.id)!, "pace") : null))
    .filter((p): p is number => p != null);
  const slowCb = cbPace.length > 0 && Math.max(...cbPace) < 55;
  if (avgWork >= 13) {
    reads.push({
      text: "This XI has the legs to press as a unit — trigger from the front foot and squeeze the middle.",
      evidence: [{ label: "XI work rate", value: avgWork.toFixed(1) }],
    });
  } else if (slowCb) {
    reads.push({
      text: "Your centre-backs lack recovery pace — sit deeper, protect the space in behind, and don't play a high line.",
      evidence: [{ label: "CB pace", value: `p${Math.round(Math.max(...cbPace))}` }],
    });
  }

  const stSlot = ctx.slots.find((s) => s.slot.zone === "ATT" && s.label === "ST");
  if (stSlot?.starter) {
    const st = ctx.byId.get(stSlot.starter.id);
    const arch = st?.scores.topArchetype ? getArchetype(st.scores.topArchetype.id) : null;
    const aerial = st ? pctOf(st, "aerial") ?? 0 : 0;
    if (arch?.family === "Finisher" && aerial >= 70) {
      reads.push({
        text: `Go direct early to ${surname(st!.player.name)} — he's the focal point and wins the first ball in the air.`,
        evidence: [
          { label: "Aerial", value: `p${Math.round(aerial)}` },
          { label: "Archetype", value: arch.name },
        ],
      });
    }
  }

  return reads.slice(0, 4);
}
