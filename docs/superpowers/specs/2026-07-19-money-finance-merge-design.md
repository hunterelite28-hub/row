# Money/Finance Merge — Design Spec

Date: 2026-07-19
Status: Approved via conversation — implementing.

## Purpose

Absorb `finance.html` (a separate, fully custom-themed page — own dark CSS, Share
Tech Mono font, fixed bottom tab bar for Net Worth / Subs / Orders / Wishlist)
into `money.html`, restyled to match the Sunpath design language, so the full
finance experience lives on the dashboard itself instead of behind a link-out.
`finance.html` is retired once its content and data ownership move over.

This mirrors the `body.html` restructure in spirit (bringing a separate page's
tiles onto the Sunpath hub, restyled) but differs in one important way: that
restructure kept gym.html/health.html/po-water.html alive as the sync owners of
their data, with body.html as an additional reader/writer. Here, finance.html is
being deleted outright, so money.html must become the sole owner of finance data
— including the cloud sync push, not just a read-only mirror.

## Page structure (money.html)

- Daterow / pagehead stay as they are today.
- New **sub-nav pill bar** directly below the pagehead: Net Worth · Subs ·
  Orders · Wishlist. A glassy segmented control in normal page flow (not
  fixed), visually related to the existing bottom dock (sliding highlight,
  `--sun` active color) but its own component since it's inline, not
  viewport-fixed.
- Below the sub-nav, a single tile area renders whichever section is selected.
  This reuses finance.html's existing show/hide-by-`data-section` logic
  (`hidden` attribute toggle), just relocated from the bottom tab bar to this
  top pill bar, and restyled.
- The bottom **dock** (Today / Body / Mind / Money) is untouched — it's the
  primary hub nav, unrelated to this new in-page sub-nav.
- money.html's current small teaser card (net worth number + sparkline) and
  the standalone "Subscriptions" section are superseded by the full Net Worth
  and Subs tiles respectively, and removed as separate elements.

## Visual restyle approach

Finance.html's ~1500 lines of component CSS (chart, donut, activity log, subs/
orders/wishlist list items, add/edit modals, forms) are structurally sound and
are **not** being rewritten. Instead, its `:root` custom properties are remapped
onto Sunpath's existing tokens:

| finance.html token | maps to sunpath.css |
|---|---|
| `--text-primary` | `--ink` |
| `--text-secondary` | `--muted` |
| `--text-tertiary`, `--text-quaternary` | `--faint` |
| `--accent` | `--sun` |
| `--success` | `--leaf` |
| `--warning` | `--sun` |
| `--danger` | `--ember` |
| `--border`, `--border-soft` | `--line` |
| `--font`, `--font-mono` | `--display` (Bricolage Grotesque), `--mono` (Spline Sans Mono) |

Card surfaces (`--bg-card` fills) switch to the `.glassy` treatment used
elsewhere in Sunpath instead of finance's flat translucent fill. Section
headers (`.section-title`) are restyled to match `.sec-head`. Chart/donut/
activity-log/modal *structure and behavior* are unchanged — only palette,
fonts, and surface treatment change.

## Sub-nav component

New lightweight segmented pill bar, 4 buttons (icons + labels carried over from
the current bottom tabs: 📊 Net Worth, 🔁 Subs, 📦 Orders, 🎯 Wishlist). Visually
adapts the dock's glassy-pill-with-sliding-lens pattern (from `injectDock` in
`sunpath.js`) but as an inline, non-fixed component local to money.html. Active
tab persists in `localStorage` under the same `finance_active_tab` key
finance.html already used, so the selected section is remembered across visits.

## Data & sync

- money.html adds `<script src="sync.js" defer>` and, on `DOMContentLoaded`,
  the same `initCloudSync({ appKey: 'finance', syncedKeys: ['subs', 'wishlist',
  'incoming_orders', 'nw_currency', 'nw:activity', 'nw:history'], syncedPrefixes:
  ['nw:'] })` call finance.html used. money.html becomes the direct owner and
  pusher of finance data.
- money.html's existing `S.pull({ 'finance': { keys: ['nw:history', 'subs'] } })`
  read-only mirror call is removed as redundant — sync.js's own init already
  pulls remote state for the `finance` row on load, and money.html now owns
  writes directly.
- All of finance.html's JS (net worth account CRUD across bank/stocks/crypto/
  other, currency conversion, activity log, chart + donut rendering, subs CRUD,
  orders CRUD, wishlist CRUD) moves into money.html's script wholesale, reading/
  writing the exact same localStorage keys finance.html used. No new keys, no
  data migration.

## Cleanup

- Delete `finance.html`.
- `topbar.js`: repoint the "Finance" link (`topbar-finance-btn`) from
  `finance.html` to `money.html`; remove the now-dead "skip chrome on
  finance.html" special case (finance.html no longer exists, so the check
  never fires — no page currently relies on topbar.js chrome being skipped
  since money.html uses Sunpath's own chrome, not topbar.js).
- `today.html`: update its two `finance.html` references (a CSS grid-area
  selector and a generated card `href`) to point at `money.html`.

## Out of scope

- The nested `row/row/row/` directory is a separate, older checkout with its
  own `.git` — untouched by this change.
- `gym.html`/`health.html`/`po-water.html` and their own tile duplication on
  body.html are unrelated precedent, not touched here.
- No visual/grid restructuring of money.html beyond what's described above
  (no 2-column grid — this is a single-column page like it is today, per the
  existing `max-width: 1100px` treatment already applied).
