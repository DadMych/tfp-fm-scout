import type { DatasetKind } from "@/lib/store";
import type { PositionGroup } from "@/src/domain/positions.js";
import type { Verdict } from "@/src/domain/recommendation.js";
import {
  isStyleId,
  PLAYING_STYLES,
  type StyleId,
} from "../src/domain/squad/styles.js";
import type { ScoutFilters as AssistantScoutFilters } from "../src/domain/assistant/types.js";

export type ScoutSortKey = "reco" | "score" | "grade" | "age" | "value" | "name" | "fit";

export type ScoutFitFilter = "all" | "upgrade" | "gap";

export type ScoutStyleFilter = StyleId | "all";

export interface ScoutFilters {
  readonly kind: DatasetKind;
  readonly q: string;
  readonly group: PositionGroup | "all";
  readonly maxAge: string;
  readonly maxValue: string;
  readonly verdict: Verdict | "all";
  readonly fit: ScoutFitFilter;
  readonly style: ScoutStyleFilter;
  readonly sort: ScoutSortKey;
  readonly dir: "asc" | "desc";
}

const GROUPS: readonly PositionGroup[] = ["GK", "CB", "FB/WB", "DM/CM", "AM/W", "ST"];

const SORT_KEYS: readonly ScoutSortKey[] = ["reco", "score", "grade", "age", "value", "name", "fit"];

const FIT_FILTERS: readonly ScoutFitFilter[] = ["all", "upgrade", "gap"];

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

function isFitFilter(v: string): v is ScoutFitFilter {
  return (FIT_FILTERS as readonly string[]).includes(v);
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
  const fitRaw = params.get("fit") ?? "all";
  const fit = isFitFilter(fitRaw) ? fitRaw : "all";
  const styleRaw = params.get("style") ?? "all";
  const style: ScoutStyleFilter =
    styleRaw !== "all" && isStyleId(styleRaw) ? styleRaw : "all";

  return {
    kind,
    q: params.get("q") ?? "",
    group,
    maxAge: params.get("maxAge") ?? "",
    maxValue: params.get("maxValue") ?? "",
    verdict,
    fit,
    style,
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
  if (f.fit !== "all") params.set("fit", f.fit);
  if (f.style !== "all") params.set("style", f.style);
  if (f.sort !== "reco") params.set("sort", f.sort);
  if (f.dir !== defaultDirForSort(f.sort)) params.set("dir", f.dir);
  const qs = params.toString();
  return qs ? `/scout?${qs}` : "/scout";
}

/** Bridge assistant insight scout actions → desk URL (doc 21). */
export function serializeAssistantScoutFilters(filters: AssistantScoutFilters): string {
  const group = filters.group ?? "all";
  const style = filters.style ?? "all";
  return serializeScoutFilters({
    kind: "shortlist",
    q: "",
    group,
    maxAge: filters.maxAge != null ? String(filters.maxAge) : "",
    maxValue: filters.maxValue != null ? String(Math.round(filters.maxValue / 1e6)) : "",
    verdict: "all",
    fit: "all",
    style,
    sort: "reco",
    dir: "asc",
  });
}

export function scoutHrefForStyle(styleId: StyleId, group?: PositionGroup): string {
  const style = PLAYING_STYLES.find((s) => s.id === styleId)!;
  return serializeScoutFilters({
    kind: "shortlist",
    q: "",
    group: group ?? style.scout.groups[0] ?? "all",
    maxAge: "",
    maxValue: "",
    verdict: "all",
    fit: "all",
    style: styleId,
    sort: "fit",
    dir: "desc",
  });
}
