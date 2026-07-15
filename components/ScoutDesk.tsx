"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useDatasets, type DatasetKind } from "@/lib/store";
import { parseScoutFilters, serializeScoutFilters, type ScoutSortKey } from "@/lib/scout-filters";
import { buildFitDeskContext, fitsGap, squadFitForRow } from "@/lib/squad-fit-desk";
import type { SquadFitResult } from "@/src/domain/scouting/fit.js";
import { getArchetype, type ArchetypeId } from "@/src/domain/archetypes/registry.js";
import { playerGroups, type PositionGroup } from "@/src/domain/positions.js";
import { standouts } from "@/src/domain/front-page.js";
import { recommend, type Recommendation, type Verdict } from "@/src/domain/recommendation.js";
import { formatMoney, scoutGradeRank } from "@/src/report/format.js";
import { VerdictBadge } from "@/components/VerdictBadge";
import { ArchetypeIcon } from "@/components/kit/ArchetypeIcon";
import { WatchToggle } from "@/components/kit/WatchToggle";
import { EmptyBroadsheet } from "@/components/kit/EmptyBroadsheet";
import { InkBar } from "@/components/kit/InkBar";

const GROUPS: readonly PositionGroup[] = ["GK", "CB", "FB/WB", "DM/CM", "AM/W", "ST"];

type SortKey = ScoutSortKey;

interface Row {
  id: string;
  name: string;
  age: number | null;
  positions: string;
  club: string | null;
  value: number | null;
  groups: PositionGroup[];
  score: number;
  badge: string | null;
  archId: ArchetypeId | null;
  archName: string;
  grade: string | null;
  rec: Recommendation;
  standout: { label: string; pct: number } | null;
  fit: SquadFitResult | null;
}

