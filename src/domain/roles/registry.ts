import type { AttributeId } from "../attributes.js";
import type { PositionSlot } from "../positions.js";

/**
 * FM26 role registry (docs/05-role-engine.md §3).
 *
 * FM26 assigns each slot an In Possession (IP) role and an Out of Possession (OOP) role.
 * The FM24 duty system (Defend/Support/Attack) does not exist here and must never appear.
 *
 * Weights are v1 editorial estimates (doc 05 §5) — tune via golden fixtures, never hardcode
 * weights outside this file. Adding a role = adding one raw entry; UI renders whatever is here.
 */

export type RolePhase = "IP" | "OOP";

export interface RoleDef {
  readonly id: RoleId;
  readonly key: string;
  readonly name: string;
  readonly phase: RolePhase;
  readonly slots: readonly PositionSlot[];
  readonly core: readonly AttributeId[]; // ×3
  readonly major: readonly AttributeId[]; // ×2
  readonly minor: readonly AttributeId[]; // ×1
}

type RawPhase = "IP" | "OOP" | "both";

interface RawRole {
  readonly key: string;
  readonly name: string;
  readonly phase: RawPhase;
  readonly slots: readonly PositionSlot[];
  readonly core: readonly AttributeId[];
  readonly major: readonly AttributeId[];
  readonly minor: readonly AttributeId[];
}

const GK: readonly PositionSlot[] = ["GK"];
const DC: readonly PositionSlot[] = ["D-C"];
const FB: readonly PositionSlot[] = ["D-L", "D-R"];
const WB: readonly PositionSlot[] = ["WB-L", "WB-R"];
const DM: readonly PositionSlot[] = ["DM-L", "DM-C", "DM-R"];
const MC: readonly PositionSlot[] = ["M-C"];
const WM: readonly PositionSlot[] = ["M-L", "M-R"];
const AMC: readonly PositionSlot[] = ["AM-C"];
const WNG: readonly PositionSlot[] = ["AM-L", "AM-R"];
const ST: readonly PositionSlot[] = ["ST-C"];

