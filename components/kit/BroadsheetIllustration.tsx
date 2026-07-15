import Image from "next/image";

export type FurnitureArtId = "empty-desk" | "masthead-vignette" | "lost-ball";

const SIZES: Record<FurnitureArtId, { width: number; height: number }> = {
  "empty-desk": { width: 320, height: 240 },
  "masthead-vignette": { width: 48, height: 48 },
  "lost-ball": { width: 180, height: 240 },
};

export function BroadsheetIllustration({
  id,
  width,
  className,
  priority,
}: {
  id: FurnitureArtId;
  width?: number;
  className?: string;
  priority?: boolean;
}) {
  const base = SIZES[id];
  const w = width ?? base.width;
  const h = Math.round((w * base.height) / base.width);
  const cls = ["bs-illust", className].filter(Boolean).join(" ");
  return (
    <Image
      src={`/art/${id}.png`}
      alt=""
      width={w}
      height={h}
      sizes={`${w}px`}
      className={cls}
      {...(priority ? { priority: true } : {})}
    />
  );
}
