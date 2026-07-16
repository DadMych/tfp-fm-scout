"use client";

import Link from "next/link";
import { useMemo } from "react";
import { getArchetype } from "@/src/domain/archetypes/registry.js";
import { recommend } from "@/src/domain/recommendation.js";
import { formatPullQuote } from "@/src/domain/evidence.js";
import { GROUP_COHORT_LABEL, canonicalPrimaryGroup } from "@/src/domain/positions.js";
import { DEFAULT_BUDGET } from "@/src/domain/assistant/defaults.js";
import { buildContext } from "@/src/domain/assistant/context.js";
import { buildBoard } from "@/src/domain/assistant/transfers/board.js";
import { getFormation } from "@/src/domain/squad/formations.js";
import { contractExpiring, loanStatusOf, ourClubOf, seasonEndOf, shortDate } from "@/src/domain/squad/status.js";
import { computeSquadFit } from "@/src/domain/scouting/fit.js";
import { footLabel, formatHeight, formatMoney } from "@/src/report/format.js";
import { Radar } from "@/components/Radar";
import { VerdictBadge } from "@/components/VerdictBadge";
import { ArchetypeColumns } from "@/components/kit/ArchetypeColumns";
import { ArchetypeArt, ArchetypeArtFallback } from "@/components/kit/ArchetypeArt";
import { Dateline } from "@/components/kit/Dateline";
import { FactsRail } from "@/components/kit/FactsRail";
import { Footline } from "@/components/kit/Footline";
import { PullQuote } from "@/components/kit/PullQuote";
import { WatchToggle } from "@/components/kit/WatchToggle";
import { AttrColumn, attrColumnsFor } from "@/components/dossier/AttrColumn";
import { RoleTable } from "@/components/dossier/RoleTable";
import { SaleVerdictCallout } from "@/components/dossier/SaleVerdictCallout";
import { SquadFitSection } from "@/components/dossier/SquadFitSection";
import { useBundle, useDatasets, type DatasetKind } from "@/lib/store";
import { similarHref, upgradesHref } from "@/lib/scout-anchor-url";

export function Dossier({ kind, id }: { kind: DatasetKind; id: string }) {
  const bundle = useBundle(kind);
  const { squad, shortlist, squadContext, ready, lastAssistantRun } = useDatasets();

  const found = useMemo(() => {
    if (!bundle) return null;
    const p = bundle.dataset.players.find((x) => x.id === id);
    if (!p) return null;
    const s = bundle.scoreById.get(p.id);
    if (!s) return null;
    return { p, s };
  }, [bundle, id]);

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

  const squadFit = useMemo(() => {
    if (!director || kind !== "shortlist" || !found) return null;
    const nameById = new Map<string, string>();
    for (const r of director.ctx.squad) nameById.set(r.player.id, r.player.name);
    for (const r of director.ctx.shortlist) nameById.set(r.player.id, r.player.name);
    return computeSquadFit(
      { player: found.p, scores: found.s },
      director.ctx.formation.id,
      director.ctx.slots,
      nameById,
    );
  }, [director, kind, found]);

  if (!ready) return <div className="empty">Loading…</div>;
  if (!found) {
    return (
      <div className="empty">
        Player not found.{" "}
        <Link href="/scout" className="empty-link">
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
  const attrCols = attrColumnsFor(s);

  const allPlayers = bundle!.dataset.players;
  const seasonEnd = seasonEndOf(allPlayers);
  const expiring = contractExpiring(p, seasonEnd);
  const loanStatus = kind === "squad" ? loanStatusOf(p, ourClubOf(allPlayers)) : p.onLoanFrom ? "loaned-in" : null;
  const contractRows = [
    ...(p.wage != null
      ? [{ label: "Wage", value: <span className="num">{formatMoney(p.wage)} p/w</span> }]
      : []),
    ...(p.contractExpires
      ? [
          {
            label: "Contract",
            value: (
              <span className="num">
                {shortDate(p.contractExpires)}
                {expiring ? <b> · expiring</b> : null}
              </span>
            ),
          },
        ]
      : []),
    ...(loanStatus === "loaned-in"
      ? [{ label: "Loan", value: `From ${p.onLoanFrom}${p.loanEnd ? ` until ${shortDate(p.loanEnd)}` : ""}` }]
      : loanStatus === "loaned-out"
        ? [{ label: "Loan", value: `Out at ${p.club}${p.loanEnd ? ` until ${shortDate(p.loanEnd)}` : ""}` }]
        : []),
    ...(p.lastTransferFee != null
      ? [{ label: "Last fee", value: <span className="num">{formatMoney(p.lastTransferFee)}</span> }]
      : []),
    ...(p.playStyle ? [{ label: "FM style", value: p.playStyle }] : []),
  ];

  return (
    <>
      <Dateline
        left="Player dossier"
        center={`${bundle!.dataset.label} · ${bundle!.dataset.players.length} players`}
        right={`Known ${conf}%`}
      />

      <section className="d-hero d-hero-art">
        <div className="d-hero-main">
          <p className="eyebrow">{eyebrow}</p>
          <h1>
            {p.name}
            <WatchToggle player={p} />
          </h1>
          <p className="standfirst">{s.summary}</p>

          <FactsRail
            rows={[
              { label: "Club", value: p.club || "—" },
              { label: "Nation", value: p.nationality || "—" },
              { label: "Age", value: <span className="num">{p.age ?? "—"}</span> },
              { label: "Height", value: <span className="num">{formatHeight(p.heightCm)}</span> },
              { label: "Foot", value: footLabel(p.foot) },
              { label: "Positions", value: p.positions.join("/") || "—" },
              { label: "Value", value: <span className="num">{formatMoney(p.value)}</span> },
              ...contractRows,
              { label: "Top archetype", value: <b>{arch ? arch.name : "No defined archetype"}</b> },
              { label: "FM grade", value: <b>{p.scoutGrade || "—"}</b> },
              { label: "Known", value: <span className="num">{conf}%</span> },
            ]}
          />

          <div className="callout">
            <VerdictBadge rec={rec} />
            <p className="c-head">{rec.headline}</p>
            {rec.reasons.length > 0 ? <p className="c-detail">{rec.reasons.join(" ")}</p> : null}
          </div>

          {pull ? <PullQuote>{pull}</PullQuote> : null}
          {director && kind === "squad" ? <SaleVerdictCallout p={p} board={director.board} /> : null}
        </div>

        {s.topArchetype ? (
          <ArchetypeArt id={s.topArchetype.id} size="hero" priority caption />
        ) : (
          <ArchetypeArtFallback family={s.general.family} />
        )}
      </section>

      <ArchetypeColumns archetypes={s.archetypes} />

      <div className="d-body">
        <figure className="radar-figure">
          <p className="panel-h">Profile radar</p>
          <Radar scores={s} cohortLabel={GROUP_COHORT_LABEL[canonicalPrimaryGroup(p.positions)]} />
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

      <RoleTable p={p} s={s} />

      {squadFit && director ? (
        <SquadFitSection
          fit={squadFit}
          formationId={director.ctx.formation.id}
          budget={lastAssistantRun?.budget ?? DEFAULT_BUDGET}
          useFull={lastAssistantRun?.useFull ?? true}
        />
      ) : null}

      <Footline
        left={`Source · ${bundle?.dataset.source}`}
        right={
          <>
            <WatchToggle player={p} />
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
          </>
        }
      />
    </>
  );
}
