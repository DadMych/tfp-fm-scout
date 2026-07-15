# TFP FM — The FM26 Scouting Companion (Web)

**TFP FM** is a hosted web companion for Football Manager 2026. Users export player data from their FM26 save (custom view + the community export plugin), upload the file to our site, and get:

- **Player Archetypes** — a proprietary, position-agnostic classification of *what kind of footballer* a player actually is (e.g. Deep Progressor, Press Machine, Penalty-Box Predator), scored 0–100 against the uploaded dataset.
- **FM26-native role ratings** — computed for the new In Possession / Out of Possession role system, not the dead FM24 duty system.
- **Squad analytics** — depth charts per formation slot, age-profile curve, squad DNA, gap analysis, succession planning.
- **Breakthrough scouting** — upgrade finder, similar-player search, wonderkid radar, shortlists that persist across re-uploads of the same save.

It is deployed as a multi-user web app: uploads are parsed server-side, datasets are stored per user, and analysis screens are served from our infrastructure.

> **Current stage (July 2026):** the shipped build is **local-first by default** (browser
> parse + IndexedDB). **Hosted accounts** work when `DATABASE_URL` and `AUTH_SECRET` are
> set — datasets and watch lists persist per user on Neon. Vercel deploy is the remaining
> P4 step. See [doc 14](docs/14-state-of-the-product.md), [doc 15](docs/15-premium-overhaul.md),
> and [doc 16](docs/16-hosted-deployment.md).

**Support:** [buymeacoffee.com/tfpdev](https://buymeacoffee.com/tfpdev) · **Site:** [tfpdev.com](https://tfpdev.com)

## Documentation index (read in order)

| # | Doc | What it specifies |
|---|-----|-------------------|
| 01 | [Product Vision](docs/01-product-vision.md) | Why we win, personas, competitor teardown, non-goals |
| 02 | [Architecture](docs/02-architecture.md) | Stack, deployment, upload pipeline, storage, multi-tenancy |
| 03 | [Data Import](docs/03-data-import.md) | How data leaves FM26, our view preset, HTML/CSV parsing spec |
| 04 | [Data Model](docs/04-data-model.md) | Entities, attribute registry, derived metrics, DB schema |
| 05 | [Role Engine](docs/05-role-engine.md) | Scoring FM26 IP/OOP roles from attributes |
| 06 | [Archetype System](docs/06-archetypes.md) | **The flagship.** Fine + general archetypes, weights/gates, the human summary line |
| 07 | [Squad Analytics](docs/07-squad-analytics.md) | Depth, age curve, DNA, gaps, the reference squad, partnerships & chemistry |
| 08 | [Scouting Tools](docs/08-scouting.md) | Filters, search, compare, upgrade finder, shortlist, "where he fits your side" |
| 09 | [Design Code](docs/09-ui-ux.md) | **Chosen direction: Broadsheet.** Voice, palette, type, components, screens |
| 10 | [Roadmap](docs/10-roadmap.md) | Milestones with verifiable acceptance criteria |
| 11 | [Assistant Analytics](docs/11-assistant-analytics.md) | Deterministic insight engine: rules, XI solver, packages |
| 12 | [Assistant UX Overhaul](docs/12-assistant-ux-overhaul.md) | Dedup, packages v3, UI restructure. **Amends 11; wins on conflict** |
| 13 | [Sporting Director](docs/13-sporting-director.md) | Sales, succession, health index, packages v4. **Amends 12's packages** |
| 14 | [State of the Product](docs/14-state-of-the-product.md) | July 2026 audit: maturity scorecard, defect catalog, doc-drift resolutions |
| 15 | [Premium Overhaul](docs/15-premium-overhaul.md) | The plan from prototype to flagship: phases P0–P4 with acceptance criteria |
| 16 | [Hosted Deployment](docs/16-hosted-deployment.md) | P4 infrastructure pinned: Neon Postgres, Auth.js (password + Google), per-user schema, Vercel. **Amends 02's auth/deploy lines** |
| — | [Broadsheet Finish](docs/15-broadsheet-finish.md) | Supplementary UI depth plan (overlaps doc 15 P1) |
| — | [Engine Truth & Platform](docs/16-engine-truth-and-platform.md) | Supplementary engine/infra depth (overlaps doc 15 P2–P3) |

The visual language is **Broadsheet** — a football-almanac look, not a SaaS dashboard. The reference artifact is `design/direction-a-broadsheet.html` (open it in a browser); doc 09 is its written law.

## Rules for implementing agents

1. **Do not invent attributes or roles.** The canonical attribute registry lives in doc 04; the canonical role list in doc 05; the canonical archetype table in doc 06. If code and docs disagree, the docs win.
2. **All scoring must be deterministic and unit-tested.** Every formula in docs 05–07 has worked examples — turn each one into a test before implementing the formula.
3. **Parsing is hostile territory.** FM exports contain locale quirks, masked attributes (`-`), and range values (`10-14`). Doc 03 defines exact handling; never silently drop a player row without recording it in the import report.
4. **Uploads are untrusted input.** Enforce the size/type limits and sandboxing rules in docs 02–03 on every ingest path.
5. **Ship milestone by milestone** (doc 10). Each milestone is independently usable — do not start milestone N+1 with N's acceptance criteria failing.
