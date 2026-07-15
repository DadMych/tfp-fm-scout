import type { DatasetKind } from "@/lib/store";

export interface PlayerRef {
  readonly kind: DatasetKind;
  readonly id: string;
}

const SLOT_KEYS = ["a", "b", "c", "d"] as const;

export function parsePlayerRef(raw: string): PlayerRef | null {
  const idx = raw.indexOf(":");
  if (idx <= 0) return null;
  const kind = raw.slice(0, idx);
  const id = raw.slice(idx + 1);
  if ((kind !== "shortlist" && kind !== "squad") || !id) return null;
  return { kind, id };
}

export function parseCompareRefs(params: URLSearchParams): PlayerRef[] {
  const out: PlayerRef[] = [];
  for (const key of SLOT_KEYS) {
    const raw = params.get(key);
    if (!raw) continue;
    const ref = parsePlayerRef(raw);
    if (ref) out.push(ref);
  }
  return out;
}

export function serializeCompareRefs(refs: readonly PlayerRef[]): string {
  const params = new URLSearchParams();
  refs.slice(0, 4).forEach((ref, i) => {
    params.set(SLOT_KEYS[i]!, `${ref.kind}:${ref.id}`);
  });
  const qs = params.toString();
  return qs ? `/compare?${qs}` : "/compare";
}
