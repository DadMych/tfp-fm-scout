import type { MetricId } from "@/src/domain/metric-id.js";
import type { PlayerScores } from "@/src/domain/scoring/dataset.js";
import { metricLabel } from "@/src/report/format.js";

const RADAR_OUTFIELD = [
  "finishingPkg",
  "creativity",
  "pressResist",
  "speed",
  "mobility",
  "physicality",
  "aerial",
  "workEngine",
  "defActivity",
  "defPosition",
] as const satisfies readonly MetricId[];

const RADAR_GK = [
  "reflexes",
  "handling",
  "aerialReach",
  "commandOfArea",
  "oneOnOnes",
  "kicking",
  "communication",
  "positioning",
  "composure",
  "agility",
] as const satisfies readonly MetricId[];

const SHORT: Record<string, string> = {
  finishingPkg: "Finishing",
  creativity: "Creativity",
  pressResist: "Press-res.",
  speed: "Speed",
  mobility: "Mobility",
  physicality: "Physical",
  aerial: "Aerial",
  workEngine: "Work rate",
  defActivity: "Def. work",
  defPosition: "Def. pos.",
};

function pt(cx: number, cy: number, r: number, i: number, n: number): [number, number] {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

export function Radar({
  scores,
  cohortLabel,
}: {
  scores: PlayerScores;
  cohortLabel?: string;
}) {
  const axes = (scores.pop === "gk" ? RADAR_GK : RADAR_OUTFIELD).map((id) => ({
    id,
    pct: scores.percentiles[id] ?? null,
  }));
  const known = axes.filter((a) => a.pct != null).length;
  if (known < 3) {
    return <p className="standfirst">Too little known to plot a radar.</p>;
  }

  const top = [...axes]
    .filter((a) => a.pct != null)
    .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))
    .slice(0, 3)
    .map((a) => `${SHORT[a.id] ?? metricLabel(a.id)} ${Math.round(a.pct!)}`)
    .join(", ");
  const ariaLabel = cohortLabel
    ? `Percentile vs ${cohortLabel} in this database. Strongest: ${top}.`
    : `Percentile radar. Strongest: ${top}.`;

  const W = 420;
  const cx = W / 2;
  const cy = 190;
  const R = 130;
  const n = axes.length;

  return (
    <svg
      className="radar"
      viewBox={`-55 0 ${W + 110} 360`}
      role="img"
      aria-label={ariaLabel}
    >
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
      <polygon
        className="area"
        points={axes
          .map((a, i) => pt(cx, cy, R * ((a.pct ?? 0) / 100), i, n).map((v) => v.toFixed(1)).join(","))
          .join(" ")}
      />
      {axes.map((a, i) => {
        const [x, y] = pt(cx, cy, R * ((a.pct ?? 0) / 100), i, n);
        return (
          <circle
            key={i}
            className={a.pct != null && a.pct >= 80 ? "dot hi" : "dot"}
            cx={x.toFixed(1)}
            cy={y.toFixed(1)}
            r={3}
          />
        );
      })}
      {axes.map((a, i) => {
        const [x, y] = pt(cx, cy, R + 20, i, n);
        const cos = Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / n);
        const anchor = cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
        return (
          <text key={i} className="rlabel" x={x.toFixed(1)} y={y.toFixed(1)} textAnchor={anchor}>
            {SHORT[a.id] ?? metricLabel(a.id)}{" "}
            <tspan className="rnum">{a.pct != null ? Math.round(a.pct) : "–"}</tspan>
          </text>
        );
      })}
    </svg>
  );
}