const RAW: readonly RawRole[] = [
  // ---------- Goalkeepers ----------
  { key: "goalkeeper", name: "Goalkeeper", phase: "both", slots: GK, core: ["reflexes", "handling", "positioning", "concentration"], major: ["commandOfArea", "aerialReach", "oneOnOnes", "decisions"], minor: ["kicking", "communication", "agility"] },
  { key: "lineHoldingKeeper", name: "Line-Holding Keeper", phase: "OOP", slots: GK, core: ["reflexes", "positioning", "handling"], major: ["concentration", "commandOfArea", "aerialReach"], minor: ["kicking", "communication"] },
  { key: "noNonsenseGoalkeeper", name: "No-Nonsense Goalkeeper", phase: "IP", slots: GK, core: ["reflexes", "handling", "aerialReach", "commandOfArea"], major: ["kicking", "punching", "bravery"], minor: ["strength", "concentration"] },
  { key: "sweeperKeeper", name: "Sweeper Keeper", phase: "OOP", slots: GK, core: ["rushingOut", "oneOnOnes", "acceleration", "anticipation"], major: ["reflexes", "positioning", "composure", "decisions"], minor: ["kicking", "agility", "pace"] },
  { key: "ballPlayingGoalkeeper", name: "Ball-Playing Goalkeeper", phase: "IP", slots: GK, core: ["passing", "firstTouch", "composure", "kicking"], major: ["vision", "decisions", "reflexes", "handling"], minor: ["throwing", "anticipation"] },

  // ---------- Centre-backs ----------
  { key: "centreBack", name: "Centre-Back", phase: "both", slots: DC, core: ["marking", "tackling", "positioning", "heading"], major: ["strength", "jumpingReach", "anticipation", "concentration"], minor: ["bravery", "aggression", "pace"] },
  { key: "noNonsenseCentreBack", name: "No-Nonsense Centre-Back", phase: "IP", slots: DC, core: ["heading", "tackling", "marking", "bravery"], major: ["strength", "jumpingReach", "aggression", "positioning"], minor: ["concentration", "determination"] },
  { key: "coveringCentreBack", name: "Covering Centre-Back", phase: "OOP", slots: DC, core: ["positioning", "anticipation", "concentration", "pace"], major: ["acceleration", "decisions", "marking"], minor: ["composure", "tackling"] },
  { key: "stoppingCentreBack", name: "Stopping Centre-Back", phase: "OOP", slots: DC, core: ["tackling", "aggression", "bravery", "anticipation"], major: ["positioning", "strength", "decisions"], minor: ["marking", "acceleration"] },
  { key: "ballPlayingCentreBack", name: "Ball-Playing Centre-Back", phase: "IP", slots: DC, core: ["passing", "composure", "firstTouch", "vision"], major: ["technique", "decisions", "marking", "tackling"], minor: ["dribbling", "anticipation"] },
  { key: "overlappingCentreBack", name: "Overlapping Centre-Back", phase: "IP", slots: DC, core: ["pace", "stamina", "crossing", "tackling"], major: ["dribbling", "workRate", "positioning", "marking"], minor: ["passing", "offTheBall"] },
  { key: "advancedCentreBack", name: "Advanced Centre-Back", phase: "IP", slots: DC, core: ["passing", "composure", "decisions", "anticipation"], major: ["firstTouch", "tackling", "positioning", "vision"], minor: ["dribbling", "workRate"] },
  { key: "wideCentreBack", name: "Wide Centre-Back", phase: "both", slots: DC, core: ["tackling", "marking", "pace", "positioning"], major: ["stamina", "anticipation", "strength"], minor: ["crossing", "dribbling"] },
  { key: "coveringWideCentreBack", name: "Covering Wide Centre-Back", phase: "OOP", slots: DC, core: ["positioning", "anticipation", "pace", "concentration"], major: ["marking", "acceleration", "decisions"], minor: ["tackling", "composure"] },
  { key: "stoppingWideCentreBack", name: "Stopping Wide Centre-Back", phase: "OOP", slots: DC, core: ["tackling", "aggression", "acceleration", "bravery"], major: ["anticipation", "positioning", "strength"], minor: ["marking", "decisions"] },

  // ---------- Full-backs ----------
  { key: "fullBack", name: "Full-Back", phase: "both", slots: FB, core: ["tackling", "positioning", "marking", "workRate"], major: ["crossing", "stamina", "anticipation", "concentration"], minor: ["passing", "pace", "teamwork"] },
  { key: "holdingFullBack", name: "Holding Full-Back", phase: "OOP", slots: FB, core: ["positioning", "marking", "concentration", "tackling"], major: ["anticipation", "decisions", "strength"], minor: ["composure", "teamwork"] },
  { key: "insideFullBack", name: "Inside Full-Back", phase: "IP", slots: FB, core: ["positioning", "passing", "composure", "marking"], major: ["firstTouch", "decisions", "tackling", "anticipation"], minor: ["vision", "strength"] },
  { key: "invertedFullBack", name: "Inverted Full-Back", phase: "IP", slots: FB, core: ["passing", "firstTouch", "composure", "decisions"], major: ["positioning", "vision", "tackling", "technique"], minor: ["dribbling", "teamwork"] },
  { key: "pressingFullBack", name: "Pressing Full-Back", phase: "OOP", slots: FB, core: ["workRate", "acceleration", "aggression", "tackling"], major: ["stamina", "anticipation", "bravery", "pace"], minor: ["positioning", "determination"] },

  // ---------- Wing-backs ----------
  { key: "wingBack", name: "Wing-Back", phase: "both", slots: WB, core: ["stamina", "crossing", "workRate", "pace"], major: ["dribbling", "tackling", "acceleration", "offTheBall"], minor: ["passing", "positioning", "teamwork"] },
  { key: "holdingWingBack", name: "Holding Wing-Back", phase: "OOP", slots: WB, core: ["positioning", "tackling", "marking", "stamina"], major: ["concentration", "anticipation", "workRate"], minor: ["strength", "decisions"] },
  { key: "insideWingBack", name: "Inside Wing-Back", phase: "IP", slots: WB, core: ["passing", "firstTouch", "decisions", "composure"], major: ["positioning", "vision", "stamina"], minor: ["technique", "teamwork"] },
  { key: "invertedWingBack", name: "Inverted Wing-Back", phase: "IP", slots: WB, core: ["passing", "composure", "decisions", "firstTouch"], major: ["vision", "technique", "positioning", "stamina"], minor: ["dribbling", "anticipation"] },
  { key: "pressingWingBack", name: "Pressing Wing-Back", phase: "OOP", slots: WB, core: ["workRate", "stamina", "acceleration", "aggression"], major: ["tackling", "anticipation", "pace", "bravery"], minor: ["positioning", "determination"] },
  { key: "playmakingWingBack", name: "Playmaking Wing-Back", phase: "IP", slots: WB, core: ["passing", "vision", "crossing", "technique"], major: ["firstTouch", "decisions", "stamina", "composure"], minor: ["dribbling", "flair", "workRate"] },
  { key: "advancedWingBack", name: "Advanced Wing-Back", phase: "IP", slots: WB, core: ["crossing", "dribbling", "pace", "stamina"], major: ["acceleration", "offTheBall", "technique", "workRate"], minor: ["passing", "flair", "agility"] },

  // ---------- Defensive midfielders ----------
  { key: "defensiveMidfielder", name: "Defensive Midfielder", phase: "both", slots: DM, core: ["tackling", "positioning", "anticipation", "concentration"], major: ["marking", "workRate", "decisions", "strength"], minor: ["passing", "teamwork", "stamina"] },
  { key: "droppingDefensiveMidfielder", name: "Dropping Defensive Midfielder", phase: "OOP", slots: DM, core: ["positioning", "anticipation", "marking", "decisions"], major: ["concentration", "composure", "heading", "strength"], minor: ["tackling", "jumpingReach"] },
  { key: "screeningDefensiveMidfielder", name: "Screening Defensive Midfielder", phase: "OOP", slots: DM, core: ["positioning", "anticipation", "concentration", "decisions"], major: ["marking", "tackling", "composure"], minor: ["workRate", "teamwork"] },
  { key: "wideCoveringDefensiveMidfielder", name: "Wide Covering Defensive Midfielder", phase: "OOP", slots: DM, core: ["positioning", "stamina", "anticipation", "workRate"], major: ["tackling", "marking", "acceleration", "pace"], minor: ["concentration", "teamwork"] },
  { key: "halfBack", name: "Half-Back", phase: "IP", slots: DM, core: ["positioning", "composure", "passing", "decisions"], major: ["anticipation", "firstTouch", "marking", "concentration"], minor: ["tackling", "vision"] },
  { key: "pressingDefensiveMidfielder", name: "Pressing Defensive Midfielder", phase: "OOP", slots: DM, core: ["workRate", "aggression", "tackling", "anticipation"], major: ["stamina", "acceleration", "bravery", "positioning"], minor: ["strength", "determination"] },
  { key: "deepLyingPlaymaker", name: "Deep-Lying Playmaker", phase: "IP", slots: DM, core: ["passing", "vision", "composure", "firstTouch"], major: ["technique", "decisions", "anticipation"], minor: ["positioning", "teamwork", "flair"] },

  // ---------- Central midfielders ----------
  { key: "centralMidfielder", name: "Central Midfielder", phase: "both", slots: MC, core: ["passing", "decisions", "workRate", "teamwork"], major: ["firstTouch", "positioning", "stamina", "tackling"], minor: ["vision", "anticipation", "composure"] },
  { key: "screeningCentralMidfielder", name: "Screening Central Midfielder", phase: "OOP", slots: MC, core: ["positioning", "anticipation", "concentration", "decisions"], major: ["marking", "tackling", "composure", "teamwork"], minor: ["workRate", "strength"] },
  { key: "wideCoveringCentralMidfielder", name: "Wide Covering Central Midfielder", phase: "OOP", slots: MC, core: ["stamina", "positioning", "workRate", "anticipation"], major: ["tackling", "marking", "pace", "teamwork"], minor: ["acceleration", "decisions"] },
  { key: "boxToBoxMidfielder", name: "Box-to-Box Midfielder", phase: "both", slots: MC, core: ["stamina", "workRate", "passing", "offTheBall"], major: ["tackling", "dribbling", "decisions", "strength"], minor: ["finishing", "longShots", "anticipation"] },
  { key: "boxToBoxPlaymaker", name: "Box-to-Box Playmaker", phase: "IP", slots: MC, core: ["passing", "stamina", "vision", "dribbling"], major: ["firstTouch", "technique", "workRate", "decisions"], minor: ["flair", "offTheBall", "composure"] },
  { key: "channelMidfielder", name: "Channel Midfielder", phase: "IP", slots: MC, core: ["offTheBall", "stamina", "passing", "dribbling"], major: ["acceleration", "decisions", "firstTouch", "workRate"], minor: ["finishing", "vision", "flair"] },
  { key: "midfieldPlaymaker", name: "Midfield Playmaker", phase: "IP", slots: MC, core: ["passing", "vision", "firstTouch", "composure"], major: ["technique", "decisions", "anticipation", "flair"], minor: ["dribbling", "teamwork", "agility"] },
  { key: "pressingCentralMidfielder", name: "Pressing Central Midfielder", phase: "OOP", slots: MC, core: ["workRate", "aggression", "anticipation", "stamina"], major: ["tackling", "acceleration", "bravery", "decisions"], minor: ["positioning", "determination"] },

  // ---------- Wide midfielders ----------
  { key: "wideMidfielder", name: "Wide Midfielder", phase: "both", slots: WM, core: ["crossing", "workRate", "stamina", "teamwork"], major: ["passing", "tackling", "decisions", "positioning"], minor: ["dribbling", "firstTouch", "concentration"] },
  { key: "trackingWideMidfielder", name: "Tracking Wide Midfielder", phase: "OOP", slots: WM, core: ["workRate", "positioning", "stamina", "tackling"], major: ["marking", "anticipation", "teamwork", "concentration"], minor: ["pace", "decisions"] },
  { key: "wideCentralMidfielder", name: "Wide Central Midfielder", phase: "IP", slots: WM, core: ["passing", "firstTouch", "decisions", "stamina"], major: ["vision", "technique", "positioning", "workRate"], minor: ["dribbling", "composure"] },
  { key: "wideOutletMidfielder", name: "Wide Outlet Midfielder", phase: "OOP", slots: WM, core: ["pace", "acceleration", "offTheBall", "dribbling"], major: ["crossing", "stamina", "firstTouch"], minor: ["flair", "composure"] },

  // ---------- Attacking midfielders ----------
  { key: "attackingMidfielder", name: "Attacking Midfielder", phase: "both", slots: AMC, core: ["passing", "vision", "offTheBall", "technique"], major: ["firstTouch", "decisions", "flair", "composure"], minor: ["dribbling", "longShots", "finishing"] },
  { key: "trackingAttackingMidfielder", name: "Tracking Attacking Midfielder", phase: "OOP", slots: AMC, core: ["workRate", "teamwork", "positioning", "stamina"], major: ["anticipation", "tackling", "decisions"], minor: ["marking", "concentration"] },
  { key: "advancedPlaymaker", name: "Advanced Playmaker", phase: "IP", slots: AMC, core: ["passing", "vision", "firstTouch", "technique"], major: ["composure", "decisions", "flair", "anticipation"], minor: ["dribbling", "agility", "offTheBall"] },
  { key: "centralOutletAttackingMidfielder", name: "Central Outlet Attacking Midfielder", phase: "OOP", slots: AMC, core: ["offTheBall", "acceleration", "composure", "firstTouch"], major: ["pace", "anticipation", "dribbling"], minor: ["passing", "flair"] },
  { key: "splittingOutletAttackingMidfielder", name: "Splitting Outlet Attacking Midfielder", phase: "OOP", slots: AMC, core: ["pace", "acceleration", "offTheBall", "dribbling"], major: ["firstTouch", "composure", "crossing"], minor: ["flair", "finishing"] },
  { key: "freeRole", name: "Free Role", phase: "IP", slots: AMC, core: ["flair", "vision", "technique", "dribbling"], major: ["passing", "firstTouch", "composure", "offTheBall"], minor: ["decisions", "agility", "finishing"] },

  // ---------- Wingers ----------
  { key: "winger", name: "Winger", phase: "both", slots: WNG, core: ["crossing", "dribbling", "pace", "acceleration"], major: ["technique", "agility", "offTheBall", "stamina"], minor: ["firstTouch", "flair", "workRate"] },
  { key: "halfSpaceWinger", name: "Half-Space Winger", phase: "IP", slots: WNG, core: ["dribbling", "offTheBall", "passing", "agility"], major: ["firstTouch", "technique", "vision", "composure"], minor: ["finishing", "flair", "acceleration"] },
  { key: "insideWinger", name: "Inside Winger", phase: "IP", slots: WNG, core: ["dribbling", "acceleration", "technique", "offTheBall"], major: ["finishing", "longShots", "agility", "pace"], minor: ["passing", "flair", "composure"] },
  { key: "invertingOutletWinger", name: "Inverting Outlet Winger", phase: "OOP", slots: WNG, core: ["pace", "acceleration", "dribbling", "offTheBall"], major: ["firstTouch", "composure", "finishing"], minor: ["flair", "agility"] },
  { key: "trackingWinger", name: "Tracking Winger", phase: "OOP", slots: WNG, core: ["workRate", "stamina", "positioning", "teamwork"], major: ["tackling", "marking", "anticipation", "pace"], minor: ["concentration", "decisions"] },
  { key: "wideOutletWinger", name: "Wide Outlet Winger", phase: "OOP", slots: WNG, core: ["pace", "acceleration", "dribbling", "crossing"], major: ["offTheBall", "stamina", "firstTouch"], minor: ["flair", "composure"] },
  { key: "widePlaymaker", name: "Wide Playmaker", phase: "IP", slots: WNG, core: ["passing", "vision", "technique", "firstTouch"], major: ["composure", "decisions", "flair", "dribbling"], minor: ["crossing", "agility"] },
  { key: "wideForward", name: "Wide Forward", phase: "IP", slots: WNG, core: ["finishing", "offTheBall", "acceleration", "dribbling"], major: ["pace", "composure", "firstTouch", "technique"], minor: ["crossing", "agility", "flair"] },
  { key: "insideForward", name: "Inside Forward", phase: "IP", slots: WNG, core: ["dribbling", "finishing", "acceleration", "offTheBall"], major: ["technique", "agility", "composure", "pace"], minor: ["passing", "flair", "longShots"] },

  // ---------- Strikers ----------
  { key: "centreForward", name: "Centre Forward", phase: "both", slots: ST, core: ["finishing", "offTheBall", "composure", "anticipation"], major: ["firstTouch", "heading", "pace", "technique"], minor: ["dribbling", "strength", "decisions"] },
  { key: "falseNine", name: "False Nine", phase: "IP", slots: ST, core: ["passing", "vision", "firstTouch", "technique"], major: ["dribbling", "composure", "offTheBall", "flair"], minor: ["decisions", "agility", "finishing"] },
  { key: "deepLyingForward", name: "Deep-Lying Forward", phase: "IP", slots: ST, core: ["firstTouch", "passing", "composure", "strength"], major: ["technique", "vision", "offTheBall", "decisions"], minor: ["heading", "finishing", "teamwork"] },
  { key: "halfSpaceForward", name: "Half-Space Forward", phase: "IP", slots: ST, core: ["offTheBall", "finishing", "dribbling", "acceleration"], major: ["composure", "firstTouch", "agility", "technique"], minor: ["passing", "flair", "pace"] },
  { key: "channelForward", name: "Channel Forward", phase: "IP", slots: ST, core: ["offTheBall", "pace", "stamina", "workRate"], major: ["acceleration", "finishing", "dribbling", "strength"], minor: ["firstTouch", "crossing", "teamwork"] },
  { key: "secondStriker", name: "Second Striker", phase: "IP", slots: ST, core: ["offTheBall", "finishing", "composure", "anticipation"], major: ["firstTouch", "passing", "dribbling", "decisions"], minor: ["flair", "longShots", "agility"] },
  { key: "centralOutletCentreForward", name: "Central Outlet Centre Forward", phase: "OOP", slots: ST, core: ["offTheBall", "pace", "acceleration", "anticipation"], major: ["finishing", "composure", "firstTouch", "strength"], minor: ["heading", "dribbling"] },
  { key: "splittingOutletCentreForward", name: "Splitting Outlet Centre Forward", phase: "OOP", slots: ST, core: ["pace", "acceleration", "offTheBall", "dribbling"], major: ["firstTouch", "composure", "crossing", "finishing"], minor: ["flair", "agility"] },
  { key: "trackingCentreForward", name: "Tracking Centre Forward", phase: "OOP", slots: ST, core: ["workRate", "teamwork", "stamina", "anticipation"], major: ["positioning", "tackling", "decisions", "aggression"], minor: ["marking", "determination"] },
  { key: "targetForward", name: "Target Forward", phase: "both", slots: ST, core: ["heading", "strength", "jumpingReach", "bravery"], major: ["firstTouch", "finishing", "offTheBall", "balance"], minor: ["composure", "teamwork", "aggression"] },
  { key: "poacher", name: "Poacher", phase: "both", slots: ST, core: ["finishing", "offTheBall", "anticipation", "composure"], major: ["acceleration", "firstTouch", "concentration"], minor: ["pace", "agility", "heading"] },
] as const satisfies readonly RawRole[];

type RoleKey = (typeof RAW)[number]["key"];
export type RoleId = `ip.${RoleKey}` | `oop.${RoleKey}`;

function expand(raw: (typeof RAW)[number]): RoleDef[] {
  const build = (phase: RolePhase): RoleDef => ({
    id: `${phase.toLowerCase()}.${raw.key}` as RoleId,
    key: raw.key,
    name: raw.name,
    phase,
    slots: raw.slots,
    core: raw.core,
    major: raw.major,
    minor: raw.minor,
  });
  if (raw.phase === "both") return [build("IP"), build("OOP")];
  return [build(raw.phase)];
}

export const ROLES: readonly RoleDef[] = RAW.flatMap(expand);

const BY_ID = new Map<RoleId, RoleDef>(ROLES.map((r) => [r.id, r]));

export function getRole(id: RoleId): RoleDef {
  const r = BY_ID.get(id);
  if (!r) throw new Error(`Unknown role id: ${id}`);
  return r;
}

export function isRoleId(id: string): id is RoleId {
  return BY_ID.has(id as RoleId);
}

export function rolesForPhase(phase: RolePhase): RoleDef[] {
  return ROLES.filter((r) => r.phase === phase);
}
