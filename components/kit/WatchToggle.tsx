"use client";

import { useDatasets } from "@/lib/store";
import type { Player } from "@/src/domain/player.js";

export function WatchToggle({ player, label }: { player: Player; label?: string }) {
  const { isWatched, toggleWatch } = useDatasets();
  const on = isWatched(player);
  const aria = label ?? (on ? "Remove from watch" : "Add to watch");

  return (
    <button
      type="button"
      className={`watch-toggle${on ? " on" : ""}`}
      aria-pressed={on}
      aria-label={aria}
      title={aria}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleWatch(player);
      }}
    >
      {on ? "★" : "☆"}
    </button>
  );
}
