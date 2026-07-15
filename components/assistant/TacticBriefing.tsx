import Link from "next/link";
import type { TacticBrief } from "@/src/domain/assistant/tactic-brief.js";
import { scoutHrefForStyle } from "@/lib/scout-filters";
import { InkBar } from "@/components/kit/InkBar";
import { SectionRule } from "@/components/kit/SectionRule";

export function TacticBriefing({ brief }: { brief: TacticBrief }) {
  const top = brief.styles[0];
  const alternatives = brief.styles.slice(1);
  const scoutHref = scoutHrefForStyle(brief.topStyleId);

  // The flank paragraphs and the "best fit" line already render below — keep only
  // the general reads here so nothing appears twice on the page.
  const flankTexts = new Set(brief.flanks.map((f) => f.text));
  const generalReads = brief.styleReads.filter(
    (r) =>
      !flankTexts.has(r.text) &&
      !r.text.startsWith("Best fit for this shape") &&
      !r.text.startsWith("You're closest to"),
  );

  return (
    <section className="tactic-brief">
      <SectionRule gap="lg">How to play it · {brief.formationName}</SectionRule>
      <div className="tactic-grid">
        <div className="tactic-col">
          {top ? (
            <div className="tactic-lead">
              <div className="tactic-style-top">
                <span className="tactic-style-name lead">Best fit · {top.style.name}</span>
                <span className="num tactic-style-score">{top.score}</span>
              </div>
              <InkBar value={top.score} absolute />
              <p className="tactic-style-blurb">{top.style.blurb}</p>
              {top.missing.length > 0 ? (
                <p className="tactic-style-gap">
                  Still short: {top.missing.slice(0, 2).join("; ")}
                </p>
              ) : null}
              <Link className="tactic-scout-link" href={scoutHref}>
                Scout for {top.style.name} →
              </Link>
            </div>
          ) : null}

          {alternatives.length > 0 ? (
            <ul className="tactic-alt-list">
              {alternatives.map((s) => (
                <li key={s.style.id} className="tactic-alt">
                  <span className="tactic-alt-name">{s.style.name}</span>
                  <InkBar value={s.score} width={80} absolute />
                  <span className="num tactic-alt-score">{s.score}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {generalReads.length > 0 ? (
            <div className="tactic-reads">
              {generalReads.map((r, i) => (
                <p key={i} className="tactic-read">
                  {r.text}
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <div className="tactic-col">
          {brief.flanks.length > 0 ? (
            <>
              <p className="tactic-subh">Flanks</p>
              {brief.flanks.map((f) => (
                <p key={f.side} className="tactic-flank">
                  <b>
                    {f.side === "left" ? "Left" : "Right"} ({f.label}).
                  </b>{" "}
                  {f.text}
                </p>
              ))}
            </>
          ) : null}

          {brief.slots.length > 0 ? (
            <>
              <p className="tactic-subh">Slot notes</p>
              <ul className="tactic-slot-list">
                {brief.slots.map((s) => (
                  <li key={s.slotKey}>
                    <span className="tactic-slot-lab">{s.slotLabel}</span> {s.text}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
