import Image from "next/image";
import type { ArchetypeId } from "@/src/domain/archetypes/registry.js";

/** Top-archetype engraving for the dossier identity band (doc 18 B4.1). */
export function ArchetypeArt({
  id,
  priority,
}: {
  id: ArchetypeId;
  priority?: boolean;
}) {
  return (
    <figure className="arch-art-frame">
      <Image
        src={`/art/archetypes/${id}.png`}
        alt=""
        width={180}
        height={240}
        sizes="180px"
        className="arch-art"
        {...(priority ? { priority: true } : {})}
      />
    </figure>
  );
}
