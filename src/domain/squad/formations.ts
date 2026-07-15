/**
 * Formations for the squad assistant (docs/08 — the "smart search" layer).
 *
 * Each slot is a real PositionSlot plus pitch coordinates (x: 0 left → 1 right,
 * y: 0 own goal → 1 opposition) for rendering, and a zone for aggregate strength.
 */

import type { PositionSlot } from "../positions.js";

export type Zone = "GK" | "DEF" | "MID" | "ATT";

export interface FormationSlot {
  readonly key: string;
  readonly label: string;
  readonly slot: PositionSlot;
  readonly zone: Zone;
  readonly x: number;
  readonly y: number;
}

/** Kind of on-pitch relationship a link represents (docs/11 §6.1). Decides what the pair needs. */
export type LinkType = "cb-pair" | "pivot" | "spine" | "wide" | "frontline" | "fb-cb";

export interface FormationLink {
  readonly a: string; // slot key
  readonly b: string; // slot key
  readonly type: LinkType;
}

export interface Formation {
  readonly id: string;
  readonly name: string;
  readonly slots: readonly FormationSlot[];
  readonly links: readonly FormationLink[];
}

const s = (
  key: string,
  label: string,
  slot: PositionSlot,
  zone: Zone,
  x: number,
  y: number,
): FormationSlot => ({ key, label, slot, zone, x, y });

const GK = (): FormationSlot => s("gk", "GK", "GK", "GK", 0.5, 0.06);

