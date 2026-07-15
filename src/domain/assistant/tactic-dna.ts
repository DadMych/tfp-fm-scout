/**
 * Target squad DNA per formation (docs/11-assistant-analytics.md §5).
 *
 * Each shape wants a rough mix of archetype families among its XI. Deficits/surpluses
 * become DNA insights; the map from family to position groups drives the "go scout for
 * this" action.
 */

import type { GeneralFamily } from "../archetypes/registry.js";
import type { PositionGroup } from "../positions.js";

export interface DnaTarget {
  readonly family: GeneralFamily;
  readonly want: number;
}

export const TACTIC_DNA: Record<string, readonly DnaTarget[]> = {
  "4-2-3-1": [
    { family: "Progressor", want: 2 },
    { family: "Creator", want: 2 },
    { family: "Destroyer", want: 2 },
    { family: "Finisher", want: 1 },
    { family: "Engine", want: 2 },
  ],
  "4-3-3": [
    { family: "Engine", want: 3 },
    { family: "Progressor", want: 2 },
    { family: "Runner", want: 2 },
    { family: "Finisher", want: 1 },
    { family: "Destroyer", want: 1 },
  ],
  "4-4-2": [
    { family: "Focal Point", want: 1 },
    { family: "Finisher", want: 2 },
    { family: "Engine", want: 2 },
    { family: "Creator", want: 1 },
    { family: "Destroyer", want: 2 },
  ],
  "3-5-2": [
    { family: "Destroyer", want: 2 },
    { family: "Progressor", want: 2 },
    { family: "Runner", want: 2 },
    { family: "Finisher", want: 2 },
  ],
};

/** Where to look on the Scout screen for a given family (used by DNA-deficit actions). */
export const FAMILY_GROUPS: Record<GeneralFamily, readonly PositionGroup[]> = {
  Progressor: ["DM/CM", "CB"],
  Creator: ["AM/W", "DM/CM"],
  Carrier: ["AM/W", "FB/WB"],
  Runner: ["AM/W", "ST", "FB/WB"],
  Engine: ["DM/CM", "AM/W"],
  Destroyer: ["CB", "DM/CM"],
  Finisher: ["ST", "AM/W"],
  "Focal Point": ["ST"],
  General: ["DM/CM", "CB"],
  "Shot-Stopper": ["GK"],
  Distributor: ["GK"],
  Commander: ["GK"],
  Sweeper: ["GK"],
};
