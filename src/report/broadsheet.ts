/**
 * Broadsheet scout report (docs/09-ui-ux.md).
 *
 * Pure renderer: (players + scores + meta) -> a self-contained HTML string in the
 * "Scouting Post" almanac style. No I/O here; the CLI (scripts/report.ts) reads the
 * export, runs the engine, and writes the file. The layout implements two of doc 09's
 * named screens as one printable page: the Front Page lead story and the Ledger.
 */

import type { Player } from "../domain/player.js";
import { playerGroups, type PositionGroup } from "../domain/positions.js";
import type { PlayerScores } from "../domain/scoring/dataset.js";
import { getArchetype } from "../domain/archetypes/registry.js";
import { getRole } from "../domain/roles/registry.js";
import { pickBargain, pickLead, posLabel, standouts } from "../domain/front-page.js";
import { formatPullQuote } from "../domain/evidence.js";
import { esc, formatMoney } from "./format.js";

export interface ReportMeta {
  readonly datasetLabel: string;
  readonly sourceFile: string;
  readonly generatedAt: Date;
  readonly maskedAttributeShare: number;
}

/** Optional per-player dossier href; when provided the Ledger links each name to its page. */
export type HrefFor = (p: Player) => string;

type LedgerGroup = PositionGroup | "Unlisted";

const GROUP_ORDER: readonly LedgerGroup[] = [
  "GK",
  "CB",
  "FB/WB",
  "DM/CM",
  "AM/W",
  "ST",
  "Unlisted",
];

const GROUP_TITLE: Record<LedgerGroup, string> = {
  GK: "Goalkeepers",
  CB: "Centre-backs",
  "FB/WB": "Full-backs & wing-backs",
  "DM/CM": "Defensive & central midfield",
  "AM/W": "Attacking midfield & wide",
  ST: "Forwards",
  Unlisted: "Position not listed",
};

function primaryGroup(p: Player): LedgerGroup {
  return playerGroups(p.positions)[0] ?? "Unlisted";
}

function inkBar(pct: number): string {
  const w = Math.max(0, Math.min(100, Math.round(pct)));
  const hi = pct >= 80 ? " hi" : "";
  return `<span class="pctbar${hi}"><i style="width:${w}%"></i></span>`;
}

function stamp(badge: string | null): string {
  if (!badge) return "";
  const cls = badge === "Elite" ? "gold" : "ink";
  return `<span class="stamp ${cls}">— ${esc(badge)} —</span>`;
}

function factsLine(p: Player): string {
  const bits = [
    p.age != null ? `Age ${p.age}` : null,
    posLabel(p),
    p.club || null,
    p.value != null ? formatMoney(p.value) : null,
  ].filter((b): b is string => !!b);
  return esc(bits.join("  ·  "));
}

function entry(p: Player, s: PlayerScores, href: string | null): string {
  const arch = s.topArchetype ? getArchetype(s.topArchetype.id) : null;
  const archScore = s.topArchetype ? Math.round(s.topArchetype.score) : null;
  const badge = s.topArchetype?.badge ?? null;
  const lead = badge === "Elite" ? " lead" : "";
  const role = s.bestRole ? getRole(s.bestRole.id) : null;
  const roleScore = s.bestRole ? Math.round(s.bestRole.score) : null;
  const conf = Math.round(s.confidence * 100);

  const so = standouts(s)
    .map(
      (x) =>
        `<span class="so"><span class="so-l">${esc(x.label)}</span>${inkBar(x.pct)}<span class="num">${Math.round(x.pct)}</span></span>`,
    )
    .join("");

  return `
  <article class="entry">
    <div class="entry-main">
      <p class="eyebrow">${esc(s.general.family)}</p>
      <h2 class="pname">${href ? `<a href="${esc(href)}">${esc(p.name)}</a>` : esc(p.name)}</h2>
      <p class="summary">${esc(s.summary)}</p>
      <div class="standouts">${so}</div>
    </div>
    <div class="entry-side">
      <div class="facts-line num">${factsLine(p)}</div>
      <div class="arch-block">
        <div class="rank">Primary identity</div>
        <div class="arch-line">
          <span class="score${lead} num">${archScore ?? "—"}</span>
          <span class="aname">${arch ? esc(arch.name) : "Utility"}</span>
        </div>
        ${stamp(badge)}
      </div>
      <div class="role-line">Best role · <b>${role ? esc(role.name) : "—"}</b> <span class="num">${roleScore ?? ""}</span> · <span class="num">${conf}%</span> known</div>
    </div>
  </article>`;
}

