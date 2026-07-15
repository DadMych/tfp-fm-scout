import type { ReactNode } from "react";
import type { ArchetypeId } from "@/src/domain/archetypes/registry.js";
import { ArchetypeArt, ArchetypeArtFallback, type ArchetypeArtSize } from "./ArchetypeArt";

/** Archetype engraving for table cells and inline identity rows. */
export function ArchetypeCell({
  id,
  family,
  size = "ledger",
  caption,
  children,
}: {
  id: ArchetypeId | null;
  family?: string;
  size?: ArchetypeArtSize;
  caption?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="arch-cell">
      {id ? (
        <ArchetypeArt
          id={id}
          size={size}
          {...(caption ? { caption: true } : {})}
        />
      ) : family ? (
        <ArchetypeArtFallback family={family} size={size} />
      ) : null}
      {children ? <div className="arch-cell-body">{children}</div> : null}
    </div>
  );
}
