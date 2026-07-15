/** Five-step percentile ramp (doc 09). Colour encodes dataset percentile, not raw 1–20. */
export const PERCENTILE_COLORS = [
  "#BDB6A6", // p0–20
  "#948C7C", // p20–40
  "#6B6456", // p40–60
  "#2C281F", // p60–80
  "#B23B2E", // p80–100
] as const;

export type PercentileStep = 0 | 1 | 2 | 3 | 4;

export function percentileStep(pct: number): PercentileStep {
  if (pct >= 80) return 4;
  if (pct >= 60) return 3;
  if (pct >= 40) return 2;
  if (pct >= 20) return 1;
  return 0;
}

export function percentileColor(pct: number): (typeof PERCENTILE_COLORS)[number] {
  return PERCENTILE_COLORS[percentileStep(pct)];
}