function bargainLine(
  b: { p: Player; s: PlayerScores },
  href: string | null,
): string {
  const arch = b.s.topArchetype ? getArchetype(b.s.topArchetype.id) : null;
  const score = b.s.topArchetype ? Math.round(b.s.topArchetype.score) : null;
  const name = href ? `<a href="${esc(href)}">${esc(b.p.name)}</a>` : esc(b.p.name);
  return `<div class="valuepick">
    <span class="vp-label">Value pick</span>
    <span class="vp-body">${name} — <b>${arch ? esc(arch.name) : "Utility"}</b> <span class="num">${score ?? ""}</span> at <span class="num">${esc(formatMoney(b.p.value))}</span>${b.p.age != null ? `, age <span class="num">${b.p.age}</span>` : ""}</span>
  </div>`;
}

function leadStory(lead: { p: Player; s: PlayerScores }, href: string | null): string {
  const { p, s } = lead;
  const arch = s.topArchetype ? getArchetype(s.topArchetype.id) : null;
  const eyebrow = [s.general.family, p.age != null ? `Age ${p.age}` : null, posLabel(p)]
    .filter((b): b is string => !!b)
    .join("  ·  ");
  const pull = formatPullQuote(s);
  return `
  <section class="hero">
    <div>
      <p class="eyebrow">${esc(eyebrow)}</p>
      <h1>${href ? `<a href="${esc(href)}">${esc(p.name)}</a>` : esc(p.name)}</h1>
      <p class="standfirst">${esc(s.summary)}</p>
      ${pull ? `<p class="pull">${esc(pull)}</p>` : ""}
    </div>
    <div class="facts">
      <dl>
        <div class="row"><dt>Club</dt><dd>${esc(p.club || "—")}</dd></div>
        <div class="row"><dt>Nation</dt><dd>${esc(p.nationality || "—")}</dd></div>
        <div class="row"><dt>Value</dt><dd class="num">${esc(formatMoney(p.value))}</dd></div>
        <div class="row"><dt>Positions</dt><dd>${esc(posLabel(p))}</dd></div>
        <div class="row"><dt>Top archetype</dt><dd><b>${arch ? esc(arch.name) : "Utility"}</b></dd></div>
        <div class="row"><dt>Score</dt><dd class="num">${s.topArchetype ? Math.round(s.topArchetype.score) : "—"}</dd></div>
        <div class="row"><dt>Known</dt><dd class="num">${Math.round(s.confidence * 100)}%</dd></div>
      </dl>
    </div>
  </section>`;
}

