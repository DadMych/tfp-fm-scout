/**
 * DNA rules — squad identity vs. tactic identity (docs/11-assistant-analytics.md §5).
 */

import { getArchetype, type GeneralFamily } from "../../archetypes/registry.js";
import type { AnalysisContext } from "../context.js";
import type { PlayerRow } from "../xi.js";
import type { RawInsight } from "../types.js";
import { T } from "../thresholds.js";
import { TACTIC_DNA, FAMILY_GROUPS } from "../tactic-dna.js";
import { surname } from "../phrases.js";
import { raw, insightId } from "./helpers.js";

function xiRows(ctx: AnalysisContext): PlayerRow[] {
  return [...ctx.xi.assignment.values()]
    .map((a) => ctx.byId.get(a.id))
    .filter((r): r is PlayerRow => !!r);
}

function topFamily(row: PlayerRow): GeneralFamily | null {
  const top = row.scores.topArchetype;
  return top ? getArchetype(top.id).family : null;
}

/**
 * Best archetype score within a family (doc 12 §3.4). A player counts toward a family
 * if he can do that job well — even when his single top archetype is another family.
 * Gate-failed scores are already capped at 40 upstream, so no extra gating here.
 */
function familyBest(row: PlayerRow, family: GeneralFamily): number {
  let best = 0;
  for (const a of row.scores.archetypes) {
    if (getArchetype(a.id).family !== family) continue;
    if (a.score > best) best = a.score;
  }
  return best;
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
  const targets = TACTIC_DNA[ctx.formation.id] ?? [];

  for (const target of targets) {
    // Count by family-best score across ALL archetypes (doc 12 §3.4), not topArchetype
    // identity — a player who can do the job counts, whatever his headline label is.
    const scored = xi
      .map((row) => ({ row, score: familyBest(row, target.family) }))
      .sort((a, b) => b.score - a.score);
    const have = scored.filter((s) => s.score >= T.DNA_BADGE).length;

    if (have < target.want) {
      const groups = FAMILY_GROUPS[target.family];
      const nearest = scored.filter((s) => s.score < T.DNA_BADGE).slice(0, 2);
      const nearestText =
        nearest.length > 0
          ? ` Closest: ${nearest.map((n) => `${surname(n.row.player.name)} (${Math.round(n.score)})`).join(", ")}.`
          : "";
      out.push({
        id: insightId("dna.deficit", `${ctx.formation.id}-${target.family}`),
        cls: "dna",
        severity: have === 0 ? "high" : "medium",
        title: `Not enough ${target.family}s for ${ctx.formation.name}`,
        detail: `${ctx.formation.name} wants ${target.want} ${target.family}${target.want > 1 ? "s" : ""} in the XI (family score ${T.DNA_BADGE}+); you have ${have}.${nearestText}`,
        evidence: [
          { label: target.family, value: `${have} / ${target.want}` },
          ...nearest.map((n) => ({ label: surname(n.row.player.name), value: `${Math.round(n.score)}` })),
        ],
        subjects: nearest.map((n) => n.row.player.id),
        ...(groups[0] ? { action: { kind: "scout" as const, filters: { group: groups[0] } } } : {}),
      });
    } else if (have >= target.want + 2) {
      out.push({
        id: insightId("dna.surplus", `${ctx.formation.id}-${target.family}`),
        cls: "dna",
        severity: "low",
        title: `Overloaded on ${target.family}s`,
        detail: `You have ${have} ${target.family}s in the XI against a target of ${target.want} — depth here, but it may be depth you don't need.`,
        evidence: [{ label: target.family, value: `${have} / ${target.want}` }],
        subjects: [],
      });
    }
  }

  // Identity: the most common top-archetype family across the XI, if it's a real majority.
  const allCounts = new Map<GeneralFamily, number>();
  for (const row of xi) {
    const fam = topFamily(row);
    if (fam) allCounts.set(fam, (allCounts.get(fam) ?? 0) + 1);
  }
  const identity = [...allCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (identity && identity[1] >= 4) {
    out.push({
      id: insightId("dna.identity", identity[0]),
      cls: "dna",
      severity: "praise",
      title: `Your identity: ${identity[0]} football`,
      detail: `${identity[1]} of your XI are primarily ${identity[0]}s — that's a real, coherent identity, not a random collection of individuals.`,
      evidence: [{ label: identity[0], value: `${identity[1]} of 11` }],
      subjects: [],
    });
  }

  // Style read — one sentence, first matching rule wins.
  const speeds = xi.map((r) => raw(r, "speed")).filter((v): v is number => v != null);
  const engines = xi.map((r) => raw(r, "workEngine")).filter((v): v is number => v != null);
  const aerials = xi.map((r) => raw(r, "aerial")).filter((v): v is number => v != null);
  const medSpeed = median(speeds);
  const medEngine = median(engines);
  const medAerial = median(aerials);
  const runnerEngine = (allCounts.get("Runner") ?? 0) + (allCounts.get("Engine") ?? 0);
  const progressorCreator = (allCounts.get("Progressor") ?? 0) + (allCounts.get("Creator") ?? 0);
  const destroyerEngine = (allCounts.get("Destroyer") ?? 0) + (allCounts.get("Engine") ?? 0);
  const focalPoint = allCounts.get("Focal Point") ?? 0;

  let style: string;
  if (medSpeed >= 14 && runnerEngine >= 4) {
    style = "Built to run: this is a transition team that punishes space.";
  } else if (progressorCreator >= 5) {
    style = "A possession side — you'll dominate the ball and need runners to turn it into goals.";
  } else if (medAerial >= 13 && focalPoint >= 1) {
    style = "Direct and physical — go long, win the second ball, feed the target man.";
  } else if (destroyerEngine >= 5) {
    style = "A counter-press unit: win it high, strike before the defence sets.";
  } else {
    style = "A balanced profile with no extreme lean — tactics can go anywhere, which also means no built-in identity.";
  }
  out.push({
    id: insightId("dna.style-read", ctx.formation.id),
    cls: "dna",
    severity: "low",
    title: "Style read",
    detail: style,
    evidence: [
      { label: "Median speed", value: medSpeed.toFixed(1) },
      { label: "Median work engine", value: medEngine.toFixed(1) },
      { label: "Median aerial", value: medAerial.toFixed(1) },
    ],
    subjects: [],
  });

  return out;
}
