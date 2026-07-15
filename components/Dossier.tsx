"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  attributesByCategory,
  getAttribute,
  type AttributeCategory,
  type AttributeId,
} from "@/src/domain/attributes.js";
import type { Player } from "@/src/domain/player.js";
import { getArchetype } from "@/src/domain/archetypes/registry.js";
import { getRole, isRoleId } from "@/src/domain/roles/registry.js";
import type { PlayerScores } from "@/src/domain/scoring/dataset.js";
import { recommend } from "@/src/domain/recommendation.js";
import { formatPullQuote } from "@/src/domain/evidence.js";
import { GROUP_COHORT_LABEL, canonicalPrimaryGroup } from "@/src/domain/positions.js";
import { DEFAULT_BUDGET } from "@/src/domain/assistant/defaults.js";
import { buildContext, type AnalysisContext } from "@/src/domain/assistant/context.js";
import { buildBoard } from "@/src/domain/assistant/transfers/board.js";
import type { TransferBoard } from "@/src/domain/assistant/transfers/types.js";
import { getFormation } from "@/src/domain/squad/formations.js";
import { computeSquadFit } from "@/src/domain/scouting/fit.js";
import { surname } from "@/src/domain/assistant/phrases.js";
import {
  footLabel,
  formatHeight,
  formatMoney,
} from "@/src/report/format.js";
import { Radar } from "@/components/Radar";
import { VerdictBadge } from "@/components/VerdictBadge";
import { ArchetypeColumns } from "@/components/kit/ArchetypeColumns";
import { AttrValueCell } from "@/components/kit/AttrValue";
import { Dateline } from "@/components/kit/Dateline";
import { FactsRail } from "@/components/kit/FactsRail";
import { InkBar } from "@/components/kit/InkBar";
import { PullQuote } from "@/components/kit/PullQuote";
import { useBundle, useDatasets, type DatasetKind } from "@/lib/store";
import { similarHref, upgradesHref } from "@/lib/scout-anchor-url";

const VERDICT_LABEL: Record<string, string> = {
  untouchable: "Untouchable",
  "sell-high": "Sell high",
  "sell-now": "Sell now",
  "loan-out": "Loan out",
  release: "Release",
};

