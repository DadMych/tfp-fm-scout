/**
 * Per-formation tactic briefing (doc 21): ranked styles, flank asymmetry, slot chips.
 */

import { midOf } from "../attr-value.js";
import { getArchetype } from "../archetypes/registry.js";
import type { AnalysisContext } from "./context.js";
import type { LinkBoard } from "./links.js";
import { surname } from "./phrases.js";
import type { PlayerRow } from "./xi.js";
import {
  rankStyles,
  type StyleId,
  type StyleSuitability,
} from "../squad/styles.js";

export interface StyleRead {
  readonly text: string;
  readonly evidence: readonly { readonly label: string; readonly value: string }[];
}

export interface FlankAdvice {
  readonly side: "left" | "right";
  readonly label: string;
  readonly text: string;
  readonly evidence: readonly { readonly label: string; readonly value: string }[];
}

export interface SlotAdvice {
  readonly slotKey: string;
  readonly slotLabel: string;
  readonly text: string;
}

export interface TacticBrief {
  readonly formationId: string;
  readonly formationName: string;
  readonly styles: readonly StyleSuitability[];
  readonly topStyleId: StyleId;
  readonly flanks: readonly FlankAdvice[];
  readonly slots: readonly SlotAdvice[];
  /** Broadsheet prose reads (feeds VerdictBar "How to play it"). */
  readonly styleReads: readonly StyleRead[];
}

function pctOf(row: PlayerRow, metric: string): number | null {
  return row.scores.percentiles[metric as keyof typeof row.scores.percentiles] ?? null;
}

function attrOf(row: PlayerRow, id: string): number | null {
  return midOf(row.player.attrs, id as never);
}

function flankSide(label: string): "left" | "right" | null {
  if (label === "LB" || label === "LWB" || label === "LW" || label === "LM") return "left";
  if (label === "RB" || label === "RWB" || label === "RW" || label === "RM") return "right";
  return null;
}

function isFullBackLabel(label: string): boolean {
  return label === "LB" || label === "RB" || label === "LWB" || label === "RWB";
}

function widePartner(
  ctx: AnalysisContext,
  linkBoard: LinkBoard,
  fbSlotKey: string,
): { winger: PlayerRow; partnership: number; wLabel: string } | null {
  for (const ev of linkBoard.links.filter((l) => l.link.type === "wide")) {
    if (ev.link.a !== fbSlotKey && ev.link.b !== fbSlotKey) continue;
    const otherKey = ev.link.a === fbSlotKey ? ev.link.b : ev.link.a;
    const wSlot = ctx.slots.find((s) => s.slotKey === otherKey);
    if (!wSlot?.starter) continue;
    const winger = ctx.byId.get(wSlot.starter.id);
    if (!winger) continue;
    return { winger, partnership: ev.partnership, wLabel: wSlot.label };
  }
  return null;
}

function flankAdviceFor(
  ctx: AnalysisContext,
  linkBoard: LinkBoard,
  side: "left" | "right",
): FlankAdvice | null {
  const fbSlot = ctx.slots.find((s) => {
    if (!s.starter) return false;
    if (!isFullBackLabel(s.label)) return false;
    return flankSide(s.label) === side;
  });
  if (!fbSlot?.starter) return null;
  const fb = ctx.byId.get(fbSlot.starter.id);
  if (!fb) return null;

  const pace = pctOf(fb, "pace") ?? 0;
  const stamina = pctOf(fb, "stamina") ?? pctOf(fb, "workEngine") ?? 0;
  const crossing = pctOf(fb, "crossing") ?? 0;
  const vision = pctOf(fb, "vision") ?? pctOf(fb, "creativity") ?? 0;
  const passing = pctOf(fb, "passing") ?? 0;
  const defAct = pctOf(fb, "defActivity") ?? 0;
  const partner = widePartner(ctx, linkBoard, fbSlot.slotKey);
  const wArch = partner?.winger.scores.topArchetype
    ? getArchetype(partner.winger.scores.topArchetype.id)
    : null;
  const name = surname(fb.player.name);
  const sideLabel = side === "left" ? "left" : "right";

  if (defAct < 40 && pace < 55) {
    return {
      side,
      label: fbSlot.label,
      text: `Keep ${name} conservative on the ${sideLabel} — he lacks both recovery defending and pace to bomb on.`,
      evidence: [
        { label: "Def activity", value: `p${Math.round(defAct)}` },
        { label: "Pace", value: `p${Math.round(pace)}` },
      ],
    };
  }

  if (pace >= 70 && stamina >= 65 && (wArch?.family === "Creator" || crossing >= 65)) {
    const wName = partner ? surname(partner.winger.player.name) : "the winger";
    return {
      side,
      label: fbSlot.label,
      text: `Push ${name} as the overlapping outlet on the ${sideLabel}; ${wName} cuts inside and leaves him the channel.`,
      evidence: [
        { label: "Pace", value: `p${Math.round(pace)}` },
        { label: "Stamina", value: `p${Math.round(stamina)}` },
        ...(partner ? [{ label: "Flank pair", value: `${partner.partnership}/100` }] : []),
      ],
    };
  }

  if (vision >= 65 && passing >= 65 && pace < 60) {
    return {
      side,
      label: fbSlot.label,
      text: `Invert ${name} on the ${sideLabel} — underlap into midfield rather than overlapping; his delivery is through the pass, not the touchline.`,
      evidence: [
        { label: "Vision/pass", value: `p${Math.round(Math.max(vision, passing))}` },
        { label: "Pace", value: `p${Math.round(pace)}` },
      ],
    };
  }

  if (pace >= 70 && crossing >= 60) {
    return {
      side,
      label: fbSlot.label,
      text: `${name} has the legs and delivery to bomb on the ${sideLabel} flank — give him licence to overlap.`,
      evidence: [
        { label: "Pace", value: `p${Math.round(pace)}` },
        { label: "Crossing", value: `p${Math.round(crossing)}` },
      ],
    };
  }

  return null;
}

