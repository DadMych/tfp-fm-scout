import type { DatasetKind } from "@/lib/store";
import type { PositionGroup } from "@/src/domain/positions.js";
import type { Verdict } from "@/src/domain/recommendation.js";

export type ScoutSortKey = "reco" | "score" | "grade" | "age" | "value" | "name";

export interface ScoutFilters {
  readonly kind: DatasetKind;
  readonly q: string;
  readonly group: PositionGroup | "all";
  readonly maxAge: string;
  readonly maxValue: string;
  readonly verdict: Verdict | "all";
  readonly sort: ScoutSortKey;
  readonly dir: "asc" | "desc";
}

const GROUPS: readonly PositionGroup[] = ["GK", "CB", "FB/WB", "DM/CM", "AM/W", "ST"];

const SORT_KEYS: readonly ScoutSortKey[] = ["reco", "score", "grade", "age", "value", "name"];

const VERDICTS: readonly Verdict[] = [
  "Priority target",
  "Squad upgrade",
  "Bargain",
  "One for the future",
  "Proven performer",
  "Squad depth",
  "Project",
  "Not for us",
];

function isGroup(v: string): v is PositionGroup {
  return (GROUPS as readonly string[]).includes(v);
}

function isSortKey(v: string): v is ScoutSortKey {
  return (SORT_KEYS as readonly string[]).includes(v);
}

function isVerdict(v: string): v is Verdict {
  return (VERDICTS as readonly string[]).includes(v);
}

function defaultDirForSort(sort: ScoutSortKey): "asc" | "desc" {
  if (sort === "reco" || sort === "name" || sort === "age" || sort === "value") return "asc";
  return "desc";
}

export function parseScoutFilters(params: URLSearchParams): ScoutFilters {
  const kind = params.get("kind") === "squad" ? "squad" : "shortlist";
  const groupRaw = params.get("group") ?? "all";
  const group = groupRaw !== "all" && isGroup(groupRaw) ? groupRaw : "all";
  const sortRaw = params.get("sort") ?? "reco";
  const sort = isSortKey(sortRaw) ? sortRaw : "reco";
  const dirRaw = params.get("dir");
  const dir =
    dirRaw === "asc" || dirRaw === "desc" ? dirRaw : defaultDirForSort(sort);
  const verdictRaw = params.get("verdict") ?? "all";
  const verdict = verdictRaw !== "all" && isVerdict(verdictRaw) ? verdictRaw : "all";

  return {
    kind,
    q: params.get("q") ?? "",
    group,
    maxAge: params.get("maxAge") ?? "",
    maxValue: params.get("maxValue") ?? "",
    verdict,
    sort,
    dir,
  };
}

export function serializeScoutFilters(f: ScoutFilters): string {
  const params = new URLSearchParams();
  if (f.kind !== "shortlist") params.set("kind", f.kind);
  if (f.q) params.set("q", f.q);
  if (f.group !== "all") params.set("group", f.group);
  if (f.maxAge) params.set("maxAge", f.maxAge);
  if (f.maxValue) params.set("maxValue", f.maxValue);
  if (f.verdict !== "all") params.set("verdict", f.verdict);
  if (f.sort !== "reco") params.set("sort", f.sort);
  if (f.dir !== defaultDirForSort(f.sort)) params.set("dir", f.dir);
  const qs = params.toString();
  return qs ? `/scout?${qs}` : "/scout";
}
