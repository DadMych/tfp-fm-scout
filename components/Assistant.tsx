"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useDatasets } from "@/lib/store";
import type { Player } from "@/src/domain/player.js";
import { FORMATIONS } from "@/src/domain/squad/formations.js";
import { buildAssistantReport } from "@/src/domain/assistant/report.js";
import type { PlayerRow } from "@/src/domain/assistant/report.js";
import type { AssistantReport } from "@/src/domain/assistant/types.js";
import type { PlayerScores } from "@/src/domain/scoring/dataset.js";
import { formatMoney } from "@/src/report/format.js";
import { AssistantControls } from "@/components/assistant/AssistantControls";
import { FindingsFeed } from "@/components/assistant/FindingsFeed";
import { PackageCard } from "@/components/assistant/PackageCard";
import { PraiseStrip } from "@/components/assistant/PraiseStrip";
import { SportingDirector } from "@/components/assistant/SportingDirector";
import { GapsPanel, Pitch, VerdictBar } from "@/components/assistant/VerdictBar";
import { FEED_COLLAPSED_COUNT, FEED_GROUPS, type FeedGroup } from "@/components/assistant/shared";

function rowsOf(players: readonly Player[], scoreById: Map<string, PlayerScores>): PlayerRow[] {
  return players.map((p) => ({ player: p, scores: scoreById.get(p.id)! }));
}

export function Assistant() {
  const { squad, shortlist, ready, lastAssistantRun, setLastAssistantRun } = useDatasets();

  const [formationId, setFormationId] = useState(lastAssistantRun?.formationId ?? "4-2-3-1");
  const [budgetM, setBudgetM] = useState(
    lastAssistantRun ? String(Math.round(lastAssistantRun.budget / 1e6)) : "50",
  );
  const [useFull, setUseFull] = useState(lastAssistantRun?.useFull ?? false);
  const [feedGroup, setFeedGroup] = useState<FeedGroup>("all");
  const [feedExpanded, setFeedExpanded] = useState(false);
  const [committed, setCommitted] = useState<{
    formationId: string;
    budget: number;
    useFull: boolean;
  } | null>(lastAssistantRun);

  function commitRun(next: { formationId: string; budget: number; useFull: boolean }) {
    setFeedExpanded(false);
    setCommitted(next);
    setLastAssistantRun(next);
  }

  function runSearch() {
    commitRun({ formationId, budget: (Number(budgetM) || 0) * 1e6, useFull });
  }

  function tryFormation(id: string) {
    setFormationId(id);
    commitRun({ formationId: id, budget: (Number(budgetM) || 0) * 1e6, useFull });
  }

  const nameById = useMemo(() => {
    const m = new Map<string, Player>();
    for (const b of [squad, shortlist]) {
      if (b) for (const p of b.dataset.players) m.set(p.id, p);
    }
    return m;
  }, [squad, shortlist]);

  const report: AssistantReport | null = useMemo(() => {
    if (!committed || !squad) return null;
    const formation = FORMATIONS.find((f) => f.id === committed.formationId) ?? FORMATIONS[0]!;
    return buildAssistantReport({
      squad: rowsOf(squad.dataset.players, squad.scoreById),
      shortlist: shortlist ? rowsOf(shortlist.dataset.players, shortlist.scoreById) : [],
      formation,
      budget: committed.budget,
      useFullBudget: committed.useFull,
    });
  }, [committed, squad, shortlist]);

  if (!ready) return <div className="empty">Loading your data…</div>;

  if (!squad) {
    return (
      <div className="empty">
        No squad loaded.{" "}
        <Link href="/" className="link-red">
          Upload your squad export
        </Link>{" "}
        so the assistant can analyse it.
      </div>
    );
  }

  const praise = report ? report.insights.filter((i) => i.severity === "praise") : [];
  const findings = report ? report.insights.filter((i) => i.severity !== "praise") : [];
  const groupCount = (g: FeedGroup) =>
    g === "all" ? findings.length : findings.filter((i) => FEED_GROUPS[g]!.includes(i.cls)).length;
  const visibleGroups = (Object.keys(FEED_GROUPS) as FeedGroup[]).filter((g) => groupCount(g) > 0);
  const activeGroup: FeedGroup = groupCount(feedGroup) > 0 ? feedGroup : "all";
  const feedAll = findings.filter((i) => {
    const classes = FEED_GROUPS[activeGroup];
    return !classes || classes.includes(i.cls);
  });
  const feed = feedExpanded ? feedAll : feedAll.slice(0, FEED_COLLAPSED_COUNT);

  return (
    <>
      <AssistantControls
        formationId={formationId}
        budgetM={budgetM}
        useFull={useFull}
        onFormationChange={setFormationId}
        onBudgetChange={setBudgetM}
        onUseFullChange={setUseFull}
        onRun={runSearch}
      />

      {!report ? (
        <div className="empty empty-spaced">
          Pick a formation and budget, then run the smart search. The assistant builds your best XI,
          reads your squad&apos;s chemistry and identity, finds every gap, and drafts named transfer plans
          from your shortlist{shortlist ? "" : " (none loaded yet)"}.
        </div>
      ) : (
        <>
          <div className="team-report">
            <div className="tr-headline">{report.teamReport.headline}</div>
            {report.teamReport.paragraphs.map((p, i) => (
              <p key={i} className="tr-p">
                {p}
              </p>
            ))}
          </div>

          <VerdictBar report={report} />

          <div className="assist-grid">
            <Pitch report={report} nameById={nameById} />
            <GapsPanel report={report} nameById={nameById} />
          </div>

          <div className="section-label section-gap-lg">
            Transfer plans {shortlist ? `(cap ${formatMoney(report.budgetCap)})` : ""}
          </div>
          {!shortlist ? (
            <p className="lede">
              Load a shortlist on the{" "}
              <Link href="/" className="link-red">
                upload page
              </Link>{" "}
              and the assistant will draft several named transfer plans that plug these gaps within budget.
            </p>
          ) : report.packages.length === 0 ? (
            <p className="lede">
              Nothing on your shortlist beats what you already have within {formatMoney(report.budgetCap)} —
              your XI is well stocked for this formation.
            </p>
          ) : (
            <div className="plans">
              {report.packages.map((pk) => (
                <PackageCard key={pk.id} pk={pk} nameById={nameById} cap={report.budgetCap} />
              ))}
            </div>
          )}

          <div className="section-label section-gap-lg">Sporting director</div>
          <SportingDirector report={report} nameById={nameById} />

          <FindingsFeed
            findings={findings}
            visibleGroups={visibleGroups}
            activeGroup={activeGroup}
            groupCount={groupCount}
            feed={feed}
            feedAll={feedAll}
            feedExpanded={feedExpanded}
            onGroupChange={(g) => {
              setFeedGroup(g);
              setFeedExpanded(false);
            }}
            onExpand={() => setFeedExpanded(true)}
            nameById={nameById}
            onFormation={tryFormation}
          />

          <PraiseStrip praise={praise} />
        </>
      )}
    </>
  );
}
