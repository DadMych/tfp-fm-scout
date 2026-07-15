/**
 * CHEM rules — partnership & link quality (docs/11-assistant-analytics.md §6, docs/07 §8).
 */

import type { AnalysisContext } from "../context.js";
import type { LinkBoard, LinkEval } from "../links.js";
import type { RawInsight } from "../types.js";
import { T } from "../thresholds.js";
import { surname } from "../phrases.js";
import { insightId } from "./helpers.js";

function names(ctx: AnalysisContext, ev: LinkEval): [string, string] {
  return [
    surname(ctx.byId.get(ev.aId)?.player.name ?? ev.aId),
    surname(ctx.byId.get(ev.bId)?.player.name ?? ev.bId),
  ];
}

function slotLabel(ctx: AnalysisContext, slotKey: string): string {
  return ctx.slots.find((s) => s.slotKey === slotKey)?.label ?? slotKey;
}

export function run(ctx: AnalysisContext, board: LinkBoard): RawInsight[] {
  const out: RawInsight[] = [];
  const great: LinkEval[] = [];

  for (const ev of board.links) {
    const [a, b] = names(ctx, ev);
    const linkKey = `${ev.link.a}-${ev.link.b}`;
    const labelA = slotLabel(ctx, ev.link.a);
    const labelB = slotLabel(ctx, ev.link.b);

    if (ev.partnership < T.PARTNERSHIP_WARN) {
      out.push({
        id: insightId("chem.weak-link", linkKey),
        cls: "chemistry",
        severity: "high",
        title: `${a} and ${b} don't combine`,
        detail: `Your ${ev.typeName} (${labelA}/${labelB}) scores only ${ev.partnership}/100 together. ${ev.read}`,
        evidence: [
          { label: "Partnership", value: `${ev.partnership}` },
          { label: "Covered", value: ev.covered.join(", ") || "nothing" },
          { label: "Missing", value: ev.missing.join(", ") || "nothing" },
        ],
        subjects: [ev.aId, ev.bId],
      });
    } else if (ev.partnership >= T.PARTNERSHIP_GOOD && ev.missing.length === 0) {
      great.push(ev);
    }

    // Redundancy is only card-worthy when it costs something (doc 12 §3.3).
    if (ev.redundant && (ev.partnership < T.PARTNERSHIP_GOOD || ev.missing.length > 0)) {
      out.push({
        id: insightId("chem.redundant", linkKey),
        cls: "chemistry",
        severity: "medium",
        title: `Two of the same player in the ${ev.typeName}`,
        detail: `${a} and ${b} share the same profile. ${ev.read}`,
        evidence: [{ label: "Partnership", value: `${ev.partnership}` }],
        subjects: [ev.aId, ev.bId],
      });
    } else if (!ev.redundant && ev.missing.length === 1) {
      out.push({
        id: insightId("chem.missing-cap", linkKey),
        cls: "chemistry",
        severity: "medium",
        title: `Your ${ev.typeName} lacks ${ev.missing[0]}`,
        detail: `${a} and ${b} cover everything else in this ${ev.typeName}, but neither brings ${ev.missing[0]}.`,
        evidence: [{ label: "Missing", value: ev.missing[0]! }],
        subjects: [ev.aId, ev.bId],
      });
    }
  }

  // Praise: at most one card (doc 12 §3.3). With 3+ great links, summarize the board
  // instead of naming every pair.
  great.sort((x, y) => y.partnership - x.partnership);
  const best = great[0];
  if (best) {
    const [a, b] = names(ctx, best);
    if (great.length >= 3) {
      out.push({
        id: insightId("chem.board-strong", ctx.formation.id),
        cls: "chemistry",
        severity: "praise",
        title: "The XI is chemically sound",
        detail: `${great.length} of ${board.links.length} partnerships rate ${T.PARTNERSHIP_GOOD}+ — the best is ${a} + ${b} (${best.typeName}, ${best.partnership}/100).`,
        evidence: great.map((ev) => {
          const [x, y] = names(ctx, ev);
          return { label: `${x} + ${y}`, value: `${ev.partnership}` };
        }),
        subjects: [best.aId, best.bId],
      });
    } else {
      out.push({
        id: insightId("chem.elite-link", `${best.link.a}-${best.link.b}`),
        cls: "chemistry",
        severity: "praise",
        title: `${a} + ${b} is a real partnership`,
        detail: `Your ${best.typeName} (${slotLabel(ctx, best.link.a)}/${slotLabel(ctx, best.link.b)}) rates ${best.partnership}/100 — everything this pairing needs is covered. ${best.read}`,
        evidence: [{ label: "Partnership", value: `${best.partnership}` }],
        subjects: [best.aId, best.bId],
      });
    }
  }

  return out;
}
