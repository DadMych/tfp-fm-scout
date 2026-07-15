/**
 * Shared phrase helpers (docs/11-assistant-analytics.md §9). Deterministic string
 * formatting only — no randomness, no LLM calls. Rule modules compose these into
 * their `detail` sentences.
 */

export function surname(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1]! : name;
}

export function listNames(names: readonly string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function money(v: number | null | undefined): string {
  if (v == null) return "an unknown fee";
  if (v >= 1e6) return `€${Math.round((v / 1e6) * 10) / 10}M`;
  if (v >= 1e3) return `€${Math.round(v / 1e3)}K`;
  return `€${Math.round(v)}`;
}

/** A one-word read of a role-fit score (0–100, absolute). */
export function fitPhrase(fit: number): string {
  if (fit >= 80) return "elite";
  if (fit >= 72) return "a real starter";
  if (fit >= 62) return "serviceable";
  return "a stopgap";
}

export function pct(n: number): string {
  return `${Math.round(n)}%`;
}
