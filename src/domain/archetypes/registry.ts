import type { MetricId } from "../metric-id.js";

/**
 * Archetype registry (docs/06-archetypes.md §3 + §9).
 *
 * A `metric` is either an AttributeId or a DerivedId (see `MetricId`).
 * Gates are hard requirements: fail any and the score is capped at 40 (partial fit).
 * Weights use the ×3/×2/×1 tier system. `family` is the canonical general archetype (§9).
 */

export type GeneralFamily =
  | "Progressor"
  | "Creator"
  | "Carrier"
  | "Runner"
  | "Engine"
  | "Destroyer"
  | "Finisher"
  | "Focal Point"
  | "General"
  | "Shot-Stopper"
  | "Distributor"
  | "Commander"
  | "Sweeper";

export type Population = "outfield" | "gk";

export interface Gate {
  readonly metric: MetricId;
  /** `pct` = percentile within the population; `raw` = attribute midpoint (physics floor). */
  readonly kind: "pct" | "raw";
  readonly min: number;
}

type ArchetypeTemplate = {
  readonly id: string;
  readonly name: string;
  readonly family: GeneralFamily;
  readonly pop: Population;
  readonly blurb: string;
  readonly gates: readonly Gate[];
  readonly core: readonly MetricId[];
  readonly major: readonly MetricId[];
  readonly minor: readonly MetricId[];
};

const pct = (metric: MetricId, min: number): Gate => ({ metric, kind: "pct", min });
const raw = (metric: MetricId, min: number): Gate => ({ metric, kind: "raw", min });

