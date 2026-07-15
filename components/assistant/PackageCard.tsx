import Link from "next/link";
import { useState } from "react";
import type { Player } from "@/src/domain/player.js";
import type { TransferPackage } from "@/src/domain/assistant/packages.js";
import { WatchToggle } from "@/components/kit/WatchToggle";
import { formatMoney } from "@/src/report/format.js";

const FATE_LABEL = {
  bench: "drops to the bench",
  sell: "is sold to fund the window",
  cover: "becomes first-choice cover",
  loan: "leaves on loan",
} as const;

export function PackageCard({
  pk,
  nameById,
  cap,
}: {
  pk: TransferPackage;
  nameById: Map<string, Player>;
  cap: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const roundedLift = pk.afterFit - pk.beforeFit;
  const totalLift = pk.afterTotalFit - pk.beforeTotalFit;
  const lift =
    roundedLift > 0 ? roundedLift : totalLift > 0 ? Math.max(1, Math.round(totalLift / 11)) : 0;
  const stratCap = pk.netSpend + pk.remaining;
  const usedPct = Math.min(100, Math.round(pk.capUsed * 100));

  const starters = pk.moves.filter((m) => m.kind !== "depth");
  const depth = pk.moves.filter((m) => m.kind === "depth");
  const showCollapse = pk.moves.length > 5;
  const visibleMoves = showCollapse && !expanded ? starters : pk.moves;
  const hiddenDepth = showCollapse && !expanded ? depth.length : 0;
  const squadLoans = pk.loans.filter((l) => !pk.moves.some((m) => m.playerId === l.playerId && m.kind === "prospect"));

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
          <i className={pk.capUsed > 0.95 ? "spend-fill hot" : "spend-fill"} style={{ width: `${usedPct}%` }} />
        </span>
        <span className="num spend-label">
          {formatMoney(pk.totalCost)} gross
          {pk.income > 0 ? ` · ${formatMoney(pk.income)} in` : ""}
          {" · "}
          net {formatMoney(pk.netSpend)}
          {stratCap !== cap && stratCap > 0 ? " (half-cap plan)" : ""}
        </span>
      </div>

      <p className="plan-rationale">{pk.rationale}</p>
      <p className="window-summary">{pk.windowSummary}</p>

      {pk.sales.length > 0 || squadLoans.length > 0 ? (
        <div className="exits-block">
          <p className="exits-h">Exits</p>
          <ul className="exits-list">
            {pk.sales.map((s) => (
              <li key={s.playerId}>
                Sell <b>{s.playerName}</b> ({formatMoney(s.fee)}) — {s.consequence}
              </li>
            ))}
            {squadLoans.map((l) => (
              <li key={l.playerId}>
                Loan <b>{l.playerName}</b> — {l.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ul className="move-list">
        {visibleMoves.map((m) => {
          const p = nameById.get(m.playerId);
          return (
            <li key={m.playerId} className="move">
              <div className="move-top">
                {p ? <WatchToggle player={p} /> : null}
                <Link href={`/scout/shortlist/${m.playerId}`} className="move-name">
                  {p?.name ?? m.playerId}
                </Link>
                <span className="move-slot">{m.slotLabel}</span>
                {m.kind === "prospect" ? <span className="move-profile">Prospect · on loan</span> : null}
                <span className="move-profile">{m.profile}</span>
                <span className="num move-cost">{formatMoney(m.cost)}</span>
              </div>
              <div className="move-why">{m.why}</div>
              {m.out ? (
                <div className="move-out">
                  <b>{m.out.name}</b> {FATE_LABEL[m.out.fate]}.
                </div>
              ) : null}
            </li>
          );
        })}
        {hiddenDepth > 0 ? (
          <li className="move move-collapsed">
            <button type="button" className="show-depth-btn" onClick={() => setExpanded(true)}>
              and {hiddenDepth} depth signing{hiddenDepth === 1 ? "" : "s"}
            </button>
          </li>
        ) : null}
      </ul>

      <div className="xi-diff">
        <p className="xi-diff-h">Your XI after this window</p>
        <table className="xi-diff-table">
          <tbody>
            {pk.xiDiff.map((row) => (
              <tr key={row.slotLabel} className={row.changed ? "changed" : ""}>
                <td className="xi-slot">{row.slotLabel}</td>
                <td className="xi-before">{row.before}</td>
                <td className="xi-arrow">→</td>
                <td className="xi-after">{row.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
        <p className="funding-note">
          Net spend: <span className="num">{formatMoney(pk.netSpend)}</span>
          {" · "}
          Squad after: <span className="num">{pk.squadAfter}</span>
        </p>
      </div>
    </div>
  );
}
