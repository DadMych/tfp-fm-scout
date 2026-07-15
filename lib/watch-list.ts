import type { DatasetKind } from "./store";
import type { Player } from "../src/domain/player.js";
import { findPlayerByIdentity, playerIdentityKey } from "../src/domain/player-identity.js";

export type WatchStatus = "watching" | "pursue" | "passed";

export interface WatchEntry {
  readonly identityKey: string;
  readonly status: WatchStatus;
  readonly note: string;
  readonly addedAt: string;
}

export const WATCH_STATUSES: readonly WatchStatus[] = ["watching", "pursue", "passed"];

export const WATCH_STATUS_LABEL: Record<WatchStatus, string> = {
  watching: "Watching",
  pursue: "Pursue",
  passed: "Passed",
};

export function createWatchEntry(p: Player, status: WatchStatus = "watching"): WatchEntry {
  return {
    identityKey: playerIdentityKey(p),
    status,
    note: "",
    addedAt: new Date().toISOString(),
  };
}

export function isPlayerWatched(p: Player, list: readonly WatchEntry[]): boolean {
  const key = playerIdentityKey(p);
  return list.some((e) => e.identityKey === key);
}

export interface ResolvedWatchEntry {
  readonly entry: WatchEntry;
  readonly p: Player;
  readonly kind: DatasetKind;
  readonly id: string;
}

export function resolveWatchEntries(
  list: readonly WatchEntry[],
  shortlistPlayers: readonly Player[] | null,
  squadPlayers: readonly Player[] | null,
): ResolvedWatchEntry[] {
  const out: ResolvedWatchEntry[] = [];
  for (const entry of list) {
    const pools: { kind: DatasetKind; players: readonly Player[] }[] = [];
    if (shortlistPlayers) pools.push({ kind: "shortlist", players: shortlistPlayers });
    if (squadPlayers) pools.push({ kind: "squad", players: squadPlayers });
    for (const pool of pools) {
      const p = findPlayerByIdentity(pool.players, entry.identityKey);
      if (p) {
        out.push({ entry, p, kind: pool.kind, id: p.id });
        break;
      }
    }
  }
  return out;
}
