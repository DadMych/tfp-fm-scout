/**
 * Player dossier (docs/09-ui-ux.md "The Dossier").
 *
 * The signature single-player screen: headline + standfirst, a facts rail, an identity band
 * of best-fitting archetypes, an engraved percentile radar, the full attribute grid rendered
 * honestly (exact / ranged / masked), and a role table. Pure renderer — no I/O. Shares the
 * almanac palette and the format helpers with the Ledger so the two screens feel like one paper.
 */

import {
  attributesByCategory,
  getAttribute,
  type AttributeCategory,
  type AttributeId,
} from "../domain/attributes.js";
import { type AttrValue } from "../domain/attr-value.js";
import type { Player } from "../domain/player.js";
import { getArchetype } from "../domain/archetypes/registry.js";
import { badgeFor, type Badge } from "../domain/archetypes/score.js";
import { getRole, isRoleId } from "../domain/roles/registry.js";
import type { PlayerScores } from "../domain/scoring/dataset.js";
import type { MetricId } from "../domain/metric-id.js";
import type { ReportMeta } from "./broadsheet.js";
import {
  esc,
  footLabel,
  formatHeight,
  formatMoney,
  metricLabel,
} from "./format.js";

/** Filesystem-safe file name for a player's dossier (unique via the stable row id). */
export function dossierFileName(p: Player): string {
  const slug = p.name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${slug || "player"}-${p.id}.html`;
}

/** Href to a player's dossier, relative to the Ledger index (`out/report/index.html`). */
export function dossierHref(p: Player): string {
  return `p/${dossierFileName(p)}`;
}

const BACK_HREF = "../index.html";

const RADAR_OUTFIELD = [
  "finishingPkg",
  "creativity",
  "pressResist",
  "speed",
  "mobility",
  "physicality",
  "aerial",
  "workEngine",
  "defActivity",
  "defPosition",
] as const satisfies readonly MetricId[];

const RADAR_GK = [
  "reflexes",
  "handling",
  "aerialReach",
  "commandOfArea",
  "oneOnOnes",
  "kicking",
  "communication",
  "positioning",
  "composure",
  "agility",
] as const satisfies readonly MetricId[];

const RADAR_SHORT: Record<string, string> = {
  finishingPkg: "Finishing",
  creativity: "Creativity",
  pressResist: "Press-res.",
  speed: "Speed",
  mobility: "Mobility",
  physicality: "Physical",
  aerial: "Aerial",
  workEngine: "Work rate",
  defActivity: "Def. work",
  defPosition: "Def. pos.",
};

function shortLabel(id: string): string {
  return RADAR_SHORT[id] ?? metricLabel(id);
}

function pt(cx: number, cy: number, r: number, i: number, n: number): [number, number] {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/** Engraved percentile radar over the population-appropriate axes (nulls plot at the centre). */
function radar(s: PlayerScores): string {
  const axes = (s.pop === "gk" ? RADAR_GK : RADAR_OUTFIELD).map((id) => ({
    id,
    pct: s.percentiles[id] ?? null,
  }));
  const known = axes.filter((a) => a.pct != null).length;
  if (known < 3) return "";

  const W = 420;
  const cx = W / 2;
  const cy = 190;
  const R = 130;
  const n = axes.length;

  const rings = [0.25, 0.5, 0.75, 1]
    .map((f) => {
      const poly = axes
        .map((_, i) => pt(cx, cy, R * f, i, n).map((v) => v.toFixed(1)).join(","))
        .join(" ");
      return `<polygon class="ring" points="${poly}"/>`;
    })
    .join("");

  const spokes = axes
    .map((_, i) => {
      const [x, y] = pt(cx, cy, R, i, n);
      return `<line class="spoke" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
    })
    .join("");

  const dataPts = axes
    .map((a, i) => pt(cx, cy, R * ((a.pct ?? 0) / 100), i, n).map((v) => v.toFixed(1)).join(","))
    .join(" ");

  const dots = axes
    .map((a, i) => {
      const [x, y] = pt(cx, cy, R * ((a.pct ?? 0) / 100), i, n);
      const cls = a.pct != null && a.pct >= 80 ? "dot hi" : "dot";
      return `<circle class="${cls}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3"/>`;
    })
    .join("");

  const labels = axes
    .map((a, i) => {
      const [x, y] = pt(cx, cy, R + 20, i, n);
      const cos = Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / n);
      const anchor = cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
      const val = a.pct != null ? Math.round(a.pct) : "–";
      return `<text class="rlabel" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}">${esc(shortLabel(a.id))} <tspan class="rnum">${val}</tspan></text>`;
    })
    .join("");

  return `<svg class="radar" viewBox="-55 0 ${W + 110} 360" role="img" aria-label="Percentile radar across ${n} axes">
    ${rings}${spokes}
    <polygon class="area" points="${dataPts}"/>
    ${dots}${labels}
  </svg>`;
}

