import { useState } from "react";
import type { Player } from "@/src/domain/player.js";
import type { PlayerScores } from "@/src/domain/scoring/dataset.js";
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
import { PlayerLink, peekFor } from "./PlayerLink";

type PeekMaps = {
  squadById: Map<string, Player>;
  shortlistById: Map<string, Player>;
  scoreById: Map<string, PlayerScores>;
};

export function SportingDirector({
  report,
  nameById,
  squadById,
  shortlistById,
  scoreById,
}: {
  report: AssistantReport;
  nameById: Map<string, Player>;
  squadById: Map<string, Player>;
  shortlistById: Map<string, Player>;
  scoreById: Map<string, PlayerScores>;
}) {
  const { board } = report;
  const verdict = healthVerdict(board.health.index);
  const maps: PeekMaps = { squadById, shortlistById, scoreById };

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
            <SaleRow key={s.playerId} sale={s} nameById={nameById} maps={maps} />
          ))}
        </ul>
      )}

      <SuccessionWatch entries={board.succession} nameById={nameById} maps={maps} />
    </div>
  );
}

function SaleRow({
  sale,
  nameById,
  maps,
}: {
  sale: SaleRecommendation;
  nameById: Map<string, Player>;
  maps: PeekMaps;
}) {
  const player = nameById.get(sale.playerId);
  const name = player?.name ?? sale.playerId;
  const band = sale.priceBand;
  const peek = peekFor(sale.playerId, maps);

  return (
    <li className="sale-row">
      <span className={`tag ${VERDICT_TONE[sale.verdict]}`}>{VERDICT_LABEL[sale.verdict]}</span>
      <div className="sale-body">
        <div className="sale-top">
          <PlayerLink id={sale.playerId} dataset="squad" peek={peek} className="sale-name">
            {surname(name)}
          </PlayerLink>
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
            Replacement:{" "}
            <PlayerLink
              id={sale.replacement.playerId}
              dataset={sale.replacement.source === "shortlist" ? "shortlist" : "squad"}
              peek={peekFor(sale.replacement.playerId, maps)}
              className="player-link"
            >
              {surname(sale.replacement.playerName ?? "")}
            </PlayerLink>{" "}
            (fit {sale.replacement.fitAfter}
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
  maps,
}: {
  entries: readonly SuccessionEntry[];
  nameById: Map<string, Player>;
  maps: PeekMaps;
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
                {starter && e.starterId ? (
                  <>
                    <PlayerLink
                      id={e.starterId}
                      dataset="squad"
                      peek={peekFor(e.starterId, maps)}
                      className="player-link"
                    >
                      {surname(starter.name)}
                    </PlayerLink>
                    {` · fit ${e.fitNow} → ${e.fitIn1} → ${e.fitIn2}`}
                  </>
                ) : (
                  "no starter"
                )}
                {e.heir?.playerId ? (
                  <>
                    {" · heir: "}
                    <PlayerLink
                      id={e.heir.playerId}
                      dataset={e.heir.source === "shortlist" ? "shortlist" : "squad"}
                      peek={peekFor(e.heir.playerId, maps)}
                      className="player-link"
                    >
                      {surname(e.heir.playerName ?? "")}
                    </PlayerLink>
                  </>
                ) : (
                  " · no heir lined up"
                )}
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
