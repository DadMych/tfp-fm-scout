import Link from "next/link";
import { useState } from "react";
import type { Player } from "@/src/domain/player.js";
import type { AssistantReport } from "@/src/domain/assistant/types.js";
import type { SaleRecommendation, SuccessionEntry } from "@/src/domain/assistant/transfers/types.js";
import { InkBar } from "@/components/kit/InkBar";
import { formatMoney } from "@/src/report/format.js";
import {
  HEALTH_SUBSCORES,
  VERDICT_LABEL,
  VERDICT_TONE,
  healthVerdict,
  surname,
} from "./shared";

export function SportingDirector({
  report,
  nameById,
}: {
  report: AssistantReport;
  nameById: Map<string, Player>;
}) {
  const { board } = report;
  const verdict = healthVerdict(board.health.index);

  return (
    <div className="sd-board">
      <div className="sd-health">
        <div>
          <div className="sd-health-num">{board.health.index}</div>
          <div className="sd-health-label">Squad health</div>
          <div className="sd-health-verdict">{verdict}</div>
        </div>
        <div className="sd-subs">
          {HEALTH_SUBSCORES.map((s) => (
            <div className="zone" key={s.key}>
              <span className="zlabel">{s.label}</span>
              <InkBar value={board.health[s.key]} width={96} />
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
  const player = nameById.get(sale.playerId);
  const name = player?.name ?? sale.playerId;
  const band = sale.priceBand;

  return (
    <li className="sale-row">
      <span className={`tag ${VERDICT_TONE[sale.verdict]}`}>{VERDICT_LABEL[sale.verdict]}</span>
      <div className="sale-body">
        <div className="sale-top">
          <Link href={`/scout/squad/${sale.playerId}`} className="sale-name">
            {surname(name)}
          </Link>
          {player?.age != null ? <span className="sale-age num">Age {player.age}</span> : null}
          {band ? (
            <span className="num sale-ask" title={`Low ${formatMoney(band.low)} · high ${formatMoney(band.high)}`}>
              {formatMoney(band.ask)}
            </span>
          ) : null}
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
  const [showAll, setShowAll] = useState(false);
  const flagged = entries.filter((e) => e.status !== "secure");
  if (flagged.length === 0) return null;
  const visible = showAll ? flagged : flagged.slice(0, 4);

  return (
    <>
      <div className="section-label section-gap">Succession watch</div>
      <ul className="gap-list">
        {visible.map((e) => {
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
      {flagged.length > 4 ? (
        <button type="button" className="show-all-btn" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show fewer" : `Show all ${flagged.length} slots`}
        </button>
      ) : null}
    </>
  );
}
