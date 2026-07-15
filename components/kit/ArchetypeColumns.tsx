import { getArchetype } from "@/src/domain/archetypes/registry.js";
import { badgeFor } from "@/src/domain/archetypes/score.js";
import type { ArchetypeScore } from "@/src/domain/archetypes/score.js";

const RANK_LABEL = ["Primary identity", "Secondary", "Also"] as const;

export function ArchetypeColumns({ archetypes }: { archetypes: readonly ArchetypeScore[] }) {
  const top = [...archetypes].sort((a, b) => b.score - a.score).slice(0, 3);
  if (top.length === 0) return null;

  return (
    <section className="identity">
      <p className="section-label">What kind of footballer is he</p>
      <div className="arch-row">
        {top.map((a, i) => {
          const def = getArchetype(a.id);
          const badge = badgeFor(a.score, a.gatesPassed);
          const scoreCls = ["score", "num", badge === "Elite" ? "lead" : ""].filter(Boolean).join(" ");
          return (
            <div className="arch" key={a.id}>
              <div className="rank">{RANK_LABEL[i] ?? "Also"}</div>
              <div className={scoreCls}>{Math.round(a.score)}</div>
              <div className="aname">{def.name}</div>
              {badge ? <div className="badge">— {badge} —</div> : null}
              <div className="desc">{def.blurb}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
