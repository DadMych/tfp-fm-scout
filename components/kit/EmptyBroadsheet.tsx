import type { ReactNode } from "react";
import { BroadsheetIllustration, type FurnitureArtId } from "@/components/kit/BroadsheetIllustration";

export function EmptyBroadsheet({
  art = "empty-desk",
  artWidth = 440,
  eyebrow,
  title,
  children,
  actions,
}: {
  art?: FurnitureArtId;
  artWidth?: number;
  eyebrow?: string;
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="empty-sheet empty-sheet-hero">
      <div className="empty-sheet-body">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        {title ? <h2 className="empty-sheet-title">{title}</h2> : null}
        <div className="empty-sheet-copy">{children}</div>
        {actions ? <div className="cta-row">{actions}</div> : null}
      </div>
      <BroadsheetIllustration id={art} width={artWidth} className="empty-sheet-art" priority />
    </section>
  );
}
