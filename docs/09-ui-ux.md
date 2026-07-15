# 09 — Design Code: "The Scouting Post"

This is the visual and editorial law of the product. Read it before writing a single component. The chosen direction is **Broadsheet** (`design/direction-a-broadsheet.html` is the reference artifact — keep it in the repo, it is the source of truth for spacing and tone).

## The idea, in plain words

TFP FM does not look like software. It looks like a football almanac — the kind of printed scouting annual a director of football keeps on the desk, dog-eared and underlined. Cream paper, black ink, one red stamp for the things that matter. When you open a player, you are reading his dossier, not filling in a form.

We chose this on purpose. Every other tool in this niche looks the same: dark chrome, neon bars, a FIFA-style number in a circle. That aesthetic says "video game stats". We want the opposite feeling — that a person who knows football sat down, watched the player, and wrote him up. The data is all there and it is dense, but it is laid out the way a good sports page lays out a match report: a headline that tells you who he is, a standfirst that tells you why he matters, then the detail for people who want it.

The whole product should feel **written, not generated**. That single instinct resolves most design arguments: if something looks like a dashboard widget, it is probably wrong; if it reads like a sentence a scout would say out loud, it is probably right.

## Voice — how the product talks

The copy is the product as much as the numbers are. It is written by a human scout, so it sounds like one.

Write in full sentences. A player's identity is a line of prose — *"A young deep progressor who breaks lines from the base of midfield; elite under pressure, but offers nothing in the air."* — not a stack of tags. Section labels are short and plain: *What kind of footballer is he*, *Where he fits your side*, *Who he plays well next to*. Never *"Analytics Overview"* or *"Insights Panel"*.

Say the true thing plainly, including the unflattering one. If a player is unremarkable, the page says so — *"A squad-filler profile; nothing here stands out against this division."* Honesty is the brand. We never inflate a masked or guessed number into a confident claim; when we are unsure, the prose hedges the way a scout hedges — *"early reports suggest…"*, *"not enough eyes on him yet."*

Numbers are always given a human frame. Not *"Passing: 92nd percentile"* on its own, but *"one of the four best passers in the division."* The percentile is shown next to it for the people who want the figure; the sentence is for everyone.

No emoji, no exclamation marks, no growth-hack copy, no em-dash-and-emoji AI cadence. British-football register throughout (*"on the ball / off the ball", "in the final third", "wins it back"*). Keep it dry and confident.

## Palette

A light, warm, printed palette. This is a **light-first** product; a "night desk" dark variant is explicitly deferred to post-v1 and must not drive v1 decisions.

| Token | Hex | Use |
|---|---|---|
| `paper` | `#F4F1EA` | page background |
| `paper-2` | `#ECE7DC` | inset panels, empty bar troughs |
| `ink` | `#17140F` | primary text, headlines, double rules |
| `ink-2` | `#4A453B` | body text, secondary values |
| `ink-3` | `#857E6F` | labels, captions, dateline |
| `rule` | `#D8D1C2` | hairline dividers, table lines |
| `red` | `#B23B2E` | the single accent — primary archetype, the "stamp", key figures, links on hover |
| `gold` | `#A9812F` | honours only — the *Elite* mark, top-of-class flags |

Discipline: **red is scarce**. It marks the one most important thing in a view (the primary archetype score, a critical squad gap) and nothing else. If two things are red, one of them is wrong. Gold appears even less — only to crown an Elite badge or a division-leading figure.

### Percentile ramp (the one hard rule)

Colour always encodes **percentile within the loaded dataset**, never the raw 1–20 value. In this palette the ramp is ink density plus a red top step, so it reads on paper:

`p0–20` faint ink `#BDB6A6` · `p20–40` `#948C7C` · `p40–60` mid ink `#6B6456` · `p60–80` full ink `#2C281F` · `p80–100` red `#B23B2E`.

