"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useDatasets } from "@/lib/store";
import type { Player } from "@/src/domain/player.js";
import { FORMATIONS } from "@/src/domain/squad/formations.js";
import type { Zone } from "@/src/domain/squad/formations.js";
import { buildAssistantReport } from "@/src/domain/assistant/report.js";
import type { PlayerRow } from "@/src/domain/assistant/report.js";
import type {
  AssistantReport,
  Insight,
  InsightClass,
  Severity,
} from "@/src/domain/assistant/types.js";
import type { SlotNeed } from "@/src/domain/assistant/slots.js";
import type { TransferPackage } from "@/src/domain/assistant/packages.js";
import type { PlayerScores } from "@/src/domain/scoring/dataset.js";
import type { SaleRecommendation, SquadHealth, SuccessionEntry } from "@/src/domain/assistant/transfers/types.js";
import { formatMoney } from "@/src/report/format.js";

const ZONE_LABEL: Record<Zone, string> = { GK: "Goal", DEF: "Defence", MID: "Midfield", ATT: "Attack" };

const NEED_LABEL: Record<SlotNeed, string> = {
  hole: "Unfilled",
  weak: "Weak spot",
  thin: "No depth",
  ageing: "Ageing",
  solid: "Solid",
};

const NEED_TONE: Record<SlotNeed, string> = {
  hole: "red",
  weak: "red",
  thin: "gold",
  ageing: "gold",
  solid: "green",
};

const SEVERITY_TONE: Record<Severity, string> = {
  critical: "red",
  high: "red",
  medium: "gold",
  low: "ink",
  praise: "green",
};

const FEED_COLLAPSED_COUNT = 8;

type FeedGroup = "all" | "squad" | "tactics" | "market" | "risk" | "transfers";

const FEED_GROUPS: Record<FeedGroup, readonly InsightClass[] | null> = {
  all: null,
  squad: ["slot", "age", "development", "physical"],
  tactics: ["shape", "dna", "setpiece", "chemistry"],
  market: ["market"],
  risk: ["risk", "shortlist"],
  transfers: ["transfer"],
};

const FEED_LABEL: Record<FeedGroup, string> = {
  all: "All",
  squad: "Squad",
  tactics: "Tactics",
  market: "Market",
  risk: "Risks",
  transfers: "Transfers",
};

const VERDICT_LABEL: Record<SaleRecommendation["verdict"], string> = {
  untouchable: "Untouchable",
  keep: "Keep",
  "sell-high": "Sell high",
  "sell-now": "Sell now",
  "loan-out": "Loan out",
  release: "Release",
};

const VERDICT_TONE: Record<SaleRecommendation["verdict"], string> = {
  untouchable: "green",
  keep: "ink",
  "sell-high": "gold",
  "sell-now": "red",
  "loan-out": "gold",
  release: "red",
};

const HEALTH_SUBSCORES: readonly { key: keyof SquadHealth; label: string }[] = [
  { key: "xiQuality", label: "XI quality" },
  { key: "depth", label: "Depth" },
  { key: "ageBalance", label: "Age balance" },
  { key: "succession", label: "Succession" },
  { key: "liquidity", label: "Liquidity" },
];

function rowsOf(players: readonly Player[], scoreById: Map<string, PlayerScores>): PlayerRow[] {
  return players.map((p) => ({ player: p, scores: scoreById.get(p.id)! }));
}