function attrValue(v: AttrValue | undefined): { text: string; masked: boolean; ranged: boolean } {
  if (v == null) return { text: "–", masked: true, ranged: false };
  if (v.min === v.max) return { text: String(v.min), masked: false, ranged: false };
  return { text: `${v.min}–${v.max}`, masked: false, ranged: true };
}

function bar(pct: number | null, ranged: boolean, masked: boolean): string {
  if (masked || pct == null) return `<span class="pctbar masked"></span>`;
  const w = Math.max(0, Math.min(100, Math.round(pct)));
  const cls = ["pctbar", pct >= 80 ? "hi" : "", ranged ? "ranged" : ""].filter(Boolean).join(" ");
  return `<span class="${cls}"><i style="width:${w}%"></i></span>`;
}

function attrRow(p: Player, s: PlayerScores, id: AttributeId): string {
  const def = getAttribute(id);
  const v = attrValue(p.attrs[id]);
  const pct = s.percentiles[id] ?? null;
  const valCls = ["aval", v.masked ? "masked" : "", v.ranged ? "ranged" : ""]
    .filter(Boolean)
    .join(" ");
  return `<tr>
    <td class="alabel">${esc(def.name)}</td>
    <td class="${valCls} num">${esc(v.text)}</td>
    <td class="abar">${bar(pct, v.ranged, v.masked)}</td>
  </tr>`;
}

function attrColumn(p: Player, s: PlayerScores, title: string, ids: readonly AttributeId[]): string {
  const rows = ids.map((id) => attrRow(p, s, id)).join("");
  return `<div class="acol">
    <p class="acol-h">${esc(title)}</p>
    <table class="atable">${rows}</table>
  </div>`;
}

function attributeGrid(p: Player, s: PlayerScores): string {
  const byCat = (c: AttributeCategory) => attributesByCategory(c).map((a) => a.id as AttributeId);
  const cols: string[] =
    s.pop === "gk"
      ? [
          attrColumn(p, s, "Goalkeeping", [
            ...byCat("goalkeeping"),
            "firstTouch" as AttributeId,
            "passing" as AttributeId,
          ]),
          attrColumn(p, s, "Mental", byCat("mental")),
          attrColumn(p, s, "Physical", byCat("physical")),
        ]
      : [
          attrColumn(p, s, "Technical", byCat("technical")),
          attrColumn(p, s, "Mental", byCat("mental")),
          attrColumn(p, s, "Physical", byCat("physical")),
        ];
  return `<div class="grid">${cols.join("")}</div>`;
}

/** Top archetypes that pass their gates, badged; shows fit even when no badge is earned. */
function identityBand(s: PlayerScores): string {
  const ranked = [...s.archetypes].sort((a, b) => b.score - a.score).slice(0, 4);
  const rows = ranked
    .map((a) => {
      const def = getArchetype(a.id);
      const badge: Badge = badgeFor(a.score, a.gatesPassed);
      const badgeHtml = badge
        ? `<span class="stamp ${badge === "Elite" ? "gold" : "ink"}">${esc(badge)}</span>`
        : a.gatesPassed
          ? ""
          : `<span class="stamp faint">gated</span>`;
      const lead = badge === "Elite" ? " lead" : "";
      return `<tr>
        <td class="score${lead} num">${Math.round(a.score)}</td>
        <td class="aname">${esc(def.name)}<span class="fam">${esc(def.family)}</span></td>
        <td class="badge">${badgeHtml}</td>
      </tr>`;
    })
    .join("");
  return `<table class="idtable">${rows}</table>`;
}

