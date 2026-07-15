"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useDatasets } from "@/lib/store";
import { buildAssistantReport } from "@/src/domain/assistant/report.js";
import { getArchetype } from "@/src/domain/archetypes/registry.js";
import {
  pickBargain,
  pickBriefs,
  pickLead,
  posLabel,
  standoutClause,
  type ScoredRow,
} from "@/src/domain/front-page.js";
import { DEFAULT_BUDGET } from "@/src/domain/assistant/defaults.js";
import { formatPullQuote } from "@/src/domain/evidence.js";
import { ENGINE_VERSION } from "@/src/domain/engine-version.js";
import { recommend } from "@/src/domain/recommendation.js";
import { getFormation } from "@/src/domain/squad/formations.js";
import { formatMoney } from "@/src/report/format.js";
import { ArchetypeArt, ArchetypeArtFallback } from "@/components/kit/ArchetypeArt";
import { Dateline } from "@/components/kit/Dateline";
import { EmptyBroadsheet } from "@/components/kit/EmptyBroadsheet";
import { FactsRail } from "@/components/kit/FactsRail";
import { PullQuote } from "@/components/kit/PullQuote";
import { SectionRule } from "@/components/kit/SectionRule";
import { WatchToggle } from "@/components/kit/WatchToggle";

function rowsFromBundle(bundle: NonNullable<ReturnType<typeof useDatasets>["shortlist"]>): ScoredRow[] {
  return bundle.dataset.players.map((p) => ({
    p,
    s: bundle.scoreById.get(p.id)!,
  }));
}

