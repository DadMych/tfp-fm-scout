import type { ReactNode } from "react";

export function SectionRule({
  children,
  gap,
}: {
  children: ReactNode;
  gap?: "sm" | "lg";
}) {
  const cls = ["section-label", gap === "sm" ? "section-gap" : gap === "lg" ? "section-gap-lg" : ""]
    .filter(Boolean)
    .join(" ");
  return <div className={cls}>{children}</div>;
}
