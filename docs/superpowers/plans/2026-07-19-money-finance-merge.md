# Money/Finance Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire the standalone `finance.html` page and absorb its full Net Worth / Subs / Orders / Wishlist functionality into `money.html` as a Sunpath-themed tile with a top sub-nav, per `docs/superpowers/specs/2026-07-19-money-finance-merge-design.md`.

**Architecture:** `finance.html`'s ~1500 lines of CSS and ~1500 lines of JS are mechanically ported (not rewritten) into `money.html`, with CSS custom properties remapped onto `sunpath.css` tokens and the bottom tab bar replaced by a new top pill sub-nav. `money.html` becomes the sole owner of finance data, gaining the `initCloudSync` call `finance.html` used to have.

**Tech Stack:** Static HTML/CSS/vanilla JS, `localStorage`, Supabase (via `sync.js`'s `initCloudSync`). No build step, no test framework in this repo — verification steps in this plan use `grep`/`node --check`/manual browser checks instead of automated tests.

## Global Constraints

- No new localStorage keys, no data migration — every ported piece of code must read/write the exact same keys `finance.html` used.
- `finance.html`'s chart/donut/activity-log/modal *structure and behavior* must not change — only palette, fonts, and surface treatment change (per spec).
- Per-category accent colors (bank `#7DD3FC`/`#BFE3F8`, stocks `#6EE7B7`, crypto `#FBBF24`, other `#B794F4`/`#9F7DD4`) and solid-fill CTA buttons (e.g. `.ord-add-btn`'s green gradient) are **left as literal hex** — explicitly out of scope for the token remap (spec covers palette/font/surface cohesion, not stripping all category color variety).
- Do not touch the nested `row/row/row/` directory (a separate checkout with its own `.git`).

---

### Task 1: Strip money.html's old teaser content, add sync.js

**Files:**
- Modify: `money.html`

**Interfaces:**
- Produces: a `money.html` with an empty `<!-- FINANCE-SUBNAV-AND-TILES -->` placeholder div (consumed by Task 3), and a minimal `boot()` that still calls `S.fillDaterow`/`S.injectDock`/`S.pull` for goals only (Task 4 appends the finance JS as separate script tags after this).

- [ ] **Step 1: Add the sync.js script tag**

In `money.html`, right after the line `<script src="sunpath.js" defer></script>` (line 15), add:

```html
<script src="sync.js" defer></script>
```

- [ ] **Step 2: Remove the three old teaser sections**

Find this exact block in `money.html` (lines 31-47) and delete it, replacing it with a placeholder comment:

Old:
```html
  <div class="section">
    <a class="glassy card" href="finance.html" id="spNw"></a>
  </div>

  <div class="section" id="spSubsSec" style="display:none">
    <div class="sec-head">Subscriptions<span class="more num" id="spSubsLbl"></span></div>
    <div class="glassy card"><div class="rows" id="spSubs"></div></div>
  </div>

  <div class="section">
    <a class="glassy card" href="finance.html" style="display:flex;align-items:center;gap:11px">
      <span class="ic" style="width:30px;height:30px;border-radius:10px;background:rgba(242,166,90,0.13);display:flex;align-items:center;justify-content:center">📊</span>
      <span style="flex:1"><span style="display:block;font-weight:600;font-size:13.5px">Open Finance</span>
      <span style="display:block;color:var(--muted);font-size:11px;margin-top:2px;font-weight:400">accounts, wishlist, orders &amp; full history</span></span>
      <span class="end act num" style="font-family:var(--mono);font-size:10.5px">→</span>
    </a>
  </div>
```

New:
```html
  <!-- FINANCE-SUBNAV-AND-TILES -->
```

- [ ] **Step 3: Replace the old render script with a minimal boot**

Replace the entire `<script>...</script>` block in `money.html` (currently the money/subs teaser renderer) with:

```html
<script>
(function () {
  'use strict';
  function boot() {
    const S = window.Sunpath;
    if (!S) return;
    S.fillDaterow('MONEY');
    S.injectDock('money');
    S.pull({ 'goals': { keys: ['goal_streak_v1'] } }, function () {});
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else { boot(); }
})();
</script>
```

- [ ] **Step 4: Verify the page still loads**

Run: `python3 -m http.server 8642 --directory /Users/rampreeth/row/row &` then open `http://localhost:8642/money.html` in a browser.
Expected: daterow shows "MONEY · <today's date>", pagehead + dock render, only the placeholder comment sits where teaser cards used to be (no visible content there), no console errors.
Stop the server after: `kill %1` (or the job's PID).

- [ ] **Step 5: Commit**

```bash
git add money.html
git commit -m "money: strip old finance teaser, add sync.js, minimal boot"
```

---

### Task 2: Port and re-theme finance.html's CSS into money.html

**Files:**
- Read: `finance.html` (source, lines 16-1590, unmodified in this task)
- Modify: `money.html` (append transformed CSS into the existing `<style>` block)

**Interfaces:**
- Consumes: nothing from Task 1's code, only its file state.
- Produces: all CSS classes Task 3's markup will need (`.section-title`, `.card`, `.card-grid`, `.nw-*`, `.wish-*`, `.ord-*`, subs list classes, `.finance-ticker`/`.ticker-*`), already re-themed.

- [ ] **Step 1: Write the extraction+remap script**

Create `/Users/rampreeth/row/row/.tmp-finance-css-port.py`:

```python
import re

with open('finance.html') as f:
    lines = f.readlines()

# 1-indexed inclusive ranges to DROP from the <style> block (lines 17-1589):
#   17-45   :root { ... }                — money.html already loads sunpath.css's :root
#   47-79   * reset / html,body bg / body::before / body::after — sunpath.css owns page chrome
#   81-85   .shell { ... }               — finance's own outer wrapper; markup will live inside
#                                            money.html's existing .shellwrap instead
#   88-111  .fin-back-btn*               — back button is being removed (dock replaces it)
#   113-157 .bottom-tabs / .bot-tab*     — bottom tab bar is being replaced by the top subnav
#   163-164 scrollbar-hiding rules       — not part of the other Sunpath hub pages' look
drop_ranges = [(17,45), (47,79), (81,85), (88,111), (113,157), (163,164)]

def dropped(n):
    return any(a <= n <= b for a, b in drop_ranges)

kept = [lines[i] for i in range(16, 1589) if not dropped(i + 1)]  # lines[16] is line 17
css = ''.join(kept)

subs = [
    (r'var\(--text-primary\)', 'var(--ink)'),
    (r'var\(--text-secondary\)', 'var(--muted)'),
    (r'var\(--text-tertiary\)', 'var(--faint)'),
    (r'var\(--text-quaternary\)', 'var(--faint)'),
    (r'var\(--bg-card\)', 'var(--glass-fill)'),
    (r'var\(--bg-secondary\)', 'var(--glass-fill)'),
    (r'var\(--glass-bg\)', 'var(--glass-fill)'),
    (r'var\(--bg-deep\)', 'var(--bg)'),
    (r'var\(--border-soft\)', 'var(--line)'),
    (r'var\(--border\)', 'var(--line)'),
    (r'var\(--radius-md\)', '12px'),
    (r'var\(--radius-lg\)', '16px'),
    (r'var\(--font-mono\)', 'var(--mono)'),
    (r'var\(--font\)', 'var(--mono)'),
    (r'var\(--danger\)', 'var(--ember)'),
    (r'var\(--glass-shadow\)',
     'inset 0 1px 0 rgba(255,255,255,0.13), inset 0 -1px 0 rgba(255,255,255,0.04), 0 16px 40px rgba(0,0,0,0.55)'),
    (r'#FF8A8A', 'var(--ember)'),
    (r'#6BE3A4', 'var(--leaf)'),
    (r'#F2C063', 'var(--sun)'),
    (r'#0A0A0B', '#0A0B0E'),
]
for pattern, repl in subs:
    css = re.sub(pattern, repl, css)

with open('.tmp-finance-css-ported.txt', 'w') as f:
    f.write(css)

print('wrote', len(css.splitlines()), 'lines')
```

- [ ] **Step 2: Run it**

Run: `cd /Users/rampreeth/row/row && python3 .tmp-finance-css-port.py`
Expected: `wrote <N> lines` where N is roughly 1500 minus the ~160 dropped lines (~1370).

- [ ] **Step 3: Verify no untransformed tokens remain**

Run: `grep -nE "var\(--(text-primary|text-secondary|text-tertiary|text-quaternary|bg-card|bg-secondary|glass-bg|bg-deep|border-soft|border|radius-md|radius-lg|font-mono|font|danger|glass-shadow)\)|#FF8A8A|#6BE3A4|#F2C063|fin-back-btn|bottom-tabs|bot-tab|\.shell " .tmp-finance-css-ported.txt`
Expected: no output (empty). If anything prints, the drop-ranges or substitution list missed a spot — fix `.tmp-finance-css-port.py` and re-run Steps 1-2 before continuing.

- [ ] **Step 4: Insert into money.html**

Read `.tmp-finance-css-ported.txt`, then use Edit on `money.html` to insert its full contents right after the existing rule (still inside the `<style>` block):

```css
@media (min-width: 1024px) {
  .money-page .shellwrap { max-width: 1100px; }
}
```

...and before the closing `</style>` tag — i.e. the ported CSS becomes the last thing inside money.html's `<style>` block.

- [ ] **Step 5: Clean up and verify the page still loads**

Run: `rm /Users/rampreeth/row/row/.tmp-finance-css-port.py /Users/rampreeth/row/row/.tmp-finance-css-ported.txt`
Then reopen `http://localhost:8642/money.html` (start the server again if needed, per Task 1 Step 4).
Expected: no console errors, no visible layout change yet (the CSS has no matching markup until Task 3).

- [ ] **Step 6: Commit**

```bash
git add money.html
git commit -m "money: port finance.html's CSS, remapped to sunpath tokens"
```

---

### Task 3: Port finance.html's markup + build the new top subnav

**Files:**
- Read: `finance.html` (source, lines ~1592-1906, unmodified in this task)
- Modify: `money.html` (replace the `<!-- FINANCE-SUBNAV-AND-TILES -->` placeholder)

**Interfaces:**
- Consumes: CSS classes from Task 2 (`.section-title`, `.card`, `.nw-*`, `.wish-*`, `.ord-*`, ticker classes).
- Produces: DOM elements Task 4's JS will bind to (`#netWorthTotal`, `#bankList`, `#subsList`, `#nwDonutSvg`, `#financeTicker`, etc. — every id `finance.html` already used, unchanged), plus the new subnav (`#finSubnav`, `#finSubnavLens`, `.fin-subnav-btn`).

- [ ] **Step 1: Write the extraction script**

Create `/Users/rampreeth/row/row/.tmp-finance-html-port.py`:

```python
with open('finance.html') as f:
    text = f.read()

def between(start_marker, end_marker):
    i = text.index(start_marker)
    j = text.index(end_marker, i)
    return text[i:j]

ticker = between('<!-- ===== FINANCE TICKER', '<!-- ===== NET WORTH ===== -->')
net = between('<!-- ===== NET WORTH ===== -->', '<!-- ===== ACTIVE SUBSCRIPTIONS ===== -->')
subs = between('<!-- ===== ACTIVE SUBSCRIPTIONS ===== -->', '<!-- ===== INCOMING ORDERS ===== -->')
incoming = between('<!-- ===== INCOMING ORDERS ===== -->', '<!-- ===== WISHLIST ===== -->')
wish_start = text.index('<!-- ===== WISHLIST ===== -->')
wish_end = text.index('\n</div>\n\n<!-- ===== BOTTOM TAB BAR', wish_start)
wish = text[wish_start:wish_end]

body = ticker + net + subs + incoming + wish

with open('.tmp-finance-html-ported.txt', 'w') as f:
    f.write(body)

print('wrote', len(body.splitlines()), 'lines')
```

- [ ] **Step 2: Run it**

Run: `cd /Users/rampreeth/row/row && python3 .tmp-finance-html-port.py`
Expected: `wrote <N> lines` (roughly 280, covering ticker + net + subs + incoming + wish).

- [ ] **Step 3: Verify no back-button/bottom-tabs markup leaked in**

Run: `grep -nE "fin-back-btn|bottom-tabs|bot-tab" .tmp-finance-html-ported.txt`
Expected: no output. (The `between()` boundaries already exclude those, this is a safety check.)

- [ ] **Step 4: Replace the placeholder with the new subnav + ported tiles**

Read `.tmp-finance-html-ported.txt`, then use Edit on `money.html` to replace:

Old:
```html
  <!-- FINANCE-SUBNAV-AND-TILES -->
```

New: the subnav markup below, followed immediately by the full contents of `.tmp-finance-html-ported.txt` (paste it in as-is, unchanged):

```html
  <div class="section fin-subnav-wrap">
    <nav class="fin-subnav glassy" id="finSubnav" aria-label="Finance sections">
      <span class="fin-subnav-lens" id="finSubnavLens"></span>
      <button class="fin-subnav-btn active" data-tab="net" type="button">
        <span class="fin-subnav-icon">📊</span><span class="fin-subnav-label">Net Worth</span>
      </button>
      <button class="fin-subnav-btn" data-tab="subs" type="button">
        <span class="fin-subnav-icon">🔁</span><span class="fin-subnav-label">Subs</span>
      </button>
      <button class="fin-subnav-btn" data-tab="incoming" type="button">
        <span class="fin-subnav-icon">📦</span><span class="fin-subnav-label">Orders</span>
      </button>
      <button class="fin-subnav-btn" data-tab="wish" type="button">
        <span class="fin-subnav-icon">🎯</span><span class="fin-subnav-label">Wishlist</span>
      </button>
    </nav>
  </div>
  <div class="section">
  <!-- (ported ticker + net + subs + incoming + wish markup from .tmp-finance-html-ported.txt goes here) -->
  </div>
```

- [ ] **Step 5: Add the subnav's CSS**

In `money.html`'s `<style>` block, right before `</style>`, add:

```css
.fin-subnav-wrap { padding: 0 20px; margin-top: 18px; }
.fin-subnav {
  position: relative;
  display: flex;
  padding: 5px;
  border-radius: 999px;
}
.fin-subnav-btn {
  position: relative; z-index: 1;
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 10px 0;
  background: none; border: none;
  font-family: var(--display); font-size: 12px; font-weight: 550; color: var(--muted);
  border-radius: 999px; cursor: pointer;
}
.fin-subnav-btn .fin-subnav-icon { font-size: 13px; }
.fin-subnav-btn.active { color: var(--sun); font-weight: 700; }
.fin-subnav-lens {
  position: absolute; top: 5px; bottom: 5px; left: 5px;
  width: calc((100% - 10px) / 4);
  border-radius: 999px;
  background: linear-gradient(160deg, rgba(255,255,255,0.20), rgba(255,255,255,0.05) 60%, rgba(255,255,255,0.10));
  backdrop-filter: blur(30px) saturate(1.9);
  -webkit-backdrop-filter: blur(30px) saturate(1.9);
  border: 1px solid rgba(255,255,255,0.30);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.38),
    inset 0 -1px 0 rgba(255,255,255,0.08),
    0 4px 14px rgba(0,0,0,0.45);
  transition: transform 0.3s cubic-bezier(0.3, 1.3, 0.4, 1);
  pointer-events: none;
}
@media (prefers-reduced-motion: reduce) { .fin-subnav-lens { transition: none; } }
```

- [ ] **Step 6: Clean up and verify structure**

Run: `rm /Users/rampreeth/row/row/.tmp-finance-html-port.py /Users/rampreeth/row/row/.tmp-finance-html-ported.txt`
Run: `grep -c 'id="netWorthTotal"' money.html` — expected: `1`.
Run: `grep -c 'id="finSubnav"' money.html` — expected: `1`.
Reopen `http://localhost:8642/money.html`. Expected: subnav pill bar renders below the pagehead (unstyled-active-state is fine, no JS wired yet), all four sections' markup appears stacked (no `hidden` attribute yet since finance's tab-switch JS hasn't been ported — this is expected at this point, fixed in Task 4). No console errors.

- [ ] **Step 7: Commit**

```bash
git add money.html
git commit -m "money: port finance.html's markup, add top subnav"
```

---

### Task 4: Port finance.html's JS, rewire the tab switcher to the new subnav

**Files:**
- Read: `finance.html` (source, lines 1909-3409, unmodified in this task)
- Modify: `money.html` (append two new `<script>` blocks before `</body>`)

**Interfaces:**
- Consumes: DOM elements from Task 3 (`#finSubnav`, `.fin-subnav-btn`, `#finSubnavLens`, and every `finance.html`-original id).
- Produces: a fully interactive money.html — this is the task that makes everything from Tasks 2-3 actually work.

- [ ] **Step 1: Write the extraction+rewire script**

Create `/Users/rampreeth/row/row/.tmp-finance-js-port.py`:

```python
with open('finance.html') as f:
    text = f.read()

# Grab the IIFE body verbatim between the two known anchors.
start = text.index('(function() {', text.index('<!-- ===== BOTTOM TAB BAR'))
end = text.index('})();', start) + len('})();')
iife = text[start:end]

old_tabs_block = """  // ============================================================
  // BOTTOM TABS — switch between Net Worth / Subs / Orders.
  // Active tab persisted in localStorage.
  // ============================================================
  const TAB_KEY = 'finance_active_tab';
  const tabs = document.querySelectorAll('.bot-tab');
  const sections = document.querySelectorAll('.section[data-section]');
  function setActiveTab(name) {
    tabs.forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    sections.forEach(s => {
      if (s.dataset.section === name) s.removeAttribute('hidden');
      else s.setAttribute('hidden', '');
    });
    storeSet(TAB_KEY, name);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  tabs.forEach(b => b.addEventListener('click', () => setActiveTab(b.dataset.tab)));
  const savedTab = storeGet(TAB_KEY);
  setActiveTab(savedTab && ['net','subs','incoming','wish'].includes(savedTab) ? savedTab : 'net');"""

new_subnav_block = """  // ============================================================
  // FINANCE SUB-NAV — switch between Net Worth / Subs / Orders / Wishlist.
  // Active tab persisted in localStorage.
  // ============================================================
  const TAB_KEY = 'finance_active_tab';
  const tabs = document.querySelectorAll('.fin-subnav-btn');
  const sections = document.querySelectorAll('.section[data-section]');
  const finLens = document.getElementById('finSubnavLens');
  function setActiveTab(name) {
    const idx = Math.max(0, Array.prototype.findIndex.call(tabs, b => b.dataset.tab === name));
    tabs.forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    sections.forEach(s => {
      if (s.dataset.section === name) s.removeAttribute('hidden');
      else s.setAttribute('hidden', '');
    });
    if (finLens) finLens.style.transform = 'translateX(' + (idx * 100) + '%)';
    storeSet(TAB_KEY, name);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  tabs.forEach(b => b.addEventListener('click', () => setActiveTab(b.dataset.tab)));
  const savedTab = storeGet(TAB_KEY);
  setActiveTab(savedTab && ['net','subs','incoming','wish'].includes(savedTab) ? savedTab : 'net');"""

assert old_tabs_block in iife, "old_tabs_block text not found verbatim — finance.html may have changed"
iife = iife.replace(old_tabs_block, new_subnav_block)
iife = iife.replace("'#FFFFFF'", "'#F4F1EA'")

sync_start = text.index('<script>\ndocument.addEventListener')
sync_end = text.index('</script>', sync_start) + len('</script>')
sync_block = text[sync_start:sync_end]

out = '<script>\n' + iife + '\n</script>\n' + sync_block + '\n'
with open('.tmp-finance-js-ported.txt', 'w') as f:
    f.write(out)

print('wrote', len(out.splitlines()), 'lines')
```

- [ ] **Step 2: Run it**

Run: `cd /Users/rampreeth/row/row && python3 .tmp-finance-js-port.py`
Expected: `wrote <N> lines` (roughly 1500). If the `assert` fails, stop and re-check the `old_tabs_block` string against the current `finance.html` (it must match byte-for-byte) before proceeding.

- [ ] **Step 3: Verify JS syntax is valid**

Run: `node --check .tmp-finance-js-ported.txt` (Node treats `<script>`/`</script>` tags as syntax errors, so first strip them for the check only): 
Run: `sed '/<\/\?script>/d' .tmp-finance-js-ported.txt > .tmp-finance-js-check.js && node --check .tmp-finance-js-check.js && rm .tmp-finance-js-check.js`
Expected: no output (success). If it errors, fix the issue in `finance.html`'s corresponding source region is NOT the fix — fix `.tmp-finance-js-port.py`'s extraction boundaries and re-run Steps 1-2.

- [ ] **Step 4: Verify old bottom-tab selectors are gone, new ones present**

Run: `grep -c "bot-tab" .tmp-finance-js-ported.txt` — expected: `0`.
Run: `grep -c "fin-subnav-btn" .tmp-finance-js-ported.txt` — expected: `2` (query selector + the replace-target reference).

- [ ] **Step 5: Insert into money.html**

Read `.tmp-finance-js-ported.txt`, then use Edit on `money.html` to insert its full contents right before the closing `</body>` tag (i.e. after the `boot()` script block from Task 1).

- [ ] **Step 6: Clean up**

Run: `rm /Users/rampreeth/row/row/.tmp-finance-js-port.py /Users/rampreeth/row/row/.tmp-finance-js-ported.txt`

- [ ] **Step 7: Manual verification**

Reopen `http://localhost:8642/money.html`. Expected:
- Only the Net Worth tile is visible at first (others `hidden`); clicking Subs/Orders/Wishlist pills swaps content and slides the pill highlight.
- No console errors.
- Adding a bank account (Net Worth tab) persists after a page reload (check via browser devtools: `localStorage.getItem('nw:history')` is non-empty after saving).

- [ ] **Step 8: Commit**

```bash
git add money.html
git commit -m "money: port finance.html's JS, rewire tab switcher to top subnav"
```

---

### Task 5: Cross-file cleanup — delete finance.html, repoint links

**Files:**
- Delete: `finance.html`
- Modify: `topbar.js:7`, `topbar.js:220`, `topbar.js:245-252`
- Modify: `today.html:47`, `today.html:320`

**Interfaces:** none — this task only changes link targets and removes dead code; no shared interfaces with other tasks.

- [ ] **Step 1: Update topbar.js's Finance link**

Old (`topbar.js:220`):
```html
  <a href="finance.html" class="topbar-finance-btn" id="topbarFinance" aria-label="Finance">
```

New:
```html
  <a href="money.html" class="topbar-finance-btn" id="topbarFinance" aria-label="Finance">
```

- [ ] **Step 2: Remove the now-dead finance-page chrome-skip special case**

Old (`topbar.js:245-252`):
```javascript
  function isFinancePage() {
    const p = (window.location.pathname || '').toLowerCase();
    return p.endsWith('/finance.html') || p.endsWith('finance.html');
  }
  function isEmbedded() {
    try { return window.self !== window.top; } catch (e) { return true; }
  }
  function shouldShowChrome() { return !isFinancePage() && !isEmbedded(); }
```

New:
```javascript
  function isEmbedded() {
    try { return window.self !== window.top; } catch (e) { return true; }
  }
  function shouldShowChrome() { return !isEmbedded(); }
```

- [ ] **Step 3: Update the header comment**

Old (`topbar.js:7-8`):
```javascript
// Main/Health/Fitness bottom tabs. Skips chrome on finance.html
// and inside iframes (so the water tracker can embed cleanly).
```

New:
```javascript
// Main/Health/Fitness bottom tabs. Skips chrome inside iframes
// (so the water tracker can embed cleanly).
```

- [ ] **Step 4: Update today.html's two references**

Old (`today.html:47`):
```css
  .today-page a.card[href="finance.html"] { grid-area: money; }
```
New:
```css
  .today-page a.card[href="money.html"] { grid-area: money; }
```

Old (`today.html:320`):
```javascript
      g += '<a class="glassy card" style="grid-column:1/-1" href="finance.html">' +
```
New:
```javascript
      g += '<a class="glassy card" style="grid-column:1/-1" href="money.html">' +
```

- [ ] **Step 5: Delete finance.html**

Run: `git rm finance.html`

- [ ] **Step 6: Verify no remaining references**

Run: `grep -rn "finance\.html" --include="*.html" --include="*.js" /Users/rampreeth/row/row --exclude-dir=row`
Expected: no output (the nested `row/row/row/` legacy checkout is intentionally excluded — out of scope per the design spec).

- [ ] **Step 7: Commit**

```bash
git add topbar.js today.html
git commit -m "cleanup: retire finance.html, repoint links to money.html"
```

---

### Task 6: End-to-end manual verification

**Files:** none modified — this task only verifies.

- [ ] **Step 1: Serve and open the full flow**

Run: `python3 -m http.server 8642 --directory /Users/rampreeth/row/row`
Open `http://localhost:8642/today.html` in a browser.

- [ ] **Step 2: Verify Today → Money linkage**

Click the Money card on `today.html`. Expected: navigates to `money.html` (not a 404), showing current net worth if any data exists.

- [ ] **Step 3: Verify all four subnav tabs**

On `money.html`, click each of Net Worth / Subs / Orders / Wishlist. Expected: each renders its own content with no console errors, and the pill highlight slides to the clicked tab.

- [ ] **Step 4: Verify a classic page's Finance shortcut**

Open `http://localhost:8642/health.html`. Expected: the topbar's Finance icon links to `money.html`, not a 404.

- [ ] **Step 5: Verify persistence across reload**

On `money.html`'s Net Worth tab, add a test account entry. Reload the page. Expected: the entry is still there (localStorage persisted), and the previously-selected tab (whichever was last clicked) is restored on load.

- [ ] **Step 6: Stop the server**

Run: `kill %1` (or find and kill the `http.server` process).

- [ ] **Step 7: Final review**

Run: `git log --oneline -8` and `git status --short` — expected: 5 commits from this plan, clean working tree (finance.html gone, no leftover `.tmp-*` files).

---

## Self-Review Notes

- **Spec coverage:** page structure (Task 3), visual restyle (Task 2), sub-nav (Task 3 Step 5), data & sync (Task 4 — the ported `initCloudSync` block travels with the JS port; the old `S.pull('finance',...)` mirror was already dropped in Task 1 Step 3), cleanup (Task 5) — all covered.
- **Type/name consistency:** `finSubnavLens`/`fin-subnav-btn` used identically in Task 3's markup, CSS, and Task 4's JS rewire.
- **Known risk:** Tasks 2-4's Python scripts assert/grep-check their own output before insertion, but they still depend on `finance.html`'s exact current text (line-range comments, the verbatim `old_tabs_block` string). If any of those don't match — the plan's assumptions about the file are stale — stop and re-verify the source ranges with `grep -n` before adjusting the script, rather than editing money.html by hand around the mismatch.
