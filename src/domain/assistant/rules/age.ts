/**
 * AGE rules — squad ageing, succession and sell windows (docs/11-assistant-analytics.md §4).
 * Quality proxy throughout: `scores.bestRole.score` (absolute 0–100).
 */

import type { AnalysisContext } from "../context.js";
import type { PlayerRow } from "../xi.js";
import type { RawInsight } from "../types.js";
import { T } from "../thresholds.js";
import { surname } from "../phrases.js";
import { blockedBy, insightId } from "./helpers.js";

function bestFit(row: PlayerRow): number {
  return row.scores.bestRole?.score ?? 0;
}

export function run(ctx: AnalysisContext): RawInsight[] {
  const out: RawInsight[] = [];
  const starters = [...ctx.slots].filter((s) => s.starter);

  // AGE-1: peak-heavy XI.
  const peakHeavy = starters.filter((s) => (s.starterAge ?? 0) >= T.AGE_PEAK_END);
  if (peakHeavy.length >= 4) {
    out.push({
      id: insightId("age.peak-heavy", "xi"),
      cls: "age",
      severity: "high",
      title: "This XI is ageing together",
      detail: `${peakHeavy.length} of your first XI are ${T.AGE_PEAK_END}+ (${peakHeavy
        .map((s) => surname(ctx.byId.get(s.starter!.id)?.player.name ?? ""))
        .join(", ")}). They'll decline in the same seasons — plan renewal now, not all at once.`,
      evidence: peakHeavy.map((s) => ({
        label: surname(ctx.byId.get(s.starter!.id)?.player.name ?? s.slotKey),
        value: `${s.starterAge}`,
      })),
      subjects: peakHeavy.map((s) => s.starter!.id),
    });
  }

  // AGE-2: no peak-age core.
  const peakCore = ctx.squad.filter(
    (r) => r.player.age != null && r.player.age >= 25 && r.player.age <= T.AGE_PEAK_END && bestFit(r) >= T.GOOD_FIT,
  );
  if (peakCore.length < 3) {
    out.push({
      id: insightId("age.no-core", "squad"),
      cls: "age",
      severity: "medium",
      title: "No peak-age core",
      detail: `Only ${peakCore.length} of your squad are 25–${T.AGE_PEAK_END} with a role fit of ${T.GOOD_FIT}+ — the age band that should carry a team usually has more than this.`,
      evidence: [{ label: "Peak-age, good-fit players", value: `${peakCore.length}` }],
      subjects: peakCore.map((r) => r.player.id),
    });
  }

  // AGE-4: blocked kids.
  for (const bench of ctx.bench) {
    const age = bench.player.age;
    if (age == null || age > T.AGE_DEV) continue;
    if (bestFit(bench) < T.GEM_FIT) continue;
    const blocker = blockedBy(ctx, bench);
    if (!blocker) continue;
    const starterName = ctx.byId.get(blocker.starter!.id)?.player.name ?? "the incumbent";
    out.push({
      id: insightId("age.kids-blocked", bench.player.id),
      cls: "age",
      severity: "low",
      title: `${surname(bench.player.name)} is blocked — loan him`,
      detail: `${surname(bench.player.name)} (${age}) already rates ${Math.round(bestFit(bench))} but ${surname(starterName)} (${blocker.starterAge}, fit ${blocker.starter!.fit}) isn't going anywhere. A loan keeps him developing instead of rotting on the bench.`,
      evidence: [{ label: `${surname(bench.player.name)} best fit`, value: `${Math.round(bestFit(bench))}` }],
      subjects: [bench.player.id, blocker.starter!.id],
    });
  }

  // AGE-5: youth pipeline.
  const youngGems = ctx.squad.filter((r) => (r.player.age ?? 99) <= T.AGE_DEV && bestFit(r) >= T.GEM_FIT);
  if (youngGems.length >= 3) {
    out.push({
      id: insightId("age.youth-pipeline", "squad"),
      cls: "age",
      severity: "praise",
      title: "The academy is feeding the first team",
      detail: `${youngGems.length} players ${T.AGE_DEV} or under already rate ${T.GEM_FIT}+ in their best role: ${youngGems
        .map((r) => surname(r.player.name))
        .join(", ")}.`,
      evidence: youngGems.map((r) => ({ label: surname(r.player.name), value: `${Math.round(bestFit(r))}` })),
      subjects: youngGems.map((r) => r.player.id),
    });
  }

  // AGE-6: veteran dependence.
  for (const s of starters) {
    if ((s.starterAge ?? 0) < T.AGE_RISK) continue;
    if (s.need !== "thin" && s.need !== "ageing") continue;
    if (s.starter!.fit < T.GOOD_FIT) continue;
    const name = ctx.byId.get(s.starter!.id)?.player.name ?? "him";
    out.push({
      id: insightId("age.veteran-dependence", s.slotKey),
      cls: "age",
      severity: "high",
      title: `It all rests on ${surname(name)}`,
      detail: `${surname(name)} is ${s.starterAge}, rated ${s.starter!.fit} at ${s.label}, and the squad has no real cover if he breaks down.`,
      evidence: [
        { label: "Age", value: `${s.starterAge}` },
        { label: "Fit", value: `${s.starter!.fit}` },
      ],
      subjects: [s.starter!.id],
      slotKey: s.slotKey,
    });
  }

  return out;
}
