/**
 * Canonical tactic presets (docs/07 §1, doc 15 P2).
 * Each formation slot maps to a sensible IP + OOP role pair for pairScore fit.
 */

import { FORMATIONS } from "./formations.js";
import { getRole } from "../roles/registry.js";

export interface SlotRolePair {
  readonly ip: string;
  readonly oop: string;
}

export interface TacticPreset {
  readonly id: string;
  readonly name: string;
  readonly slots: Readonly<Record<string, SlotRolePair>>;
}

const GK: SlotRolePair = { ip: "ip.goalkeeper", oop: "oop.goalkeeper" };
const CB: SlotRolePair = { ip: "ip.ballPlayingCentreBack", oop: "oop.stoppingCentreBack" };
const FB: SlotRolePair = { ip: "ip.fullBack", oop: "oop.pressingFullBack" };
const DM_SCREEN: SlotRolePair = { ip: "ip.halfBack", oop: "oop.screeningDefensiveMidfielder" };
const CM_BOX: SlotRolePair = { ip: "ip.boxToBoxMidfielder", oop: "oop.pressingCentralMidfielder" };
const CM_PLAY: SlotRolePair = { ip: "ip.midfieldPlaymaker", oop: "oop.screeningCentralMidfielder" };
const AM: SlotRolePair = { ip: "ip.advancedPlaymaker", oop: "oop.trackingAttackingMidfielder" };
const WING: SlotRolePair = { ip: "ip.insideWinger", oop: "oop.trackingWinger" };
const WIDE_FWD: SlotRolePair = { ip: "ip.wideForward", oop: "oop.wideOutletWinger" };
const ST: SlotRolePair = { ip: "ip.centreForward", oop: "oop.trackingCentreForward" };
const WB_ADV: SlotRolePair = { ip: "ip.advancedWingBack", oop: "oop.pressingWingBack" };
const WM: SlotRolePair = { ip: "ip.wideMidfielder", oop: "oop.trackingWideMidfielder" };
const ST_TARGET: SlotRolePair = { ip: "ip.targetForward", oop: "oop.trackingCentreForward" };

const PRESETS: readonly TacticPreset[] = [
  {
    id: "4-2-3-1",
    name: "4-2-3-1",
    slots: {
      gk: GK,
      dr: FB,
      dcr: CB,
      dcl: CB,
      dl: FB,
      dmr: DM_SCREEN,
      dml: DM_SCREEN,
      amr: WING,
      amc: AM,
      aml: WING,
      st: ST,
    },
  },
  {
    id: "4-3-3",
    name: "4-3-3",
    slots: {
      gk: GK,
      dr: FB,
      dcr: CB,
      dcl: CB,
      dl: FB,
      dm: { ip: "ip.deepLyingPlaymaker", oop: "oop.screeningDefensiveMidfielder" },
      mcr: CM_BOX,
      mcl: CM_BOX,
      amr: WIDE_FWD,
      aml: WIDE_FWD,
      st: ST,
    },
  },
  {
    id: "4-4-2",
    name: "4-4-2",
    slots: {
      gk: GK,
      dr: FB,
      dcr: CB,
      dcl: CB,
      dl: FB,
      mr: WM,
      mcr: CM_PLAY,
      mcl: CM_PLAY,
      ml: WM,
      str: ST_TARGET,
      stl: ST_TARGET,
    },
  },
  {
    id: "3-5-2",
    name: "3-5-2",
    slots: {
      gk: GK,
      dcr: CB,
      dc: CB,
      dcl: CB,
      wbr: WB_ADV,
      mcr: CM_BOX,
      dm: { ip: "ip.centralMidfielder", oop: "oop.screeningCentralMidfielder" },
      mcl: CM_BOX,
      wbl: WB_ADV,
      str: ST,
      stl: ST,
    },
  },
];

const BY_ID = new Map(PRESETS.map((p) => [p.id, p]));

export const TACTIC_PRESETS: readonly TacticPreset[] = PRESETS;

export function getTacticPreset(formationId: string): TacticPreset | null {
  return BY_ID.get(formationId) ?? null;
}

export function getSlotPair(formationId: string, slotKey: string): SlotRolePair | null {
  return BY_ID.get(formationId)?.slots[slotKey] ?? null;
}

/** Every shipped formation slot must have a valid IP+OOP pair. */
export function assertPresetCoverage(): void {
  for (const f of FORMATIONS) {
    const preset = getTacticPreset(f.id);
    if (!preset) throw new Error(`Missing tactic preset for ${f.id}`);
    for (const fs of f.slots) {
      const pair = preset.slots[fs.key];
      if (!pair) throw new Error(`Missing slot pair ${f.id}/${fs.key}`);
      getRole(pair.ip);
      getRole(pair.oop);
    }
  }
}
