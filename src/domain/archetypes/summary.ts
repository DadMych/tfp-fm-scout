import type { PositionGroup } from "../positions.js";
import { GROUP_COHORT_LABEL } from "../positions.js";
import type { GeneralFamily } from "./registry.js";

/**
 * Human summary line generator (docs/06-archetypes.md §10).
 *
 * Deterministic — no randomness, no LLM. Shape:
 *   "A {age} {family noun} who {behaviour}. {standout}, though {caveat}."
 * with an optional low-confidence hedge. Phrase banks below are editorial content, versioned
 * with the engine; changing them deliberately updates the snapshot test.
 */

export interface SummaryMetric {
  readonly metric: string;
  readonly pct: number;
}

export interface SummaryInput {
  readonly age: number | null;
  readonly positionGroup: PositionGroup;
  readonly family: GeneralFamily | "Utility";
  readonly primaryBlurb: string | null;
  /** Runner-up archetype blurb, present only for a cross-family hybrid. */
  readonly secondaryBlurb: string | null;
  readonly confidence: number;
  /** Every known metric with its position-group percentile. */
  readonly metrics: readonly SummaryMetric[];
  /** Count of players at or above this player's value within the same cohort (for counted claims). */
  readonly atOrAbove: Readonly<Record<string, number>>;
}

const NUMBER_WORD = ["zero", "one", "two", "three", "four", "five"] as const;

/** Metrics that can headline a "one of the best X" claim, with their plural noun. */
const STANDOUT_NOUN: Record<string, string> = {
  passing: "passers",
  finishing: "finishers",
  dribbling: "dribblers",
  crossing: "crossers",
  tackling: "tacklers",
  heading: "headers of the ball",
  longShots: "strikers of the ball from range",
  technique: "technicians",
  vision: "creators",
  speed: "quickest players",
  creativity: "creators",
  workEngine: "runners",
  aerial: "aerial threats",
  pressResist: "ball-retainers",
  physicality: "physical specimens",
  defActivity: "ball-winners",
  defPosition: "readers of the game",
};

/** Notable weaknesses, in priority order (physical holes first). */
const WEAK_PHRASE: Record<string, string> = {
  aerial: "he offers little in the air",
  speed: "he will be caught for pace",
  pace: "he lacks a change of pace",
  strength: "he is bullied off the ball too easily",
  stamina: "he fades late in games",
  composure: "he can lose his head under pressure",
  pressResist: "he struggles when the game tightens up",
  finishing: "he is wasteful in front of goal",
  passing: "his distribution lets him down",
  tackling: "his tackling is a liability",
};

const STANDOUT_MIN_PCT = 75;
const WEAK_MAX_PCT = 40;

const FAMILY_NOUN: Record<GeneralFamily | "Utility", Partial<Record<PositionGroup, string>> & { default: string }> = {
  Progressor: { "DM/CM": "ball-progressing midfielder", CB: "ball-playing defender", default: "deep playmaker" },
  Creator: { "AM/W": "creator", ST: "creative forward", default: "creator" },
  Carrier: { "AM/W": "wide dribbler", default: "ball-carrier" },
  Runner: { "FB/WB": "attacking full-back", ST: "runner in behind", default: "runner" },
  Engine: { "AM/W": "tireless wide runner", ST: "pressing forward", default: "midfield engine" },
  Destroyer: { CB: "defender", "FB/WB": "combative full-back", default: "ball-winner" },
  Finisher: { "AM/W": "wide finisher", default: "finisher" },
  "Focal Point": { default: "focal point" },
  General: { default: "leader" },
  Utility: { default: "squad player" },
  "Shot-Stopper": { default: "shot-stopper" },
  Distributor: { default: "ball-playing keeper" },
  Commander: { default: "commanding keeper" },
  Sweeper: { default: "sweeper-keeper" },
};

function ageWord(age: number | null): string {
  if (age == null) return "";
  if (age < 20) return "teenage";
  if (age <= 23) return "young";
  if (age <= 29) return "";
  if (age <= 32) return "experienced";
  return "veteran";
}

function aOrAn(next: string): string {
  return /^[aeiou]/i.test(next) ? "An" : "A";
}

function familyNoun(family: GeneralFamily | "Utility", group: PositionGroup): string {
  const table = FAMILY_NOUN[family];
  return table[group] ?? table.default;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function standoutClause(input: SummaryInput): string | null {
  const candidates = input.metrics
    .filter((m) => m.metric in STANDOUT_NOUN && m.pct >= STANDOUT_MIN_PCT)
    .sort((a, b) => b.pct - a.pct);
  const top = candidates[0];
  if (!top) return null;

  const noun = STANDOUT_NOUN[top.metric] as string;
  const cohort = GROUP_COHORT_LABEL[input.positionGroup];
  const count = input.atOrAbove[top.metric];
  if (count === 1) return `The best ${noun} among ${cohort} in this division`;
  if (count != null && count >= 2 && count <= 5) {
    return `One of the ${NUMBER_WORD[count]} best ${noun} among ${cohort} in this division`;
  }
  return `One of the best ${noun} among ${cohort} in this division`;
}

function caveatClause(input: SummaryInput): string | null {
  const candidates = input.metrics
    .filter((m) => m.metric in WEAK_PHRASE && m.pct < WEAK_MAX_PCT)
    .sort((a, b) => a.pct - b.pct);
  const worst = candidates[0];
  return worst ? (WEAK_PHRASE[worst.metric] as string) : null;
}

export function generateSummary(input: SummaryInput): string {
  const hedge =
    input.confidence < 0.5
      ? " — though there aren't enough eyes on him yet to be sure."
      : "";

  if (input.family === "Utility" || !input.primaryBlurb) {
    return `A squad player; nothing here stands out against this division.${hedge}`;
  }

  const noun = familyNoun(input.family, input.positionGroup);
  const age = ageWord(input.age);
  const lead = age ? `${age} ${noun}` : noun;

  let behaviour = input.primaryBlurb;
  if (input.secondaryBlurb) behaviour += ` and also ${input.secondaryBlurb}`;

  const sentence1 = `${aOrAn(lead)} ${lead} who ${behaviour}.`;

  const standout = standoutClause(input);
  const caveat = caveatClause(input);

  let sentence2 = "";
  if (standout && caveat) sentence2 = ` ${cap(standout)}, though ${caveat}.`;
  else if (standout) sentence2 = ` ${cap(standout)}.`;
  else if (caveat) sentence2 = ` For all that, ${caveat}.`;

  return `${sentence1}${sentence2}${hedge}`;
}
