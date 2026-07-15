# 18 — Visual Identity & Form Language (the premium coat of paint)

Two workstreams: (A) one form language for every control in the app, (B) a generated
image system — archetype art, icons, site furniture — in the Broadsheet voice.
Read with doc 07 (design system), doc 15 (premium overhaul; A1 fonts and D-phase
Dossier recomposition are prerequisites where noted).

**Who implements this:** an implementing agent plus an image-generation model.
Workstream A is pure CSS/TSX. Workstream B has a hard gate: **one style-proof image
approved by the owner before generating the full set.**

---

## A. One form language

### A1. The problem

Today there are at least two control designs:

- `.auth-form input` — 18px serif, 10×12 padding (`app/globals.css:55`);
- `.field input, .field select` — 13px sans, 6×8 padding (`app/globals.css:78`);
- native `<select>` chrome leaks through on Ledger filters, Assistant controls
  (`components/ScoutDesk.tsx`, `components/CompareView.tsx`,
  `components/assistant/AssistantControls.tsx`), file inputs on Upload are browser
  default.

### A2. The spec — one `.field` control

Every text input, number input, search box and select in the app renders as the same
control. Tokens from doc 07 (`--paper #F5F1E6`, `--ink #2C281F`, `--rule`, `--red
#B23B2E`, `--sans`, `--serif`).

```
.control          font: 13px var(--sans); color: var(--ink);
                  background: var(--paper); border: 1px solid var(--rule);
                  border-radius: 0; padding: 7px 10px; line-height: 1.3;
.control:focus    outline: none; border-color: var(--ink);
                  box-shadow: 0 1px 0 0 var(--red);        /* the ink-bar */
.control:disabled color: var(--ink-3); background: color-mix(paper, rule 12%);
.control[aria-invalid="true"]  border-color: var(--red);
select.control    appearance: none; custom caret: 8px ink chevron as inline
                  background-image (SVG data-URI), padding-right: 28px;
label (kicker)    11px var(--sans) uppercase letter-spacing .08em color var(--ink-2)
```

Auth forms keep their larger size via a modifier (`.control--lg`: 16px serif, 10×12
padding) — same borders, same focus, same caret. Search boxes keep `min-width:200px`
via `.control--search`. The upload drop-zone and file button are restyled to match
(dashed `--rule` border, `.control` typography); the native file input stays visually
hidden behind a styled label.

### A3. Execution

1. Add the `.control` block to `globals.css`; keep `.field input/select` as aliases
   during migration, delete after.
2. Sweep: `rg "<(input|select|textarea)" app components` — every hit gets
   `className="control"` (+ modifier). Files known to contain controls: `Upload*`,
   `ScoutDesk`, `CompareView`, `AssistantControls`, `SquadDesk`, `login` page,
   `LocalMigrationPrompt`.
3. E2E selectors use roles/placeholders, so no test churn expected; run `pnpm check`
   + Playwright smoke after the sweep.

**Acceptance:** screenshot pass over Upload, Scout, Compare, Assistant, Squad, Login —
no native browser chrome visible, one control family everywhere, focus shows the red
ink-bar.

---

## B. Generated imagery

### B1. Style contract (every image, no exceptions)

Broadsheet engraving: vintage newspaper woodcut/copper-engraving illustration,
hatching and cross-hatching, single ink `#2C281F` on paper `#F5F1E6`, one restrained
accent in `--red #B23B2E` (a sash, a ball, a pennant — one element max), no
gradients, no photorealism, no modern kit sponsors, no text inside the image.
Composition calm and central, generous paper margin.

Base prompt template:

> "Vintage newspaper engraving illustration, woodcut cross-hatching style, dark
> sepia-black ink (#2C281F) on aged cream paper (#F5F1E6), single muted red accent
> (#B23B2E) on [ACCENT ELEMENT]. [SUBJECT]. No text, no borders, centered
> composition, generous margins, 1930s sporting-print aesthetic."

**Gate:** generate ONE image first (suggested: Tempo Dictator), show the owner,
iterate on the prompt until approved, then batch the rest with the locked template.

### B2. Archetype art — 34 pieces

One 3:4 portrait-format artwork per archetype, `public/art/archetypes/{id}.png`
(1024×1536 source, served via `next/image`). Subject = the family motif + the
archetype's action. Family motifs (keep consistent within a family):

| Family | Motif | Archetypes (ids) |
|---|---|---|
| Progressor | metronome / compass rose | deepProgressor, tempoDictator, pressResister |
| Creator | quill and key | chanceArchitect, wideCreator, deadBallSpecialist, linkForward, maverick |
| Carrier | galloping horse | lineBreaker, touchlineIsolator |
| Runner | hare / greyhound | roadrunner, transitionWeapon, runnerInBehind, overlappingOutlet |
| Finisher | arrow in the bullseye | penaltyBoxPredator, completeFinisher, secondPhaseThreat, longRangeMarksman, cuttingInsideFinisher |
| Focal Point | lighthouse / anvil | aerialMonster, targetFulcrum |
| Destroyer | shield and axe | duelWinner, readerOfTheGame, recoverySprinter, destroyer, manMarker, anchor |
| Engine | locomotive / piston | pressMachine, perpetualMotion, athleticSpecimen |
| General | standard-bearer's banner | leaderOrganizer, warrior |
| GK families | gauntlet / wall / watchtower | shotStoppingWall, modernDistributor, boxCommander, sweeperKeeper |

Per-archetype subject comes from its registry blurb
(`src/domain/archetypes/registry.ts:52–105`), e.g. tempoDictator = "sets the rhythm"
→ a conductor-figure with a metronome. Write all 34 subjects into
`public/art/archetypes/manifest.json` (`{id, subject, accent}`) so regeneration is
reproducible.

### B3. Archetype icons — 34 pictograms

Small line pictograms for Ledger badges, Compare and archetype columns: 24×24 grid,
single ink stroke, no fill, no red. These are **drawn SVGs, not generated bitmaps**
(bitmaps die at 16px). One `components/kit/ArchetypeIcon.tsx` with an inline SVG map
keyed by archetype id; family motif simplified to its silhouette. Generate a
reference sheet image first if helpful, but the shipped asset is hand-traced SVG
paths.

### B4. Integration points

1. **Dossier identity band** (doc 15 D1): archetype art of the player's top archetype,
   right-aligned, ~180px, engraving sits on the paper with a thin `--rule` frame.
2. **Ledger / ArchetypeColumns:** `ArchetypeIcon` at 16px before the archetype name.
3. **Compare:** icon in column headers.
4. **Empty states** (Upload before data, empty Watch, empty Squad): one shared
   engraving (`public/art/empty-desk.png` — an empty scout's desk with a lamp).
5. **Front Page masthead vignette:** small ornamental engraving centered above the
   wordmark (`public/art/masthead-vignette.png`, a football flanked by laurels).
6. **OG card** `public/og.png` 1200×630: masthead wordmark + vignette on paper.
   Wire via `metadata.openGraph.images` in `app/layout.tsx`.
7. **Favicon/logo:** `app/icon.svg` — "TFP" monogram in the serif, ink on paper,
   red full stop.
8. **404 / error pages:** `public/art/lost-ball.png` (a ball in tall grass), used by
   `app/not-found.tsx` and `app/error.tsx`.

Loading discipline: all art through `next/image` with explicit width/height (no
layout shift), `priority` only on the Dossier band, everything else lazy.

### B5. Fonts (prerequisite from doc 15 A1, if not yet landed)

`next/font` self-hosted Source Serif 4 + Inter wired to `--serif`/`--sans`;
`font-variant-numeric: tabular-nums` on all numeric table cells.

### B6. Sequencing

| # | Step | Gate |
|---|---|---|
| 1 | A form-language sweep | screenshots, `pnpm check` |
| 2 | B1 style proof (1 image) | **owner approval — hard stop** |
| 3 | B2 batch 34 arts + manifest | spot-check 5, consistency |
| 4 | B4.1–.3 Dossier band + icons | screenshots |
| 5 | B4.4–.8 furniture (OG, favicon, empty, 404) | link-preview check |
| 6 | B3 SVG icon set | render at 16px, legible |

Repo hygiene: PNGs are committed (no runtime generation); keep each ≤ 400KB
(`sips`/`squoosh` to compress); manifest.json documents the prompt used per image.
