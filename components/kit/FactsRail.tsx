import type { ReactNode } from "react";

export interface FactRow {
  readonly label: string;
  readonly value: ReactNode;
}

export function FactsRail({ rows }: { rows: readonly FactRow[] }) {
  return (
    <div className="facts">
      <dl>
        {rows.map((row) => (
          <div className="row" key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
