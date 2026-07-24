# Today Day Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add previous/next day arrows flanking the date on `today.html` that switch the entire dashboard — hero sun arc, "Up next" focus tile, and all grid tiles — to show that day's data, per `docs/superpowers/specs/2026-07-24-today-day-navigation-design.md`.

**Architecture:** `sunpath.js`'s "today" domain helpers (`waterProgress`, `stackToday`, `goalsToday`, `splitToday`, `fillDaterow`) are generalized to accept an optional date-key/date argument, defaulting to today so every other page's zero-arg call sites are unaffected. `today.html` adds two arrow buttons + a "Today" jump pill around the date label, holds the viewed date as in-memory JS state (`viewDate`, resets to today on reload), and its three render functions (`renderSky`, `renderFocus`, `renderGrid`) are updated to take the viewed date key and branch their output for past/today/future days.

**Tech Stack:** Static HTML/CSS/vanilla JS, `localStorage`. No build step, no test framework in this repo — verification steps in this plan use `node --check` and manual browser checks (seeding `localStorage` via devtools console) instead of automated tests, matching the existing convention in `docs/superpowers/plans/2026-07-19-money-finance-merge.md`.

## Global Constraints

- Every generalized `sunpath.js` helper must keep its exact current behavior when called with no date argument — `body.html`, `mind.html`, `money.html`, `health.html`, `goals.html`, etc. all call these functions today and must see zero change.
- No new `localStorage` keys, no data migration.
- Mentor tile status and both streak stats (goal streak, habit best-streak) stay global/unaffected by the viewed day (per spec — no per-day data exists for these).
- The viewed date is in-memory JS state only. It always resets to today on page load/reload — never persisted to a URL param or storage.
- Arrows page unlimited in both directions (past and future), not capped at today.
- `waterProgress`'s daily target uses the *current* profile for any date (known approximation, documented in the spec — not a bug to "fix" here).

---

### Task 1: Generalize `sunpath.js` date-scoped helpers

**Files:**
- Modify: `sunpath.js:53-62` (`fillDaterow`), `sunpath.js:136-159` (`waterProgress`), `sunpath.js:161-170` (`stackToday`), `sunpath.js:172-181` (`goalsToday`), `sunpath.js:202-218` (`splitToday`)

**Interfaces:**
- Produces: `S.waterProgress(dateKey?)`, `S.stackToday(dateKey?)`, `S.goalsToday(dateKey?)`, `S.splitToday(dateKey?)`, `S.fillDaterow(label, date?)` — all consumed by Task 2-4's `today.html` changes. `dateKey` is a `calKey`-format string (`YYYY-MM-DD`, matching `fitness_sessions[].date` / `learning_sessions[].date` / `habits_log` keys). `date` (in `fillDaterow`) is a `Date` object. `activeDateKey()` is untouched — `goalsToday`/`stackToday` keep it as their internal no-arg fallback, so no export changes are needed for this task.

- [ ] **Step 1: Generalize `fillDaterow` to accept an explicit date**

Replace (lines 53-62):

```javascript
  function fillDaterow(label) {
    const el = document.getElementById('spDaterow');
    if (!el) return;
    const d = new Date();
    const DAYS = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
    const MONS = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
    el.innerHTML =
      (label ? '<span>' + label + '</span><span>·</span>' : '') +
      '<span>' + DAYS[d.getDay()] + ', ' + MONS[d.getMonth()] + ' ' + d.getDate() + '</span>';
  }
```

with:

```javascript
  function fillDaterow(label, date) {
    const el = document.getElementById('spDaterow');
    if (!el) return;
    const d = date || new Date();
    const DAYS = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
    const MONS = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
    el.innerHTML =
      (label ? '<span>' + label + '</span><span>·</span>' : '') +
      '<span>' + DAYS[d.getDay()] + ', ' + MONS[d.getMonth()] + ' ' + d.getDate() + '</span>';
  }
```

- [ ] **Step 2: Parameterize `waterProgress`, `stackToday`, `goalsToday`**

Replace (lines 136-181, all three functions together):

```javascript
  function waterProgress() {
    const state = readJSON('po_water_v1', null);
    if (!state) return { done: 0, total: 0 };
    const done = (state.logs || {})[todayKey()] || 0;
    const p = state.profile || { weightKg: 75 };
    const wKg = state.weightUnit === 'lb' ? (p.weightKg || 0) / 2.20462 : (p.weightKg || 0);
    const base = wKg * 35;
    const exercise = (p.activityHrsPerWeek || 0) / 7 * 500;
    const caffeine = Math.max(0, (state.caffeineMgPerDay || 0) - 200) * 1.5;
    const subs = (state.substances || []).reduce((s, x) => {
      const dose = (x && x.dose != null ? x.dose : (x && x.defaultDose)) || 0;
      return s + Math.max(0, dose * ((x && x.mlPerUnit) || 0));
    }, 0);
    let adjust = 0;
    if (p.sex === 'm') adjust += 200;
    if ((p.age || 0) >= 50) adjust += 100;
    const totalMl = base + exercise + caffeine + subs + adjust;
    let unitVol;
    if (state.unit === 'glass') unitVol = state.glassMl || 250;
    else if (state.unit === 'oz') unitVol = 30;
    else if (state.unit === 'ml') unitVol = 1;
    else unitVol = state.bottleMl || 500;
    return { done, total: Math.max(1, Math.ceil(totalMl / unitVol)) };
  }

  function stackToday() {
    const items = readJSON('stack:items', []);
    const taken = readJSON('stack:taken:' + activeDateKey(), {});
    const times = Object.keys(taken).map(k => taken[k]).filter(t => typeof t === 'number');
    return {
      total: Array.isArray(items) ? items.length : 0,
      taken: Object.keys(taken).length,
      lastTs: times.length ? Math.max.apply(null, times) : null
    };
  }

  function goalsToday() {
    const list = readJSON('goals:' + activeDateKey(), []);
    const arr = Array.isArray(list) ? list : [];
    return {
      total: arr.length,
      done: arr.filter(g => g && g.done).length,
      pending: arr.filter(g => g && !g.done),
      doneWithTs: arr.filter(g => g && g.done && g.doneAt)
    };
  }
```

with:

```javascript
  function waterProgress(dateKey) {
    const state = readJSON('po_water_v1', null);
    if (!state) return { done: 0, total: 0 };
    const dk = dateKey || todayKey();
    const done = (state.logs || {})[dk] || 0;
    const p = state.profile || { weightKg: 75 };
    const wKg = state.weightUnit === 'lb' ? (p.weightKg || 0) / 2.20462 : (p.weightKg || 0);
    const base = wKg * 35;
    const exercise = (p.activityHrsPerWeek || 0) / 7 * 500;
    const caffeine = Math.max(0, (state.caffeineMgPerDay || 0) - 200) * 1.5;
    const subs = (state.substances || []).reduce((s, x) => {
      const dose = (x && x.dose != null ? x.dose : (x && x.defaultDose)) || 0;
      return s + Math.max(0, dose * ((x && x.mlPerUnit) || 0));
    }, 0);
    let adjust = 0;
    if (p.sex === 'm') adjust += 200;
    if ((p.age || 0) >= 50) adjust += 100;
    const totalMl = base + exercise + caffeine + subs + adjust;
    let unitVol;
    if (state.unit === 'glass') unitVol = state.glassMl || 250;
    else if (state.unit === 'oz') unitVol = 30;
    else if (state.unit === 'ml') unitVol = 1;
    else unitVol = state.bottleMl || 500;
    return { done, total: Math.max(1, Math.ceil(totalMl / unitVol)) };
  }

  function stackToday(dateKey) {
    const items = readJSON('stack:items', []);
    const dk = dateKey || activeDateKey();
    const taken = readJSON('stack:taken:' + dk, {});
    const times = Object.keys(taken).map(k => taken[k]).filter(t => typeof t === 'number');
    return {
      total: Array.isArray(items) ? items.length : 0,
      taken: Object.keys(taken).length,
      lastTs: times.length ? Math.max.apply(null, times) : null
    };
  }

  function goalsToday(dateKey) {
    const dk = dateKey || activeDateKey();
    const list = readJSON('goals:' + dk, []);
    const arr = Array.isArray(list) ? list : [];
    return {
      total: arr.length,
      done: arr.filter(g => g && g.done).length,
      pending: arr.filter(g => g && !g.done),
      doneWithTs: arr.filter(g => g && g.done && g.doneAt)
    };
  }
```

- [ ] **Step 3: Parameterize `splitToday`**

Replace (lines 202-218):

```javascript
  function splitToday() {
    const state = readJSON('po_coach_v1', null);
    let rotation = ['push', 'pull', 'legs', 'rest'];
    let anchorDate = '2026-05-12', anchorIndex = rotation.indexOf('rest');
    if (state && Array.isArray(state.splitRotation) && state.splitRotation.length) {
      rotation = state.splitRotation.map(x => String(x));
      if (state.splitAnchor && state.splitAnchor.date && state.splitAnchor.index != null) {
        anchorDate = state.splitAnchor.date;
        anchorIndex = state.splitAnchor.index;
      }
    }
    const a = new Date(anchorDate + 'T00:00:00');
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const diff = Math.round((t - a) / 864e5);
    const idx = ((anchorIndex + diff) % rotation.length + rotation.length) % rotation.length;
    return String(rotation[idx] || '');
  }
```

with:

```javascript
  function splitToday(dateKey) {
    const state = readJSON('po_coach_v1', null);
    let rotation = ['push', 'pull', 'legs', 'rest'];
    let anchorDate = '2026-05-12', anchorIndex = rotation.indexOf('rest');
    if (state && Array.isArray(state.splitRotation) && state.splitRotation.length) {
      rotation = state.splitRotation.map(x => String(x));
      if (state.splitAnchor && state.splitAnchor.date && state.splitAnchor.index != null) {
        anchorDate = state.splitAnchor.date;
        anchorIndex = state.splitAnchor.index;
      }
    }
    const a = new Date(anchorDate + 'T00:00:00');
    const t = dateKey ? new Date(dateKey + 'T00:00:00') : new Date();
    t.setHours(0, 0, 0, 0);
    const diff = Math.round((t - a) / 864e5);
    const idx = ((anchorIndex + diff) % rotation.length + rotation.length) % rotation.length;
    return String(rotation[idx] || '');
  }
```

- [ ] **Step 4: Syntax check**

Run: `node --check sunpath.js`
Expected: no output (exits 0).

- [ ] **Step 5: Verify zero-arg call sites are unaffected**

Run: `python3 -m http.server 8080` from the repo root (leave running), then open `http://localhost:8080/money.html` and `http://localhost:8080/body.html` in a browser. Confirm both still show today's real date in the date row and their existing tiles render with the same values as before this change (nothing regresses — these pages never pass a `dateKey`/`date` argument).

Then open the browser devtools console on `today.html` and run:

```javascript
Sunpath.goalsToday('2000-01-01')
```

Expected: `{ total: 0, done: 0, pending: [], doneWithTs: [] }` (a date key with no stored data returns an empty result, confirming the param is actually being used instead of ignored).

- [ ] **Step 6: Commit**

```bash
git add sunpath.js
git commit -m "sunpath: generalize today-scoped helpers to accept an explicit date"
```

---

### Task 2: Add day-navigation arrows and date-aware hero section

**Files:**
- Modify: `today.html:16-61` (style block), `today.html:65-66` (daterow markup), `today.html:88-358` (script block)

**Interfaces:**
- Consumes: `S.calKey`, `S.todayKey`, `S.fillDaterow(label, date)`, `S.fitness()`, `S.stackToday(dateKey)`, `S.learning()`, `S.goalsToday(dateKey)`, `S.sessionTime`, `S.esc`, `S.fmtClock` (all from Task 1 / existing exports).
- Produces: `viewDate` (module-closure `Date`, mutated by arrow clicks), `dayEvents(dk)`, `renderSky(viewDate, isToday)` — consumed by Task 3 & 4's updated `render()` orchestration (this task already updates `render()` to call `renderFocus(vk, isToday)` / `renderGrid(vk, isToday)`, but those two functions don't use the args yet until Task 3/4 — harmless, JS ignores extra call args).

- [ ] **Step 1: Add arrow/jump-pill CSS**

In `today.html`, right after `.mentor-fab { display: none; }` (line 17), add:

```css
.day-arrow {
  appearance: none; border: none; cursor: pointer;
  width: 24px; height: 24px; border-radius: 50%; flex: 0 0 auto;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(244,241,234,0.08); color: var(--ink);
  font-family: var(--display); font-size: 15px; line-height: 1;
  transition: background .15s ease, transform .15s ease;
}
.day-arrow:hover { background: rgba(244,241,234,0.16); transform: scale(1.08); }
.day-arrow:active { transform: scale(0.94); }
.daterow-label {
  flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
}
.day-today-jump {
  appearance: none; cursor: pointer; flex: 0 0 auto;
  border: 1px solid rgba(242,166,90,0.4);
  background: rgba(242,166,90,0.14); color: var(--sun);
  font-family: var(--mono); font-size: 10px; letter-spacing: 0.08em;
  text-transform: uppercase; padding: 3px 8px; border-radius: 999px;
}
.day-today-jump:hover { background: rgba(242,166,90,0.22); }
```

- [ ] **Step 2: Restructure the daterow markup**

Replace (line 66):

```html
  <div class="daterow" id="spDaterow"></div>
```

with:

```html
  <div class="daterow" id="spDaterowNav">
    <button class="day-arrow" id="spDayPrev" type="button" aria-label="Previous day">‹</button>
    <span class="daterow-label" id="spDaterow"></span>
    <button class="day-arrow" id="spDayNext" type="button" aria-label="Next day">›</button>
    <button class="day-today-jump num" id="spDayToday" type="button" hidden>Today</button>
  </div>
```

- [ ] **Step 3: Add `dayHeading` and `dayEvents`, replacing `todaysEvents`**

In `today.html`'s script block, replace the `todaysEvents` function (lines 109-138):

```javascript
    function todaysEvents() {
      const ev = [];
      const tk = S.todayKey();
      const F = S.fitness();
      F.sessions.forEach(s => {
        if (!s || s.date !== tk) return;
        const ts = S.sessionTime(s);
        if (!ts) return;
        const icon = s.type === 'run' ? '🏃' : s.type === 'gym' ? '🏋️' : '🥊';
        const label = s.type === 'run' ? 'Run' : s.type === 'gym' ? 'Gym' : 'Muay';
        const detail = s.type === 'run'
          ? ((s.km ? s.km + ' km' : '') || (s.duration ? s.duration + ' min' : ''))
          : (s.split || (s.duration ? s.duration + ' min' : '') || '');
        ev.push({ ts, icon, label, detail });
      });
      const st = S.stackToday();
      if (st.lastTs && st.taken > 0) {
        ev.push({ ts: st.lastTs, icon: '💊', label: 'Stack', detail: st.taken + '/' + st.total + ' taken' });
      }
      const L = S.learning();
      L.sessions.forEach(s => {
        if (!s || s.date !== tk || !s.ts) return;
        ev.push({ ts: s.ts, icon: 'λ', label: S.subjectName(L, s.subjectId) || 'Study', detail: (s.hours ? s.hours + ' h' : (s.topic || '')) });
      });
      S.goalsToday().doneWithTs.forEach(g => {
        const t = String(g.text || '');
        ev.push({ ts: g.doneAt, icon: '✓', label: 'Done', detail: t.length > 22 ? t.slice(0, 22) + '…' : t });
      });
      return ev.sort((a, b) => a.ts - b.ts);
    }
```

with:

```javascript
    const DAYS_TITLE = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const MONS_TITLE = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    function dayHeading(d) {
      return DAYS_TITLE[d.getDay()] + ', ' + MONS_TITLE[d.getMonth()] + ' ' + d.getDate();
    }

    function dayEvents(dk) {
      const ev = [];
      const F = S.fitness();
      F.sessions.forEach(s => {
        if (!s || s.date !== dk) return;
        const ts = S.sessionTime(s);
        if (!ts) return;
        const icon = s.type === 'run' ? '🏃' : s.type === 'gym' ? '🏋️' : '🥊';
        const label = s.type === 'run' ? 'Run' : s.type === 'gym' ? 'Gym' : 'Muay';
        const detail = s.type === 'run'
          ? ((s.km ? s.km + ' km' : '') || (s.duration ? s.duration + ' min' : ''))
          : (s.split || (s.duration ? s.duration + ' min' : '') || '');
        ev.push({ ts, icon, label, detail });
      });
      const st = S.stackToday(dk);
      if (st.lastTs && st.taken > 0) {
        ev.push({ ts: st.lastTs, icon: '💊', label: 'Stack', detail: st.taken + '/' + st.total + ' taken' });
      }
      const L = S.learning();
      L.sessions.forEach(s => {
        if (!s || s.date !== dk || !s.ts) return;
        ev.push({ ts: s.ts, icon: 'λ', label: S.subjectName(L, s.subjectId) || 'Study', detail: (s.hours ? s.hours + ' h' : (s.topic || '')) });
      });
      S.goalsToday(dk).doneWithTs.forEach(g => {
        const t = String(g.text || '');
        ev.push({ ts: g.doneAt, icon: '✓', label: 'Done', detail: t.length > 22 ? t.slice(0, 22) + '…' : t });
      });
      return ev.sort((a, b) => a.ts - b.ts);
    }
```

- [ ] **Step 4: Rewrite `renderSky` to be date-aware**

Replace the entire `renderSky` function (lines 140-223) with:

```javascript
    function renderSky(viewDate, isToday) {
      const vk = S.calKey(viewDate);
      const tk = S.todayKey();
      const isPast = vk < tk;
      const ev = dayEvents(vk);

      let stops, arcP, showDisc, showEvents, emptyText, hr;
      if (isToday) {
        const now = new Date();
        hr = now.getHours() + now.getMinutes() / 60;
        const night = hr < 5 || hr >= 23;
        stops = skyStops();
        if (night) {
          arcP = null; showDisc = false; showEvents = false;
          emptyText = "sun's down — recharge";
        } else {
          arcP = Math.max(0.015, Math.min(0.985, (hr - 5) / 18));
          showDisc = true; showEvents = true; emptyText = null;
        }
      } else if (isPast) {
        stops = ['#1C2C50', '#39456A', '#B57C4A'];
        arcP = 1; showDisc = false; showEvents = true; emptyText = null;
      } else {
        stops = ['#1C2C50', '#39456A', '#B57C4A'];
        arcP = null; showDisc = false; showEvents = false;
        emptyText = "this day hasn't happened yet";
      }

      let s = '<svg class="sky" viewBox="0 -30 390 230">';
      s += '<defs><linearGradient id="skyfill" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="' + stops[0] + '" stop-opacity="0.85"/>' +
        '<stop offset="60%" stop-color="' + stops[1] + '" stop-opacity="0.45"/>' +
        '<stop offset="100%" stop-color="' + stops[2] + '" stop-opacity="0.22"/>' +
        '</linearGradient>' +
        '<linearGradient id="arcdone" x1="0" y1="1" x2="1" y2="0">' +
        '<stop offset="0%" stop-color="#E4572E"/><stop offset="100%" stop-color="#F2A65A"/>' +
        '</linearGradient>' +
        '<radialGradient id="sunglow">' +
        '<stop offset="0%" stop-color="#FFD9A0" stop-opacity="0.9"/>' +
        '<stop offset="100%" stop-color="#F2A65A" stop-opacity="0"/>' +
        '</radialGradient></defs>';
      s += '<path d="M20 182 A175 175 0 0 1 370 182 Z" fill="url(#skyfill)"/>';
      s += '<path d="M20 182 A175 175 0 0 1 370 182" fill="none" stroke="rgba(244,241,234,0.14)" stroke-width="1.6" stroke-dasharray="2 6"/>';

      if (arcP != null) {
        const sp = pos(arcP);
        s += '<path d="M20 182 A175 175 0 0 1 ' + sp.x.toFixed(1) + ' ' + sp.y.toFixed(1) +
             '" fill="none" stroke="url(#arcdone)" stroke-width="2.6" stroke-linecap="round"/>';
        if (showEvents) {
          const MIN_GAP = 0.05;
          const clusters = [];
          ev.forEach(e => {
            const d = new Date(e.ts);
            const ehr = d.getHours() + d.getMinutes() / 60;
            const ep = Math.max(0.02, Math.min(0.98, (ehr - 5) / 18));
            if (ep > arcP + 0.01) return;
            const last = clusters[clusters.length - 1];
            if (last && ep - last.p < MIN_GAP) { last.count++; return; }
            clusters.push({ p: ep, icon: e.icon, count: 1 });
          });
          clusters.slice(0, 10).forEach(c => {
            const m = pos(c.p);
            s += '<circle cx="' + m.x.toFixed(1) + '" cy="' + m.y.toFixed(1) + '" r="' +
                 (c.count > 1 ? 6 : 4.5) + '" fill="#F2A65A"/>';
            s += '<text x="' + m.x.toFixed(1) + '" y="' + (m.y - 12).toFixed(1) +
                 '" text-anchor="middle" font-size="11" fill="#F4F1EA"' +
                 (c.count > 1 ? ' font-family="Spline Sans Mono, monospace"' : '') + '>' +
                 (c.count > 1 ? '×' + c.count : c.icon) + '</text>';
          });
        }
        if (showDisc) {
          s += '<circle cx="' + sp.x.toFixed(1) + '" cy="' + sp.y.toFixed(1) + '" r="26" fill="url(#sunglow)"/>';
          s += '<circle cx="' + sp.x.toFixed(1) + '" cy="' + sp.y.toFixed(1) + '" r="9" fill="#FFD9A0"/>';
        }
      } else if (emptyText) {
        s += '<text x="195" y="120" text-anchor="middle" font-size="12" fill="rgba(244,241,234,0.4)" font-family="Spline Sans Mono, monospace">' + emptyText + '</text>';
      }
      s += '<line x1="0" y1="182" x2="390" y2="182" stroke="rgba(244,241,234,0.14)" stroke-width="1"/>';
      s += '<circle cx="20" cy="182" r="3" fill="rgba(244,241,234,0.35)"/>';
      s += '<circle cx="370" cy="182" r="3" fill="rgba(244,241,234,0.2)"/>';
      s += '</svg>';
      document.getElementById('spSky').innerHTML = s;

      if (isToday) {
        const h = Math.floor(hr);
        const name = h < 5 ? 'Rest up,' : h < 12 ? 'Good morning,' : h < 17 ? 'Good afternoon,' : h < 23 ? 'Good evening,' : 'Rest up,';
        document.getElementById('spGreeting').innerHTML = name + '<br>Rame.';
      } else {
        document.getElementById('spGreeting').innerHTML = dayHeading(viewDate) + '.';
      }

      const subEl = document.getElementById('spDaySub');
      if (isToday) {
        if (arcP == null) {
          subEl.innerHTML = 'Your day runs 5:00 — 23:00. See you at sunrise.';
        } else {
          const minsLeft = Math.max(0, (23 - hr) * 60);
          const hh = Math.floor(minsLeft / 60), mm = Math.floor(minsLeft % 60);
          subEl.innerHTML = '<b class="num">' + hh + 'h ' + mm + 'm</b> left in your day — you\'re ' +
            Math.round(arcP * 100) + '% through.';
        }
      } else if (isPast) {
        subEl.innerHTML = ev.length
          ? '<b class="num">' + ev.length + '</b> thing' + (ev.length === 1 ? '' : 's') + ' logged that day.'
          : 'Nothing logged that day.';
      } else {
        subEl.innerHTML = 'Nothing logged yet.';
      }

      const chips = ev.map(e =>
        '<span class="log-chip glassy"><span class="t num">' + S.fmtClock(e.ts) + '</span><b>' +
        S.esc(e.label) + '</b>' + (e.detail ? ' ' + S.esc(e.detail) : '') + '</span>'
      );
      const emptyChip = isToday
        ? 'nothing logged yet — the day is young'
        : (isPast ? 'nothing was logged this day' : 'nothing logged yet');
      document.getElementById('spLogged').innerHTML = chips.length
        ? chips.join('')
        : '<span class="log-chip glassy" style="color:var(--faint)">' + emptyChip + '</span>';
    }
```

- [ ] **Step 5: Wire up `viewDate` state, arrow handlers, and `render()` orchestration**

Replace the `render()` function and the boot tail (lines 334-353):

