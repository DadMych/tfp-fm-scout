# 01 — Product Vision

## One-liner

The scouting brain FM26 doesn't ship with: upload your save's player export, get archetype-level understanding of every player and surgical analysis of your squad.

## The gap we exploit

FM26 shipped with the biggest tactical overhaul in series history (In Possession / Out of Possession roles) **and simultaneously removed the native `Ctrl+P` data export**. The tooling ecosystem is in flux:

1. **In-game tools lag the meta.** FM26's own star ratings are relative to your squad and colored by scout knowledge. There is no in-game way to ask "who in my shortlist is the best *Deep Progressor* regardless of position label?"
2. **Community tooling is FM24-shaped.** Existing analyzers (FM-Dash, spreadsheet workflows) were built around FM24's role/duty system and FM24's HTML export format. Nobody has rebuilt analysis natively around IP/OOP.
3. **Export is solved, analysis is not.** The community BepInEx plugin (*FM26 Player Export* by vinteset) restored one-hotkey CSV + HTML export. That means a reliable data pipe into a web app exists — but the apps consuming it are generic tables with FIFA-style overall ratings.

We win by being **FM26-native** (IP/OOP role engine, current attribute layout) and by introducing **archetypes** — a layer of analysis nobody in this niche has.

## Personas

| Persona | What they want | Killer feature for them |
|---|---|---|
| **The Journeyman** — plays 20+ seasons, lower leagues | Find undervalued players who fit a style, not a star rating | Archetype search + upgrade finder over full database exports |
| **The Tactician** — builds systems first, buys players second | Know which players can execute a specific IP/OOP role pair | Role engine + depth chart per tactical slot |
| **The Director of Football roleplayer** | Long-horizon squad planning: age curves, succession, contracts | Squad analytics dashboard + shortlist snapshots across seasons |
| **The Content Creator** | Shareable, beautiful visuals of players/squads | Player cards, radar charts, shareable read-only dataset links |

## Competitor teardown

| Tool | Model | Strengths | Where we beat it |
|---|---|---|---|
| **Genie Scout** (FM Scout) | Desktop app, reads save file directly | Sees hidden attributes, CA/PA | Windows-only desktop; exposes hidden values many players consider cheating; no squad-level analytics; not a web product |
| **FM-Dash** | Web, HTML upload | Handles 50MB+ exports, wonderkid/free-agent finders, nice UI | FM24-era roles; FIFA-style "overall" flattens players; no archetypes; no IP/OOP awareness |
| **FMRTE** | Desktop editor | Real-time save editing | It's an editor, not a scout; cheating-adjacent |
| **Spreadsheet workflows** (YouTube meta) | Manual view → convert → Sheets | Fully customizable | Hours of manual labor per import; no persistence, no cross-save reuse |
| **footballgpt / content sites** | Static guides | Role knowledge | Not data tools at all |

**Positioning:** the honesty of the spreadsheet workflow (only visible attributes, no save-file spelunking), the convenience of FM-Dash (upload and go), and an analytical layer neither has.

## Product principles

1. **No cheating.** We only consume what the player's scouts can see in-game. Masked/range attributes are handled honestly (doc 03). We never read save files for hidden attributes or PA. This is a *feature*: results are usable in "no-editor" saves and streams.
2. **Archetypes over overalls.** A single 0–100 "overall" destroys information. A player is a *profile*: strong archetype fits, weak ones, and role ratings. The UI always leads with "what kind of player is this."
3. **Relative to *your* world.** All percentile math is computed against the uploaded dataset (the user's game world / division), because a 14 Passing means something different in League Two vs the Champions League.
4. **Explainable numbers.** Every score can be expanded to show exactly which attributes contributed what. No black boxes — users must be able to argue with us.
5. **Fast enough to be a habit.** Upload → first insight in under 30 seconds for a squad export, under 2 minutes for a 20k-player database export.

## Non-goals (v1)

- No match/performance statistics analysis (goals, xG from the save). Attribute-based only; the export pipeline for match stats is a different beast. Revisit in v2.
- No tactic builder or match-engine simulation.
- No FM Mobile / FM Touch / console support.
- No save-file parsing.
- No social features beyond read-only share links.
- No mobile-first design; desktop browser is the primary target (FM players are at a desk), responsive down to tablet.

## Success metrics for v1

- A user with the export plugin installed gets from "file on disk" to "squad depth chart on screen" in ≤ 3 clicks.
- Archetype scores for a known elite player pass the sniff test of an experienced FM player (validated with the golden-fixture players in doc 06 §7).
- Full-database export (≥ 20,000 rows, up to **80 MB** per doc 03) imports without timeout or data loss. The ~50 MB case is the performance target, not the hard cap.
- Re-uploading a later-season export of the same save preserves shortlists and shows attribute deltas.
