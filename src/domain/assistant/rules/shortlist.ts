/**
 * SL rules — shortlist coverage of the squad's needs (docs/11-assistant-analytics.md §7).
 * A meta-analysis of the shortlist itself: can it actually fix what's wrong?
 */

import type { AnalysisContext } from "../context.js";
import type { RawInsight } from "../types.js";
import { T } from "../thresholds.js";
import { slotFit } from "../xi.js";
import { insightId, scoutAction } from "./helpers.js";

export function run(ctx: AnalysisContext): RawInsight[] {
  const out: RawInsight[] = [];
  if (ctx.shortlist.length === 0) return out;

  const nonSolid = ctx.slots.filter((s) => s.need !== "solid");
  let allCovered = nonSolid.length > 0;

  for (const s of nonSolid) {
    const eligibleShortlist = ctx.shortlist.filter((r) => r.player.positions.includes(s.slot.slot));
    const fits = eligibleShortlist.map((r) => slotFit(r.scores, s.slot.slot));
    const coveringWeak = fits.filter((f) => f >= T.WEAK_FIT).length;
    const coveringGood = fits.filter((f) => f >= T.GOOD_FIT).length;

    if (coveringWeak === 0) {
      allCovered = false;
      out.push({
        id: insightId("sl.uncovered-need", s.slotKey),
        cls: "shortlist",
        severity: "high",
        title: `Your shortlist can't fix ${s.label}`,
        detail: `${eligibleShortlist.length} shortlist player${eligibleShortlist.length === 1 ? "" : "s"} play${eligibleShortlist.length === 1 ? "s" : ""} ${s.label}, but none rate ${T.WEAK_FIT}+ there. Go scout the position properly before you spend on this window.`,
        evidence: [{ label: "Eligible shortlist players", value: `${eligibleShortlist.length}` }],
        subjects: [],
        slotKey: s.slotKey,
        action: scoutAction(s.slot.slot, { minFit: T.WEAK_FIT }),
      });
    }

    if (coveringGood >= 5) {
      out.push({
        id: insightId("sl.rich-vein", s.slotKey),
        cls: "shortlist",
        severity: "low",
        title: `Deep market at ${s.label}`,
        detail: `${coveringGood} shortlist players already rate ${T.GOOD_FIT}+ at ${s.label} — you have real options and can afford to be picky on price and age.`,
        evidence: [{ label: "Options", value: `${coveringGood}` }],
        subjects: [],
        slotKey: s.slotKey,
      });
    }
  }

  if (allCovered) {
    out.push({
      id: insightId("sl.everything-covered", ctx.formation.id),
      cls: "shortlist",
      severity: "praise",
      title: "The shortlist covers every gap",
      detail: "Every slot that needs help has at least one capable shortlist option behind it. This is a well-scouted window.",
      evidence: [],
      subjects: [],
    });
  }

  return out;
}
