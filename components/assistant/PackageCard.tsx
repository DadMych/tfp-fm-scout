import Link from "next/link";
import type { Player } from "@/src/domain/player.js";
import type { TransferPackage } from "@/src/domain/assistant/packages.js";
import { formatMoney } from "@/src/report/format.js";

export function PackageCard({
  pk,
  nameById,
  cap,
}: {
  pk: TransferPackage;
  nameById: Map<string, Player>;
  cap: number;
}) {
  const lift = pk.afterFit - pk.beforeFit;
  const stratCap = pk.totalCost + pk.remaining;
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
          <i className={pk.capUsed > 0.95 ? "spend-fill hot" : "spend-fill"} style={{ width: `${usedPct}%` }} />
        </span>
        <span className="num spend-label">
          {formatMoney(pk.totalCost)} of {formatMoney(stratCap)}
          {stratCap !== cap ? " (half-cap plan)" : ""}
        </span>
      </div>

      <p className="plan-rationale">{pk.rationale}</p>

      {pk.sales.length > 0 ? (
        <p className="sale-funding">
          {pk.sales
            .map((s) => `Sell ${s.playerName} (${formatMoney(s.fee)}) — ${s.consequence}`)
            .join(" ")}
        </p>
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
