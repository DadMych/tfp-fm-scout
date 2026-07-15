import type { InsightClass, Severity } from "@/src/domain/assistant/types.js";
import type { SlotNeed } from "@/src/domain/assistant/slots.js";
import type { SaleRecommendation } from "@/src/domain/assistant/transfers/types.js";
import type { SquadHealth } from "@/src/domain/assistant/transfers/types.js";
import type { Zone } from "@/src/domain/squad/formations.js";

export const ZONE_LABEL: Record<Zone, string> = {
  GK: "Goal",
  DEF: "Defence",
  MID: "Midfield",
  ATT: "Attack",
};

export const NEED_LABEL: Record<SlotNeed, string> = {
  hole: "Unfilled",
  weak: "Weak spot",
  thin: "No depth",
  ageing: "Ageing",
  solid: "Solid",
};

export const NEED_TONE: Record<SlotNeed, string> = {
  hole: "red",
  weak: "red",
  thin: "gold",
  ageing: "gold",
  solid: "ink",
};

export const SEVERITY_TONE: Record<Severity, string> = {
  critical: "red",
  high: "red",
  medium: "gold",
  low: "ink",
  praise: "gold",
};

export const FEED_COLLAPSED_COUNT = 8;

export type FeedGroup = "all" | "squad" | "tactics" | "market" | "risk";

export const FEED_GROUPS: Record<FeedGroup, readonly InsightClass[] | null> = {
  all: null,
  squad: ["slot", "age", "development", "physical"],
  tactics: ["shape", "dna", "setpiece", "chemistry"],
  market: ["market", "transfer"],
  risk: ["risk", "shortlist"],
};

export const FEED_LABEL: Record<FeedGroup, string> = {
  all: "All",
  squad: "Squad",
  tactics: "Tactics",
  market: "Market",
  risk: "Risks",
};

export const VERDICT_LABEL: Record<SaleRecommendation["verdict"], string> = {
  untouchable: "Untouchable",
  keep: "Keep",
  "sell-high": "Sell high",
  "sell-now": "Sell now",
  "loan-out": "Loan out",
  release: "Release",
};

export const VERDICT_TONE: Record<SaleRecommendation["verdict"], string> = {
  untouchable: "gold",
  keep: "ink",
  "sell-high": "gold",
  "sell-now": "red",
  "loan-out": "gold",
  release: "red",
};

export const HEALTH_SUBSCORES: readonly { key: keyof SquadHealth; label: string }[] = [
  { key: "xiQuality", label: "XI quality" },
  { key: "depth", label: "Depth" },
  { key: "ageBalance", label: "Age balance" },
  { key: "succession", label: "Succession" },
  { key: "liquidity", label: "Liquidity" },
];

export function healthVerdict(index: number): string {
  if (index >= 75) return "Healthy";
  if (index >= 55) return "Stable";
  if (index >= 40) return "Fragile";
  return "Critical";
}

export function surname(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1]! : name;
}