export const FORMATIONS: readonly Formation[] = [
  {
    id: "4-2-3-1",
    name: "4-2-3-1",
    slots: [
      GK(),
      s("dr", "RB", "D-R", "DEF", 0.85, 0.26),
      s("dcr", "RCB", "D-C", "DEF", 0.62, 0.2),
      s("dcl", "LCB", "D-C", "DEF", 0.38, 0.2),
      s("dl", "LB", "D-L", "DEF", 0.15, 0.26),
      s("dmr", "RDM", "DM-C", "MID", 0.62, 0.45),
      s("dml", "LDM", "DM-C", "MID", 0.38, 0.45),
      s("amr", "RW", "AM-R", "ATT", 0.83, 0.68),
      s("amc", "AM", "AM-C", "ATT", 0.5, 0.66),
      s("aml", "LW", "AM-L", "ATT", 0.17, 0.68),
      s("st", "ST", "ST-C", "ATT", 0.5, 0.9),
    ],
    links: [
      { a: "dcr", b: "dcl", type: "cb-pair" },
      { a: "dmr", b: "dml", type: "pivot" },
      { a: "dml", b: "amc", type: "spine" },
      { a: "dmr", b: "amc", type: "spine" },
      { a: "dr", b: "amr", type: "wide" },
      { a: "dl", b: "aml", type: "wide" },
      { a: "amr", b: "st", type: "frontline" },
      { a: "aml", b: "st", type: "frontline" },
      { a: "amc", b: "st", type: "frontline" },
      { a: "dr", b: "dcr", type: "fb-cb" },
      { a: "dl", b: "dcl", type: "fb-cb" },
    ],
  },
  {
    id: "4-3-3",
    name: "4-3-3",
    slots: [
      GK(),
      s("dr", "RB", "D-R", "DEF", 0.85, 0.26),
      s("dcr", "RCB", "D-C", "DEF", 0.62, 0.2),
      s("dcl", "LCB", "D-C", "DEF", 0.38, 0.2),
      s("dl", "LB", "D-L", "DEF", 0.15, 0.26),
      s("dm", "DM", "DM-C", "MID", 0.5, 0.42),
      s("mcr", "RCM", "M-C", "MID", 0.7, 0.55),
      s("mcl", "LCM", "M-C", "MID", 0.3, 0.55),
      s("amr", "RW", "AM-R", "ATT", 0.83, 0.78),
      s("aml", "LW", "AM-L", "ATT", 0.17, 0.78),
      s("st", "ST", "ST-C", "ATT", 0.5, 0.9),
    ],
    links: [
      { a: "dcr", b: "dcl", type: "cb-pair" },
      { a: "dm", b: "mcr", type: "pivot" },
      { a: "dm", b: "mcl", type: "pivot" },
      { a: "mcr", b: "st", type: "spine" },
      { a: "mcl", b: "st", type: "spine" },
      { a: "dr", b: "amr", type: "wide" },
      { a: "dl", b: "aml", type: "wide" },
      { a: "amr", b: "st", type: "frontline" },
      { a: "aml", b: "st", type: "frontline" },
      { a: "dr", b: "dcr", type: "fb-cb" },
      { a: "dl", b: "dcl", type: "fb-cb" },
    ],
  },
  {
    id: "4-4-2",
    name: "4-4-2",
    slots: [
      GK(),
      s("dr", "RB", "D-R", "DEF", 0.85, 0.26),
      s("dcr", "RCB", "D-C", "DEF", 0.62, 0.2),
      s("dcl", "LCB", "D-C", "DEF", 0.38, 0.2),
      s("dl", "LB", "D-L", "DEF", 0.15, 0.26),
      s("mr", "RM", "M-R", "MID", 0.85, 0.55),
      s("mcr", "RCM", "M-C", "MID", 0.6, 0.5),
      s("mcl", "LCM", "M-C", "MID", 0.4, 0.5),
      s("ml", "LM", "M-L", "MID", 0.15, 0.55),
      s("str", "RST", "ST-C", "ATT", 0.62, 0.88),
      s("stl", "LST", "ST-C", "ATT", 0.38, 0.88),
    ],
    links: [
      { a: "dcr", b: "dcl", type: "cb-pair" },
      { a: "mcr", b: "mcl", type: "pivot" },
      { a: "mr", b: "str", type: "wide" },
      { a: "ml", b: "stl", type: "wide" },
      { a: "str", b: "stl", type: "frontline" },
      { a: "dr", b: "mr", type: "wide" },
      { a: "dl", b: "ml", type: "wide" },
      { a: "dr", b: "dcr", type: "fb-cb" },
      { a: "dl", b: "dcl", type: "fb-cb" },
    ],
  },
  {
    id: "3-5-2",
    name: "3-5-2",
    slots: [
      GK(),
      s("dcr", "RCB", "D-C", "DEF", 0.72, 0.2),
      s("dc", "CB", "D-C", "DEF", 0.5, 0.18),
      s("dcl", "LCB", "D-C", "DEF", 0.28, 0.2),
      s("wbr", "RWB", "WB-R", "MID", 0.9, 0.48),
      s("mcr", "RCM", "M-C", "MID", 0.66, 0.52),
      s("dm", "CM", "M-C", "MID", 0.5, 0.46),
      s("mcl", "LCM", "M-C", "MID", 0.34, 0.52),
      s("wbl", "LWB", "WB-L", "MID", 0.1, 0.48),
      s("str", "RST", "ST-C", "ATT", 0.62, 0.88),
      s("stl", "LST", "ST-C", "ATT", 0.38, 0.88),
    ],
    links: [
      { a: "dcr", b: "dc", type: "cb-pair" },
      { a: "dc", b: "dcl", type: "cb-pair" },
      { a: "dm", b: "mcr", type: "pivot" },
      { a: "dm", b: "mcl", type: "pivot" },
      { a: "wbr", b: "mcr", type: "wide" },
      { a: "wbl", b: "mcl", type: "wide" },
      { a: "str", b: "stl", type: "frontline" },
      { a: "mcr", b: "str", type: "spine" },
      { a: "mcl", b: "stl", type: "spine" },
    ],
  },
];

export function getFormation(id: string): Formation {
  return FORMATIONS.find((f) => f.id === id) ?? FORMATIONS[0]!;
}
