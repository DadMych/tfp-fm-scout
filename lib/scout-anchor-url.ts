import type { DatasetKind } from "@/lib/store";
import { parsePlayerRef, type PlayerRef } from "./compare-url";

export type { PlayerRef };

export function parseAnchorRef(params: URLSearchParams): PlayerRef | null {
  const raw = params.get("anchor");
  if (!raw) return null;
  return parsePlayerRef(raw);
}

export function encodePlayerRef(ref: PlayerRef): string {
  return `${ref.kind}:${ref.id}`;
}

export function similarHref(kind: DatasetKind, id: string): string {
  return `/similar?anchor=${encodeURIComponent(encodePlayerRef({ kind, id }))}`;
}

export function upgradesHref(kind: DatasetKind, id: string): string {
  return `/upgrades?anchor=${encodeURIComponent(encodePlayerRef({ kind, id }))}`;
}
