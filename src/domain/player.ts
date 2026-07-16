import type { AttrVector } from "./attr-value.js";
import type { PositionSlot } from "./positions.js";

/**
 * Domain view of a player — the minimum the scoring engines need (docs/04-data-model.md §3).
 * The DB/persistence layer carries the full record; this is what pure functions operate on.
 */
export interface Player {
  readonly id: string;
  readonly name: string;
  readonly age: number | null;
  readonly positions: readonly PositionSlot[];
  readonly attrs: AttrVector;
  readonly club?: string | null;
  readonly nationality?: string | null;
  /** Transfer value midpoint in the export's currency units (e.g. euros), or null. */
  readonly value?: number | null;
  readonly heightCm?: number | null;
  /** Preferred foot derived from the Right/Left Foot strength columns. */
  readonly foot?: "Right" | "Left" | "Either" | null;
  /**
   * FM's own letter recommendation (A+ … D-), the game's scout-style grade of how good/
   * suitable a player is. Null when the export left it blank. (Star Ability/Potential are
   * *not* carried: FM exports them as "Unknown" for players you have no scouting knowledge of.)
   */
  readonly scoutGrade?: string | null;
  /** Weekly wage in the export's currency units (per week), or null. */
  readonly wage?: number | null;
  /** Contract expiry as an ISO date ("2028-06-30"), or null. Strings survive JSON/DB roundtrips. */
  readonly contractExpires?: string | null;
  /** Owning club when the player is on a loan spell (either direction). */
  readonly onLoanFrom?: string | null;
  /** Loan spell end as an ISO date, parsed from "Loan Duration". */
  readonly loanEnd?: string | null;
  /** Fee paid the last time this player was transferred, or null (loans export "(€1)"). */
  readonly lastTransferFee?: number | null;
  /** Status flags from the export's Inf column (Inj, Wnt, Loa …). */
  readonly flags?: readonly PlayerFlag[];
  /** FM's one-word player style ("Creative", "Physical" …) from the Style column. */
  readonly playStyle?: string | null;
}

export type PlayerFlag = "injured" | "wanted" | "loan-listed" | "transfer-listed";

/** A player is scored against the goalkeeper population iff he can play in goal. */
export function isGoalkeeper(p: Player): boolean {
  return p.positions.includes("GK");
}