Implement as five discrete steps (crisp, print-like), not a smooth gradient. Bars are thin ink rules that fill left-to-right; the top quintile fills red. The number label is always present beside the bar — colour never carries meaning alone.

## Typography

Two families, sharply separated by job.

**Serif (display + editorial):** an old-style serif for player names, headlines, standfirsts and human summary lines — the "written by a person" voice. Stack: `"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif`. Ship a licensed old-style face (e.g. Source Serif 4 or a similar workhorse) as the web font; the stack above is the fallback. Italics carry the standfirst and every generated summary sentence.

**Sans (labels + data + chrome):** a neutral grotesque for everything functional — section labels, table headers, attribute rows, navigation, buttons. Stack: `"Söhne", "Helvetica Neue", Arial, sans-serif` (or Inter if a licence is simpler). Labels are small, uppercase, wide-tracked (`.18–.22em`).

**Numbers:** `font-variant-numeric: tabular-nums` on every element that renders a figure, without exception — tables must align.

Scale (px): display 66 / 52 / 34 · standfirst 20 italic · body 16–17 · data 15 · label 12 uppercase · caption 11 uppercase. Line-height tight on headlines (`.98–1.02`), generous on prose (`1.5–1.6`).

## Layout & grid

The page is built from newspaper furniture, top to bottom:

- **Masthead** — the wordmark (*The Scouting Post*, "Scouting" in red) on the left, primary navigation as small wide-tracked caps on the right, separated from the page by a **double rule** (3px double, ink). The masthead is the app's global nav; it never scrolls away on the chrome level but the page beneath is a document.
- **Dateline** — a thin sans strip under the masthead carrying the active context: save name, dataset (division + player count), confidence. Hairline rule under it. This replaces a heavy "toolbar".
- **Body** — a text grid. Player page: a 1fr / 300px split (story column + facts rail), then a full-width identity band divided by vertical hairlines into archetype columns, then a 300px / 1fr split (radar figure + attribute columns). Content sits in real columns like print, divided by `rule` hairlines rather than boxed in cards.

Cards are used sparingly and, when used, are defined by a **rule and a label**, not a filled rounded box with a shadow. Think ruled sections of a page, not Material cards. No drop shadows anywhere; depth comes from rules and whitespace. Corner radius: 0 (paper has square corners) except interactive controls which may take 2px.

Spacing scale (px): 4 · 8 · 12 · 20 · 30 · 48 · 80. Column gutter 40–48. Generous top/bottom padding on sections (30–48) is what makes it feel like an annual rather than a spreadsheet.

## Data rendered as print

- **Attribute tables** are set as newspaper columns (`column-count: 2` within a group region), each group under a sans header with a 2px ink underline. Rows separated by hairlines. Value right-aligned and bold; a thin percentile ink bar sits to its left.
- **Ranged values** (`11–13`, scout uncertainty) render in italic inside a lightly **hatched pill** (45° 6% ink hatch) — visibly "not a firm number". **Masked values** render as `?` at 50% opacity in `ink-3`. These two treatments are mandatory everywhere a value appears.
- **Standout facts** become **pull-quotes**: large serif italic, red left-border, e.g. *"In this division he is a 92nd-percentile passer. Only four midfielders keep the ball better under pressure."* One per page maximum — it is the editorial hook.
- **The radar** is drawn as a fine engraving: hairline octagon grid, ink axis labels in small caps, the player's shape as a thin red outline with a 16% red fill. It sits in a `figure` with a caption ("Percentile vs midfielders in this database"), like a printed diagram. No glossy gradients.
- **The pitch** (squad depth) is drawn as a printed tactics-board: ink lines on paper, slot labels in caps, names in serif, the depth status shown by a small red/gold/ink stamp rather than a coloured fill.

## Components (the inventory to build)

Each is a real, reusable component; build once.