```javascript
    function render() {
      S.fillDaterow('');
      renderSky();
      renderFocus();
      renderGrid();
    }

    S.injectDock('today');
    render();
    setInterval(renderSky, 60 * 1000);
    S.pull({
      'goals':    { prefixes: ['goals:'], keys: ['goal_streak_v1'] },
      'po-coach': { keys: ['fitness_sessions', 'po_coach_v1', 'po_coach_weights'] },
      'health':   { keys: ['stack:items', 'po_water_v1'], prefixes: ['stack:taken:'] },
      'learning': { keys: ['learning_subjects', 'learning_sessions'] },
      'library':  { keys: ['library_books', 'library_notes'] },
      'growth':   { keys: ['growth_notes', 'growth_lock_hash'] },
      'habits':   { keys: ['habits_list', 'habits_log'] },
      'finance':  { keys: ['nw:history', 'subs'] }
    }, render);
```

with:

```javascript
    let viewDate = new Date();

    function render() {
      const vk = S.calKey(viewDate);
      const isToday = vk === S.todayKey();
      document.getElementById('spDayToday').hidden = isToday;
      S.fillDaterow('', viewDate);
      renderSky(viewDate, isToday);
      renderFocus(vk, isToday);
      renderGrid(vk, isToday);
    }

    document.getElementById('spDayPrev').addEventListener('click', () => {
      viewDate.setDate(viewDate.getDate() - 1);
      render();
    });
    document.getElementById('spDayNext').addEventListener('click', () => {
      viewDate.setDate(viewDate.getDate() + 1);
      render();
    });
    document.getElementById('spDayToday').addEventListener('click', () => {
      viewDate = new Date();
      render();
    });

    S.injectDock('today');
    render();
    setInterval(() => {
      if (S.calKey(viewDate) === S.todayKey()) renderSky(viewDate, true);
    }, 60 * 1000);
    S.pull({
      'goals':    { prefixes: ['goals:'], keys: ['goal_streak_v1'] },
      'po-coach': { keys: ['fitness_sessions', 'po_coach_v1', 'po_coach_weights'] },
      'health':   { keys: ['stack:items', 'po_water_v1'], prefixes: ['stack:taken:'] },
      'learning': { keys: ['learning_subjects', 'learning_sessions'] },
      'library':  { keys: ['library_books', 'library_notes'] },
      'growth':   { keys: ['growth_notes', 'growth_lock_hash'] },
      'habits':   { keys: ['habits_list', 'habits_log'] },
      'finance':  { keys: ['nw:history', 'subs'] }
    }, render);
```

- [ ] **Step 6: Syntax check**

Run: `node --check <(sed -n '/<script>/,/<\/script>/p' today.html | sed '1d;$d')`
Expected: no output. (This extracts and checks just the inline `<script>` body.)

- [ ] **Step 7: Manual browser verification**

With the static server from Task 1 still running, open `http://localhost:8080/today.html`. Confirm:
- The date row shows `‹  [TODAY'S DAY, MONTH DATE]  ›` with no "Today" pill visible.
- Clicking `‹` moves the label back one day, the heading changes from "Good morning/afternoon/evening, Rame" to the day/date (e.g. "Wednesday, July 22."), the sun arc shows fully drawn with no sun disc, and a "Today" pill appears next to the date.
- Clicking `›` twice from today moves the label two days forward, the arc shows as an empty outline with the text "this day hasn't happened yet", and the "Today" pill is visible.
- Clicking the "Today" pill jumps back to today, hides the pill, and restores the live arc/greeting.
- Reload the page: it comes back on today regardless of where you left off.

- [ ] **Step 8: Commit**

```bash
git add today.html
git commit -m "today: add day navigation arrows with date-aware hero section"
```

---

### Task 3: Make the "Up next" focus tile date-aware

**Files:**
- Modify: `today.html:226-267` (`renderFocus`)

**Interfaces:**
- Consumes: `S.goalsToday(dateKey)`, `S.waterProgress(dateKey)`, `S.stackToday(dateKey)`, `S.splitToday(dateKey)`, `S.fitness()` (Task 1). `vk`/`isToday` passed in by Task 2's `render()`.
- Produces: `renderFocus(vk, isToday)` signature (no downstream consumers beyond `render()`, already wired in Task 2).

- [ ] **Step 1: Rewrite `renderFocus`**

Replace the entire `renderFocus` function (lines 226-267):

```javascript
    function renderFocus() {
      const G = S.goalsToday();
      const W = S.waterProgress();
      const st = S.stackToday();
      document.getElementById('spNextMore').textContent =
        G.total ? (G.total - G.done) + ' of ' + G.total + ' goals left' : '';

      const pct = G.total ? Math.round(G.done / G.total * 100) : 0;
      let html = '';
      const first = G.pending[0];
      html += '<a class="focus-top" href="goals.html">' +
        '<span class="ring" style="background:conic-gradient(var(--leaf) 0 ' + pct + '%, rgba(244,241,234,0.1) ' + pct + '% 100%)"><i class="num">' +
        (G.total ? G.done + '/' + G.total : '—') + '</i></span>' +
        '<span><span class="what">' + (first ? S.esc(first.text) : (G.total ? 'All goals done — solid day.' : 'No goals set yet')) + '</span>' +
        '<span class="whatsub" style="display:block">' + (first ? 'top of your list · tap to manage' : (G.total ? 'plan tomorrow tonight' : 'tap to add today\'s goals')) + '</span></span></a>';

      html += '<div class="rows" style="margin-top:10px">';
      if (W.total > 0) {
        const meter = Array.from({ length: Math.min(W.total, 10) }, (_, i) =>
          '<i class="' + (i < W.done ? 'on' : '') + '"></i>').join('');
        html += '<a class="rowi" href="health.html#water"><span class="ic">💧</span>' +
          '<span class="tx"><span class="t1">Water</span><span class="meter">' + meter + '</span></span>' +
          '<span class="end num">' + W.done + '/' + W.total + '</span></a>';
      }
      if (st.total > 0) {
        html += '<a class="rowi" href="health.html"><span class="ic">💊</span>' +
          '<span class="tx"><span class="t1">Supplement stack</span><span class="t2">' +
          (st.taken >= st.total ? 'all taken' : (st.total - st.taken) + ' still to take') + '</span></span>' +
          '<span class="end' + (st.taken >= st.total ? '' : ' act') + '">' +
          (st.taken >= st.total ? '<b>' + st.taken + '/' + st.total + '</b>' : st.taken + '/' + st.total) + '</span></a>';
      }
      const split = S.splitToday();
      if (split && split.toLowerCase() !== 'rest') {
        const loggedToday = S.fitness().sessions.some(x => x && x.date === S.todayKey() && x.type === 'gym');
        html += '<a class="rowi" href="gym.html"><span class="ic">🏋️</span>' +
          '<span class="tx"><span class="t1">' + S.esc(split.charAt(0).toUpperCase() + split.slice(1)) + ' session</span>' +
          '<span class="t2">' + (loggedToday ? 'logged — nice' : 'today\'s split day') + '</span></span>' +
          '<span class="end' + (loggedToday ? '' : ' act') + '">' + (loggedToday ? '<b>✓</b>' : '+ LOG') + '</span></a>';
      }
      html += '</div>';
      document.getElementById('spFocus').innerHTML = html;
    }
```