function AttrColumn({
  p,
  s,
  title,
  ids,
}: {
  p: Player;
  s: PlayerScores;
  title: string;
  ids: readonly AttributeId[];
}) {
  return (
    <div className="acol">
      <p className="acol-h">{title}</p>
      <table className="atable">
        <tbody>
          {ids.map((id) => {
            const pct = s.percentiles[id] ?? null;
            return (
              <tr key={id}>
                <td className="alabel">{getAttribute(id).name}</td>
                <AttrValueCell v={p.attrs[id]} />
                <td className="abar">
                  <InkBar value={pct} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function byCat(c: AttributeCategory): AttributeId[] {
  return attributesByCategory(c).map((a) => a.id as AttributeId);
}

export function Dossier({ kind, id }: { kind: DatasetKind; id: string }) {
  const bundle = useBundle(kind);
  const { squad, shortlist, squadContext, ready, lastAssistantRun, isWatched, toggleWatch } = useDatasets();

  const found = useMemo(() => {
    if (!bundle) return null;
    const p = bundle.dataset.players.find((x) => x.id === id);
    if (!p) return null;
    const s = bundle.scoreById.get(p.id);
    if (!s) return null;
    return { p, s };
  }, [bundle, id]);

  // Sporting-director read on this player: exit verdict for a squad player, or which
  // starter he'd challenge for a shortlist player. Uses a fixed default formation and an
  // effectively unbounded budget — this page has no formation/budget picker of its own.
  const director = useMemo(() => {
    if (!squad) return null;
    const squadRows = squad.dataset.players.map((p) => ({ player: p, scores: squad.scoreById.get(p.id)! }));
    const shortlistRows = shortlist
      ? shortlist.dataset.players.map((p) => ({ player: p, scores: shortlist.scoreById.get(p.id)! }))
      : [];
    const formation = getFormation(lastAssistantRun?.formationId ?? "4-2-3-1");
    const ctx = buildContext({
      squad: squadRows,
      shortlist: shortlistRows,
      formation,
      budget: lastAssistantRun?.budget ?? DEFAULT_BUDGET,
      useFullBudget: lastAssistantRun?.useFull ?? true,
    });
    return { ctx, board: buildBoard(ctx) };
  }, [squad, shortlist, lastAssistantRun]);

  if (!ready) return <div className="empty">Loading…</div>;
  if (!found) {
    return (
      <div className="empty">
        Player not found.{" "}
        <Link href="/scout" style={{ color: "var(--red)" }}>
          Back to the desk
        </Link>
      </div>
    );
  }

  const { p, s } = found;
  const rec = recommend(p, s, kind === "shortlist" ? (squadContext ?? undefined) : undefined);
  const arch = s.topArchetype ? getArchetype(s.topArchetype.id) : null;
  const family = s.general.hybridWith
    ? `${s.general.family} · ${s.general.hybridWith} hybrid`
    : s.general.family;
  const eyebrow = [family, p.age != null ? `Age ${p.age}` : null, p.positions.join("/") || "—"]
    .filter(Boolean)
    .join("  ·  ");
  const conf = Math.round(s.confidence * 100);

  const pull = formatPullQuote(s);

  const identity = s.archetypes;

  const posSet = new Set(p.positions);
  const roles = Object.entries(s.roles)
    .flatMap(([rid, r]) =>
      r && isRoleId(rid)
        ? [{ rid, r, eligible: getRole(rid).slots.some((slot) => posSet.has(slot)) }]
        : [],
    )
    .sort((a, b) => b.r.score - a.r.score)
    .slice(0, 8);

  const attrCols =
    s.pop === "gk"
      ? [
          { title: "Goalkeeping", ids: [...byCat("goalkeeping"), "firstTouch" as AttributeId, "passing" as AttributeId] },
          { title: "Mental", ids: byCat("mental") },
          { title: "Physical", ids: byCat("physical") },
        ]
      : [
          { title: "Technical", ids: byCat("technical") },
          { title: "Mental", ids: byCat("mental") },
          { title: "Physical", ids: byCat("physical") },
        ];

  return (
    <>
      <Dateline
        left="Player dossier"
        center={`${bundle!.dataset.label} · ${bundle!.dataset.players.length} players`}
        right={`Known ${conf}%`}
      />

      <section className="d-hero">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{p.name}</h1>
          <p className="standfirst">{s.summary}</p>

          <div className="callout">
            <VerdictBadge rec={rec} />
            <p className="c-head">{rec.headline}</p>
            {rec.reasons.length > 0 ? (
              <p className="c-detail">
                {rec.reasons.join(" ")}
              </p>
            ) : null}
          </div>

          {pull ? <PullQuote>{pull}</PullQuote> : null}

          {director ? <DirectorRead kind={kind} p={p} s={s} ctx={director.ctx} board={director.board} /> : null}
        </div>

        <FactsRail
          rows={[
            { label: "Club", value: p.club || "—" },
            { label: "Nation", value: p.nationality || "—" },
            { label: "Age", value: <span className="num">{p.age ?? "—"}</span> },
            { label: "Height", value: <span className="num">{formatHeight(p.heightCm)}</span> },
            { label: "Foot", value: footLabel(p.foot) },
            { label: "Positions", value: p.positions.join("/") || "—" },
            { label: "Value", value: <span className="num">{formatMoney(p.value)}</span> },
            {
              label: "Top archetype",
              value: <b>{arch ? arch.name : "Utility"}</b>,
            },
            { label: "FM grade", value: <b>{p.scoutGrade || "—"}</b> },
            { label: "Known", value: <span className="num">{conf}%</span> },
          ]}
        />
      </section>

      <ArchetypeColumns archetypes={identity} artId={s.topArchetype?.id ?? null} />

      <div className="d-body">
        <figure className="radar-figure">
          <p className="panel-h">Profile radar</p>
          <Radar scores={s} />
          <figcaption className="radar-cap">
            Percentile vs {GROUP_COHORT_LABEL[canonicalPrimaryGroup(p.positions)]} in this database
          </figcaption>
        </figure>

        <div className="d-attrs">
          <p className="panel-h">Attributes — value &amp; dataset percentile</p>
          <div className="grid">
            {attrCols.map((c) => (
              <AttrColumn key={c.title} p={p} s={s} title={c.title} ids={c.ids} />
            ))}
          </div>
        </div>
      </div>

      <p className="panel-h">
        Roles — strongest fits{" "}
        <span style={{ color: "var(--ink-3)", fontSize: 10 }}>▸ playable in listed positions</span>
      </p>
      <table className="roletable">
        <thead>
          <tr>
            <th>Role</th>
            <th>Phase</th>
            <th></th>
            <th>Fit</th>
          </tr>
        </thead>
        <tbody>
          {roles.map(({ rid, r, eligible }) => {
            const def = getRole(rid);
            return (
              <tr key={rid} className={eligible ? "elig" : ""}>
                <td className="rname">
                  {eligible ? <span className="tick">▸</span> : null}
                  {def.name}
                </td>
                <td className="rphase">{def.phase}</td>
                <td className="rbar">
                  <InkBar value={r.insufficient ? null : r.score} absolute />
                </td>
                <td className="rscore num">{r.insufficient ? "—" : Math.round(r.score)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="footline">
        <span>Source · {bundle?.dataset.source}</span>
        <span>
          <button type="button" className="foot-action" onClick={() => toggleWatch(p)}>
            {isWatched(p) ? "Remove from watch" : "Add to watch"}
          </button>
          {" · "}
          <Link href={`/compare?a=${kind}:${p.id}`}>Compare</Link>
          {" · "}
          <Link href={similarHref(kind, p.id)}>Find similar</Link>
          {kind === "squad" && shortlist ? (
            <>
              {" · "}
              <Link href={upgradesHref(kind, p.id)}>Find upgrades</Link>
            </>
          ) : null}
          {" · "}
          <Link href="/scout">← Back to desk</Link>
        </span>
      </div>
    </>
  );
}

/**
 * Sporting-director read on this one player (docs/13-sporting-director.md §11.4): the exit
 * verdict for a squad player, or which starter a shortlist player would challenge.
 */
function DirectorRead({
  kind,
  p,
  s,
  ctx,
  board,
}: {
  kind: DatasetKind;
  p: Player;
  s: PlayerScores;
  ctx: AnalysisContext;
  board: TransferBoard;
}) {
  if (kind === "squad") {
    const sale = board.all.find((x) => x.playerId === p.id);
    if (!sale || sale.verdict === "keep") return null;
    const extras = [
      sale.priceBand ? `Ask ${formatMoney(sale.priceBand.ask)}.` : null,
      sale.replacement?.playerId
        ? `Replacement ${surname(sale.replacement.playerName ?? "")} (fit ${sale.replacement.fitAfter}).`
        : null,
    ].filter(Boolean);
    return (
      <div className="callout" style={{ borderColor: "var(--gold)" }}>
        <span className="verdict gold">{VERDICT_LABEL[sale.verdict] ?? sale.verdict}</span>
        <p className="c-head">{sale.reasons[0] ?? "Flagged by the sporting director."}</p>
        {extras.length > 0 ? <p className="c-detail">{extras.join(" ")}</p> : null}
      </div>
    );
  }

  const nameById = new Map<string, string>();
  for (const r of ctx.squad) nameById.set(r.player.id, r.player.name);
  for (const r of ctx.shortlist) nameById.set(r.player.id, r.player.name);

  const squadFit = computeSquadFit({ player: p, scores: s }, ctx.formation.id, ctx.slots, nameById);
  if (!squadFit) return null;

  return (
    <div className="callout" style={{ borderColor: squadFit.verdict === "Upgrade" ? "var(--gold)" : "var(--ink)" }}>
      <span className={`verdict ${squadFit.verdict === "Upgrade" ? "gold" : squadFit.verdict === "Not for you" ? "ink" : ""}`}>
        {squadFit.verdict}
      </span>
      <p className="c-head">{squadFit.headline}</p>
    </div>
  );
}
