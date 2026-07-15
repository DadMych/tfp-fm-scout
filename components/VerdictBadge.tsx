import type { Recommendation } from "@/src/domain/recommendation.js";

export function VerdictBadge({ rec }: { rec: Recommendation }) {
  return <span className={`verdict ${rec.tone}`}>{rec.verdict}</span>;
}
