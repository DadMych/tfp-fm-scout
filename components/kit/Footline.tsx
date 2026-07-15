import type { ReactNode } from "react";

export function Footline({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="footline">
      <span>{left}</span>
      {right ? <span>{right}</span> : null}
    </div>
  );
}
