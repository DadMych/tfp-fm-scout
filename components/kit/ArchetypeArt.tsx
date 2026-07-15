import Image from "next/image";
import type { ArchetypeId } from "@/src/domain/archetypes/registry.js";
import { getArchetype } from "@/src/domain/archetypes/registry.js";

const SIZES = {
  hero: { width: 380, height: 480, sizes: "(min-width: 900px) 380px, 100vw" },
  plate: { width: 240, height: 320, sizes: "(min-width: 900px) 240px, 45vw" },
  thumb: { width: 120, height: 160, sizes: "120px" },
  ledger: { width: 56, height: 72, sizes: "56px" },
} as const;

export type ArchetypeArtSize = keyof typeof SIZES;

/** Top-archetype engraving (doc 18 B4.1, doc 19 §6 sizing). */
export function ArchetypeArt({
  id,
  size = "plate",
  priority,
  caption,
}: {
  id: ArchetypeId;
  size?: ArchetypeArtSize;
  priority?: boolean;
  caption?: boolean;
}) {
  const dim = SIZES[size];
  const arch = getArchetype(id);

  return (
    <figure className={`arch-art-frame arch-art-${size}`}>
      <Image
        src={`/art/archetypes/${id}.png`}
        alt=""
        width={dim.width}
        height={dim.height}
        sizes={dim.sizes}
        className="arch-art"
        {...(priority ? { priority: true } : {})}
      />
      {caption ? (
        <figcaption className="arch-art-cap">
          {arch.name} — engraving, The Scouting Post
        </figcaption>
      ) : null}
    </figure>
  );
}

export function ArchetypeArtFallback({ family, size = "plate" }: { family: string; size?: ArchetypeArtSize }) {
  const minH = size === "hero" ? 360 : size === "plate" ? 240 : 120;
  return (
    <figure className={`arch-art-frame arch-art-fallback arch-art-${size}`}>
      <div className="arch-art-watermark" style={{ minHeight: minH }} aria-hidden>
        <span className="arch-art-glyph">{family.slice(0, 1)}</span>
      </div>
      <figcaption className="arch-art-cap">{family} — no defined archetype</figcaption>
    </figure>
  );
}
