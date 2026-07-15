import type { Player } from "./player.js";

/** Stable key for matching the same human across re-imports (doc 03 / doc 15 P2). */
export function playerIdentityKey(p: Pick<Player, "name" | "nationality">): string {
  const name = p.name.trim().toLowerCase();
  const nat = (p.nationality ?? "").trim().toLowerCase();
  return `${name}|${nat}`;
}

export function findPlayerByIdentity(
  players: readonly Player[],
  identityKey: string,
): Player | null {
  return players.find((p) => playerIdentityKey(p) === identityKey) ?? null;
}