with:

```javascript
    function renderFocus(vk, isToday) {
      const G = S.goalsToday(vk);
      const W = S.waterProgress(vk);
      const st = S.stackToday(vk);
      document.getElementById('spNextMore').textContent =
        G.total ? (G.total - G.done) + ' of ' + G.total + ' goals left' : '';

      const pct = G.total ? Math.round(G.done / G.total * 100) : 0;
      let html = '';
      const first = G.pending[0];
      html += '<a class="focus-top" href="goals.html">' +
        '<span class="ring" style="background:conic-gradient(var(--leaf) 0 ' + pct + '%, rgba(244,241,234,0.1) ' + pct + '% 100%)"><i class="num">' +
        (G.total ? G.done + '/' + G.total : '—') + '</i></span>' +
        '<span><span class="what">' + (first ? S.esc(first.text) : (G.total ? 'All goals done — solid day.' : 'No goals set that day')) + '</span>' +
        '<span class="whatsub" style="display:block">' + (first ? 'top of the list · tap to manage' : (G.total ? (isToday ? 'plan tomorrow tonight' : 'nothing left that day') : (isToday ? 'tap to add today\'s goals' : 'no goals that day'))) + '</span></span></a>';

      html += '<div class="rows" style="margin-top:10px">';
      if (W.total > 0) {
        const meter = Array.from({ length: Math.min(W.total, 10) }, (_, i) =>
          '<i class="' + (i < W.done ? 'on' : '') + '"></i>').join('');
        html += '<a class="rowi" href="health.html#water"><span class="ic">💧</span>' +
          '<span class="tx"><span class="t1">Water</span><span class="meter">' + meter + '</span></span>' +
          '<span class="end num">' + W.done + '/' + W.total + '</span></a>';
      }
      if (st.total > 0) {
        html += '<a class="rowi" href="health.html"><span class="ic">💊</span>' +
          '<span class="tx"><span class="t1">Supplement stack</span><span class="t2">' +
          (st.taken >= st.total ? 'all taken' : (st.total - st.taken) + ' still to take') + '</span></span>' +
          '<span class="end' + (st.taken >= st.total ? '' : ' act') + '">' +
          (st.taken >= st.total ? '<b>' + st.taken + '/' + st.total + '</b>' : st.taken + '/' + st.total) + '</span></a>';
      }
      const split = S.splitToday(vk);
      if (split && split.toLowerCase() !== 'rest') {
        const loggedThatDay = S.fitness().sessions.some(x => x && x.date === vk && x.type === 'gym');
        html += '<a class="rowi" href="gym.html"><span class="ic">🏋️</span>' +
          '<span class="tx"><span class="t1">' + S.esc(split.charAt(0).toUpperCase() + split.slice(1)) + ' session</span>' +
          '<span class="t2">' + (loggedThatDay ? 'logged — nice' : (isToday ? 'today\'s split day' : 'that day\'s split')) + '</span></span>' +
          '<span class="end' + (loggedThatDay ? '' : ' act') + '">' + (loggedThatDay ? '<b>✓</b>' : (isToday ? '+ LOG' : '—')) + '</span></a>';
      }
      html += '</div>';
      document.getElementById('spFocus').innerHTML = html;
    }
```

- [ ] **Step 2: Syntax check**

Run: `node --check <(sed -n '/<script>/,/<\/script>/p' today.html | sed '1d;$d')`
Expected: no output.

- [ ] **Step 3: Seed a fixture and verify in browser**

With the static server running, open `http://localhost:8080/today.html`, open devtools console, and run:

```javascript
const dk = '2026-07-20';
localStorage.setItem('goals:' + dk, JSON.stringify([
  { id: 'g1', text: 'Test goal for July 20', done: true, doneAt: Date.now() },
  { id: 'g2', text: 'Second goal', done: false }
]));
location.reload();
```

