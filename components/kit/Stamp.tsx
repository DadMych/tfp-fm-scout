import type { ReactNode } from "react";

export type StampTone = "gold" | "ink" | "faint" | "red";

export function Stamp({ tone, children }: { tone?: StampTone; children: ReactNode }) {
  const cls = ["stamp", tone].filter(Boolean).join(" ");
  return <span className={cls}>{children}</span>;
}
