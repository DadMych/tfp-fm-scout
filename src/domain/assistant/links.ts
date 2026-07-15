/**
 * Chemistry / partnership evaluation (docs/11-assistant-analytics.md §6, docs/07 §8).
 *
 * A link is a real on-pitch relationship declared per formation (e.g. the two centre-backs,
 * the double pivot, a full-back + winger down one flank). Each link type owns a short list
 * of capabilities the *pair* must cover between them; we score how well they cover it, and
 * penalise redundancy (two players who do the exact same job and cover nothing else).
 */

import { midOf } from "../attr-value.js";
import type { AttributeId } from "../attributes.js";
import { DERIVED_INPUTS, type DerivedId } from "../derived.js";
import { getArchetype } from "../archetypes/registry.js";
import type { Formation, FormationLink, LinkType } from "../squad/formations.js";
import type { PlayerRow } from "./xi.js";
import type { AnalysisContext } from "./context.js";
import { T } from "./thresholds.js";
import { surname } from "./phrases.js";

interface Cap {
  readonly label: string;
  covers(row: PlayerRow): boolean;
}

function isDerived(metric: string): metric is DerivedId {
  return metric in DERIVED_INPUTS;
}

function rawValue(row: PlayerRow, metric: string): number | null {
  return isDerived(metric)
    ? row.scores.derived[metric]
    : midOf(row.player.attrs, metric as AttributeId);
}

function cap(metric: string, threshold: number, label: string): Cap {
  return {
    label,
    covers: (row) => (rawValue(row, metric) ?? -1) >= threshold,
  };
}

function cap2(mA: string, tA: number, mB: string, tB: number, label: string): Cap {
  return {
    label,
    covers: (row) => (rawValue(row, mA) ?? -1) >= tA || (rawValue(row, mB) ?? -1) >= tB,
  };
}

export const LINK_CAPS: Record<LinkType, readonly Cap[]> = {
  "cb-pair": [
    cap("defActivity", 12, "front-foot defending"),
    cap("speed", 12, "covering pace"),
    cap("aerial", 13, "aerial command"),
    cap("passing", 12, "ball progression"),
  ],
  pivot: [
    cap("defActivity", 12, "ball-winning"),
    cap("creativity", 12, "progression"),
    cap("pressResist", 12, "press resistance"),
    cap("workEngine", 13, "legs"),
  ],
  spine: [
    cap("creativity", 13, "creativity"),
    cap("finishingPkg", 12, "goal threat"),
    cap("defPosition", 11, "screening"),
  ],
  wide: [
    cap("speed", 13, "pace on the flank"),
    cap2("crossing", 12, "dribbling", 13, "delivery or a dribbler"),
    cap("defActivity", 10, "flank cover"),
  ],
  frontline: [
    cap("finishingPkg", 13, "box finishing"),
    cap2("physicality", 12, "aerial", 12, "a focal point"),
    cap("speed", 13, "running in behind"),
  ],
  "fb-cb": [cap("defPosition", 12, "positional glue"), cap("speed", 11, "recovery pace")],
};

const LINK_TYPE_NAME: Record<LinkType, string> = {
  "cb-pair": "centre-back pairing",
  pivot: "double pivot",
  spine: "central spine",
  wide: "wide combination",
  frontline: "front line",
  "fb-cb": "full-back/centre-back axis",
};

/** Diversity-wanting link types: two players doing the same job is a weakness here. */
const WANTS_DIVERSITY: ReadonlySet<LinkType> = new Set(["pivot", "spine", "wide", "frontline"]);

export interface LinkEval {
  readonly link: FormationLink;
  readonly typeName: string;
  readonly aId: string;
  readonly bId: string;
  readonly partnership: number;
  readonly covered: readonly string[];
  readonly missing: readonly string[];
  readonly redundant: boolean;
  readonly read: string;
}

export interface LinkBoard {
  readonly links: readonly LinkEval[];
}

function familyOf(row: PlayerRow): string | null {
  const top = row.scores.topArchetype;
  if (!top) return null;
  return getArchetype(top.id).family;
}

function redundancyPenalty(a: PlayerRow, b: PlayerRow, type: LinkType): number {
  const famA = familyOf(a);
  const famB = familyOf(b);
  if (!famA || !famB) return 0;
  const sameFine = a.scores.topArchetype!.id === b.scores.topArchetype!.id;
  const sameFamily = famA === famB;
  if (!sameFamily) return 0;
  if (type === "cb-pair" || type === "fb-cb") return 0; // twin stoppers are fine here
  return sameFine ? 60 : 40;
}

function buildRead(
  a: PlayerRow,
  b: PlayerRow,
  caps: readonly Cap[],
  redundant: boolean,
): { covered: string[]; missing: string[]; read: string } {
  const covered: string[] = [];
  const missing: string[] = [];
  const suppliers: string[] = [];
  for (const c of caps) {
    const aHas = c.covers(a);
    const bHas = c.covers(b);
    if (aHas || bHas) {
      covered.push(c.label);
      if (aHas && !bHas) suppliers.push(`${surname(a.player.name)} covers ${c.label}`);
      else if (bHas && !aHas) suppliers.push(`${surname(b.player.name)} covers ${c.label}`);
    } else {
      missing.push(c.label);
    }
  }
  let read: string;
  if (redundant && missing.length > 0) {
    read = `Both want the same job — and nobody brings ${missing.join(" or ")}.`;
  } else if (redundant) {
    read = `Similar profiles — the job gets done, but they duplicate rather than complement each other.`;
  } else if (missing.length === 0) {
    read = suppliers.length > 0 ? `${suppliers.join("; ")} — they cover each other.` : "Both cover everything this pairing needs.";
  } else {
    read = `Nobody in this pair brings ${missing.join(" or ")}.`;
  }
  return { covered, missing, read };
}

export function evaluateLinks(ctx: AnalysisContext): LinkBoard {
  const links: LinkEval[] = [];
  for (const link of ctx.formation.links) {
    const a = ctx.xi.assignment.get(link.a);
    const b = ctx.xi.assignment.get(link.b);
    if (!a || !b) continue; // a hole on either side — no partnership to evaluate
    const rowA = ctx.byId.get(a.id);
    const rowB = ctx.byId.get(b.id);
    if (!rowA || !rowB) continue;

    const caps = LINK_CAPS[link.type];
    const penalty = WANTS_DIVERSITY.has(link.type) ? redundancyPenalty(rowA, rowB, link.type) : 0;
    const { covered, missing, read } = buildRead(rowA, rowB, caps, penalty >= 40);

    const individual = (a.fit + b.fit) / 2;
    const coverage = caps.length > 0 ? (100 * covered.length) / caps.length : 100;
    const balance = 100 - penalty;
    const partnership = Math.round(0.4 * individual + 0.45 * coverage + 0.15 * balance);

    links.push({
      link,
      typeName: LINK_TYPE_NAME[link.type],
      aId: a.id,
      bId: b.id,
      partnership,
      covered,
      missing,
      redundant: penalty >= 40,
      read,
    });
  }
  return { links };
}

export { LINK_TYPE_NAME };
export const PARTNERSHIP_WARN = T.PARTNERSHIP_WARN;
export const PARTNERSHIP_GOOD = T.PARTNERSHIP_GOOD;
export type { Formation };