export const ARCHETYPES = [
  // ---------- Progressor ----------
  { id: "deepProgressor", name: "Deep Progressor", family: "Progressor", pop: "outfield", blurb: "breaks lines from the base of midfield", gates: [pct("passing", 70), pct("composure", 55)], core: ["passing", "vision", "pressResist"], major: ["firstTouch", "technique", "decisions"], minor: ["dribbling", "anticipation"] },
  { id: "tempoDictator", name: "Tempo Dictator", family: "Progressor", pop: "outfield", blurb: "sets the rhythm and is always an option", gates: [pct("decisions", 65), pct("composure", 65)], core: ["decisions", "composure", "passing", "teamwork"], major: ["vision", "firstTouch", "concentration"], minor: ["positioning", "technique"] },
  { id: "pressResister", name: "Press Resister", family: "Progressor", pop: "outfield", blurb: "receives under pressure and comes out the far side", gates: [pct("pressResist", 75)], core: ["firstTouch", "composure", "agility", "balance"], major: ["dribbling", "technique", "decisions"], minor: ["strength", "vision"] },

  // ---------- Creator ----------
  { id: "chanceArchitect", name: "Chance Architect", family: "Creator", pop: "outfield", blurb: "unlocks defences with the final ball", gates: [pct("creativity", 75)], core: ["vision", "passing", "flair"], major: ["technique", "firstTouch", "offTheBall"], minor: ["dribbling", "composure"] },
  { id: "wideCreator", name: "Wide Creator", family: "Creator", pop: "outfield", blurb: "creates from the flanks", gates: [pct("crossing", 65), pct("creativity", 55)], core: ["crossing", "passing", "technique"], major: ["vision", "dribbling", "firstTouch"], minor: ["flair", "agility"] },
  { id: "deadBallSpecialist", name: "Dead-Ball Specialist", family: "Creator", pop: "outfield", blurb: "is a weapon from set-pieces", gates: [pct("technique", 55), raw("freeKicks", 12)], core: ["freeKicks", "corners", "technique"], major: ["penalties", "passing", "composure"], minor: ["longShots", "crossing", "vision"] },
  { id: "linkForward", name: "Link Forward", family: "Creator", pop: "outfield", blurb: "plays as the team's connector up front", gates: [pct("passing", 60), pct("firstTouch", 60)], core: ["passing", "firstTouch", "composure", "teamwork"], major: ["vision", "technique", "offTheBall", "decisions"], minor: ["dribbling", "flair"] },
  { id: "maverick", name: "Maverick", family: "Creator", pop: "outfield", blurb: "makes something from nothing", gates: [pct("flair", 85), pct("technique", 65)], core: ["flair", "technique", "dribbling"], major: ["vision", "firstTouch", "agility"], minor: ["longShots", "composure"] },

  // ---------- Carrier ----------
  { id: "lineBreaker", name: "Line Breaker", family: "Carrier", pop: "outfield", blurb: "carries the ball past opponents", gates: [pct("dribbling", 75), raw("acceleration", 11)], core: ["dribbling", "mobility", "technique"], major: ["flair", "firstTouch", "pace"], minor: ["composure", "offTheBall"] },
  { id: "touchlineIsolator", name: "Touchline Isolator", family: "Carrier", pop: "outfield", blurb: "beats his man one-on-one out wide", gates: [pct("dribbling", 80), raw("agility", 12)], core: ["dribbling", "agility", "flair", "acceleration"], major: ["balance", "technique", "pace"], minor: ["offTheBall", "composure"] },

  // ---------- Runner ----------
  { id: "roadrunner", name: "Roadrunner", family: "Runner", pop: "outfield", blurb: "threatens with raw pace", gates: [raw("pace", 14), pct("speed", 80)], core: ["pace", "acceleration"], major: ["offTheBall", "dribbling", "stamina"], minor: ["agility", "flair"] },
  { id: "transitionWeapon", name: "Transition Weapon", family: "Runner", pop: "outfield", blurb: "is devastating in the seconds after a turnover", gates: [pct("speed", 70), pct("offTheBall", 55)], core: ["acceleration", "offTheBall", "dribbling"], major: ["pace", "firstTouch", "composure", "anticipation"], minor: ["finishing", "flair"] },
  { id: "runnerInBehind", name: "Runner in Behind", family: "Runner", pop: "outfield", blurb: "times his runs off the last shoulder", gates: [pct("offTheBall", 70), pct("speed", 70)], core: ["offTheBall", "acceleration", "pace", "anticipation"], major: ["finishing", "composure"], minor: ["firstTouch", "agility"] },
  { id: "overlappingOutlet", name: "Overlapping Outlet", family: "Runner", pop: "outfield", blurb: "is an athletic wide runner from deep", gates: [pct("speed", 70), pct("workEngine", 60)], core: ["pace", "stamina", "crossing", "workRate"], major: ["acceleration", "offTheBall", "dribbling"], minor: ["teamwork", "positioning"] },

  // ---------- Finisher ----------
  { id: "penaltyBoxPredator", name: "Penalty-Box Predator", family: "Finisher", pop: "outfield", blurb: "lives on the last touch in the box", gates: [pct("finishing", 75), pct("offTheBall", 65)], core: ["finishing", "offTheBall", "anticipation", "composure"], major: ["firstTouch", "concentration"], minor: ["acceleration", "agility", "heading"] },
  { id: "completeFinisher", name: "Complete Finisher", family: "Finisher", pop: "outfield", blurb: "scores every type of goal", gates: [pct("finishing", 70), pct("mobility", 50), pct("aerial", 50)], core: ["finishing", "offTheBall", "composure"], major: ["heading", "dribbling", "technique", "anticipation"], minor: ["pace", "longShots", "firstTouch"] },
  { id: "secondPhaseThreat", name: "Second-Phase Threat", family: "Finisher", pop: "outfield", blurb: "arrives late for chaos in the box", gates: [pct("longShots", 65), pct("offTheBall", 55)], core: ["longShots", "offTheBall", "anticipation"], major: ["finishing", "workRate", "stamina"], minor: ["composure", "technique"] },
  { id: "longRangeMarksman", name: "Long-Range Marksman", family: "Finisher", pop: "outfield", blurb: "is a threat from distance", gates: [pct("longShots", 80)], core: ["longShots", "technique", "composure"], major: ["finishing", "flair", "vision"], minor: ["firstTouch", "offTheBall"] },
  { id: "cuttingInsideFinisher", name: "Cutting-Inside Finisher", family: "Finisher", pop: "outfield", blurb: "scores by cutting in from wide", gates: [pct("finishing", 70), pct("dribbling", 65)], core: ["finishing", "dribbling", "offTheBall", "acceleration"], major: ["composure", "technique", "agility"], minor: ["longShots", "flair", "pace"] },

  // ---------- Focal Point ----------
  { id: "aerialMonster", name: "Aerial Monster", family: "Focal Point", pop: "outfield", blurb: "dominates both boxes in the air", gates: [pct("aerial", 85), raw("jumpingReach", 13)], core: ["jumpingReach", "heading", "strength"], major: ["bravery", "anticipation", "balance"], minor: ["offTheBall", "aggression"] },
  { id: "targetFulcrum", name: "Target Fulcrum", family: "Focal Point", pop: "outfield", blurb: "holds the ball up and brings others into play", gates: [pct("physicality", 70), pct("firstTouch", 50)], core: ["strength", "heading", "firstTouch", "balance"], major: ["jumpingReach", "passing", "composure", "bravery"], minor: ["teamwork", "offTheBall", "finishing"] },

  // ---------- Destroyer ----------
  { id: "duelWinner", name: "Duel Winner", family: "Destroyer", pop: "outfield", blurb: "wins his individual battles on the ground and in the air", gates: [pct("tackling", 70), pct("physicality", 60)], core: ["tackling", "strength", "aggression", "bravery"], major: ["heading", "jumpingReach", "anticipation"], minor: ["marking", "balance", "determination"] },
  { id: "readerOfTheGame", name: "Reader of the Game", family: "Destroyer", pop: "outfield", blurb: "intercepts and positions rather than diving in", gates: [pct("defPosition", 75), pct("anticipation", 70)], core: ["anticipation", "positioning", "concentration", "decisions"], major: ["marking", "composure"], minor: ["tackling", "teamwork"] },
  { id: "recoverySprinter", name: "Recovery Sprinter", family: "Destroyer", pop: "outfield", blurb: "defends the space behind with pace", gates: [pct("speed", 75), pct("defPosition", 50)], core: ["pace", "acceleration", "anticipation"], major: ["positioning", "tackling", "concentration", "agility"], minor: ["marking", "bravery"] },
  { id: "destroyer", name: "Destroyer", family: "Destroyer", pop: "outfield", blurb: "breaks up play by force", gates: [pct("tackling", 75), pct("aggression", 65)], core: ["tackling", "aggression", "workRate"], major: ["anticipation", "strength", "bravery", "stamina"], minor: ["positioning", "determination"] },
  { id: "manMarker", name: "Man-Marker", family: "Destroyer", pop: "outfield", blurb: "locks onto and smothers a danger man", gates: [pct("marking", 75), pct("concentration", 60)], core: ["marking", "concentration", "tackling", "anticipation"], major: ["positioning", "aggression", "strength", "pace"], minor: ["bravery", "determination"] },
  { id: "anchor", name: "Anchor", family: "Destroyer", pop: "outfield", blurb: "is a positional shield that never leaves its post", gates: [pct("defPosition", 70), pct("teamwork", 55)], core: ["positioning", "concentration", "tackling", "teamwork"], major: ["anticipation", "decisions", "marking", "composure"], minor: ["strength", "workRate"] },

  // ---------- Engine ----------
  { id: "pressMachine", name: "Press Machine", family: "Engine", pop: "outfield", blurb: "hunts the ball down for the full ninety", gates: [pct("workEngine", 80), pct("aggression", 55)], core: ["workRate", "stamina", "aggression", "anticipation"], major: ["acceleration", "tackling", "bravery", "teamwork"], minor: ["determination", "pace"] },
  { id: "perpetualMotion", name: "Perpetual Motion", family: "Engine", pop: "outfield", blurb: "is a physical outlier who never stops", gates: [pct("workEngine", 85), pct("naturalFitness", 60)], core: ["stamina", "workRate", "naturalFitness"], major: ["acceleration", "pace", "strength"], minor: ["agility", "determination"] },
  { id: "athleticSpecimen", name: "Athletic Specimen", family: "Engine", pop: "outfield", blurb: "is a physical outlier in every direction", gates: [pct("speed", 70), pct("physicality", 70)], core: ["acceleration", "pace", "strength", "jumpingReach"], major: ["stamina", "balance", "agility", "naturalFitness"], minor: ["bravery", "workRate"] },

  // ---------- General ----------
  { id: "leaderOrganizer", name: "Leader-Organizer", family: "General", pop: "outfield", blurb: "leads and organises those around him", gates: [pct("leadership", 80), pct("determination", 60)], core: ["leadership", "determination", "teamwork"], major: ["bravery", "composure", "decisions", "concentration"], minor: ["workRate", "aggression"] },
  { id: "warrior", name: "Warrior", family: "General", pop: "outfield", blurb: "sets the tone with bravery and aggression", gates: [pct("bravery", 70), pct("aggression", 60)], core: ["bravery", "aggression", "determination", "workRate"], major: ["tackling", "strength", "teamwork"], minor: ["leadership", "stamina"] },

  // ---------- Goalkeepers ----------
  { id: "shotStoppingWall", name: "Shot-Stopping Wall", family: "Shot-Stopper", pop: "gk", blurb: "keeps out what he should and plenty he shouldn't", gates: [pct("reflexes", 75)], core: ["reflexes", "handling", "oneOnOnes", "positioning"], major: ["concentration", "agility", "composure"], minor: ["aerialReach", "bravery"] },
  { id: "modernDistributor", name: "Modern Distributor", family: "Distributor", pop: "gk", blurb: "plays as an eleventh outfielder", gates: [pct("kicking", 65), pct("composure", 60)], core: ["passing", "kicking", "firstTouch", "composure"], major: ["vision", "decisions", "throwing"], minor: ["reflexes", "handling"] },
  { id: "boxCommander", name: "Box Commander", family: "Commander", pop: "gk", blurb: "owns his penalty area", gates: [pct("commandOfArea", 70), pct("aerialReach", 65)], core: ["commandOfArea", "aerialReach", "communication"], major: ["punching", "handling", "bravery", "jumpingReach"], minor: ["leadership", "concentration"] },
  { id: "sweeperKeeper", name: "Sweeper-Keeper", family: "Sweeper", pop: "gk", blurb: "defends the space behind the line", gates: [pct("rushingOut", 65), pct("acceleration", 55)], core: ["rushingOut", "oneOnOnes", "acceleration", "anticipation"], major: ["positioning", "composure", "reflexes"], minor: ["pace", "agility", "kicking"] },
] as const satisfies readonly ArchetypeTemplate[];

export type ArchetypeId = (typeof ARCHETYPES)[number]["id"];
export type ArchetypeDef = (typeof ARCHETYPES)[number];

const BY_ID = new Map<ArchetypeId, (typeof ARCHETYPES)[number]>(
  ARCHETYPES.map((a) => [a.id, a]),
);

export function getArchetype(id: ArchetypeId): (typeof ARCHETYPES)[number] {
  const a = BY_ID.get(id);
  if (!a) throw new Error(`Unknown archetype id: ${id}`);
  return a;
}
