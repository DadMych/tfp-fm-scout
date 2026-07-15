/**
 * Canonical attribute registry — the single source of truth (docs/04-data-model.md §2).
 *
 * Every attribute has: canonical id, display name, FM26 column short code, and category.
 * Set-piece attributes stay in `technical` but carry `setPiece: true` for display grouping
 * (FM26 shows Set Pieces as a separate block on the profile).
 *
 * The header-synonym table (docs/03-data-import.md §5) and every UI grouping are generated
 * from this list. Do not hardcode attribute names anywhere else.
 */

export type AttributeCategory =
  | "technical"
  | "mental"
  | "physical"
  | "goalkeeping";

export interface AttributeDef {
  readonly id: string;
  readonly name: string;
  /** FM26 narrow-column abbreviation. */
  readonly code: string;
  readonly category: AttributeCategory;
  /** Technical attribute that FM26 displays under "Set Pieces". */
  readonly setPiece?: true;
}

export const ATTRIBUTES = [
  // Technical (outfield)
  { id: "corners", name: "Corners", code: "Cor", category: "technical", setPiece: true },
  { id: "crossing", name: "Crossing", code: "Cro", category: "technical" },
  { id: "dribbling", name: "Dribbling", code: "Dri", category: "technical" },
  { id: "finishing", name: "Finishing", code: "Fin", category: "technical" },
  { id: "firstTouch", name: "First Touch", code: "Fir", category: "technical" },
  { id: "freeKicks", name: "Free Kick Taking", code: "Fre", category: "technical", setPiece: true },
  { id: "heading", name: "Heading", code: "Hea", category: "technical" },
  { id: "longShots", name: "Long Shots", code: "Lon", category: "technical" },
  { id: "longThrows", name: "Long Throws", code: "L Th", category: "technical", setPiece: true },
  { id: "marking", name: "Marking", code: "Mar", category: "technical" },
  { id: "passing", name: "Passing", code: "Pas", category: "technical" },
  { id: "penalties", name: "Penalty Taking", code: "Pen", category: "technical", setPiece: true },
  { id: "tackling", name: "Tackling", code: "Tck", category: "technical" },
  { id: "technique", name: "Technique", code: "Tec", category: "technical" },

  // Mental
  { id: "aggression", name: "Aggression", code: "Agg", category: "mental" },
  { id: "anticipation", name: "Anticipation", code: "Ant", category: "mental" },
  { id: "bravery", name: "Bravery", code: "Bra", category: "mental" },
  { id: "composure", name: "Composure", code: "Cmp", category: "mental" },
  { id: "concentration", name: "Concentration", code: "Cnt", category: "mental" },
  { id: "decisions", name: "Decisions", code: "Dec", category: "mental" },
  { id: "determination", name: "Determination", code: "Det", category: "mental" },
  { id: "flair", name: "Flair", code: "Fla", category: "mental" },
  { id: "leadership", name: "Leadership", code: "Ldr", category: "mental" },
  { id: "offTheBall", name: "Off The Ball", code: "OtB", category: "mental" },
  { id: "positioning", name: "Positioning", code: "Pos", category: "mental" },
  { id: "teamwork", name: "Teamwork", code: "Tea", category: "mental" },
  { id: "vision", name: "Vision", code: "Vis", category: "mental" },
  { id: "workRate", name: "Work Rate", code: "Wor", category: "mental" },

  // Physical
  { id: "acceleration", name: "Acceleration", code: "Acc", category: "physical" },
  { id: "agility", name: "Agility", code: "Agi", category: "physical" },
  { id: "balance", name: "Balance", code: "Bal", category: "physical" },
  { id: "jumpingReach", name: "Jumping Reach", code: "Jum", category: "physical" },
  { id: "naturalFitness", name: "Natural Fitness", code: "Nat", category: "physical" },
  { id: "pace", name: "Pace", code: "Pac", category: "physical" },
  { id: "stamina", name: "Stamina", code: "Sta", category: "physical" },
  { id: "strength", name: "Strength", code: "Str", category: "physical" },

  // Goalkeeping (null for outfielders)
  { id: "aerialReach", name: "Aerial Reach", code: "Aer", category: "goalkeeping" },
  { id: "commandOfArea", name: "Command Of Area", code: "Cmd", category: "goalkeeping" },
  { id: "communication", name: "Communication", code: "Com", category: "goalkeeping" },
  { id: "eccentricity", name: "Eccentricity", code: "Ecc", category: "goalkeeping" },
  { id: "handling", name: "Handling", code: "Han", category: "goalkeeping" },
  { id: "kicking", name: "Kicking", code: "Kic", category: "goalkeeping" },
  { id: "oneOnOnes", name: "One On Ones", code: "1v1", category: "goalkeeping" },
  { id: "punching", name: "Punching (Tendency)", code: "Pun", category: "goalkeeping" },
  { id: "reflexes", name: "Reflexes", code: "Ref", category: "goalkeeping" },
  { id: "rushingOut", name: "Rushing Out (Tendency)", code: "TRO", category: "goalkeeping" },
  { id: "throwing", name: "Throwing", code: "Thr", category: "goalkeeping" },
] as const satisfies readonly AttributeDef[];

export type AttributeId = (typeof ATTRIBUTES)[number]["id"];

const BY_ID = new Map<AttributeId, AttributeDef>(
  ATTRIBUTES.map((a) => [a.id, a]),
);

export function getAttribute(id: AttributeId): AttributeDef {
  const def = BY_ID.get(id);
  // Unreachable for a valid AttributeId; guards against a bad cast.
  if (!def) throw new Error(`Unknown attribute id: ${id}`);
  return def;
}

export function attributesByCategory(category: AttributeCategory): AttributeDef[] {
  return ATTRIBUTES.filter((a) => a.category === category);
}
