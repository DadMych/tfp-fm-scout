"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import type { Player } from "@/src/domain/player.js";
import type { PlayerScores } from "@/src/domain/scoring/dataset.js";
import { getArchetype } from "@/src/domain/archetypes/registry.js";
import { shortDate } from "@/src/domain/squad/status.js";
import { formatMoney } from "@/src/report/format.js";

export type ScoutDataset = "squad" | "shortlist";

export interface PlayerPeekData {
  readonly player: Player;
  readonly scores?: PlayerScores;
  readonly dataset: ScoutDataset;
}

const HOLD_MS = 400;

export function PlayerLink({
  id,
  dataset,
  children,
  className,
  peek,
}: {
  id: string;
  dataset: ScoutDataset;
  children: ReactNode;
  className?: string;
  peek?: PlayerPeekData | null;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const href = `/scout/${dataset}/${id}`;

  function clear() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  function arm() {
    clear();
    if (!peek) return;
    timer.current = setTimeout(() => setOpen(true), HOLD_MS);
  }

  function disarm() {
    clear();
    setOpen(false);
  }

  return (
    <span
      className="player-link-wrap"
      onPointerDown={arm}
      onPointerUp={disarm}
      onPointerLeave={disarm}
      onPointerCancel={disarm}
      onMouseEnter={arm}
      onMouseLeave={disarm}
    >
      <Link href={href} className={className ?? "player-link"}>
        {children}
      </Link>
      {open && peek ? <PlayerPeekCard peek={peek} /> : null}
    </span>
  );
}

function PlayerPeekCard({ peek }: { peek: PlayerPeekData }) {
  const { player, scores } = peek;
  const arch = scores?.topArchetype ? getArchetype(scores.topArchetype.id) : null;
  const pos = player.positions.length ? player.positions.join("/") : "—";
  return (
    <span className="player-peek" role="tooltip">
      <span className="player-peek-name">{player.name}</span>
      <span className="player-peek-meta">
        {player.age != null ? `Age ${player.age}` : "Age —"}
        {" · "}
        {pos}
        {player.value != null ? ` · ${formatMoney(player.value)}` : ""}
      </span>
      {arch ? (
        <span className="player-peek-arch">
          {arch.name}
          {scores?.topArchetype ? ` · ${Math.round(scores.topArchetype.score)}` : ""}
        </span>
      ) : null}
      {player.wage != null || player.contractExpires ? (
        <span className="player-peek-meta">
          {player.wage != null ? `${formatMoney(player.wage)} p/w` : ""}
          {player.wage != null && player.contractExpires ? " · " : ""}
          {player.contractExpires ? `ends ${shortDate(player.contractExpires)}` : ""}
        </span>
      ) : null}
      {player.onLoanFrom ? (
        <span className="player-peek-meta">On loan · {player.onLoanFrom}</span>
      ) : null}
      <span className="player-peek-hint">Click for full dossier</span>
    </span>
  );
}

/** Resolve peek data from squad/shortlist maps. Prefers squad when both exist. */
export function peekFor(
  id: string,
  maps: {
    squadById: Map<string, Player>;
    shortlistById: Map<string, Player>;
    scoreById?: Map<string, PlayerScores>;
  },
): PlayerPeekData | null {
  const squad = maps.squadById.get(id);
  if (squad) {
    const scores = maps.scoreById?.get(id);
    return scores ? { player: squad, scores, dataset: "squad" } : { player: squad, dataset: "squad" };
  }
  const short = maps.shortlistById.get(id);
  if (short) {
    const scores = maps.scoreById?.get(id);
    return scores ? { player: short, scores, dataset: "shortlist" } : { player: short, dataset: "shortlist" };
  }
  return null;
}
