import Link from "next/link";
import type { TacticBrief } from "@/src/domain/assistant/tactic-brief.js";
import { scoutHrefForStyle } from "@/lib/scout-filters";
import { InkBar } from "@/components/kit/InkBar";

export function TacticBriefing({ brief }: { brief: TacticBrief }) {
  const top = brief.styles[0];
  const scoutHref = scoutHrefForStyle(brief.topStyleId);

  return (
    <section className="tactic-brief">
      <div className="tactic-brief-head">
        <div>
          <p className="eyebrow">Playing the {brief.formationName}</p>
          <h2 className="tactic-brief-title">Tactic briefing</h2>
        </div>
        <Link className="btn ghost" href={scoutHref}>
          Scout for {top?.style.name ?? "this style"} →
        </Link>
      </div>

      <div className="tactic-styles">
        {brief.styles.map((s, i) => (
          <div key={s.style.id} className={`tactic-style ${i === 0 ? "lead" : ""}`}>
            <div className="tactic-style-top">
              <span className="tactic-style-name">
                {i === 0 ? "Best fit · " : ""}
                {s.style.name}
              </span>
              <span className="num tactic-style-score">{s.score}</span>
            </div>
            <InkBar value={s.score} absolute />
            <p className="tactic-style-blurb">{s.style.blurb}</p>
            {i === 0 && s.missing.length > 0 ? (
              <p className="tactic-style-gap">Still short: {s.missing.slice(0, 2).join("; ")}</p>
            ) : null}
          </div>
        ))}
      </div>

      {brief.flanks.length > 0 ? (
        <div className="tactic-flanks">
          <p className="tactic-subh">Flanks</p>
          {brief.flanks.map((f) => (
            <p key={f.side} className="tactic-flank">
              <b>{f.side === "left" ? "Left" : "Right"} ({f.label}).</b> {f.text}
            </p>
          ))}
        </div>
      ) : null}

      {brief.slots.length > 0 ? (
        <div className="tactic-slots">
          <p className="tactic-subh">Slot notes</p>
          <ul className="tactic-slot-list">
            {brief.slots.map((s) => (
              <li key={s.slotKey}>
                <span className="tactic-slot-lab">{s.slotLabel}</span> {s.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
