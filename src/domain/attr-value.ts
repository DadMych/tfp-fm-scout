import type { AttributeId } from "./attributes.js";

/**
 * A parsed attribute value (docs/03-data-import.md §6.1).
 *
 * - exact value  -> { min: n, max: n }
 * - scout range  -> { min, max } with min < max (uncertainty = max - min)
 * - masked/unknown ("-", "") -> null
 *
 * All downstream maths uses the midpoint; the range is kept so the UI can render
 * ranged values honestly and so `confidence` can be computed.
 */
export type AttrValue = { readonly min: number; readonly max: number } | null;

/** Full attribute vector for a player; a missing key is treated as masked (null). */
export type AttrVector = Partial<Record<AttributeId, AttrValue>>;

/** Midpoint of a value, or null when masked/missing. */
export function mid(v: AttrValue | undefined): number | null {
  if (v == null) return null;
  return (v.min + v.max) / 2;
}

/** Uncertainty band width (0 for exact, >0 for ranged), or null when masked. */
export function uncertainty(v: AttrValue | undefined): number | null {
  if (v == null) return null;
  return v.max - v.min;
}

/** Convenience: read a midpoint straight from a vector. */
export function midOf(attrs: AttrVector, id: AttributeId): number | null {
  return mid(attrs[id]);
}
