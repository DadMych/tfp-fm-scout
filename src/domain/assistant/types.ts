/**
 * Assistant analytics types (docs/11-assistant-analytics.md §2).
 */

import type { PositionGroup, PositionSlot } from "../positions.js";
import type { Formation, Zone } from "../squad/formations.js";
export type { Zone } from "../squad/formations.js";
import type { FormationFit, SlotAssignment, Verdict } from "./slots.js";
import type { XiSolution } from "./xi.js";
import type { LinkBoard } from "./links.js";
import type { TransferPackage } from "./packages.js";
import type { TransferBoard } from "./transfers/types.js";

export type InsightClass =
  | "shape"
  | "slot"
  | "age"
  | "dna"
  | "chemistry"
  | "setpiece"
  | "physical"
  | "market"
  | "development"
  | "risk"
  | "shortlist"
  | "transfer";

export type Severity = "critical" | "high" | "medium" | "low" | "praise";

export interface Evidence {
  readonly label: string;
  readonly value: string;
}

export interface ScoutFilters {
  readonly group?: PositionGroup;
  readonly maxAge?: number;
  readonly maxValue?: number;
  readonly minFitAtSlot?: { slot: PositionSlot; fit: number };
}

export type InsightAction =
  | { readonly kind: "scout"; readonly filters: ScoutFilters }
  | { readonly kind: "player"; readonly playerId: string; readonly dataset: "squad" | "shortlist" }
  | { readonly kind: "package"; readonly packageId: string }
  | { readonly kind: "formation"; readonly formationId: string };

/** What a rule module produces — priority.ts fills in `score` and sorts (§11.1). */
export interface RawInsight {
  readonly id: string;
  readonly cls: InsightClass;
  readonly severity: Severity;
  readonly title: string;
  readonly detail: string;
  readonly evidence: readonly Evidence[];
  readonly subjects: readonly string[];
  readonly slotKey?: string;
  readonly action?: InsightAction;
}

export interface Insight extends RawInsight {
  readonly score: number;
}

export interface TeamReport {
  readonly headline: string;
  readonly paragraphs: readonly [string, string, string];
}

export interface AssistantReport {
  readonly formation: Formation;
  readonly xi: XiSolution;
  readonly slots: readonly SlotAssignment[];
  readonly zoneStrength: Readonly<Record<Zone, number>>;
  readonly avgFit: number;
  readonly verdict: Verdict;
  readonly formationRanking: readonly FormationFit[];
  readonly linkBoard: LinkBoard;
  readonly insights: readonly Insight[];
  readonly packages: readonly TransferPackage[];
  readonly teamReport: TeamReport;
  readonly budgetCap: number;
  readonly board: TransferBoard;
}