- `Masthead` / `Dateline` — global chrome described above.
- `Headline` — player/section title in display serif with an eyebrow (sans caps) and optional standfirst (serif italic).
- `FactsRail` — a `<dl>` of club/nation/positions/value/wage/contract/height, sans, ink-2, tabular figures, right-aligned values, a 2px ink top rule.
- `ArchetypeColumns` — the identity band: primary / secondary / also, divided by vertical hairlines, each with rank label, large score (primary in red), name in serif, the *Elite/Strong/Notable* stamp in gold caps, and a one-line italic description. Clicking a column opens its contribution breakdown.
- `SummaryLine` — the generated human sentence (doc 06 §10), serif italic, sitting under the headline. This is the product's signature; treat it as headline furniture, not a caption. The eyebrow above the name carries the **general archetype** (doc 06 §9) in sans caps.
- `InkBar` — the percentile bar (five-step, top step red). Always paired with a number.
- `RangedPill` / `MaskedMark` — the honesty treatments.
- `AttrColumns` — grouped attribute tables set in print columns.
- `PullQuote` — the single editorial highlight.
- `RadarFigure` — engraved SVG radar + caption.
- `RoleTable` / `RolePairGrid` — role and IP×OOP pair scores as ruled tables (not a neon heatmap; use ink-density cells with the figure printed on top).
- `Stamp` — small caps status marks (Elite gold, Strong ink, Critical red) used for badges and squad depth.
- `Footline` — the sans action row (Add to shortlist · Compare · Find similar · Find upgrades over him) and the "Analysed with TFP FM" mark, above a hairline.

Only these plus shadcn primitives (restyled to the palette — no default rounded/shadowed look). No second component library.

## Screens (named like sections of the paper)

- **The Front Page** (dataset dashboard) — lead story is the most interesting player in the set (biggest bargain, youngest Elite), written up with a headline and summary line, then a column of shorter "briefs" (highlights), and the standing "Team Report" box if a reference squad is set. Every brief links into the Scout ledger with a filter applied.
- **The Ledger** (scout) — the player list as a broadsheet results table: dense, ruled rows, serif names, sans data, the percentile ink bars in attribute columns. The filter bar reads as a sentence being composed. This is where the density lives.
- **The Dossier** (player page) — the reference mock. Headline, summary line, facts rail, identity band, radar figure, attribute columns, one pull-quote, role tables, and — when a reference squad exists — the **"Where he fits your side"** section (doc 08 §9).
- **The Team Report** (squad) — the printed tactics-board depth chart, the age-and-quality plot drawn as a scatter engraving, the squad DNA as a ruled bar chart, and the gaps written as short prose briefs each ending in a "Scout for this" link.
- **The Watch List** (shortlists) — a ruled list with a note column in the margin (like annotations), status set in small caps, and score deltas since a player was added shown as small red/ink figures.

## Motion & feel

Paper does not bounce. Transitions are quick and flat: 120–180ms opacity/position fades, no springy easing, no scale-pop on cards, no skeleton shimmer (use a quiet "setting the page…" line). Hover states are a colour shift to ink/red or an underline, not a lift. The one permitted flourish is the pull-quote and headline fading in on load, once, like a page settling.

## Accessibility & honesty guarantees

Contrast: ink on paper clears WCAG AA comfortably; never drop body text below `ink-2` on `paper`. Colour is always redundant with a number or a label — the percentile ramp is decorative reinforcement, the figure is the truth. The radar and every chart carry an `aria-label` summarising the top three values as a sentence. Ranged and masked values are distinguishable without colour (hatch texture, the `?` glyph). Focus-visible states are a 2px ink outline. Everything is keyboard-reachable; the Ledger supports `j/k` row movement and `s` to shortlist the focused row.

## What this design forbids

No neon-on-black. No circular "overall" badges. No filled rounded cards with shadows. No three-up "feature grids". No bullet-point lists inside the product surface (docs may use them; the app speaks in sentences and ruled tables). No emoji. No decorative gradients. If a screen starts to look like a generic analytics SaaS, it has left the brief — return to the almanac.