function slotAdvice(ctx: AnalysisContext): SlotAdvice[] {
  const out: SlotAdvice[] = [];

  for (const slot of ctx.slots) {
    if (!slot.starter) continue;
    const row = ctx.byId.get(slot.starter.id);
    if (!row) continue;
    const arch = row.scores.topArchetype ? getArchetype(row.scores.topArchetype.id) : null;
    const name = surname(row.player.name);

    if (slot.slot.zone === "ATT" && (slot.label === "ST" || slot.label.startsWith("ST"))) {
      const aerial = pctOf(row, "aerial") ?? 0;
      const speed = pctOf(row, "speed") ?? pctOf(row, "pace") ?? 0;
      if (arch?.family === "Focal Point" || (arch?.family === "Finisher" && aerial >= 70)) {
        out.push({
          slotKey: slot.slotKey,
          slotLabel: slot.label,
          text: `${name} is a target — go direct and win the first ball around him.`,
        });
      } else if (arch?.family === "Runner" || speed >= 75) {
        out.push({
          slotKey: slot.slotKey,
          slotLabel: slot.label,
          text: `${name} runs in behind — play early vertical balls, not hold-up.`,
        });
      }
    }

    if (
      slot.label === "DM" ||
      slot.label === "DMC" ||
      slot.label === "RDM" ||
      slot.label === "LDM" ||
      slot.slotKey === "dm" ||
      slot.slotKey === "dml" ||
      slot.slotKey === "dmr"
    ) {
      const creativity = pctOf(row, "creativity") ?? 0;
      const defPos = pctOf(row, "defPosition") ?? 0;
      if (arch?.family === "Progressor" || creativity >= 70) {
        out.push({
          slotKey: slot.slotKey,
          slotLabel: slot.label,
          text: `${name} progresses from the base — let him receive on the half-turn.`,
        });
      } else if (arch?.family === "Destroyer" || defPos >= 70) {
        out.push({
          slotKey: slot.slotKey,
          slotLabel: slot.label,
          text: `${name} anchors — screen the back four, don't ask him to create.`,
        });
      }
    }

    if (slot.label === "LCB" || slot.label === "RCB" || slot.label === "CB" || slot.slotKey.startsWith("dc")) {
      const press = pctOf(row, "pressResist") ?? 0;
      const pace = pctOf(row, "pace") ?? 0;
      if (press >= 70 && pace >= 60) {
        out.push({
          slotKey: slot.slotKey,
          slotLabel: slot.label,
          text: `${name} can step out of the line — press the first receiver when they turn.`,
        });
      }
    }
  }

  return out.slice(0, 6);
}

