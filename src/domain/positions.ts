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