After reload, click `‹` until the date row shows "Monday, July 20" (adjust click count to match today's actual date). Confirm the "Up next" tile shows `1/2` in the ring and "Second goal" as the pending item — not whatever today's real goals are.

Click the "Today" pill and confirm the tile reverts to today's actual goals.

- [ ] **Step 4: Commit**

```bash
git add today.html
git commit -m "today: make Up Next focus tile date-aware"
```

---

### Task 4: Make all grid tiles date-aware

**Files:**
- Modify: `today.html:270-332` (`renderGrid`)

**Interfaces:**
- Consumes: `S.fitness()`, `S.stackToday(dateKey)`, `S.waterProgress(dateKey)`, `S.learning()`, `S.library()`, `S.habits()`, `S.growth()`, `S.goalsToday(dateKey)`, `S.calKey`, `S.esc` (Task 1). `vk`/`isToday` passed in by Task 2's `render()`.
- Produces: `renderGrid(vk, isToday)` signature (no downstream consumers beyond `render()`, already wired in Task 2).

- [ ] **Step 1: Rewrite `renderGrid`**

Replace the entire `renderGrid` function (lines 270-332):

```javascript
    function renderGrid() {
      const F = S.fitness();
      const st = S.stackToday();
      const W = S.waterProgress();
      const L = S.learning();
      const Lib = S.library();
      const H = S.habits();
      const Gr = S.growth();

      const lastSess = F.sessions[0];
      const lastLabel = lastSess
        ? (lastSess.type === 'run' ? 'run' : lastSess.type === 'gym' ? 'gym' : 'muay') + ' · ' + S.fmtDateStr(lastSess.date)
        : 'no sessions yet';
      const lastLearn = L.sessions[0];
      const reading = Lib.books.filter(b => b && b.status === 'reading');
      const lastNote = Gr.notes[0];

      const G = S.goalsToday();
      const streak = (S.readJSON('goal_streak_v1', {}) || {}).count || 0;

      let g = '';
      g += '<a class="mod glassy" href="goals.html"><span class="k">Today — Goals</span>' +
        '<span class="v num">' + (G.total ? G.done + '/' + G.total : '—') + ' <small>done</small></span>' +
        '<span class="d">' + (streak > 0 ? '<b>🔥 ' + streak + '</b> day streak' : 'start a streak today') + '</span></a>';
      g += '<a class="mod glassy" href="habits.html"><span class="k">Today — Habits</span>' +
        '<span class="v num">' + H.bestStreak + ' <small>day streak</small></span>' +
        (H.list.length
          ? '<span class="dots">' + H.list.slice(0, 7).map(h =>
              '<i class="' + ((H.log[S.todayKey()] || []).indexOf(h.id) !== -1 ? 'on' : '') + '"></i>').join('') + '</span>'
          : '<span class="d">no habits yet</span>') + '</a>';
      g += '<a class="mod glassy" href="gym.html"><span class="k">Body — Fitness</span>' +
        '<span class="v num">' + (F.km % 1 === 0 ? F.km : F.km.toFixed(1)) + ' <small>km all-time</small></span>' +
        '<span class="d">last: ' + S.esc(lastLabel) + '</span></a>';
      g += '<a class="mod glassy" href="health.html"><span class="k">Body — Health</span>' +
        '<span class="v num">' + (st.total ? st.taken + '/' + st.total : '—') + ' <small>stack</small></span>' +
        '<span class="d">water <b' + (W.done >= W.total ? '' : ' class="warm"') + '>' + W.done + '/' + W.total + '</b></span></a>';
      g += '<a class="mod glassy" href="learning.html"><span class="k">Mind — Learning</span>' +
        '<span class="v num">' + (L.hours % 1 === 0 ? L.hours : L.hours.toFixed(1)) + ' <small>hours</small></span>' +
        '<span class="d">' + (lastLearn ? 'last: ' + S.esc((lastLearn.topic || 'session').slice(0, 22)) : 'no sessions yet') + '</span></a>';
      g += '<a class="mod glassy" href="library.html"><span class="k">Mind — Library</span>' +
        '<span class="v num">' + reading.length + ' <small>book' + (reading.length === 1 ? '' : 's') + ' open</small></span>' +
        '<span class="d">' + (reading[0] ? S.esc(String(reading[0].title).slice(0, 24)) : 'shelf is empty') + '</span></a>';
      const mentorReady = !!(localStorage.getItem('mentor_api_key') || '').trim();
      g += '<a class="mod glassy" href="mentor.html"><span class="k">Today — Mentor</span>' +
        '<span class="v num">' + (mentorReady ? 'Nova' : '—') + ' <small>' + (mentorReady ? 'ready' : 'not set up') + '</small></span>' +
        '<span class="d">' + (mentorReady ? 'ask Nova about your day' : 'tap to add your Claude key') + '</span></a>';
      let quote;
      if (Gr.locked) {
        quote = lastNote
          ? '<span class="quote-q">Locked · last written ' + S.fmtShort(lastNote.ts) + ' — tap to unlock.</span>'
          : '<span class="quote-q">Reflections are locked.</span>';
      } else if (lastNote) {
        const t = String(lastNote.text || '');
        quote = '<span class="quote-q">“' + S.esc(t.length > 110 ? t.slice(0, 110) + '…' : t) + '”</span>';
      } else {
        quote = '<span class="quote-q">No reflections yet — what did you notice today?</span>';
      }
      g += '<a class="glassy card" style="grid-column:1/-1" href="growth.html">' +
        '<span class="k">Growth — ' + (lastNote ? 'last reflection · ' + S.fmtShort(lastNote.ts) : 'reflections') + '</span>' +
        '<div style="margin-top:8px">' + quote + '</div></a>';

      document.getElementById('spGrid').innerHTML = g;
    }
```

with:

```javascript
    function renderGrid(vk, isToday) {
      const tk = S.todayKey();
      const isFuture = vk > tk;
      const F = S.fitness();
      const st = S.stackToday(vk);
      const W = S.waterProgress(vk);
      const L = S.learning();
      const Lib = S.library();
      const H = S.habits();
      const Gr = S.growth();
      const G = S.goalsToday(vk);
      const streak = (S.readJSON('goal_streak_v1', {}) || {}).count || 0;

      const daySessions = F.sessions.filter(x => x && x.date === vk);
      const sessDesc = daySessions.length
        ? daySessions.map(x => (x.type === 'run' ? 'run' : x.type === 'gym' ? 'gym' : 'muay') +
            (x.type === 'run' && x.km ? ' ' + x.km + 'km' : (x.split ? ' ' + x.split : ''))).join(', ')
        : (isFuture ? 'nothing planned' : 'rest day');

      const daySess = L.sessions.filter(x => x && x.date === vk);
      const dayHours = daySess.reduce((t, x) => t + (parseFloat(x.hours) || 0), 0);
      const learnDesc = daySess.length ? S.esc((daySess[0].topic || 'session').slice(0, 22)) : 'no session';

      const dayNotes = Lib.notes.filter(n => n && n.ts && S.calKey(new Date(n.ts)) === vk);
      const libDesc = dayNotes.length ? S.esc(String(dayNotes[0].text || '').slice(0, 40)) : 'no notes this day';

      const dayReflection = Gr.notes.find(n => n && n.ts && S.calKey(new Date(n.ts)) === vk);

      let g = '';
      g += '<a class="mod glassy" href="goals.html"><span class="k">' + (isToday ? 'Today' : 'Goals') + ' — Goals</span>' +
        '<span class="v num">' + (G.total ? G.done + '/' + G.total : '—') + ' <small>done</small></span>' +
        '<span class="d">' + (isToday
          ? (streak > 0 ? '<b>🔥 ' + streak + '</b> day streak' : 'start a streak today')
          : (G.total ? 'goals for that day' : 'no goals set that day')) + '</span></a>';
      g += '<a class="mod glassy" href="habits.html"><span class="k">' + (isToday ? 'Today' : 'Habits') + ' — Habits</span>' +
        '<span class="v num">' + H.bestStreak + ' <small>day streak</small></span>' +
        (H.list.length
          ? '<span class="dots">' + H.list.slice(0, 7).map(h =>
              '<i class="' + ((H.log[vk] || []).indexOf(h.id) !== -1 ? 'on' : '') + '"></i>').join('') + '</span>'
          : '<span class="d">no habits yet</span>') + '</a>';
      g += '<a class="mod glassy" href="gym.html"><span class="k">Body — Fitness</span>' +
        '<span class="v num">' + (daySessions.length || '—') + ' <small>session' + (daySessions.length === 1 ? '' : 's') + '</small></span>' +
        '<span class="d">' + S.esc(sessDesc) + ' · ' + (F.km % 1 === 0 ? F.km : F.km.toFixed(1)) + 'km all-time</span></a>';
      g += '<a class="mod glassy" href="health.html"><span class="k">Body — Health</span>' +
        '<span class="v num">' + (st.total ? st.taken + '/' + st.total : '—') + ' <small>stack</small></span>' +
        '<span class="d">water <b' + (W.done >= W.total ? '' : ' class="warm"') + '>' + W.done + '/' + W.total + '</b></span></a>';
      g += '<a class="mod glassy" href="learning.html"><span class="k">Mind — Learning</span>' +
        '<span class="v num">' + (dayHours % 1 === 0 ? dayHours : dayHours.toFixed(1)) + ' <small>hours</small></span>' +
        '<span class="d">' + learnDesc + '</span></a>';
      g += '<a class="mod glassy" href="library.html"><span class="k">Mind — Library</span>' +
        '<span class="v num">' + dayNotes.length + ' <small>note' + (dayNotes.length === 1 ? '' : 's') + '</small></span>' +
        '<span class="d">' + libDesc + '</span></a>';
      const mentorReady = !!(localStorage.getItem('mentor_api_key') || '').trim();
      g += '<a class="mod glassy" href="mentor.html"><span class="k">Today — Mentor</span>' +
        '<span class="v num">' + (mentorReady ? 'Nova' : '—') + ' <small>' + (mentorReady ? 'ready' : 'not set up') + '</small></span>' +
        '<span class="d">' + (mentorReady ? 'ask Nova about your day' : 'tap to add your Claude key') + '</span></a>';
      let quote;
      if (Gr.locked) {
        quote = dayReflection
          ? '<span class="quote-q">Locked · written that day — tap to unlock.</span>'
          : '<span class="quote-q">Reflections are locked.</span>';
      } else if (dayReflection) {
        const t = String(dayReflection.text || '');
        quote = '<span class="quote-q">“' + S.esc(t.length > 110 ? t.slice(0, 110) + '…' : t) + '”</span>';
      } else {
        quote = '<span class="quote-q">No reflection this day.</span>';
      }
      g += '<a class="glassy card" style="grid-column:1/-1" href="growth.html">' +
        '<span class="k">Growth' + (dayReflection ? ' — that day' : '') + '</span>' +
        '<div style="margin-top:8px">' + quote + '</div></a>';

      document.getElementById('spGrid').innerHTML = g;
    }
```

- [ ] **Step 2: Syntax check**

Run: `node --check <(sed -n '/<script>/,/<\/script>/p' today.html | sed '1d;$d')`
Expected: no output.

- [ ] **Step 3: Seed fixtures across all date-aware tiles and verify**

With the static server running, open `http://localhost:8080/today.html`, open devtools console, and run (using the same `dk` you'll navigate to — adjust to a real past date):

```javascript
const dk = '2026-07-20';
localStorage.setItem('fitness_sessions', JSON.stringify([
  { id: 'ft' + Date.now(), type: 'run', date: dk, km: 5 }
]));
localStorage.setItem('learning_sessions', JSON.stringify([
  { date: dk, ts: Date.now(), hours: 1.5, topic: 'Spec verification' }
]));
localStorage.setItem('library_notes', JSON.stringify([
  { id: 'n1', bookId: 'b1', text: 'Test library note', page: 42, ts: Date.now() }
]));
localStorage.setItem('growth_notes', JSON.stringify([
  { ts: Date.now(), text: 'Test reflection for that day' }
]));
localStorage.setItem('habits_log', JSON.stringify({ [dk]: ['h1'] }));
localStorage.setItem('habits_list', JSON.stringify([{ id: 'h1', name: 'Test habit' }]));
location.reload();
```

Navigate with `‹`/`›` to `dk`'s date and confirm:
- Fitness tile shows "1 session" and "run 5km · ... km all-time".
- Learning tile shows "1.5 hours" and "Spec verification".
- Library tile shows "1 note" and "Test library note".
- Growth tile shows "Growth — that day" and the reflection text.
- Habits tile's first dot is lit (matching `h1` in the seeded log).

Click the "Today" pill and confirm every tile reverts to today's real state (all-time km unaffected, Mentor tile unaffected, streaks unaffected).

- [ ] **Step 4: Commit**

```bash
git add today.html
git commit -m "today: make all dashboard grid tiles date-aware"
```

---

### Task 5: Final end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Clear seeded fixtures**

In the devtools console on `today.html`:

```javascript
localStorage.clear();
location.reload();
```

(This is a throwaway local dev fixture cleanup — confirm you're on `localhost`, not a real device with real data, before running.)

- [ ] **Step 2: Full manual pass**

With a clean slate, open `http://localhost:8080/today.html` and:
- Confirm today's view looks and behaves exactly as it did before this feature (live arc, greeting, all tiles showing empty/zero states correctly since storage is empty).
- Page back 3 days, forward 5 days, and back to today using the arrows and the "Today" pill; confirm no console errors at any point (check devtools console).
- Resize the browser to a desktop width (≥1024px) and confirm the arrows and "Today" pill still lay out correctly within the date row in the desktop grid layout.
- Resize to a mobile width (~390px) and confirm the same.

- [ ] **Step 3: Regression-check sibling pages**

Open `http://localhost:8080/body.html`, `http://localhost:8080/mind.html`, `http://localhost:8080/money.html` and confirm each still loads, shows today's date correctly, and their tiles render without errors (these pages call the Task 1 helpers with no date argument and must be unaffected).

- [ ] **Step 4: Stop the local server**

Run: `kill %1` (or `Ctrl+C` the `python3 -m http.server 8080` process from Task 1, Step 5).
