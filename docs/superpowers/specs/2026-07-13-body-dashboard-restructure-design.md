# Body Dashboard Restructure — Design Spec

Date: 2026-07-13
Status: Approved via conversation — implementing.

## Purpose

Restructure `body.html` from its current single-column, link-out layout into a
2-column × 3-row desktop dashboard (matching `today.html`'s grid treatment and
max-width) that brings the interactive tiles currently living on `gym.html`
(Weight, Workouts/Hevy, Runs/Strava) and `health.html` (Supplement stack, Water)
directly onto the page — fully interactive, not read-only summaries.

## Grid layout

A `.body-page` class on `<body>`, mirroring `today.html`'s `.today-page` pattern:
desktop-only (`@media (min-width: 1024px)`) grid, `max-width: 1100px`, two
columns. Below 1024px, everything stacks single-column in the same order
(current mobile behavior, unchanged).

```
Row 1:  Today               |  Weight
Row 2:  Workouts (Hevy)     |  Runs (Strava)
Row 3:  Supplement stack    |  Water tracker
```

`mind.html` and `money.html` get the same `max-width: 1100px` treatment applied
(no grid restructure — just matching width to Today/Body). Their tile layouts
will be covered in a follow-up once screenshots are provided.

## Styling approach

All ported tiles are **rebuilt natively in Sunpath's visual language** (Bricolage
Grotesque, `.glassy` card chrome, `--sun`/`--leaf` accents, `sunpath.css` patterns
like `.rowi`, `.sec-head`, `.num`) rather than copying gym.html/health.html's dark
"Share Tech Mono" tech-aesthetic verbatim. This keeps body.html reading as one
cohesive page instead of stitching together two different design systems.

All tiles read/write the **same localStorage keys** already used by
gym.html/health.html, so data stays in sync regardless of which page the user
interacts from. No new keys, no data migration.

## Tile-by-tile scope

### Weight
Number, 30-day delta, streak, sparkline chart (last 30 entries + 7-day moving
average), composition estimate (muscle/fat split), input + Save button.
Reads/writes `po_coach_weights`. Reuses the composition-estimate math from
`gym.html` (weight trend × strength trend, `CONFIG.composition`).
**Out of scope:** progress photos / camera capture — stays gym.html-only.

### Workouts (Hevy)
Connect (paste API key — no OAuth), Sync button, 3 stat boxes (this week / kg
vol per wk / last workout), recent workout list, disconnect. Full port of
`gym.html`'s Hevy integration (`hevy_api_key`, `hevy_workouts_cache`, bridges
into `fitness_sessions`).

### Runs (Strava)
Connect (Client ID/Secret → OAuth), Sync, stats, recent list, disconnect. Full
port of `gym.html`'s Strava integration (`strava_client_id/secret`,
`strava_tokens`, `strava_cache`, bridges into `fitness_sessions`). OAuth
`redirect_uri` is computed dynamically as `location.origin + location.pathname`
(confirmed in gym.html's existing code), and Strava's Authorization Callback
Domain check is domain-level, not path-level — so initiating Connect from
body.html works without any Strava app config changes.

### Supplement stack
Full windowed (morning/lunch/evening/anytime) checklist with per-item
checkboxes, add-item form with autocomplete search against the existing
supplement database, and the cycling missed/low-stock ticker banner. Reads/
writes `stack:items`, `stack:taken:*`, `stack:low`, `stack:version` — same keys
and same "never clobber user data" load logic as `health.html`.

### Water tracker
Hero number/target, progress bar with healthy-zone bands, +/− buttons, "why
this target" breakdown, 7-day history bars, 14-day sparkline, and the **full
Settings modal** (profile: weight/age/sex/activity; display: unit/bottle/glass
size; caffeine; stimulants & meds search; export/import/reset). Reads/writes
`po_water_v1`. Full port of `po-water.html`'s logic, restyled.

## Data flow / consistency

Because every tile reads/writes the exact same localStorage keys as the
existing full pages, there's no new sync mechanism needed — existing
`initCloudSync`/`sync.js` wiring on gym.html/health.html/po-water.html continues
to own cross-device sync for those keys. body.html's copies are additional
readers/writers of the same local data, refreshed via the existing `S.pull(...)`
polling pattern already used in body.html today (extended to cover the new
keys: `po_coach_weights`, `hevy_api_key`, `hevy_workouts_cache`,
`strava_tokens`, `strava_cache`, `stack:items`, `stack:low`, `po_water_v1`).

## Known duplication tradeoff

This intentionally duplicates a meaningful amount of JS/CSS between
gym.html/health.html/po-water.html and body.html (confirmed acceptable in
conversation). Future changes to Weight/Hevy/Strava/Stack/Water behavior will
need to be applied in both places if they should stay in sync. Not addressed in
this pass: extracting shared logic into common included files.
