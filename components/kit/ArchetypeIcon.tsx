import type { GeneralFamily } from "@/src/domain/archetypes/registry.js";
import { getArchetype, type ArchetypeId } from "@/src/domain/archetypes/registry.js";

/** Family motif silhouettes — doc 18 B3, single ink stroke, no fill. */
const FAMILY_PATHS: Record<GeneralFamily, string> = {
  Progressor:
    "M12 3v11M8 18h8M12 14l-3 4M12 14l3 4M10 18h4",
  Creator: "M5 19L15 7M15 7l4-2M15 7l2 4",
  Carrier: "M4 17q3-8 8-8 4 0 6 4l2 2M7 15h6",
  Runner: "M8 17V11L6 6M16 17V11l2-5M10 17h4M8 17q4-5 8 0",
  Finisher: "M12 12m-7 0a7 7 0 1 0 14 0M12 12m-3.5 0a3.5 3.5 0 1 0 7 0M7 7l10 10",
  "Focal Point": "M10 20h4M11 20L12 5l1 15M12 5L8 3M12 5l4-2",
  Destroyer: "M12 4l6 3v6q0 5-6 7-6-2-6-7V7zM12 8v8",
  Engine: "M5 12h14M9 8v8M15 8v8M7 17h10",
  General: "M6 4v16M6 6h8l-2 4 2 4H6",
  "Shot-Stopper": "M8 10q0-4 4-4 4 0 4 4v6q0 2-4 2-4 0-4-2zM10 12h4",
  Distributor: "M5 15l12-4M5 15l4-4M17 11l3-2",
  Commander: "M8 17V11l4-5 4 5v6M10 9l2-4 2 4",
  Sweeper: "M3 17h14M5 17l9-4M11 13l4-4M17 9v4",
};

export function ArchetypeIcon({
  id,
  size = 16,
  className,
}: {
  id: ArchetypeId;
  size?: number;
  className?: string;
}) {
  const family = getArchetype(id).family;
  const d = FAMILY_PATHS[family];
  const cls = ["arch-icon", className].filter(Boolean).join(" ");
  return (
    <svg
      className={cls}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}