export function FrontPage() {
  const { shortlist, squad, squadContext, ready, watchList, importStatus, lastAssistantRun } = useDatasets();

  const bundle = shortlist ?? squad;
  const pending = importStatus.shortlist ?? importStatus.squad;
  const rows = useMemo(() => (bundle ? rowsFromBundle(bundle) : []), [bundle]);

  const lead = useMemo(() => pickLead(rows), [rows]);
  const bargain = useMemo(() => pickBargain(rows), [rows]);

  const briefs = useMemo(() => {
    if (!bundle) return [];
    const withRec = rows.map((r) => ({
      ...r,
      rec: recommend(r.p, r.s, bundle === shortlist ? (squadContext ?? undefined) : undefined),
    }));
    return pickBriefs(withRec, 4);
  }, [rows, bundle, squadContext, shortlist]);

  const teamReport = useMemo(() => {
    if (!squad) return null;
    const formation = getFormation(lastAssistantRun?.formationId ?? "4-2-3-1");
    const squadRows = squad.dataset.players.map((p) => ({
      player: p,
      scores: squad.scoreById.get(p.id)!,
    }));
    const shortlistRows = shortlist
      ? shortlist.dataset.players.map((p) => ({
          player: p,
          scores: shortlist.scoreById.get(p.id)!,
        }))
      : [];
    return buildAssistantReport({
      squad: squadRows,
      shortlist: shortlistRows,
      formation,
      budget: lastAssistantRun?.budget ?? DEFAULT_BUDGET,
      useFullBudget: lastAssistantRun?.useFull ?? false,
    }).teamReport;
  }, [squad, shortlist, lastAssistantRun]);

  if (!ready) return <div className="empty">Setting the page…</div>;

  if (!bundle && pending) {
    return (
      <>
        <Dateline left="The Scouting Post" center="Import in progress" right="" />
        <div className="empty import-progress">{pending}</div>
      </>
    );
  }

  if (!bundle) {
    return (
      <>
        <Dateline left="The Scouting Post" center="No dataset loaded" right="Upload to begin" />
        <EmptyBroadsheet
          eyebrow="The FM26 scouting companion"
          title="Your squad's scouting annual starts here."
          actions={
            <>
              <Link className="btn" href="/upload">
                Upload your players →
              </Link>
              <Link className="btn ghost" href="/scout">
                Scout desk
              </Link>
            </>
          }
        >
          <p>
            Load a shortlist or squad export and this page becomes your front page — lead story,
            value picks, and the day&rsquo;s briefs before you open the ledger.
          </p>
        </EmptyBroadsheet>
      </>
    );
  }

  const masked = Math.round(bundle.dataset.maskedShare * 100);
  const kind = shortlist ? "shortlist" : "squad";

  return (
    <>
      <Dateline
        left={bundle.dataset.label}
        center={`${bundle.dataset.players.length} players · ${masked}% masked`}
        right={`${watchList.length} on watch · engine ${ENGINE_VERSION}`}
      />

      {lead ? (
        <section className="fp-hero">
          <div>
            <p className="eyebrow">
              {[lead.s.general.family, lead.p.age != null ? `Age ${lead.p.age}` : null, posLabel(lead.p)]
                .filter(Boolean)
                .join("  ·  ")}
            </p>
            <h1>
              <Link href={`/scout/${kind}/${lead.p.id}`}>{lead.p.name}</Link>
              <WatchToggle player={lead.p} />
            </h1>
            <p className="standfirst">{lead.s.summary}</p>
            {formatPullQuote(lead.s) ? <PullQuote>{formatPullQuote(lead.s)}</PullQuote> : null}
            <FactsRail
              rows={[
                { label: "Club", value: lead.p.club || "—" },
                { label: "Nation", value: lead.p.nationality || "—" },
                { label: "Value", value: <span className="num">{formatMoney(lead.p.value)}</span> },
                { label: "Positions", value: posLabel(lead.p) },
                {
                  label: "Top archetype",
                  value: (
                    <b>{lead.s.topArchetype ? getArchetype(lead.s.topArchetype.id).name : "Utility"}</b>
                  ),
                },
                {
                  label: "Score",
                  value: (
                    <span className="num">
                      {lead.s.topArchetype ? Math.round(lead.s.topArchetype.score) : "—"}
                    </span>
                  ),
                },
                {
                  label: "Known",
                  value: <span className="num">{Math.round(lead.s.confidence * 100)}%</span>,
                },
              ]}
            />
          </div>
          {lead.s.topArchetype ? (
            <ArchetypeArt id={lead.s.topArchetype.id} size="plate" priority caption />
          ) : (
            <ArchetypeArtFallback family={lead.s.general.family} />
          )}
        </section>
      ) : null}

      {bargain ? (
        <div className="valuepick">
          <span className="vp-label">Value pick</span>
          <span className="vp-body">
            <WatchToggle player={bargain.p} />
            <Link href={`/scout/${kind}/${bargain.p.id}`}>{bargain.p.name}</Link>
            {" — "}
            <b>
              {bargain.s.topArchetype ? getArchetype(bargain.s.topArchetype.id).name : "Utility"}
            </b>{" "}
            <span className="num">{Math.round(bargain.s.topArchetype?.score ?? 0)}</span> at{" "}
            <span className="num">{formatMoney(bargain.p.value)}</span>
            {bargain.p.age != null ? (
              <>
                , age <span className="num">{bargain.p.age}</span>
              </>
            ) : null}
          </span>
        </div>
      ) : null}

      {teamReport ? (
        <section className="team-report">
          <SectionRule>Team report</SectionRule>
          <div className="tr-headline">{teamReport.headline}</div>
          {teamReport.paragraphs.map((p, i) => (
            <p key={i} className="tr-p">
              {p}
            </p>
          ))}
          <p className="lede">
            <Link href="/assistant" className="link-red">
              Open the full assistant →
            </Link>
          </p>
        </section>
      ) : null}

      {briefs.length > 0 ? (
        <>
          <SectionRule gap="sm">Today&apos;s briefs</SectionRule>
          <div className="briefs">
            {briefs.map(({ p, s, rec }) => {
              const clause = standoutClause(s);
              return (
                <article className="brief-card" key={p.id}>
                  <div className="brief-top">
                    <Link className="brief-name" href={`/scout/${kind}/${p.id}`}>
                      {p.name}
                    </Link>
                    <WatchToggle player={p} />
                  </div>
                  <p className="brief-meta">
                    {[
                      p.age != null ? `Age ${p.age}` : null,
                      posLabel(p),
                      p.value != null ? formatMoney(p.value) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <span className={`verdict ${rec.tone}`}>{rec.verdict}</span>
                  <p className="brief-head">
                    {rec.headline}
                    {clause ? <em className="brief-standout"> {clause}</em> : null}
                  </p>
                </article>
              );
            })}
          </div>
        </>
      ) : null}

      <div className="cta-row fp-actions">
        <Link className="btn" href="/scout">
          Open the scout desk →
        </Link>
        <Link className="btn ghost" href="/upload">
          Upload another file
        </Link>
      </div>
    </>
  );
}
