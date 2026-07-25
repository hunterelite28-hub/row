# Life Areas + Profile Page (`areas.html`)

Date: 2026-07-25

## Summary

Port the "Avatar" concept from the user's Notion "5am club" dashboard into Sunpath as a new page, `areas.html`: a profile card (identity + aggregate level) sitting above a grid of 6 RPG-style "Life Area" stat cards (strength, intellect, vitality, perception, wealth, education). Reached by tapping the avatar in the topbar rather than a new bottom-nav tab. Styled entirely in Sunpath's existing dark/glassy aesthetic (`sunpath.css` tokens), not a copy of Notion's flat card look.

Source reference: Notion page `the 5am club` → `Avatar` page, which contains an Avatar database (identity, aggregate Level, Total EXP, Shards, Life Areas relation) and a Life Areas database (the 6 stat cards). Shards/Market/Inventory (an in-app currency + shop) exist in Notion but are explicitly out of scope for this pass — see Non-goals.

## Page: `areas.html`

New standalone page following the existing single-file pattern (inline `<style>`/`<script>`, `topbar.js` + `sync.js` includes, `sunpath.css` tokens: `--bg`, `--card`, `--glass-fill`, `--sun`, `--ember`, `--leaf`, glassy card treatment).

### Section 1: Profile card

- Avatar image (uploaded photo, stored as a data URL) or fallback: an emoji/icon picker if no image set.
- Name (editable text, defaults to "Rame" matching existing `index.html` title branding).
- **Avatar Level** (read-only, derived): `round(sum of all 6 life areas' XP / 6000)` — i.e., roughly the average level across life areas. Recomputed live whenever any area's XP changes; never stored or manually edited.
- Total EXP readout (sum of all 6 areas' XP / 600,000 cap), shown as a supporting stat under the level, same segmented-bar treatment as the life area cards (see below) scaled to the combined cap.
- Edit via pencil icon → modal for image + name only (Level/EXP are derived, not editable here).

### Section 2: Life Area cards (6, grid layout)

Each card: **strength, intellect, vitality, perception, wealth, education**.

| Area | Category | Links to |
|---|---|---|
| strength | health and fitness | `gym.html` |
| intellect | knowledge | `learning.html` |
| vitality | mind | `mind.html` |
| perception | lifestyle | `habits.html` |
| wealth | money | `money.html` |
| education | credentials | `library.html` |

Per-card fields, all editable:
- Icon + name + accent color (mapped to Sunpath palette, one distinct accent per card rather than reusing a single `--sun` orange for all six — e.g. strength/ember, intellect/blue-ish new token, vitality/sun, perception/leaf, wealth/purple new token, education/brown new token — exact hex values decided during implementation to stay harmonious with existing tokens).
- Purpose (short text, 1-2 sentences).
- Level + XP: `Level = round(XP / 1000)`. Progress bar: 10 segments, each = 10,000 XP toward the 100,000 cap, mirroring the source data's own numbers (e.g. 16,530 XP → Level 17, 1 segment lit).
- Category label (short text).
- Skill/subject tags: chip list, add/remove.
- Linked resources: list of `{ label, url? }`, add/remove. `url` optional — some resources (like a course name) may just be a label with no link.

**Interaction:**
- Tap card body (outside controls) → navigate to the mapped page in the table above.
- Tap pencil icon → edit modal for that card: Purpose, XP (raw number entry, not just an increment button, so the user can set/correct values directly), category, tags, resources. Same modal visual pattern as existing trackers on `body.html` (glassy modal, dark overlay).

## Topbar changes (`topbar.js`)

- The existing home link (`<a href="today.html" class="topbar-os">`) becomes the avatar entry point: swap its target to `areas.html`, and render the user's avatar image (or fallback icon) in place of/alongside the "SUNPATH" wordmark, read from the same profile localStorage key so it updates live.
- `today.html` remains reachable via the bottombar's existing "Today" tab — no navigation is lost, since the bottombar (Today/Body/Mind/Money) is untouched.
- No changes to `bottombar-tab` set or `currentPageKey()` routing logic beyond leaving `areas.html` unmatched (no tab highlights when on this page, which is correct since it's not one of the 4 bottom tabs).

## Data model

Two new `localStorage` keys, following the existing per-page key convention (see `habits_list`, `habits_log` in `habits.html`):

```js
// sunpath_profile
{ name: string, avatarDataUrl: string | null, avatarEmoji: string | null }

// sunpath_life_areas — fixed-length array of 6, order-stable
[
  {
    id: 'strength' | 'intellect' | 'vitality' | 'perception' | 'wealth' | 'education',
    xp: number,          // 0–100000
    purpose: string,
    category: string,
    tags: string[],
    resources: { label: string, url?: string }[],
  },
  // ...5 more
]
```

Icon, accent color, display name, and the page-link mapping (table above) are static per `id` and live in code, not in the stored data — they aren't things the user needs to reconfigure.

## Sync

New `initCloudSync` call in `areas.html`, own `appKey` (e.g. `'areas'`), `syncedKeys: ['sunpath_profile', 'sunpath_life_areas']` — same pattern as every other page (`habits.html`, `money.html`, etc.), independent of their sync scopes.

## Non-goals (this pass)

- No Shards currency, no Market/shop, no Inventory. The Notion source has these (Shards earned from EXP, spent on user-defined real-world rewards) but they add a second economy (earn rate, spend flow, transaction history) that's a distinct follow-up project, not needed for the profile + life-areas hub to be useful on its own.
- No auto-computed XP from other pages' activity (gym logs, money data, etc.) — XP is manually entered per card for now, per earlier decision. Wiring real activity into XP is a separate future project once the hub is live.
- No new bottom-nav tab — entry is via the topbar avatar only.