export function ScoutDesk() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = useMemo(() => parseScoutFilters(searchParams), [searchParams]);
  const { shortlist, squad, squadContext, ready, isWatched, toggleWatch, lastAssistantRun, importStatus } =
    useDatasets();
  const [kind, setKind] = useState<DatasetKind>(initial.kind);
  const bundle = kind === "squad" ? squad : shortlist;

  const [q, setQ] = useState(initial.q);
  const [group, setGroup] = useState<PositionGroup | "all">(initial.group);
  const [maxAge, setMaxAge] = useState(initial.maxAge);
  const [maxValue, setMaxValue] = useState(initial.maxValue);
  const [verdict, setVerdict] = useState<Verdict | "all">(initial.verdict);
  const [fitFilter, setFitFilter] = useState(initial.fit);
  const [sort, setSort] = useState<SortKey>(initial.sort);
  const [dir, setDir] = useState<"asc" | "desc">(initial.dir);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  useEffect(() => {
    const href = serializeScoutFilters({
      kind,
      q,
      group,
      maxAge,
      maxValue,
      verdict,
      fit: fitFilter,
      sort,
      dir,
    });
    router.replace(href, { scroll: false });
  }, [kind, q, group, maxAge, maxValue, verdict, fitFilter, sort, dir, router]);

  const fitCtx = useMemo(() => {
    if (!squad || !shortlist) return null;
    return buildFitDeskContext(squad, shortlist, lastAssistantRun);
  }, [squad, shortlist, lastAssistantRun]);

  const showFit = kind === "shortlist" && fitCtx != null;

  const rows = useMemo<Row[]>(() => {
    if (!bundle) return [];
    const ctx = kind === "shortlist" ? (squadContext ?? undefined) : undefined;
    return bundle.dataset.players.map((p) => {
      const s = bundle.scoreById.get(p.id)!;
      const arch = s.topArchetype ? getArchetype(s.topArchetype.id) : null;
      const row = { player: p, scores: s };
      const fit = showFit && fitCtx ? squadFitForRow(row, fitCtx) : null;
      return {
        id: p.id,
        name: p.name,
        age: p.age,
        positions: p.positions.length ? p.positions.join("/") : "—",
        club: p.club ?? null,
        value: p.value ?? null,
        groups: playerGroups(p.positions),
        score: Math.round(s.topArchetype?.score ?? 0),
        badge: s.topArchetype?.badge ?? null,
        archId: s.topArchetype?.id ?? null,
        archName: arch?.name ?? "Utility",
        grade: p.scoutGrade ?? null,
        rec: recommend(p, s, ctx),
        standout: standouts(s, 1)[0] ?? null,
        fit,
      };
    });
  }, [bundle, kind, squadContext, showFit, fitCtx]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const ageCap = maxAge ? Number(maxAge) : null;
    const valCap = maxValue ? Number(maxValue) * 1e6 : null;
    const out = rows.filter((r) => {
      if (needle && !r.name.toLowerCase().includes(needle)) return false;
      if (group !== "all" && !r.groups.includes(group)) return false;
      if (ageCap != null && (r.age == null || r.age > ageCap)) return false;
      if (valCap != null && (r.value == null || r.value > valCap)) return false;
      if (verdict !== "all" && r.rec.verdict !== verdict) return false;
      if (showFit && fitFilter !== "all") {
        if (!r.fit) return false;
        if (fitFilter === "upgrade" && r.fit.verdict !== "Upgrade") return false;
        if (fitFilter === "gap" && (!fitCtx || !fitsGap(r.fit, fitCtx.needBySlotKey))) return false;
      }
      return true;
    });
    const cmp: Record<SortKey, (a: Row, b: Row) => number> = {
      reco: (a, b) => a.rec.rank - b.rec.rank || b.score - a.score,
      score: (a, b) => b.score - a.score,
      grade: (a, b) => scoutGradeRank(b.grade) - scoutGradeRank(a.grade) || b.score - a.score,
      age: (a, b) => (a.age ?? 999) - (b.age ?? 999),
      value: (a, b) => (a.value ?? Infinity) - (b.value ?? Infinity),
      name: (a, b) => a.name.localeCompare(b.name),
      fit: (a, b) => (b.fit?.pairScore ?? -1) - (a.fit?.pairScore ?? -1),
    };
    out.sort(cmp[sort]);
    if (dir === "desc") out.reverse();
    return out;
  }, [rows, q, group, maxAge, maxValue, verdict, fitFilter, showFit, fitCtx, sort, dir]);

  const activeId = useMemo(() => {
    if (filtered.length === 0) return null;
    if (focusedId && filtered.some((r) => r.id === focusedId)) return focusedId;
    return filtered[0]!.id;
  }, [filtered, focusedId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (filtered.length === 0) return;
      const idx = filtered.findIndex((r) => r.id === activeId);
      const cur = idx >= 0 ? idx : 0;
      if (e.key === "j") {
        e.preventDefault();
        setFocusedId(filtered[Math.min(cur + 1, filtered.length - 1)]!.id);
      } else if (e.key === "k") {
        e.preventDefault();
        setFocusedId(filtered[Math.max(cur - 1, 0)]!.id);
      } else if (e.key === "s" && activeId) {
        e.preventDefault();
        const p = bundle?.dataset.players.find((x) => x.id === activeId);
        if (p) toggleWatch(p);
      } else if (e.key === "Enter" && activeId) {
        e.preventDefault();
        router.push(`/scout/${kind}/${activeId}`);
      } else if (e.key === "c" && activeId) {
        e.preventDefault();
        router.push(`/compare?a=${kind}:${activeId}`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, activeId, kind, toggleWatch, router, bundle]);

  const guidance = useMemo(() => {
    const counts = new Map<Verdict, number>();
    for (const r of rows) counts.set(r.rec.verdict, (counts.get(r.rec.verdict) ?? 0) + 1);
    const order: Verdict[] = [
      "Priority target",
      "Squad upgrade",
      "Bargain",
      "One for the future",
      "Proven performer",
    ];
    return order
      .map((v) => ({ v, n: counts.get(v) ?? 0 }))
      .filter((x) => x.n > 0);
  }, [rows]);

  function toggleSort(key: SortKey) {
    if (sort === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDir(key === "name" || key === "age" || key === "value" ? "asc" : "desc");
    }
  }

  if (!ready) return <div className="empty">Loading your data…</div>;

  const deskStatus = importStatus[kind];
  if (!bundle && deskStatus) {
    return <div className="empty import-progress">{deskStatus}</div>;
  }

  if (!bundle) {
    return (
      <EmptyBroadsheet
        eyebrow="Scout desk"
        title={`No ${kind} loaded.`}
        actions={
          <Link className="btn" href="/upload">
            Upload an export →
          </Link>
        }
      >
        <p>Drop in an FM26 export to open the ledger for this pool.</p>
      </EmptyBroadsheet>
    );
  }

  return (
    <>
      <div className="toolbar">
        <div className="seg" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={kind === "shortlist"}
            className={kind === "shortlist" ? "on" : ""}
            onClick={() => setKind("shortlist")}
          >
            Shortlist {shortlist ? `(${shortlist.dataset.players.length})` : ""}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={kind === "squad"}
            className={kind === "squad" ? "on" : ""}
            onClick={() => setKind("squad")}
          >
            Squad {squad ? `(${squad.dataset.players.length})` : ""}
          </button>
        </div>

        <div className="field">
          <label>Search</label>
          <input
            className="control control--search"
            placeholder="Player name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Position</label>
          <select className="control" value={group} onChange={(e) => setGroup(e.target.value as PositionGroup | "all")}>
            <option value="all">All</option>
            {GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Max age</label>
          <input
            className="control"
            type="number"
            min={15}
            max={45}
            value={maxAge}
            onChange={(e) => setMaxAge(e.target.value)}
            style={{ minWidth: 80 }}
          />
        </div>
        <div className="field">
          <label>Max value (€M)</label>
          <input
            className="control"
            type="number"
            min={0}
            value={maxValue}
            onChange={(e) => setMaxValue(e.target.value)}
            style={{ minWidth: 90 }}
          />
        </div>
        <div className="field">
          <label>Verdict</label>
          <select className="control" value={verdict} onChange={(e) => setVerdict(e.target.value as Verdict | "all")}>
            <option value="all">All</option>
            <option>Priority target</option>
            <option>Squad upgrade</option>
            <option>Bargain</option>
            <option>One for the future</option>
            <option>Proven performer</option>
            <option>Squad depth</option>
            <option>Project</option>
            <option>Not for us</option>
          </select>
        </div>
        {showFit ? (
          <div className="field">
            <label>Fit</label>
            <select
              className="control"
              value={fitFilter}
              onChange={(e) => setFitFilter(e.target.value as typeof fitFilter)}
            >
              <option value="all">All</option>
              <option value="upgrade">Improves my XI</option>
              <option value="gap">Fits a gap</option>
            </select>
          </div>
        ) : null}
        <span className="count">
          {filtered.length} shown · <span className="kbd-hint">j/k move · s watch · c compare</span>
        </span>
      </div>

      {kind === "shortlist" && guidance.length > 0 && (
        <p className="section-label" style={{ marginTop: 18 }}>
          The desk flags{" "}
          {guidance.map((x, i) => (
            <span key={x.v}>
              {i > 0 ? " · " : " "}
              <b style={{ color: "var(--ink)" }}>{x.n}</b> {x.v.toLowerCase()}
              {x.n > 1 ? "s" : ""}
            </span>
          ))}
          {squad ? "" : "  ·  add your squad to surface upgrades"}
        </p>
      )}

      <table className="rowlist">
        <thead>
          <tr className="head">
            <th onClick={() => toggleSort("name")} className={sort === "name" ? "sorted" : ""}>
              Player
            </th>
            <th onClick={() => toggleSort("reco")} className={sort === "reco" ? "sorted" : ""}>
              Verdict
            </th>
            <th>Identity</th>
            <th>Standout</th>
            {showFit ? (
              <th onClick={() => toggleSort("fit")} className={sort === "fit" ? "sorted" : ""}>
                Fit
              </th>
            ) : null}
            <th
              onClick={() => toggleSort("age")}
              className={`c-num ${sort === "age" ? "sorted" : ""}`}
            >
              Age
            </th>
            <th
              onClick={() => toggleSort("grade")}
              className={`c-num ${sort === "grade" ? "sorted" : ""}`}
            >
              FM grade
            </th>
            <th
              onClick={() => toggleSort("value")}
              className={`c-num ${sort === "value" ? "sorted" : ""}`}
            >
              Value
            </th>
            <th
              onClick={() => toggleSort("score")}
              className={`c-num ${sort === "score" ? "sorted" : ""}`}
            >
              Score
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={showFit ? 9 : 8} className="empty">
                No players match. Loosen the filters.
              </td>
            </tr>
          ) : (
            filtered.map((r) => {
            const p = bundle.dataset.players.find((x) => x.id === r.id)!;
            const watched = isWatched(p);
            return (
            <tr
              className={`player${activeId === r.id ? " focused" : ""}${watched ? " watched" : ""}`}
              key={r.id}
              tabIndex={activeId === r.id ? 0 : -1}
              onFocus={() => setFocusedId(r.id)}
              onClick={() => setFocusedId(r.id)}
            >
              <td className="c-name">
                <WatchToggle player={p} />
                <Link className="pname" href={`/scout/${kind}/${r.id}`}>
                  {r.name}
                </Link>
                {watched ? <span className="watch-mark">Watch</span> : null}
                <div className="sub">
                  {r.positions}
                  {r.club ? ` · ${r.club}` : ""}
                </div>
              </td>
              <td className="c-verdict">
                <VerdictBadge rec={r.rec} />
                <div className="why">{r.rec.headline}</div>
              </td>
              <td className="c-arch">
                {r.archId ? <ArchetypeIcon id={r.archId} size={16} /> : null}
                <span className="aname">{r.archName}</span>
                {r.badge ? (
                  <span className={`stamp ${r.badge === "Elite" ? "gold" : ""}`}>{r.badge}</span>
                ) : null}
              </td>
              <td className="c-standout">
                {r.standout ? (
                  <div className="so-cell">
                    <span className="so-l">{r.standout.label}</span>
                    <InkBar value={r.standout.pct} width={44} />
                    <span className="num">{Math.round(r.standout.pct)}</span>
                  </div>
                ) : (
                  "—"
                )}
              </td>
              {showFit ? (
                <td className="c-fit">
                  {r.fit ? (
                    <>
                      <span
                        className={`stamp ${r.fit.verdict === "Upgrade" ? "gold" : r.fit.verdict === "Not for you" ? "" : ""}`}
                      >
                        {r.fit.verdict}
                      </span>
                      <div className="sub num">
                        {r.fit.slotLabel} · {r.fit.pairScore}
                      </div>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              ) : null}
              <td className="c-num">{r.age ?? "—"}</td>
              <td className="c-num">{r.grade ?? "—"}</td>
              <td className="c-num">{formatMoney(r.value)}</td>
              <td className="c-num">
                <span className={`score${r.rec.tone === "gold" ? " lead" : ""}`}>{r.score}</span>
              </td>
            </tr>
            );
            })
          )}
        </tbody>
      </table>
    </>
  );
}
