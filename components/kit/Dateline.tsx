import type { ReactNode } from "react";

export function Dateline({
  left,
  center,
  right,
}: {
  left: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="dateline">
      <span>{left}</span>
      {center ? <span>{center}</span> : null}
      {right ? <span>{right}</span> : null}
    </div>
  );
}
