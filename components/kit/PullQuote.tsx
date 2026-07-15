import type { ReactNode } from "react";

export function PullQuote({ children }: { children: ReactNode }) {
  return <blockquote className="pull">{children}</blockquote>;
}