export function renderReport(
  players: readonly Player[],
  scores: readonly PlayerScores[],
  meta: ReportMeta,
  hrefFor?: HrefFor,
): string {
  const byId = new Map(scores.map((s) => [s.playerId, s]));
  const rows = players
    .map((p) => ({ p, s: byId.get(p.id)! }))
    .filter((r) => r.s)
    .sort((a, b) => (b.s.topArchetype?.score ?? 0) - (a.s.topArchetype?.score ?? 0));

  const lead = pickLead(rows);
  const bargain = pickBargain(rows);
  const sections: string[] = [];
  for (const g of GROUP_ORDER) {
    const inGroup = rows.filter((r) => primaryGroup(r.p) === g);
    if (!inGroup.length) continue;
    const entries = inGroup
      .map((r) => entry(r.p, r.s, hrefFor ? hrefFor(r.p) : null))
      .join("\n");
    sections.push(
      `<p class="section-label">${esc(GROUP_TITLE[g])} · ${inGroup.length}</p>\n${entries}`,
    );
  }
  const ledger = sections.join("\n");
  const dateline = `${esc(meta.datasetLabel)} · ${rows.length} players · ${Math.round(meta.maskedAttributeShare * 100)}% masked`;
  const stamp = meta.generatedAt.toISOString().slice(0, 16).replace("T", " ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Scouting Post — ${esc(meta.datasetLabel)}</title>
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
  .masthead{display:flex;align-items:baseline;justify-content:space-between;border-bottom:3px double var(--ink);padding:22px 0 12px;}
  .logo{font-weight:700;letter-spacing:-.01em;font-size:22px;}
  .logo span{color:var(--red);}
  .masthead nav{font-family:var(--sans);font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-3);display:flex;gap:26px;}
  .masthead nav a{color:inherit;text-decoration:none;}
  .masthead nav a.on{color:var(--ink);border-bottom:2px solid var(--red);padding-bottom:4px;}
  .dateline{font-family:var(--sans);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-3);display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--rule);}

  .hero{display:grid;grid-template-columns:1fr 300px;gap:48px;padding:34px 0 30px;border-bottom:3px double var(--ink);}
  .eyebrow{font-family:var(--sans);font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--red);margin:0 0 14px;}
  h1{font-size:66px;line-height:.98;margin:0;font-weight:700;letter-spacing:-.02em;}
  .standfirst{font-size:20px;line-height:1.5;color:var(--ink-2);margin:20px 0 0;max-width:46ch;font-style:italic;}
  .pull{font-size:22px;line-height:1.35;font-style:italic;color:var(--ink);border-left:3px solid var(--red);padding:4px 0 4px 22px;margin:22px 0 0;max-width:44ch;}
  .facts{font-family:var(--sans);border-top:2px solid var(--ink);padding-top:12px;align-self:start;}
  .facts dl{display:grid;grid-template-columns:auto 1fr;gap:2px 16px;margin:0;font-size:13.5px;}
  .facts dt{color:var(--ink-3);letter-spacing:.04em;}
  .facts dd{margin:0;text-align:right;font-variant-numeric:tabular-nums;}
  .facts .row{display:contents;}
  .facts dd b{font-weight:600;}

  .valuepick{display:flex;align-items:baseline;gap:16px;margin-top:18px;padding:12px 0 0;border-top:1px solid var(--rule);font-family:var(--sans);font-size:14px;}
  .valuepick .vp-label{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--red);white-space:nowrap;}
  .valuepick .vp-body{color:var(--ink-2);}
  .valuepick .vp-body b{color:var(--ink);font-weight:600;}
  .valuepick a{color:var(--ink);text-decoration:none;border-bottom:1px solid var(--red);}

  .ledger-head{font-family:var(--serif);font-size:20px;font-style:italic;color:var(--ink);margin:36px 0 0;padding-bottom:10px;border-bottom:3px double var(--ink);}
  .section-label{font-family:var(--sans);font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--ink-3);margin:34px 0 4px;display:flex;align-items:center;gap:14px;}
  .section-label::after{content:"";flex:1;height:1px;background:var(--rule);}

  .entry{display:grid;grid-template-columns:1fr 300px;gap:48px;padding:24px 0;border-bottom:1px solid var(--rule);}
  .pname{font-size:30px;line-height:1.02;margin:2px 0 0;font-weight:700;letter-spacing:-.01em;}
  .pname a,h1 a{color:inherit;text-decoration:none;background-image:linear-gradient(var(--red),var(--red));background-size:0% 2px;background-repeat:no-repeat;background-position:0 100%;transition:background-size .18s ease;}
  .pname a:hover,h1 a:hover{background-size:100% 2px;}
  .summary{font-size:16px;line-height:1.5;color:var(--ink-2);margin:10px 0 0;font-style:italic;max-width:60ch;}
  .standouts{display:flex;flex-wrap:wrap;gap:6px 22px;margin-top:14px;}
  .so{display:inline-flex;align-items:center;gap:8px;font-family:var(--sans);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);}
  .so-l{min-width:0;}
  .pctbar{width:44px;height:6px;background:var(--paper-2);position:relative;display:inline-block;}
  .pctbar i{position:absolute;left:0;top:0;bottom:0;background:var(--ink);}
  .pctbar.hi i{background:var(--red);}
  .so .num{color:var(--ink-2);font-size:12px;}

  .entry-side{font-family:var(--sans);}
  .facts-line{font-size:12.5px;letter-spacing:.04em;color:var(--ink-2);border-top:2px solid var(--ink);padding-top:10px;}
  .arch-block{margin-top:14px;}
  .rank{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-3);}
  .arch-line{display:flex;align-items:baseline;gap:10px;margin-top:4px;}
  .score{font-size:38px;font-weight:700;letter-spacing:-.03em;line-height:1;color:var(--ink);}
  .score.lead{color:var(--red);}
  .aname{font-family:var(--serif);font-size:19px;font-weight:600;}
  .stamp{display:inline-block;font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;margin-top:6px;}
  .stamp.gold{color:var(--gold);}
  .stamp.ink{color:var(--ink-3);}
  .role-line{font-size:12.5px;color:var(--ink-2);margin-top:12px;letter-spacing:.02em;}
  .role-line b{font-weight:600;color:var(--ink);}

  .footline{font-family:var(--sans);font-size:12px;color:var(--ink-3);letter-spacing:.04em;border-top:1px solid var(--rule);margin-top:40px;padding-top:16px;display:flex;justify-content:space-between;}

  @media(max-width:820px){.hero,.entry{grid-template-columns:1fr;gap:20px;}h1{font-size:48px;}}
</style>
</head>
<body>
<div class="wrap">
  <div class="masthead">
    <div class="logo">The <span>Scouting</span> Post</div>
    <nav><a href="#" class="on">Scout</a><a href="#lead">Front Page</a></nav>
  </div>
  <div class="dateline">
    <span>Scout ledger</span>
    <span>${dateline}</span>
    <span>${esc(stamp)}</span>
  </div>

  <a id="lead"></a>
  ${lead ? leadStory(lead, hrefFor ? hrefFor(lead.p) : null) : `<p class="standfirst">No players to report.</p>`}
  ${bargain ? bargainLine(bargain, hrefFor ? hrefFor(bargain.p) : null) : ""}

  <p class="ledger-head">The Ledger — by position, strongest first</p>
  ${ledger}

  <div class="footline">
    <span>Source · ${esc(meta.sourceFile)}</span>
    <span>Analysed with TFP FM</span>
  </div>
</div>
</body>
</html>`;
}