function buildStyleReadsFromBrief(
  ctx: AnalysisContext,
  linkBoard: LinkBoard,
  flanks: readonly FlankAdvice[],
  styles: readonly StyleSuitability[],
): StyleRead[] {
  const reads: StyleRead[] = [];

  const top = styles[0];
  if (top && top.score >= 55) {
    reads.push({
      text: `Best fit for this shape: ${top.style.name} — ${top.style.blurb}`,
      evidence: top.evidence.filter((e) => e.ok).slice(0, 3).map((e) => ({ label: e.label, value: e.value })),
    });
  } else if (top && top.missing.length > 0) {
    reads.push({
      text: `You're closest to ${top.style.name}, but still short on ${top.missing.slice(0, 2).join(" and ")}.`,
      evidence: top.evidence.slice(0, 3).map((e) => ({ label: e.label, value: e.value })),
    });
  }

  for (const f of flanks) {
    reads.push({ text: f.text, evidence: f.evidence });
  }

  const workRates = ctx.squad
    .filter((r) => ctx.starters.has(r.player.id))
    .map((r) => r.scores.derived.workEngine)
    .filter((v): v is number => v != null);
  const avgWork =
    workRates.length > 0 ? workRates.reduce((s, v) => s + v, 0) / workRates.length : 0;
  const aggressionVals = ctx.squad
    .filter((r) => ctx.starters.has(r.player.id))
    .map((r) => attrOf(r, "aggression"))
    .filter((v): v is number => v != null);
  const avgAgg =
    aggressionVals.length > 0
      ? aggressionVals.reduce((s, v) => s + v, 0) / aggressionVals.length
      : 0;
  const pressResistVals = ctx.squad
    .filter((r) => ctx.starters.has(r.player.id))
    .map((r) => r.scores.derived.pressResist)
    .filter((v): v is number => v != null);
  const avgPress =
    pressResistVals.length > 0
      ? pressResistVals.reduce((s, v) => s + v, 0) / pressResistVals.length
      : 0;

  const cbSlots = ctx.slots.filter((s) => s.label === "LCB" || s.label === "RCB" || s.label === "CB");
  const cbPace = cbSlots
    .map((s) => (s.starter ? pctOf(ctx.byId.get(s.starter.id)!, "pace") : null))
    .filter((p): p is number => p != null);
  const slowCb = cbPace.length > 0 && Math.max(...cbPace) < 55;

  if (avgWork >= 13 && avgAgg >= 12) {
    reads.push({
      text: "This XI has the legs and bite to press as a unit — trigger from the front foot and squeeze the middle.",
      evidence: [
        { label: "XI work rate", value: avgWork.toFixed(1) },
        { label: "Aggression", value: avgAgg.toFixed(1) },
      ],
    });
  } else if (slowCb) {
    reads.push({
      text: "Your centre-backs lack recovery pace — sit deeper, protect the space in behind, and don't play a high line.",
      evidence: [{ label: "CB pace", value: `p${Math.round(Math.max(...cbPace))}` }],
    });
  } else if (avgPress >= 13 && avgWork < 12.5) {
    reads.push({
      text: "Press-resistant enough to keep the ball, but not enough legs for a sustained high press — hold a mid-block.",
      evidence: [{ label: "Press resist", value: avgPress.toFixed(1) }],
    });
  }

  const wideLinks = linkBoard.links.filter((l) => l.link.type === "wide");
  const centralLinks = linkBoard.links.filter((l) =>
    ["pivot", "spine", "cb-pair"].includes(l.link.type),
  );
  const wideAvg =
    wideLinks.length > 0
      ? wideLinks.reduce((s, l) => s + l.partnership, 0) / wideLinks.length
      : 0;
  const centralAvg =
    centralLinks.length > 0
      ? centralLinks.reduce((s, l) => s + l.partnership, 0) / centralLinks.length
      : 0;
  if (wideLinks.length >= 2 && wideAvg >= centralAvg + 8) {
    reads.push({
      text: "Your width is stronger than your middle — build through the flanks and let the centre hold shape.",
      evidence: [
        { label: "Wide pairs", value: `${Math.round(wideAvg)}/100` },
        { label: "Central pairs", value: `${Math.round(centralAvg)}/100` },
      ],
    });
  }

  // Deduplicate by text; keep evidence-rich first.
  const seen = new Set<string>();
  const unique: StyleRead[] = [];
  for (const r of reads) {
    if (seen.has(r.text)) continue;
    seen.add(r.text);
    unique.push(r);
  }
  return unique.slice(0, 5);
}

export function buildTacticBrief(ctx: AnalysisContext, linkBoard: LinkBoard): TacticBrief {
  const styles = rankStyles(ctx).slice(0, 3);
  const topStyleId = styles[0]?.style.id ?? "tiki-taka";

  const left = flankAdviceFor(ctx, linkBoard, "left");
  const right = flankAdviceFor(ctx, linkBoard, "right");
  const flanks = [left, right].filter((f): f is FlankAdvice => f != null);

  const slots = slotAdvice(ctx);
  const styleReads = buildStyleReadsFromBrief(ctx, linkBoard, flanks, styles);

  return {
    formationId: ctx.formation.id,
    formationName: ctx.formation.name,
    styles,
    topStyleId,
    flanks,
    slots,
    styleReads,
  };
}