function roleTable(p: Player, s: PlayerScores): string {
  const posSet = new Set(p.positions);
  const ranked = Object.entries(s.roles)
    .flatMap(([id, r]) =>
      r && isRoleId(id)
        ? [{ id, r, eligible: getRole(id).slots.some((slot) => posSet.has(slot)) }]
        : [],
    )
    .sort((a, b) => b.r.score - a.r.score)
    .slice(0, 8);
  const rows = ranked
    .map(({ id, r, eligible }) => {
      const def = getRole(id);
      const w = Math.max(0, Math.min(100, Math.round(r.score)));
      const cls = ["pctbar", r.score >= 80 ? "hi" : "", r.insufficient ? "masked" : ""]
        .filter(Boolean)
        .join(" ");
      const barHtml = r.insufficient
        ? `<span class="pctbar masked"></span>`
        : `<span class="${cls}"><i style="width:${w}%"></i></span>`;
      return `<tr class="${eligible ? "elig" : ""}">
        <td class="rname">${eligible ? '<span class="tick">▸</span>' : ""}${esc(def.name)}</td>
        <td class="rphase">${esc(def.phase)}</td>
        <td class="rbar">${barHtml}</td>
        <td class="rscore num">${r.insufficient ? "—" : Math.round(r.score)}</td>
      </tr>`;
    })
    .join("");
  return `<table class="roletable">
    <thead><tr><th>Role</th><th>Phase</th><th></th><th>Fit</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function posLabel(p: Player): string {
  return p.positions.length ? p.positions.join("/") : "—";
}

import { formatPullQuote } from "../domain/evidence.js";

export function renderDossier(p: Player, s: PlayerScores, meta: ReportMeta): string {
  const arch = s.topArchetype ? getArchetype(s.topArchetype.id) : null;
  const family = s.general.hybridWith
    ? `${s.general.family} · ${s.general.hybridWith} hybrid`
    : s.general.family;
  const eyebrow = [family, p.age != null ? `Age ${p.age}` : null, posLabel(p)]
    .filter((b): b is string => !!b)
    .join("  ·  ");
  const pull = formatPullQuote(s);
  const conf = Math.round(s.confidence * 100);
  const stamp = meta.generatedAt.toISOString().slice(0, 16).replace("T", " ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.name)} — The Scouting Post</title>
<style>
  :root{
    --paper:#f4f1ea; --paper-2:#ece7dc; --ink:#17140f; --ink-2:#4a453b; --ink-3:#857e6f;
    --rule:#d8d1c2; --red:#b23b2e; --gold:#a9812f;
    --serif:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;
    --sans:"Helvetica Neue",Arial,sans-serif;
  }
  *{box-sizing:border-box;}
  body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--serif);-webkit-font-smoothing:antialiased;}
  .num{font-variant-numeric:tabular-nums;}
  .wrap{max-width:1120px;margin:0 auto;padding:0 40px 80px;}
  a{color:inherit;}
  .masthead{display:flex;align-items:baseline;justify-content:space-between;border-bottom:3px double var(--ink);padding:22px 0 12px;}
  .logo{font-weight:700;letter-spacing:-.01em;font-size:22px;}
  .logo span{color:var(--red);}
  .masthead nav{font-family:var(--sans);font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-3);}
  .masthead nav a{color:inherit;text-decoration:none;}
  .dateline{font-family:var(--sans);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-3);display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--rule);}

  .hero{display:grid;grid-template-columns:1fr 300px;gap:48px;padding:34px 0 30px;border-bottom:3px double var(--ink);}
  .eyebrow{font-family:var(--sans);font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--red);margin:0 0 14px;}
  h1{font-size:64px;line-height:.98;margin:0;font-weight:700;letter-spacing:-.02em;}
  .standfirst{font-size:19px;line-height:1.5;color:var(--ink-2);margin:20px 0 0;max-width:52ch;font-style:italic;}
  .pull{font-size:21px;line-height:1.35;font-style:italic;border-left:3px solid var(--red);padding:4px 0 4px 22px;margin:22px 0 0;max-width:46ch;}
  .facts{font-family:var(--sans);border-top:2px solid var(--ink);padding-top:12px;align-self:start;}
  .facts dl{display:grid;grid-template-columns:auto 1fr;gap:3px 16px;margin:0;font-size:13.5px;}
  .facts dt{color:var(--ink-3);letter-spacing:.04em;}
  .facts dd{margin:0;text-align:right;font-variant-numeric:tabular-nums;}
  .facts .row{display:contents;}
  .facts dd b{font-weight:600;}

  .cols{display:grid;grid-template-columns:420px 1fr;gap:48px;padding:30px 0;border-bottom:3px double var(--ink);align-items:start;}
  .panel-h{font-family:var(--sans);font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--ink-3);margin:0 0 10px;display:flex;align-items:center;gap:14px;}
  .panel-h::after{content:"";flex:1;height:1px;background:var(--rule);}
  .radar{width:100%;height:auto;display:block;}
  .radar .ring{fill:none;stroke:var(--rule);stroke-width:1;}
  .radar .spoke{stroke:var(--rule);stroke-width:1;}
  .radar .area{fill:rgba(178,59,46,.16);stroke:var(--red);stroke-width:1.75;stroke-linejoin:round;}
  .radar .dot{fill:var(--ink);}
  .radar .dot.hi{fill:var(--red);}
  .radar .rlabel{font-family:var(--sans);font-size:11px;fill:var(--ink-2);letter-spacing:.02em;}
  .radar .rnum{font-weight:700;fill:var(--ink);}

  .idtable{width:100%;border-collapse:collapse;font-family:var(--sans);margin-top:2px;}
  .idtable td{padding:9px 0;border-bottom:1px solid var(--rule);vertical-align:baseline;}
  .idtable .score{font-family:var(--serif);font-size:30px;font-weight:700;letter-spacing:-.03em;width:56px;line-height:1;}
  .idtable .score.lead{color:var(--red);}
  .idtable .aname{font-family:var(--serif);font-size:18px;font-weight:600;}
  .idtable .fam{display:block;font-family:var(--sans);font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3);margin-top:2px;}
  .idtable .badge{text-align:right;width:70px;}
  .stamp{font-family:var(--sans);font-size:10px;letter-spacing:.14em;text-transform:uppercase;}
  .stamp.gold{color:var(--gold);}
  .stamp.ink{color:var(--ink-2);}
  .stamp.faint{color:var(--ink-3);opacity:.7;}

  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0 40px;padding:30px 0;border-bottom:1px solid var(--rule);}
  .acol-h{font-family:var(--sans);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--red);margin:0 0 8px;border-bottom:2px solid var(--ink);padding-bottom:6px;}
  .atable{width:100%;border-collapse:collapse;}
  .atable td{padding:4px 0;border-bottom:1px solid var(--rule);font-size:14px;}
  .alabel{color:var(--ink-2);}
  .aval{width:44px;text-align:right;font-weight:600;padding-right:32px;}
  .aval.ranged{color:var(--ink-2);font-weight:500;}
  .aval.masked{color:var(--ink-3);}
  .abar{width:80px;}
  .pctbar{width:74px;height:6px;background:var(--paper-2);position:relative;display:inline-block;}
  .pctbar i{position:absolute;left:0;top:0;bottom:0;background:var(--ink);}
  .pctbar.hi i{background:var(--red);}
  .pctbar.ranged i{background:repeating-linear-gradient(45deg,var(--ink),var(--ink) 2px,transparent 2px,transparent 4px);}
  .pctbar.ranged.hi i{background:repeating-linear-gradient(45deg,var(--red),var(--red) 2px,transparent 2px,transparent 4px);}
  .pctbar.masked{background:transparent;border-bottom:1px dotted var(--ink-3);height:6px;}

  .roles{padding:30px 0 0;}
  .roletable{width:100%;border-collapse:collapse;font-family:var(--sans);}
  .roletable th{text-align:left;font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-3);font-weight:400;padding:0 0 8px;border-bottom:2px solid var(--ink);}
  .roletable th:last-child{text-align:right;}
  .roletable td{padding:8px 0;border-bottom:1px solid var(--rule);font-size:14px;}
  .rname{font-family:var(--serif);font-size:16px;}
  .tick{color:var(--red);margin-right:8px;}
  .roletable tr.elig .rname{font-weight:600;}
  .rphase{color:var(--ink-3);font-size:12px;letter-spacing:.08em;width:60px;}
  .rbar{width:180px;}
  .rbar .pctbar{width:170px;}
  .rscore{text-align:right;width:44px;font-weight:600;}

  .footline{font-family:var(--sans);font-size:12px;color:var(--ink-3);letter-spacing:.04em;border-top:1px solid var(--rule);margin-top:40px;padding-top:16px;display:flex;justify-content:space-between;}
  .footline a{text-decoration:none;}

  @media(max-width:900px){.hero,.cols{grid-template-columns:1fr;gap:24px;}h1{font-size:46px;}.grid{grid-template-columns:1fr;}}
</style>
</head>
<body>
<div class="wrap">
  <div class="masthead">
    <div class="logo">The <span>Scouting</span> Post</div>
    <nav><a href="${BACK_HREF}">← Back to ledger</a></nav>
  </div>
  <div class="dateline">
    <span>Player dossier</span>
    <span>${esc(meta.datasetLabel)}</span>
    <span>${esc(stamp)}</span>
  </div>

  <section class="hero">
    <div>
      <p class="eyebrow">${esc(eyebrow)}</p>
      <h1>${esc(p.name)}</h1>
      <p class="standfirst">${esc(s.summary)}</p>
      ${pull ? `<p class="pull">${esc(pull)}</p>` : ""}
    </div>
    <div class="facts">
      <dl>
        <div class="row"><dt>Club</dt><dd>${esc(p.club || "—")}</dd></div>
        <div class="row"><dt>Nation</dt><dd>${esc(p.nationality || "—")}</dd></div>
        <div class="row"><dt>Age</dt><dd class="num">${p.age ?? "—"}</dd></div>
        <div class="row"><dt>Height</dt><dd class="num">${esc(formatHeight(p.heightCm))}</dd></div>
        <div class="row"><dt>Foot</dt><dd>${esc(footLabel(p.foot))}</dd></div>
        <div class="row"><dt>Positions</dt><dd>${esc(posLabel(p))}</dd></div>
        <div class="row"><dt>Value</dt><dd class="num">${esc(formatMoney(p.value))}</dd></div>
        <div class="row"><dt>Top archetype</dt><dd><b>${arch ? esc(arch.name) : "Utility"}</b></dd></div>
        <div class="row"><dt>Known</dt><dd class="num">${conf}%</dd></div>
      </dl>
    </div>
  </section>

  <section class="cols">
    <div>
      <p class="panel-h">Profile radar</p>
      ${radar(s) || `<p class="standfirst">Too little known to plot a radar.</p>`}
    </div>
    <div>
      <p class="panel-h">Identity — best-fitting archetypes</p>
      ${identityBand(s)}
    </div>
  </section>

  <p class="panel-h" style="margin-top:30px">Attributes — value & dataset percentile</p>
  ${attributeGrid(p, s)}

  <section class="roles">
    ${roleTable(p, s)}
  </section>

  <div class="footline">
    <span>Source · ${esc(meta.sourceFile)}</span>
    <span><a href="${BACK_HREF}">The Scouting Post — Ledger</a></span>
  </div>
</div>
</body>
</html>`;
}
