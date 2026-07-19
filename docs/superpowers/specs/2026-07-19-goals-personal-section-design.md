# Goals Page: Personal/All-Time Goals Section

Date: 2026-07-19

## Summary

Remove three dashboard sections from `goals.html` (SYS.STATUS day ring, FITNESS.TOTALS stat cards, ACTIVITY.LOG recent sessions) and replace them with a new `PERSONAL.GOALS` section: a persistent, all-time list of goals the user wants to work toward as a person (not daily todos).

## Remove

- `SYS.STATUS` section: `.day-ring-wrap` block (markup ~L746-770) and its supporting JS (`updateDayRing`, the day-ring palette/format helpers, the `setInterval(updateDayRing, ...)` call, and the `#dayRingFill` dasharray setup).
- `FITNESS.TOTALS` section: `.dash-stats` block (markup ~L772-790).
- `ACTIVITY.LOG` section: `.dash-activity` block (markup ~L792-795).
- `renderDashStats()` and its call sites, plus the Supabase `po-coach` fitness-session pull in the second `<script>` block (nothing will read `fitness_sessions` after this change).
- Associated now-unused CSS (`.day-ring*`, `.dash-stats`, `.dash-stat-*`, `.dash-activity*`, `.dash-act-*`) — including the duplicated rules in the "REFINED POLISH" block at the bottom of `<style>`.

Leave the ticker row and `TODO.TODAY` / `PLAN.TOMORROW` sections untouched.

## Add: PERSONAL.GOALS section

Placed where the removed sections were (after the ticker row, before `TODO.TODAY`), styled with the existing `gm-card` / `gm-row` visual language so it matches the rest of the page.

### Data model

New `localStorage` key: `personal_goals_v1` → flat JSON array, no date-keying, no rollover, no streak:

```js
{ text: string, category: string, target: string, done: boolean, doneAt?: number }
```

- `category` — one of a fixed preset (see below).
- `target` — optional free-text label (e.g. "2028", "before 30", "someday"). Not a strict date picker — life goals don't always have a calendar date.

### Categories (fixed preset, color-coded)

Reusing colors already present in the page's palette:

| Category | Color |
|---|---|
| Career | `#7B8CDE` (blue/purple, new) |
| Health | `#6BE3A4` (existing `--success`) |
| Relationships | `#F2C063` (existing `--warning`) |
| Growth | `#A78BFA` (purple, existing muay-icon hue) |
| Financial | `#F97316` (orange, existing run/gym-icon hue) |
| Adventure | `#5EC8D8` (teal, new) |

Each row shows a small colored tag/pill with the category name.

### Row behavior

- Checkbox toggles `done`. Achieved goals stay in place, struck through and dimmed — same visual treatment as the existing today-goal rows (`.gm-row-done`), not moved to a separate list.
- Delete button (×), same as existing goal rows.
- No drag-reorder, no queue button, no inline-edit-on-click — those are today-list-specific affordances not needed here (YAGNI: this list doesn't need daily reordering).

### Add row

- Text input (goal text) + category `<select>` (preset options) + optional text input (target label) + "+ Add" button.
- No "Polish" button — that's specific to the daily goal-phrasing flow and doesn't apply here.

### Sync

Add `personal_goals_v1` to the existing `initCloudSync({ syncedPrefixes: [...] })` call so it syncs across devices alongside the daily goals (prefix match is exact-string safe since `indexOf(...) === 0`).

## Out of scope

- No target-date sorting/grouping by category — flat list in entry order (matches existing today-list simplicity).
- No migration of old fitness/activity data — those sections are simply removed from this page (data still lives in `fitness_sessions` for other pages that use it, e.g. body.html).
