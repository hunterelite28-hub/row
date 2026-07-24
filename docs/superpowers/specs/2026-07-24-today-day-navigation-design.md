# Today Page — Day Navigation Design Spec

Date: 2026-07-24
Status: Approved via conversation — implementing.

## Purpose

Add previous/next arrows flanking the date on `today.html` so the whole
dashboard can page through other days, not just today. This is a "full day
view switch": every tile that has genuine per-day data re-renders for the
viewed day, not just the date label.

## Data layer changes (`sunpath.js`)

The domain helpers currently hardcode "now"/"today" internally
(`todayKey()`, `activeDateKey()`). They're generalized to accept an optional
explicit date key, defaulting to today so every other page calling them
unchanged keeps working exactly as before:

- `calKey(d)` / `todayKey()` stay as-is (calendar-day key, midnight boundary).
- `activeDateKeyFor(refDate)` — new: same 5am-cutoff logic `activeDateKey()`
  already uses, generalized to take a reference date instead of always
  `new Date()`. `activeDateKey()` becomes `activeDateKeyFor(new Date())`.
- `waterProgress(dateKey)`, `stackToday(dateKey)`, `goalsToday(dateKey)`,
  `splitToday(dateKey)` each gain an optional `dateKey` param (default:
  today's key via the same function they use today). Internals swap their
  hardcoded key lookup for the passed-in one.

This preserves an existing quirk rather than "fixing" it: goals/streak and
the supplement stack already use the 5am-cutoff "active day" while
fitness/learning/library/growth/habits use plain calendar days. The arrows
keep that same duality — a change to fix it would be a separate, unrelated
piece of work.

`fillDaterow(label, date)` — generalized to render an arbitrary `Date`
instead of always `new Date()` (date defaults to today, so the label-only
call sites elsewhere in the app are unaffected).

## Per-tile behavior when viewing a non-today date

**Date-aware (re-render for the viewed day):**

| Tile | Today behavior | Viewed-day behavior |
|---|---|---|
| Goals | done/total + streak | done/total for that day; streak hidden (see exceptions) |
| Habits | best streak + today's dots | best streak (global, see exceptions) + that day's dots |
| Fitness | all-time km + last session | that day's session(s) (type, detail) or "rest day"; all-time km stays as a secondary stat since it's not meaningfully "for" a day |
| Health (stack + water) | today's taken/total, water done/total | that day's taken/total and water done/total |
| Learning | all-time hours + last session | that day's session hours/topic, or "no session" |
| Library | currently-reading shelf | notes logged that day, or "no notes this day" (no per-day reading-progress log exists, so shelf state can't be reconstructed for arbitrary days) |
| Growth | latest reflection ever | reflection written that day, or "no reflection this day" |
| Hero sun arc + "logged" chips | live arc, current time position, today's events | see below |

**Kept global (not day-scoped) — no underlying per-day data exists:**

- **Mentor tile** — chat history isn't persisted (in-memory only, no
  timestamps), so "did I talk to Nova on day X" is unanswerable. Always
  shows current setup status.
- **Streaks** (goal streak, habit best-streak) — running records computed
  off the live log. Recomputing "the streak as of day X" is a materially
  bigger change for a stat that's inherently about *now*; both stay global
  regardless of viewed day.

**Known approximation:** `waterProgress`'s daily target is computed from the
*current* profile (weight, caffeine, activity). There's no historical
profile log, so a past day's water target is today's target applied
retroactively, not a true reconstruction of what the target was that day.
Acceptable — flagged here so it's not mistaken for a bug later.

## Hero section (sun arc, greeting, sub-text)

- **Today (unchanged):** greeting ("Good morning, Rame"), live arc with sun
  disc at current time position, "Xh Ym left … N% through", today's events
  plotted up to now.
- **Past day:** heading shows the day/date instead of a greeting (e.g.
  "Saturday, July 18"). Arc renders fully drawn (the day already completed),
  all that day's events plotted along it, no sun disc. Sub-text becomes
  "N things logged that day" (or "nothing logged that day").
- **Future day:** heading shows the day/date. Arc renders as the empty
  outline only (no progress fill, no events — nothing to plot yet).
  Sub-text becomes "Nothing logged yet."

## Navigation UI

- Two arrow buttons flank the date text in the `.daterow`
  (`‹  SATURDAY, JULY 18  ›`). Both directions are unlimited — you can page
  into the future as well as the past (e.g. to glance at an upcoming split
  day), not just capped at today.
- While viewing a non-today date, a small "Today" pill/button appears next
  to the date to jump straight back in one tap.
- The viewed date is in-memory JS state only — it resets to today on every
  page load/reload. Nothing is persisted to the URL or storage.

## Out of scope

- No changes to how any other page (goals.html, health.html, gym.html, etc.)
  reads or writes this data — they keep calling the generalized helpers with
  no date arg and get identical behavior to today.
- No new data logging is added anywhere (e.g. no new mentor conversation
  history, no historical profile snapshots) purely to make a tile more
  date-aware. Tiles without existing per-day data use the fallbacks
  described above.
