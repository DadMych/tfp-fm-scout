/**
 * Canonical position slots and cohort groups (docs/04-data-model.md §4, docs/03 §6.2).
 */

export type Side = "L" | "C" | "R";
export type Strata = "D" | "WB" | "DM" | "M" | "AM" | "ST";
export type PositionSlot = "GK" | `${Strata}-${Side}`;

/** Cohort groups used for percentile comparisons and role/archetype families. */
export type PositionGroup = "GK" | "CB" | "FB/WB" | "DM/CM" | "AM/W" | "ST";

/** A slot can belong to more than one group is not the case here, but a player does. */
export function slotToGroups(slot: PositionSlot): PositionGroup[] {
  if (slot === "GK") return ["GK"];
  const [strata, side] = slot.split("-") as [Strata, Side];
  switch (strata) {
    case "D":
      return side === "C" ? ["CB"] : ["FB/WB"];
    case "WB":
      return ["FB/WB"];
    case "DM":
      return ["DM/CM"];
    case "M":
      return side === "C" ? ["DM/CM"] : ["AM/W"];
    case "AM":
      return ["AM/W"];
    case "ST":
      return ["ST"];
  }
}

/** All groups a player covers across his playable slots. */
export function playerGroups(slots: readonly PositionSlot[]): PositionGroup[] {
  const set = new Set<PositionGroup>();
  for (const s of slots) for (const g of slotToGroups(s)) set.add(g);
  return [...set];
}

/** Canonical primary group — export column order must not change cohort (doc 17 §7.1). */
const GROUP_PRIORITY: readonly PositionGroup[] = ["GK", "CB", "FB/WB", "DM/CM", "AM/W", "ST"];

export function canonicalPrimaryGroup(slots: readonly PositionSlot[]): PositionGroup {
  const groups = new Set(playerGroups(slots));
  for (const g of GROUP_PRIORITY) {
    if (groups.has(g)) return g;
  }
  return "DM/CM";
}

/** Human label for a position-group cohort (radar captions, summary superlatives). */
export const GROUP_COHORT_LABEL: Record<PositionGroup, string> = {
  GK: "goalkeepers",
  CB: "centre-backs",
  "FB/WB": "full-backs and wing-backs",
  "DM/CM": "midfielders",
  "AM/W": "wide players and attacking midfielders",
  ST: "strikers",
};
