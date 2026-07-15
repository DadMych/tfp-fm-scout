import { ATTRIBUTES, type AttributeId } from "./attributes.js";
import { DERIVED_INPUTS, type DerivedId } from "./derived.js";

/** Attribute or derived metric referenced in archetype gates and weights. */
export type MetricId = AttributeId | DerivedId;

const VALID_METRICS = new Set<string>([
  ...ATTRIBUTES.map((a) => a.id),
  ...(Object.keys(DERIVED_INPUTS) as DerivedId[]),
]);

export function isValidMetric(metric: string): metric is MetricId {
  return VALID_METRICS.has(metric);
}

export function isDerivedId(metric: MetricId): metric is DerivedId {
  return metric in DERIVED_INPUTS;
}

export const METRIC_IDS: readonly MetricId[] = [
  ...ATTRIBUTES.map((a) => a.id),
  ...(Object.keys(DERIVED_INPUTS) as DerivedId[]),
];

export function percentileFor(
  percentiles: Readonly<Partial<Record<MetricId, number | null>>>,
  metric: string,
): number | null {
  return isValidMetric(metric) ? (percentiles[metric] ?? null) : null;
}
