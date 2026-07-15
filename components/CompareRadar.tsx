import type { PlayerScores } from "@/src/domain/scoring/dataset.js";
import { COMPARE_DERIVED } from "@/src/domain/compare.js";
import { metricLabel } from "@/src/report/format.js";

const SHORT: Record<string, string> = {
  finishingPkg: "Finishing",
  creativity: "Creativity",
  pressResist: "Press-res.",
  speed: "Speed",
  workEngine: "Work rate",
  aerial: "Aerial",
  defActivity: "Def. work",
  defPosition: "Def. pos.",
};

const STROKES = ["var(--red)", "var(--ink)", "var(--gold)", "#6b5b4f"] as const;

function pt(cx: number, cy: number, r: number, i: number, n: number): [number, number] {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

export function CompareRadar({
  entries,
}: {
  entries: readonly { name: string; scores: PlayerScores }[];
}) {
  const axes = COMPARE_DERIVED.map((id) => ({
    id,
    label: SHORT[id] ?? metricLabel(id),
  }));
  const n = axes.length;
  const knownCounts = entries.map(
    (e) => axes.filter((a) => e.scores.percentiles[a.id] != null).length,
  );
  if (knownCounts.every((c) => c < 3)) {
    return <p className="standfirst">Too little known to plot a comparison radar.</p>;
  }

  const W = 460;
  const cx = W / 2;
  const cy = 200;
  const R = 140;

  return (
    <svg className="radar cmp-radar" viewBox={`-60 0 ${W + 120} 380`} role="img">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon
          key={f}
          className="ring"
          points={axes.map((_, i) => pt(cx, cy, R * f, i, n).map((v) => v.toFixed(1)).join(",")).join(" ")}
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(cx, cy, R, i, n);
        return <line key={i} className="spoke" x1={cx} y1={cy} x2={x.toFixed(1)} y2={y.toFixed(1)} />;
      })}
      {entries.map((e, ei) => (
        <polygon
          key={e.name}
          className={`area p${ei}`}
          style={{ stroke: STROKES[ei % STROKES.length] }}
          points={axes
            .map((a, i) => {
              const pct = e.scores.percentiles[a.id] ?? 0;
              return pt(cx, cy, R * (pct / 100), i, n).map((v) => v.toFixed(1)).join(",");
            })
            .join(" ")}
        />
      ))}
      {axes.map((a, i) => {
        const [x, y] = pt(cx, cy, R + 22, i, n);
        const cos = Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / n);
        const anchor = cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
        return (
          <text key={a.id} className="rlabel" x={x.toFixed(1)} y={y.toFixed(1)} textAnchor={anchor}>
            {a.label}
          </text>
        );
      })}
      <g className="cmp-legend">
        {entries.map((e, i) => (
          <g key={e.name} transform={`translate(0 ${i * 18})`}>
            <rect x={0} y={330} width={12} height={12} fill="none" stroke={STROKES[i % STROKES.length]} strokeWidth={2} />
            <text x={18} y={340} className="rlabel">
              {e.name}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
