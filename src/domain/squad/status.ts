/**
 * Loan & contract status derived from the FM export's Club / On Loan From /
 * Expires columns (docs/22-contracts-loans.md). Everything is inferred from the
 * dataset itself — no wall clock: FM contracts all expire June 30, so the earliest
 * expiry in the squad marks the current season's end.
 */

import type { Player } from "../player.js";

/** The squad's own club: the modal Club value (loaned-out players list their host club). */
export function ourClubOf(players: readonly Player[]): string | null {
  const counts = new Map<string, number>();
  for (const p of players) {
    // A player on loan at us still shows our club in Club; a player loaned out
    // shows the host club but names us in On Loan From — count both signals.
    for (const c of [p.club, p.onLoanFrom]) {
      if (!c) continue;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [club, n] of counts) {
    if (n > bestN) {
      best = club;
      bestN = n;
    }
  }
  return best;
}

export type LoanStatus = "loaned-in" | "loaned-out" | null;

/**
 * On Loan From names the *owning* club. If that's us, the player is away on loan;
 * if it's someone else, he's here on a loan we don't own.
 */
export function loanStatusOf(p: Player, ourClub: string | null): LoanStatus {
  if (!p.onLoanFrom) return null;
  if (ourClub != null && p.onLoanFrom === ourClub) return "loaned-out";
  if (p.club != null && p.onLoanFrom === p.club) return null; // defensive: bad export row
  return "loaned-in";
}

/** Away at another club — unavailable this season. */
export function isLoanedOut(p: Player, ourClub: string | null): boolean {
  if (loanStatusOf(p, ourClub) === "loaned-out") return true;
  // Older exports without On Loan From: the Club column shows the host side.
  return ourClub != null && p.club != null && p.club !== ourClub;
}

/** Here on someone else's books — not an asset we can sell or re-loan. */
export function isLoanedIn(p: Player, ourClub: string | null): boolean {
  return loanStatusOf(p, ourClub) === "loaned-in";
}

/**
 * The June 30 that ends the current season, inferred as the earliest contract
 * expiry or loan end in the dataset (loan spells always run to a season end).
 */
export function seasonEndOf(players: readonly Player[]): string | null {
  let min: string | null = null;
  for (const p of players) {
    for (const e of [p.contractExpires, p.loanEnd]) {
      if (!e) continue;
      if (min == null || e < min) min = e;
    }
  }
  return min;
}

/** Contract runs out at the coming season end — free agent in under a year. */
export function contractExpiring(p: Player, seasonEnd: string | null): boolean {
  if (!p.contractExpires || !seasonEnd) return false;
  return p.contractExpires <= seasonEnd;
}

/** One season beyond the coming end — the last window to command a real fee. */
export function contractPenultimate(p: Player, seasonEnd: string | null): boolean {
  if (!p.contractExpires || !seasonEnd) return false;
  if (contractExpiring(p, seasonEnd)) return false;
  const nextEnd = `${Number(seasonEnd.slice(0, 4)) + 1}${seasonEnd.slice(4)}`;
  return p.contractExpires <= nextEnd;
}

/** "30/6/26" for compact UI display of an ISO date. */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}/${(y ?? "").slice(2)}`;
}
