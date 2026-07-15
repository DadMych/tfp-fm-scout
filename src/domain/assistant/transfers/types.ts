/**
 * Sporting Director layer — core types (docs/13-sporting-director.md §2).
 */

import type { PositionSlot } from "../../positions.js";

export type SaleVerdict =
  | "untouchable"
  | "keep"
  | "sell-high"
  | "sell-now"
  | "loan-out"
  | "b-team"
  | "release";

export interface PriceBand {
  readonly low: number;
  readonly ask: number;
  readonly high: number;
}

export type ReplacementSource = "internal" | "shortlist" | "none";

export interface ReplacementChain {
  readonly source: ReplacementSource;
  readonly playerId: string | null;
  readonly playerName: string | null;
  readonly slot: PositionSlot;
  readonly fitBefore: number;
  readonly fitAfter: number;
  readonly cost: number | null;
  readonly netCost: number | null;
  readonly ready: boolean;
}

export interface SaleRecommendation {
  readonly playerId: string;
  readonly verdict: SaleVerdict;
  readonly reasons: readonly string[];
  readonly evidence: readonly { readonly label: string; readonly value: string }[];
  readonly priceBand: PriceBand | null;
  readonly xiImpact: number;
  readonly replacement: ReplacementChain | null;
  readonly urgency: "this-window" | "next-window" | "no-rush";
}

export interface SuccessionEntry {
  readonly slotKey: string;
  readonly slotLabel: string;
  readonly starterId: string | null;
  readonly starterAge: number | null;
  readonly fitNow: number;
  readonly fitIn1: number;
  readonly fitIn2: number;
  readonly fitIn3: number;
  readonly heir: ReplacementChain | null;
  readonly horizon: number;
  readonly status: "secure" | "watch" | "crisis";
}

export interface SquadHealth {
  readonly index: number;
  readonly xiQuality: number;
  readonly depth: number;
  readonly ageBalance: number;
  readonly succession: number;
  readonly liquidity: number;
}

export interface TransferBoard {
  readonly sales: readonly SaleRecommendation[];
  readonly all: readonly SaleRecommendation[];
  readonly succession: readonly SuccessionEntry[];
  readonly health: SquadHealth;
  readonly expectedIncome: number;
}
