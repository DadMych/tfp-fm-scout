import { percentileColor } from "@/src/ui/percentile-ramp.js";

export function InkBar({
  value,
  width = 74,
  insufficient,
}: {
  value: number | null;
  width?: number;
  insufficient?: boolean;
}) {
  if (insufficient || value == null) {
    return <span className="pctbar pctbar--masked" style={{ width }} aria-hidden />;
  }
  const w = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <span className="pctbar" style={{ width }} aria-hidden>
      <i style={{ width: `${w}%`, background: percentileColor(w) }} />
    </span>
  );
}