function surname(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1]! : name;
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
        <Link href="/" style={{ color: "var(--red)" }}>
          Upload your squad export
        </Link>{" "}
        so the assistant can analyse it.
      </div>
    );
  }

  const needs = report?.slots.filter((s) => s.need !== "solid") ?? [];

  // Praise lives in its own strip at the bottom; the feed is problems + reads only.
  const praise = report ? report.insights.filter((i) => i.severity === "praise") : [];
  const findings = report ? report.insights.filter((i) => i.severity !== "praise") : [];
  const groupCount = (g: FeedGroup) =>
    g === "all"
      ? findings.length
      : findings.filter((i) => FEED_GROUPS[g]!.includes(i.cls)).length;
  const visibleGroups = (Object.keys(FEED_GROUPS) as FeedGroup[]).filter((g) => groupCount(g) > 0);
  const activeGroup: FeedGroup = groupCount(feedGroup) > 0 ? feedGroup : "all";
  const feedAll = findings.filter((i) => {
    const classes = FEED_GROUPS[activeGroup];
    return !classes || classes.includes(i.cls);
  });
  const feed = feedExpanded ? feedAll : feedAll.slice(0, FEED_COLLAPSED_COUNT);

  return (
    <>
      <div className="brief">
        <div className="field">
          <label>Formation</label>
          <select value={formationId} onChange={(e) => setFormationId(e.target.value)}>
            {FORMATIONS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Transfer budget (€M)</label>
          <input
            type="number"
            min={0}
            value={budgetM}
            onChange={(e) => setBudgetM(e.target.value)}
            style={{ minWidth: 110 }}
          />
        </div>
        <label className="check">
          <input type="checkbox" checked={useFull} onChange={(e) => setUseFull(e.target.checked)} />
          Spend full budget (ignore 80% wage buffer)
        </label>
        <button className="btn" onClick={runSearch}>
          Run smart search
        </button>
      </div>

      {!report ? (
        <div className="empty" style={{ marginTop: 34 }}>
          Pick a formation and budget, then run the smart search. The assistant builds your best XI,
          reads your squad's chemistry and identity, finds every gap, and drafts named transfer plans
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

          <div className="verdict-bar">
            <div>
              <div className="section-label">Squad verdict</div>
              <div className="big-verdict">
                {report.verdict}
                <span className="num" style={{ color: "var(--ink-3)", fontSize: 22 }}>
                  {" "}
                  · XI fit {report.avgFit}
                </span>
              </div>
            </div>
            <div className="zones">
              {(Object.keys(report.zoneStrength) as Zone[]).map((z) => (
                <div className="zone" key={z}>
                  <span className="zlabel">{ZONE_LABEL[z]}</span>
                  <span className="pctbar" style={{ width: 96 }}>
                    <i
                      style={{
                        width: `${report.zoneStrength[z]}%`,
                        background:
                          report.zoneStrength[z] >= 72
                            ? "var(--green)"
                            : report.zoneStrength[z] >= 62
                              ? "var(--ink)"
                              : "var(--red)",
                      }}
                    />
                  </span>
                  <span className="num zval">{report.zoneStrength[z]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="assist-grid">
            <Pitch report={report} nameById={nameById} />

            <div className="gaps">
              <div className="section-label">Where you're short</div>
              {needs.length === 0 ? (
                <p className="lede">
                  No pressing gaps — every position has a capable starter and adequate cover.
                </p>
              ) : (
                <ul className="gap-list">
                  {needs.map((s) => {
                    const starter = s.starter ? nameById.get(s.starter.id) : null;
                    return (
                      <li key={s.slotKey}>
                        <span className={`tag ${NEED_TONE[s.need]}`}>{NEED_LABEL[s.need]}</span>
                        <b>{s.label}</b>
                        <span className="gsub">
                          {starter
                            ? `${surname(starter.name)} · fit ${s.starter!.fit}${
                                s.backup ? ` · cover ${s.backup.fit}` : " · no cover"
                              }`
                            : "no natural player"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="section-label" style={{ marginTop: 26 }}>
                Best-fitting shapes
              </div>
              <div className="form-strip">
                {report.formationRanking.map((f) => (
                  <div key={f.id} className={`form-chip${f.id === report.formation.id ? " current" : ""}`}>
                    <span className="fname">{f.name}</span>
                    <span className="num ffit">{f.avgFit}</span>
                    {f.holes > 0 ? <span className="fwarn">{f.holes} gap</span> : null}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Transfer plans come before the findings feed — they're the product. */}
          <div className="section-label" style={{ marginTop: 40 }}>
            Transfer plans {shortlist ? `(cap ${formatMoney(report.budgetCap)})` : ""}
          </div>
          {!shortlist ? (
            <p className="lede">
              Load a shortlist on the{" "}
              <Link href="/" style={{ color: "var(--red)" }}>
                upload page
              </Link>{" "}
              and the assistant will draft several named transfer plans that plug these gaps within
              budget.
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

          <div className="section-label" style={{ marginTop: 40 }}>
            Sporting director
          </div>
          <SportingDirector report={report} nameById={nameById} />

          <div className="section-label" style={{ marginTop: 40 }}>
            Scouting report ({findings.length} findings)
          </div>
          {visibleGroups.length > 2 ? (
            <div className="feed-tabs">
              {visibleGroups.map((g) => (
                <button
                  key={g}
                  className={activeGroup === g ? "on" : ""}
                  onClick={() => {
                    setFeedGroup(g);
                    setFeedExpanded(false);
                  }}
                >
                  {FEED_LABEL[g]} ({groupCount(g)})
                </button>
              ))}
            </div>
          ) : null}
          <ul className="insight-feed">
            {feed.map((i) => (
              <InsightRow key={i.id} insight={i} nameById={nameById} onFormation={tryFormation} />
            ))}
            {feed.length === 0 ? <li className="lede">Nothing here — good news.</li> : null}
          </ul>
          {!feedExpanded && feedAll.length > FEED_COLLAPSED_COUNT ? (
            <button className="show-all-btn" onClick={() => setFeedExpanded(true)}>
              Show all {feedAll.length} findings
            </button>
          ) : null}

          {praise.length > 0 ? (
            <>
              <div className="section-label" style={{ marginTop: 40 }}>
                What's working
              </div>
              <div className="praise-strip">
                {praise.map((i) => (
                  <div key={i.id} className="praise-card">
                    <div className="ptitle">{i.title}</div>
                    <p className="pdetail">{i.detail}</p>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </>
  );
}

function InsightRow({
  insight,
  nameById,
  onFormation,
}: {
  insight: Insight;
  nameById: Map<string, Player>;
  onFormation: (id: string) => void;
}) {
  return (
    <li className={`insight sev-${SEVERITY_TONE[insight.severity]}`}>
      <span className="isev" aria-hidden />
      <div className="ibody">
        <div className="ititle">{insight.title}</div>
        <p className="idetail">{insight.detail}</p>
        {insight.evidence.length > 0 ? (
          <div className="ievidence">
            {insight.evidence.map((e, i) => (
              <span key={i} className="epill">
                {e.label}: <b>{e.value}</b>
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <InsightAction insight={insight} nameById={nameById} onFormation={onFormation} />
    </li>
  );
}

function InsightAction({
  insight,
  nameById,
  onFormation,
}: {
  insight: Insight;
  nameById: Map<string, Player>;
  onFormation: (id: string) => void;
}) {
  const action = insight.action;
  if (!action) return null;
  if (action.kind === "formation") {
    const formationId = action.formationId;
    return (
      <button className="iaction" onClick={() => onFormation(formationId)}>
        Try {FORMATIONS.find((f) => f.id === formationId)?.name}
      </button>
    );
  }
  if (action.kind === "player") {
    return (
      <Link className="iaction" href={`/scout/${action.dataset}/${action.playerId}`}>
        View {surname(nameById.get(action.playerId)?.name ?? "player")}
      </Link>
    );
  }
  if (action.kind === "scout") {
    return (
      <Link className="iaction" href="/scout">
        Scout
      </Link>
    );
  }
  return null;
}

function PackageCard({
  pk,
  nameById,
  cap,
}: {
  pk: TransferPackage;
  nameById: Map<string, Player>;
  cap: number;
}) {
  const lift = pk.afterFit - pk.beforeFit;
  const stratCap = pk.totalCost + pk.remaining; // the cap this strategy played under
  const usedPct = Math.min(100, Math.round(pk.capUsed * 100));
  return (
    <div className="plan">
      <div className="plan-head">
        <div>
          <h3 className="plan-name">{pk.name}</h3>
          <div className="plan-tag">{pk.tagline}</div>
        </div>
        <div className="plan-impact">
          <span className="num impact-fit">
            {pk.beforeFit} <span className="arrow">→</span> {pk.afterFit}
            {lift > 0 ? <b className="up"> +{lift}</b> : null}
          </span>
          <span className="impact-verdict">{pk.afterVerdict}</span>
          {pk.depthGain > 0 ? <span className="impact-depth num">2nd XI +{pk.depthGain}</span> : null}
        </div>
      </div>

      <div className="spend-meter" title={`${usedPct}% of ${formatMoney(stratCap)}`}>
        <span className="track">
          <i style={{ width: `${usedPct}%`, background: pk.capUsed > 0.95 ? "var(--red)" : "var(--ink)" }} />
        </span>
        <span className="num spend-label">
          {formatMoney(pk.totalCost)} of {formatMoney(stratCap)}
          {stratCap !== cap ? " (half-cap plan)" : ""}
        </span>
      </div>

      <p className="plan-rationale">{pk.rationale}</p>

      {pk.sales.length > 0 ? (
        <ul className="sale-funding">
          {pk.sales.map((s) => (
            <li key={s.playerId}>
              Sell {s.playerName} ({formatMoney(s.fee)}) — {s.consequence}
            </li>
          ))}
        </ul>
      ) : null}

      <ul className="move-list">
        {pk.moves.map((m) => {
          const p = nameById.get(m.playerId);
          return (
            <li key={m.playerId} className="move">
              <div className="move-top">
                <Link href={`/scout/shortlist/${m.playerId}`} className="move-name">
                  {p?.name ?? m.playerId}
                </Link>
                <span className="move-slot">{m.slotLabel}</span>
                <span className="move-profile">{m.profile}</span>
                <span className="num move-cost">{formatMoney(m.cost)}</span>
              </div>
              <div className="move-why">{m.why}</div>
            </li>
          );
        })}
      </ul>

      <div className="plan-foot">
        {pk.displaced.length > 0 ? (
          <div className="bench-row">
            <span className="foot-label">Bench:</span>
            {pk.displaced.map((n) => (
              <span key={n} className="bench-chip">
                {n}
              </span>
            ))}
          </div>
        ) : null}
        {pk.fundingNote ? <p className="funding-note">{pk.fundingNote}</p> : null}
        {pk.netSpend !== pk.totalCost ? (
          <p className="funding-note">
            Net spend: <span className="num">{formatMoney(pk.netSpend)}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SportingDirector({
  report,
  nameById,
}: {
  report: AssistantReport;
  nameById: Map<string, Player>;
}) {
  const { board } = report;
  return (
    <div className="sd-board">
      <div className="sd-health">
        <div>
          <div className="sd-health-num">{board.health.index}</div>
          <div className="sd-health-label">Squad health</div>
        </div>
        <div className="sd-subs">
          {HEALTH_SUBSCORES.map((s) => (
            <div className="zone" key={s.key}>
              <span className="zlabel">{s.label}</span>
              <span className="pctbar" style={{ width: 96 }}>
                <i
                  style={{
                    width: `${board.health[s.key]}%`,
                    background:
                      board.health[s.key] >= 72
                        ? "var(--green)"
                        : board.health[s.key] >= 50
                          ? "var(--ink)"
                          : "var(--red)",
                  }}
                />
              </span>
              <span className="num zval">{board.health[s.key]}</span>
            </div>
          ))}
        </div>
        {board.expectedIncome > 0 ? (
          <div className="sd-income">
            <span className="num">{formatMoney(board.expectedIncome)}</span> expected from the sales below
          </div>
        ) : null}
      </div>

      {board.sales.length === 0 ? (
        <p className="lede">No one is flagged to leave this window.</p>
      ) : (
        <ul className="sale-list">
          {board.sales.map((s) => (
            <SaleRow key={s.playerId} sale={s} nameById={nameById} />
          ))}
        </ul>
      )}

      <SuccessionWatch entries={board.succession} nameById={nameById} />
    </div>
  );
}

function SaleRow({ sale, nameById }: { sale: SaleRecommendation; nameById: Map<string, Player> }) {
  const name = nameById.get(sale.playerId)?.name ?? sale.playerId;
  return (
    <li className="sale-row">
      <span className={`tag ${VERDICT_TONE[sale.verdict]}`}>{VERDICT_LABEL[sale.verdict]}</span>
      <div className="sale-body">
        <div className="sale-top">
          <Link href={`/scout/squad/${sale.playerId}`} className="sale-name">
            {surname(name)}
          </Link>
          {sale.priceBand ? <span className="num sale-ask">{formatMoney(sale.priceBand.ask)}</span> : null}
        </div>
        {sale.reasons.map((r, i) => (
          <p key={i} className="sale-reason">
            {r}
          </p>
        ))}
        {sale.replacement?.playerId ? (
          <div className="sale-replacement">
            Replacement: {surname(sale.replacement.playerName ?? "")} (fit {sale.replacement.fitAfter}
            {sale.replacement.source === "shortlist" ? `, ${formatMoney(sale.replacement.cost)}` : ", free"})
          </div>
        ) : null}
      </div>
    </li>
  );
}

function SuccessionWatch({
  entries,
  nameById,
}: {
  entries: readonly SuccessionEntry[];
  nameById: Map<string, Player>;
}) {
  const flagged = entries.filter((e) => e.status !== "secure");
  if (flagged.length === 0) return null;
  return (
    <>
      <div className="section-label" style={{ marginTop: 26 }}>
        Succession watch
      </div>
      <ul className="gap-list">
        {flagged.map((e) => {
          const starter = e.starterId ? nameById.get(e.starterId) : null;
          return (
            <li key={e.slotKey}>
              <span className={`tag ${e.status === "crisis" ? "red" : "gold"}`}>
                {e.status === "crisis" ? "Crisis" : "Watch"}
              </span>
              <b>{e.slotLabel}</b>
              <span className="gsub">
                {starter ? `${surname(starter.name)} · fit ${e.fitNow} → ${e.fitIn1} → ${e.fitIn2}` : "no starter"}
                {e.heir?.playerId ? ` · heir: ${surname(e.heir.playerName ?? "")}` : " · no heir lined up"}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Pitch({ report, nameById }: { report: AssistantReport; nameById: Map<string, Player> }) {
  const W = 340;
  const H = 460;
  const px = (x: number) => 24 + x * (W - 48);
  const py = (y: number) => H - 30 - y * (H - 70);
  const ringOf: Record<SlotNeed, string> = {
    hole: "var(--red)",
    weak: "var(--red)",
    thin: "var(--gold)",
    ageing: "var(--gold)",
    solid: "var(--ink)",
  };

  const coordByKey = new Map(report.formation.slots.map((s) => [s.key, { x: px(s.x), y: py(s.y) }]));

  return (
    <div className="pitch-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="pitch" role="img" aria-label="Recommended XI">
        <rect x="6" y="6" width={W - 12} height={H - 12} className="pitch-bg" />
        <line x1="6" y1={H / 2} x2={W - 6} y2={H / 2} className="pitch-line" />
        <circle cx={W / 2} cy={H / 2} r="42" className="pitch-line" fill="none" />
        <rect x={W / 2 - 66} y="6" width="132" height="64" className="pitch-line" fill="none" />
        <rect x={W / 2 - 66} y={H - 70} width="132" height="64" className="pitch-line" fill="none" />

        {report.linkBoard.links.map((l) => {
          const a = coordByKey.get(l.link.a);
          const b = coordByKey.get(l.link.b);
          if (!a || !b) return null;
          const warn = l.partnership < 45;
          return (
            <line
              key={`${l.link.a}-${l.link.b}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className="link-line"
              style={{
                stroke: warn ? "var(--red)" : "var(--ink)",
                opacity: warn ? 0.7 : Math.max(0.12, l.partnership / 140),
                strokeWidth: warn ? 2 : 1 + l.partnership / 40,
              }}
            />
          );
        })}

        {report.slots.map((s) => {
          const cx = px(s.slot.x);
          const cy = py(s.slot.y);
          const player = s.starter ? nameById.get(s.starter.id) : null;
          return (
            <g key={s.slotKey}>
              <circle cx={cx} cy={cy} r="17" className="token" style={{ stroke: ringOf[s.need] }} />
              <text x={cx} y={cy + 4} className="token-pos">
                {s.label}
              </text>
              <text x={cx} y={cy + 32} className="token-name">
                {player ? surname(player.name) : "—"}
              </text>
              <text x={cx} y={cy + 44} className="token-fit num">
                {s.starter ? `fit ${s.starter.fit}` : "gap"}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
