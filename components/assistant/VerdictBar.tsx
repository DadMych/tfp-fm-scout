import type { Player } from "@/src/domain/player.js";
import type { PlayerScores } from "@/src/domain/scoring/dataset.js";
import type { AssistantReport } from "@/src/domain/assistant/types.js";
import type { Zone } from "@/src/domain/squad/formations.js";
import type { SlotNeed } from "@/src/domain/assistant/slots.js";
import { InkBar } from "@/components/kit/InkBar";
import { SectionRule } from "@/components/kit/SectionRule";
import { NEED_LABEL, NEED_TONE, surname, ZONE_LABEL } from "./shared";
import { PlayerLink, peekFor } from "./PlayerLink";

type PeekMaps = {
  squadById: Map<string, Player>;
  shortlistById: Map<string, Player>;
  scoreById: Map<string, PlayerScores>;
};

/**
 * The squad board — verdict, zones, gaps and shapes beside the pitch.
 * One section instead of three stacked ones (doc 12 §2).
 */
export function SquadBoard({
  report,
  nameById,
  maps,
  onFormation,
}: {
  report: AssistantReport;
  nameById: Map<string, Player>;
  maps: PeekMaps;
  onFormation?: (id: string) => void;
}) {
  const needs = report.slots.filter((s) => s.need !== "solid");

  return (
    <section className="squad-board">
      <SectionRule gap="lg">Squad verdict</SectionRule>
      <div className="squad-board-grid">
        <div className="squad-board-side">
          <div className="big-verdict">
            {report.verdict}
            <span className="num verdict-fit"> · XI fit {report.avgFit}</span>
          </div>
          <div className="zones">
            {(Object.keys(report.zoneStrength) as Zone[]).map((z) => (
              <div className="zone" key={z}>
                <span className="zlabel">{ZONE_LABEL[z]}</span>
                <InkBar value={report.zoneStrength[z]} width={96} />
                <span className="num zval">{report.zoneStrength[z]}</span>
              </div>
            ))}
          </div>

          <SectionRule gap="sm">Where you&apos;re short</SectionRule>
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
                      {starter && s.starter ? (
                        <>
                          <PlayerLink
                            id={s.starter.id}
                            dataset="squad"
                            peek={peekFor(s.starter.id, maps)}
                            className="player-link"
                          >
                            {surname(starter.name)}
                          </PlayerLink>
                          {` · fit ${s.starter.fit}${s.backup ? ` · cover ${s.backup.fit}` : " · no cover"}`}
                        </>
                      ) : (
                        "no natural player"
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <SectionRule gap="sm">Best-fitting shapes</SectionRule>
          <div className="form-strip" role="group" aria-label="Formation switcher">
            {report.formationRanking.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`form-chip${f.id === report.formation.id ? " current" : ""}`}
                aria-pressed={f.id === report.formation.id}
                onClick={() => onFormation?.(f.id)}
              >
                <span className="fname">{f.name}</span>
                <span className="num ffit">{f.avgFit}</span>
                {f.holes > 0 ? <span className="fwarn">{f.holes} gap</span> : null}
              </button>
            ))}
          </div>
        </div>

        <Pitch report={report} nameById={nameById} />
      </div>
    </section>
  );
}

export function Pitch({
  report,
  nameById,
}: {
  report: AssistantReport;
  nameById: Map<string, Player>;
}) {
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
  const gaps = report.slots.filter((s) => s.need === "hole" || s.need === "weak").map((s) => s.label);
  const ariaLabel =
    gaps.length > 0
      ? `Recommended XI. Gaps at ${gaps.join(", ")}.`
      : "Recommended XI with no critical gaps.";

  return (
    <div className="pitch-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="pitch" role="img" aria-label={ariaLabel}>
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
              className={warn ? "link-line warn" : "link-line"}
              style={{ opacity: warn ? 0.7 : Math.max(0.12, l.partnership / 140) }}
            />
          );
        })}

        {report.slots.map((s) => {
          const cx = px(s.slot.x);
          const cy = py(s.slot.y);
          const player = s.starter ? nameById.get(s.starter.id) : null;
          const name = player ? surname(player.name) : "—";
          return (
            <g key={s.slotKey}>
              <circle cx={cx} cy={cy} r="17" className="token" style={{ stroke: ringOf[s.need] }} />
              <text x={cx} y={cy + 4} className="token-pos">
                {s.label}
              </text>
              {s.starter ? (
                <a href={`/scout/squad/${s.starter.id}`}>
                  <text x={cx} y={cy + 32} className="token-name token-name-link">
                    {name}
                  </text>
                </a>
              ) : (
                <text x={cx} y={cy + 32} className="token-name">
                  {name}
                </text>
              )}
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
