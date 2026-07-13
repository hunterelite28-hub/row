# Mentor (Nova) Dashboard Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a real, working `mentor.html` page — Nova's 3D avatar + a Claude-powered chat box grounded in the user's live Sunpath data — reachable from a new tile on `today.html`.

**Architecture:** A single self-contained `mentor.html` (matching this repo's one-file-per-page convention), following the existing "classic sub-page" pattern used by `goals.html`/`gym.html` (`rameos.css` + `topbar.js` + `sync.js`, hub = `today`), not the newer `sunpath.css`/hub-page pattern used by `today.html` itself. The Three.js avatar and cozy-loader visuals are ported from `ai-avatar.html` (an existing unlinked prototype lab); the chat box is rebuilt against Sunpath's own accent colors. Claude is called directly from the browser (no backend) using a user-supplied API key stored in `localStorage`.

**Tech Stack:** Vanilla HTML/CSS/JS, Three.js via `unpkg` importmap (same CDN pin as the lab), `window.Sunpath` data API (`sunpath.js`), Anthropic Messages API (`https://api.anthropic.com/v1/messages`, direct-browser-access header).

## Global Constraints

- No build step, no npm, no bundler — this repo has none and every page is a single static HTML file. `mentor.html` must work opened directly or via any static file server.
- No backend/serverless proxy — the Claude API key is user-supplied and lives only in the browser's `localStorage` (key `mentor_api_key`), never committed to git, never sent anywhere but `api.anthropic.com`.
- Follow the "classic sub-page" convention exactly (`rameos.css`, `topbar.js` defer, `sync.js` defer, Share Tech Mono font, `.page` max-width 1100px container) — this is how every other tile-linked page (`goals.html`, `habits.html`, `gym.html`, `health.html`, `learning.html`, `library.html`, `growth.html`, `finance.html`) is built. Do not use `sunpath.css`/`sunpath.js`'s `injectDock` (that's the hub-page pattern used only by `today.html`/`body.html`/`mind.html`/`money.html`).
- `ai-avatar.html`, `gym.html`'s existing uncommitted diff, and the nested `row/` directory are out of scope — do not modify or commit them as part of this work.
- Model: `claude-sonnet-5`. No model picker UI (YAGNI).
- Do not port the lab's animation-kit showcase, auto-tour, or palette picker — Nova only needs `neutral/happy/sad/surprised/thinking/sleepy/wink/love/star` expressions driven programmatically, no UI for browsing them.

## File Structure

- **Create:** `mentor.html` — the whole feature: page shell, Nova avatar (Three.js), chat box, cozy-loader "thinking" state, Claude API call, settings/key entry.
- **Modify:** `topbar.js:255-280` — register `mentor.html` in `currentPageKey()`, `currentHub()` (→ `today`), and `pageDisplayName()` (→ `MENTOR`) so the shared topbar/bottombar highlight correctly on the new page.
- **Modify:** `today.html:263-265` (inside `renderGrid()`) — add a new `.mod.glassy` tile linking to `mentor.html`, styled like the existing Library tile.

---

### Task 1: Page shell + nav integration

**Files:**
- Create: `mentor.html`
- Modify: `topbar.js:255-280`
- Modify: `today.html:263-265`
- Test: manual browser check + `curl`/`grep` structural checks (this repo has no test runner — static-site checks stand in for automated tests)

**Interfaces:**
- Produces: `mentor.html` page reachable at `/mentor.html`, containing a `.page` root div that later tasks append into.

- [ ] **Step 1: Create `mentor.html` shell**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="stylesheet" href="rameos.css">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#000000">
<title>Mentor</title>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="sync.js" defer></script>
<script src="topbar.js" defer></script>
<script src="sunpath.js" defer></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap" rel="stylesheet">
<script type="importmap">
{ "imports": { "three": "https://unpkg.com/three@0.160.0/build/three.module.js" } }
</script>
<style>
:root { --os-accent: #A78BFA; }
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0;
  background: #000000;
  color: #B8B6B0;
  font-family: 'Share Tech Mono', monospace;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}
body { min-height: 100vh; position: relative; overflow-x: hidden; padding: 0 20px 60px; }
body::before {
  content: '';
  position: fixed; inset: 0;
  background:
    radial-gradient(circle at 82% 14%, rgba(167, 139, 250, 0.16), transparent 45%),
    radial-gradient(circle at 18% 90%, rgba(103, 232, 249, 0.08), transparent 50%);
  filter: blur(40px);
  pointer-events: none;
  z-index: -2;
  animation: drift 36s ease-in-out infinite alternate;
}
body::after {
  content: '';
  position: fixed; inset: 0;
  background-image: radial-gradient(rgba(255,255,255,0.014) 1px, transparent 1px);
  background-size: 3px 3px;
  pointer-events: none;
  z-index: -1;
}
@keyframes drift { 0% { transform: translate3d(0,0,0); } 100% { transform: translate3d(-22px, 14px, 0); } }
.page { max-width: 1100px; margin: 0 auto; }
.dash-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  margin-bottom: 18px; padding-bottom: 14px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.dash-title-text {
  font-size: 24px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
  color: #FAFAFA; line-height: 1.1;
}
.dash-title-dot { color: #A78BFA; }
.dash-title-sub {
  font-size: 11px; color: rgba(255,255,255,0.38);
  margin-top: 5px; letter-spacing: 0.06em; text-transform: uppercase;
}
.glassy {
  background: linear-gradient(160deg, rgba(26,28,34,0.55), rgba(6,7,10,0.42) 45%, rgba(14,15,20,0.5));
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 20px;
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
}
</style>
</head>
<body>
<div class="page">
  <div class="dash-header">
    <div>
      <div class="dash-title-text">Mentor<span class="dash-title-dot">.</span></div>
      <div class="dash-title-sub">Nova &middot; your AI companion</div>
    </div>
  </div>
  <!-- Task 2 appends the avatar card here, Task 4 appends the chat card -->
</div>
</body>
</html>
```

- [ ] **Step 2: Register `mentor` in `topbar.js`**

Edit `topbar.js` — in `currentPageKey()` (around line 255), add a check before the fallback:

```js
  function currentPageKey() {
    const p = (window.location.pathname || '').toLowerCase();
    if (p.endsWith('mentor.html')) return 'mentor';
    if (p.endsWith('habits.html')) return 'habits';
    if (p.endsWith('learning.html')) return 'learning';
    if (p.endsWith('library.html')) return 'library';
    if (p.endsWith('health.html')) return 'health';
    if (p.endsWith('gym.html')) return 'fitness';
    if (p.endsWith('growth.html')) return 'growth';
    if (p.endsWith('goals.html')) return 'goals';
    return 'goals';
  }
```

In `currentHub()` (around line 266), add `mentor: 'today'` to the map:

```js
  function currentHub() {
    const map = {
      goals: 'today', habits: 'today', mentor: 'today',
      health: 'body', fitness: 'body',
      learning: 'mind', library: 'mind', growth: 'mind'
    };
    return map[currentPageKey()] || 'today';
  }
```

In `pageDisplayName()` (around line 275), add `mentor: 'MENTOR'` to the map:

```js
  function pageDisplayName() {
    const map = {
      goals: 'GOALS', habits: 'HABITS', learning: 'LEARN', library: 'LIBRARY',
      health: 'HEALTH', fitness: 'FITNESS', growth: 'GROWTH', mentor: 'MENTOR'
    };
    return map[currentPageKey()] || 'GOALS';
  }
```

- [ ] **Step 3: Add the Mentor tile to `today.html`**

Edit `today.html` — inside `renderGrid()`, after the Library tile (around line 265) and before the Money full-width card:

```js
      const mentorReady = !!(localStorage.getItem('mentor_api_key') || '').trim();
      g += '<a class="mod glassy" href="mentor.html"><span class="k">Today — Mentor</span>' +
        '<span class="v num">' + (mentorReady ? 'Nova' : '—') + ' <small>' + (mentorReady ? 'ready' : 'not set up') + '</small></span>' +
        '<span class="d">' + (mentorReady ? 'ask Nova about your day' : 'tap to add your Claude key') + '</span></a>';
```

- [ ] **Step 4: Structural verification**

Run: `grep -c 'id="mentor' mentor.html; grep -c "mentor" topbar.js; grep -c 'mentor.html' today.html`
Expected: no errors; `topbar.js` and `today.html` each report at least one match.

Run: `curl -s http://localhost:8000/mentor.html | grep -o '<title>[^<]*</title>'`
Expected: `<title>Mentor</title>`

- [ ] **Step 5: Manual verification**

Open `http://localhost:8000/today.html` in a browser. Confirm a new "Today — Mentor" tile appears near Library. Click it. Confirm the URL changes to `mentor.html`, the topbar reads "SUNPATH · MENTOR", and the bottombar highlights "Today".

- [ ] **Step 6: Commit**

```bash
git add mentor.html topbar.js today.html
git commit -m "Add Mentor page shell wired into nav and today.html tile"
```

---

### Task 2: Nova 3D avatar

**Files:**
- Modify: `mentor.html`

**Interfaces:**
- Consumes: nothing from Task 1 beyond the `.page` div to append into.
- Produces: `window.Nova.setExpression(name, holdSeconds)` and `window.Nova.setPalette(a, b, c)` — later tasks call `setExpression` to react to chat state.

- [ ] **Step 1: Add the avatar card HTML** (inside `.page`, after `.dash-header`)

```html
  <div class="nova-card glassy">
    <div class="nova-stage"><canvas id="novaScene"></canvas></div>
    <div class="nova-label">
      <div class="nova-name">Nova</div>
      <div class="nova-role" id="novaRole">your mentor</div>
    </div>
  </div>
```

- [ ] **Step 2: Add avatar CSS** (append to the `<style>` block)

```css
.nova-card { padding: 20px; margin-bottom: 16px; text-align: center; }
.nova-stage {
  position: relative; height: 240px;
  display: grid; place-items: center;
  background:
    radial-gradient(60% 55% at 50% 42%, rgba(80,120,255,0.14), transparent 60%),
    radial-gradient(40% 40% at 70% 70%, rgba(190,80,255,0.10), transparent 65%);
  border-radius: 16px;
}
#novaScene { width: 200px; height: 200px; display: block; cursor: grab; }
#novaScene:active { cursor: grabbing; }
.nova-label { margin-top: 10px; }
.nova-name {
  font-family: Georgia, 'Times New Roman', serif; font-style: italic;
  font-size: 22px; letter-spacing: -0.01em;
  background: linear-gradient(90deg, #67e8f9, #a78bfa 60%, #f0abfc);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent;
}
.nova-role {
  margin-top: 4px; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase;
  color: rgba(255,255,255,0.4);
}
```

- [ ] **Step 3: Port the Nova Three.js factory** (append before `</body>`)

This is `ai-avatar.html`'s `buildNova(canvas)` factory (lines 1413-1673 of that file), unchanged — same octahedron/glass material, face-on-canvas-texture expression system, halo particles, and cursor-follow idle motion. Only the mount call at the bottom changes (one instance, not two):

```html
  <script type="module">
  import * as THREE from 'three'
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

  function buildNova(canvas) {
  const CYAN = new THREE.Color('#67E8F9'), VIOLET = new THREE.Color('#A78BFA'), PINK = new THREE.Color('#F0ABFC')
  let renderer
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }) }
  catch (e) { throw e }
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
  camera.position.set(0, 0.1, 5.2); camera.lookAt(0, 0, 0)

  function makeEnv() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64
    const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 64)
    g.addColorStop(0, '#0a1030'); g.addColorStop(0.5, '#243a8a'); g.addColorStop(0.75, '#7a4adf'); g.addColorStop(1, '#f0abfc')
    x.fillStyle = g; x.fillRect(0, 0, 64, 64)
    const tex = new THREE.CanvasTexture(c); tex.mapping = THREE.EquirectangularReflectionMapping
    const pm = new THREE.PMREMGenerator(renderer); const env = pm.fromEquirectangular(tex).texture
    tex.dispose(); pm.dispose(); return env
  }
  scene.environment = makeEnv()

  const avatar = new THREE.Group(); scene.add(avatar)

  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.18, 0),
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#dfe8ff'), metalness: 0, roughness: 0.06,
      transmission: 0.9, thickness: 2.0, ior: 1.6, clearcoat: 1, clearcoatRoughness: 0.1,
      iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [120, 520],
      attenuationColor: VIOLET.clone(), attenuationDistance: 2.4, envMapIntensity: 1.4,
    })
  )
  avatar.add(core)

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 32, 32),
    new THREE.MeshBasicMaterial({ color: VIOLET, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending })
  )
  avatar.add(glow)

  const fc = document.createElement('canvas'); fc.width = fc.height = 256
  const fx = fc.getContext('2d'); const faceTex = new THREE.CanvasTexture(fc)

  function strokeStyle(lw = 13) {
    fx.strokeStyle = '#eafcff'; fx.fillStyle = '#eafcff';
    fx.lineCap = 'round'; fx.lineJoin = 'round';
    fx.shadowColor = '#a78bfa'; fx.shadowBlur = 18; fx.lineWidth = lw;
  }
  let gx = 0, gy = 0;
  function eye(cx, cy, open, type, noPupil) {
    strokeStyle()
    fx.beginPath()
    if (type === 'happy')      fx.ellipse(cx, cy + 6, 26, 22, 0, Math.PI * 1.05, Math.PI * 1.95)
    else if (type === 'sad')   fx.ellipse(cx, cy - 6, 26, 22, 0, Math.PI * 0.05, Math.PI * 0.95)
    else if (type === 'closed')fx.ellipse(cx, cy, 24, 2, 0, 0, Math.PI * 2)
    else if (type === 'wide')  fx.ellipse(cx, cy, 22, 24 * open, 0, 0, Math.PI * 2)
    else                       fx.ellipse(cx, cy, 22, Math.max(1.5, 22 * open), 0, 0, Math.PI * 2)
    fx.stroke()
    if ((type === 'wide' || type === 'neutral') && !noPupil && open > 0.55) { fx.beginPath(); fx.arc(cx + gx, cy + gy, 5, 0, Math.PI * 2); fx.fill() }
  }
  function symbol(kind) {
    strokeStyle(11); fx.beginPath()
    if (kind === 'heart') {
      fx.fillStyle = '#ff8fcf'; fx.shadowColor = '#ff8fcf'
      fx.moveTo(128, 150)
      fx.bezierCurveTo(70, 100, 90, 60, 128, 96)
      fx.bezierCurveTo(166, 60, 186, 100, 128, 150)
      fx.fill()
    } else if (kind === 'star') {
      fx.fillStyle = '#ffe08a'; fx.shadowColor = '#ffe08a'
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 16 : 38, a = -Math.PI / 2 + i * Math.PI / 5
        const px = 128 + Math.cos(a) * r, py = 118 + Math.sin(a) * r
        i ? fx.lineTo(px, py) : fx.moveTo(px, py)
      }
      fx.closePath(); fx.fill()
    }
    faceTex.needsUpdate = true
  }

  const EXPR = {
    neutral:   { eye: 'neutral', mouth: null },
    happy:     { eye: 'happy',   mouth: 'smile' },
    sad:       { eye: 'sad',     mouth: 'frown' },
    surprised: { eye: 'wide',    mouth: 'o' },
    thinking:  { eye: 'neutral', mouth: null, dots: true },
    sleepy:    { eye: 'closed',  mouth: null, zzz: true },
    wink:      { eye: 'wink',    mouth: 'smile' },
    love:      { symbol: 'heart' },
    star:      { symbol: 'star' },
  }

  function drawFace(open = 1, expr = 'neutral', rightOpen = null, time = 0) {
    fx.clearRect(0, 0, 256, 256)
    const e = EXPR[expr] || EXPR.neutral
    if (e.symbol) { symbol(e.symbol); return }
    if (rightOpen == null) rightOpen = open
    if (e.eye === 'wink') {
      eye(86, 110, open, 'neutral')
      eye(170, 110, rightOpen, 'neutral', true)
    } else {
      eye(86, 110, open, e.eye)
      eye(170, 110, open, e.eye)
    }
    strokeStyle(10)
    if (e.mouth === 'smile') { fx.beginPath(); fx.arc(128, 158, 30, Math.PI * 0.12, Math.PI * 0.88); fx.stroke() }
    else if (e.mouth === 'frown') { fx.beginPath(); fx.arc(128, 196, 30, Math.PI * 1.12, Math.PI * 1.88); fx.stroke() }
    else if (e.mouth === 'o') { fx.beginPath(); fx.arc(128, 168, 13, 0, Math.PI * 2); fx.stroke() }
    if (e.dots) {
      fx.fillStyle = '#eafcff'
      ;[108, 128, 148].forEach((x, i) => {
        fx.beginPath(); fx.arc(x, 172, 4, 0, Math.PI * 2)
        fx.globalAlpha = 0.3 + 0.6 * (0.5 + 0.5 * Math.sin(time * 4 - i * 0.9))
        fx.fill()
      })
      fx.globalAlpha = 1
    }
    if (e.zzz) {
      const f = (time * 0.55) % 1
      fx.fillStyle = '#eafcff'; fx.globalAlpha = 1 - f
      fx.font = 'italic 22px serif'; fx.fillText('z', 176, 86 - f * 16)
      fx.font = 'italic 16px serif'; fx.fillText('z', 196, 70 - f * 16)
      fx.globalAlpha = 1
    }
    faceTex.needsUpdate = true
  }
  drawFace(1, 'neutral')
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.05),
    new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, opacity: 0.98, depthTest: false, depthWrite: false }))
  face.position.set(0, 0, 1.25)
  face.renderOrder = 999
  avatar.add(face)

  const N = 70, pPos = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    const r = 2.0 + Math.random() * 0.9, t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1)
    pPos[i*3] = r*Math.sin(p)*Math.cos(t); pPos[i*3+1] = r*Math.cos(p)*0.6; pPos[i*3+2] = r*Math.sin(p)*Math.sin(t)
  }
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3))
  const halo = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: CYAN, size: 0.03, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }))
  avatar.add(halo)

  const key = new THREE.DirectionalLight(CYAN, 2.2); key.position.set(2, 3, 4); scene.add(key)
  const rim = new THREE.DirectionalLight(VIOLET, 1.8); rim.position.set(-3, 1, -2); scene.add(rim)
  const fill = new THREE.PointLight(PINK, 6, 12); fill.position.set(0, -2, 2); scene.add(fill)
  scene.add(new THREE.AmbientLight(0x223066, 0.6))

  function setPalette(a, b, c) {
    CYAN.set(a); VIOLET.set(b); PINK.set(c)
    key.color.set(a); rim.color.set(b); fill.color.set(c)
    halo.material.color.set(a)
    glow.material.color.set(b)
    core.material.attenuationColor.set(b)
    core.material.needsUpdate = true
  }

  const target = { x: 0, y: 0 }, cur = { x: 0, y: 0 }
  addEventListener('pointermove', e => { target.x = (e.clientX / innerWidth - 0.5) * 2; target.y = (e.clientY / innerHeight - 0.5) * 2 })

  function resize() {
    const s = canvas.clientWidth || 200
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(s, s, false)
    camera.aspect = 1; camera.updateProjectionMatrix()
  }
  new ResizeObserver(resize).observe(canvas); resize()

  let expr = 'neutral';
  let exprHold = -1;
  let pop = 0;
  let winkT = 0;
  let prevExpr = 'neutral';
  let transT = -1;
  const TRANS_DUR = 0.36;
  function setExpression(name, holdSec = 0) {
    if (!EXPR[name]) return
    if (name !== expr) { prevExpr = expr; transT = 0 }
    expr = name; pop = 1; exprHold = holdSec > 0 ? holdSec : -1
    winkT = 0
  }

  const clock = new THREE.Clock(); let nextBlink = 2.5, blinkT = -1
  function frame() {
    requestAnimationFrame(frame)
    const t = clock.getElapsedTime(), dt = Math.min(clock.getDelta(), 0.05)
    if (!reduce) {
      cur.x += (target.x - cur.x) * 0.06; cur.y += (target.y - cur.y) * 0.06
      avatar.rotation.y = cur.x * 0.5 + Math.sin(t * 0.25) * 0.15
      avatar.rotation.x = cur.y * 0.35 + Math.sin(t * 0.4) * 0.05
      core.rotation.y = t * 0.35; core.rotation.x = Math.sin(t * 0.5) * 0.2
      pop = Math.max(0, pop - dt * 2.2)
      const breathe = 1 + Math.sin(t * 1.4) * 0.025 + pop * 0.12
      core.scale.setScalar(breathe)
      glow.material.opacity = 0.4 + Math.sin(t * 1.4) * 0.12 + pop * 0.3
      glow.scale.setScalar(1 + Math.sin(t * 1.4) * 0.06 + pop * 0.15)
      halo.rotation.y = t * 0.08
      gx = Math.max(-6, Math.min(6, cur.x * 5 + Math.sin(t * 0.7) * 2))
      gy = Math.max(-5, Math.min(5, cur.y * 4 + Math.cos(t * 0.9) * 1.5))

      let open = 1
      let shownExpr = expr
      const sym = (EXPR[expr] || {}).symbol
      if (transT >= 0) {
        transT += dt
        const k = Math.min(1, transT / TRANS_DUR)
        shownExpr = k < 0.5 ? prevExpr : expr
        const h = k < 0.5 ? 1 - k * 2 : (k - 0.5) * 2
        open = k < 0.5 ? h : h * (1 + 0.14 * Math.sin(h * Math.PI))
        if (transT >= TRANS_DUR) transT = -1
      } else if (!sym) {
        if (blinkT >= 0) { const k = blinkT / 0.18; open = Math.abs(k - 0.5) * 2; blinkT += dt; if (blinkT > 0.18) blinkT = -1 }
        else if (t > nextBlink) { blinkT = 0; nextBlink = t + 2.4 + Math.random() * 3.4 }
        else open = 0.93 + 0.07 * Math.sin(t * 2.0)
      }
      if (exprHold > 0) { exprHold -= dt; if (exprHold <= 0) { setExpression('neutral'); exprHold = -1 } }
      winkT += dt
      const rightOpen = shownExpr === 'wink' ? Math.max(0, 1 - winkT / 0.32) : open
      drawFace(open, shownExpr, rightOpen, t)
      face.rotation.y = -avatar.rotation.y * 0.6; face.rotation.x = -avatar.rotation.x * 0.6
    }
    renderer.render(scene, camera)
  }
  frame()
  return { setExpression, setPalette, expressions: Object.keys(EXPR) }
  }

  window.Nova = buildNova(document.getElementById('novaScene'))
  </script>
```

- [ ] **Step 4: Structural verification**

Run: `grep -c 'buildNova' mentor.html; grep -c 'window.Nova = buildNova' mentor.html`
Expected: both ≥ 1.

- [ ] **Step 5: Manual verification**

Reload `http://localhost:8000/mentor.html`. Confirm the crystal renders, slowly rotates/breathes, and tilts toward the cursor. Open the browser console and run `Nova.setExpression('happy', 3)` — confirm the face changes to a smile for ~3s then returns to neutral.

- [ ] **Step 6: Commit**

```bash
git add mentor.html
git commit -m "Port Nova 3D avatar into the Mentor page"
```

---

### Task 3: Sunpath data digest

**Files:**
- Modify: `mentor.html`

**Interfaces:**
- Consumes: `window.Sunpath` (from `sunpath.js`, already loaded in Task 1's head) — `goalsToday()`, `habits()`, `fitness()`, `waterProgress()`, `stackToday()`, `learning()`, `library()`, `growth()`, `money()`, `fmtShort(ts)`.
- Produces: `buildSunpathDigest()` — returns a plain-text multi-line string. Task 5 calls this to build the system prompt.

- [ ] **Step 1: Add the digest function** (in the main `<script>` block, before the chat logic added in Task 4)

```html
  <script>
  function buildSunpathDigest() {
    const S = window.Sunpath;
    if (!S) return 'No Sunpath data available yet.';
    const parts = [];
    try {
      const G = S.goalsToday();
      parts.push('Goals: ' + (G.total ? G.done + '/' + G.total + ' done today' : 'none set today'));
    } catch (e) {}
    try {
      const H = S.habits();
      parts.push('Habits: best streak ' + H.bestStreak + ' days, ' + H.list.length + ' tracked');
    } catch (e) {}
    try {
      const F = S.fitness();
      const last = F.sessions[0];
      parts.push('Fitness: ' + (F.km % 1 === 0 ? F.km : F.km.toFixed(1)) + ' km all-time' +
        (last ? ', last session ' + last.type + ' on ' + last.date : ', no sessions yet'));
    } catch (e) {}
    try {
      const W = S.waterProgress();
      parts.push('Water today: ' + (W.total ? W.done + '/' + W.total : 'not tracked'));
    } catch (e) {}
    try {
      const st = S.stackToday();
      if (st.total) parts.push('Supplement stack: ' + st.taken + '/' + st.total + ' taken today');
    } catch (e) {}
    try {
      const L = S.learning();
      parts.push('Learning: ' + (L.hours % 1 === 0 ? L.hours : L.hours.toFixed(1)) + ' hours total');
    } catch (e) {}
    try {
      const Lib = S.library();
      const reading = Lib.books.filter(function (b) { return b && b.status === 'reading'; });
      parts.push('Library: ' + reading.length + ' book(s) currently reading' +
        (reading[0] ? ' — "' + reading[0].title + '"' : ''));
    } catch (e) {}
    try {
      const Gr = S.growth();
      const lastNote = Gr.notes[0];
      parts.push('Growth: ' + (lastNote ? 'last reflection ' + S.fmtShort(lastNote.ts) : 'no reflections yet'));
    } catch (e) {}
    try {
      const M = S.money();
      if (M) parts.push('Money: net worth ' + Math.round(M.last.v).toLocaleString() + ' SGD, ' +
        (M.delta30 >= 0 ? '+' : '') + Math.round(M.delta30).toLocaleString() + ' past 30d');
    } catch (e) {}
    return parts.join('\n');
  }
  </script>
```

- [ ] **Step 2: Structural verification**

Run: `grep -c 'function buildSunpathDigest' mentor.html`
Expected: 1.

- [ ] **Step 3: Manual verification**

Open `http://localhost:8000/mentor.html`, open the browser console, run `buildSunpathDigest()`. Confirm it returns a multi-line string with no `undefined`/thrown errors, and that the numbers (goals done, km, water) match what's shown on `today.html`.

- [ ] **Step 4: Commit**

```bash
git add mentor.html
git commit -m "Add Sunpath data digest for grounding Mentor's replies"
```

---

### Task 4: Chat box UI + cozy-loader thinking state (stubbed reply)

**Files:**
- Modify: `mentor.html`

**Interfaces:**
- Consumes: `escapeHtml` (defined in this task), `window.Nova.setExpression` (Task 2).
- Produces: `addUserBubble(text)`, `addNovaBubble(html)`, `addThinkingBubble()` → `{ el, stop() }`, `send(text)`, `hasKey()`, `promptForKey()`. Task 5 replaces the `runReply` stub these call into.

- [ ] **Step 1: Add the chat card HTML** (inside `.page`, after the Nova avatar card)

```html
  <div class="chat-card glassy">
    <div class="chat-feed" id="chatFeed"></div>
    <div class="chat-composer">
      <input id="chatInput" placeholder="ask Nova&hellip;" autocomplete="off" />
      <button id="chatSend" aria-label="Send">&rarr;</button>
    </div>
  </div>
```

Also add a settings button to the header, next to the title (inside `.dash-header`, as a sibling of the title `<div>`):

```html
    <button class="nova-settings-btn" id="mentorSettings" aria-label="Settings" type="button">&#9881;</button>
```

- [ ] **Step 2: Add chat + cozy-loader CSS** (append to `<style>`)

```css
.nova-settings-btn {
  width: 36px; height: 36px; border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.6); font-size: 16px; cursor: pointer;
}
.chat-card { padding: 18px; display: flex; flex-direction: column; gap: 14px; }
.chat-feed { display: flex; flex-direction: column; gap: 14px; max-height: 460px; overflow-y: auto; padding-right: 4px; }
.msg { max-width: 86%; }
.msg.user { align-self: flex-end; }
.msg.nova { align-self: flex-start; width: 100%; }
.bubble { border-radius: 16px; padding: 14px 16px; font-size: 15px; line-height: 1.5; }
.msg.user .bubble { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); }
.msg.nova .bubble {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(167,139,250,0.45);
  border-left: 3px solid #A78BFA; backdrop-filter: blur(8px);
}
.tagchip {
  display: inline-flex; align-items: center; gap: 6px; margin-bottom: 10px;
  font-family: ui-monospace, monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
  color: #1b1233; background: #A78BFA; padding: 4px 10px; border-radius: 999px;
}
.bubble-text { animation: rvFade .5s ease both; }
@keyframes rvFade { from{ opacity:0; transform: translateY(4px) } to{ opacity:1; transform:none } }
.chat-composer { display: flex; gap: 10px; }
.chat-composer input {
  flex: 1; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);
  color: #FAFAFA; border-radius: 12px; padding: 14px 16px; font-size: 15px; outline: none; font-family: inherit;
}
.chat-composer input:focus { border-color: #A78BFA; }
.chat-composer button {
  width: 52px; border: 0; border-radius: 12px; cursor: pointer; color: #1b1233;
  background: #A78BFA; font-size: 18px;
}
.chat-composer button:active { transform: scale(0.94); }
.key-prompt { display: flex; flex-direction: column; gap: 10px; }
.key-prompt input {
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);
  color: #FAFAFA; border-radius: 10px; padding: 10px 12px; font-size: 13px; font-family: inherit; outline: none;
}
.key-prompt button {
  align-self: flex-start; background: #A78BFA; color: #1b1233; border: 0; border-radius: 999px;
  padding: 8px 16px; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer;
}
.cz {
  --tone: #A78BFA; --tone-soft: rgba(167,139,250,0.28); --tone-ink: #1b1233;
  display: flex; gap: 14px; border: 1px solid var(--tone-soft);
  background: rgba(255,255,255,0.02); border-radius: 14px; padding: 14px; max-width: 460px;
}
.cz .cz-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
.cz .cz-bar { height: 4px; border-radius: 999px; background: rgba(255,255,255,0.16); overflow: hidden; }
.cz .cz-bar span {
  display: block; height: 100%; width: 40%; border-radius: 999px;
  background: linear-gradient(90deg, transparent, var(--tone), transparent);
  animation: czSlide 1.4s cubic-bezier(.16,1,.3,1) infinite;
}
.cz .cz-fact { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; min-height: 2.4em; }
.cz .cz-tag {
  font-family: ui-monospace, monospace; font-size: 9.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--tone-ink); background: var(--tone); border-radius: 999px; padding: 3px 10px; width: fit-content;
  animation: czTagPop 0.5s cubic-bezier(0.34,1.56,0.64,1);
}
.cz .cz-dots { display: flex; gap: 6px; }
.cz .cz-dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--tone); opacity: 0.4; animation: czDot 1.2s ease-in-out infinite; }
.cz .cz-dots i:nth-child(2){ animation-delay:.2s } .cz .cz-dots i:nth-child(3){ animation-delay:.4s }
@keyframes czTagPop { 0%{ opacity:0; transform: scale(.6) rotate(-6deg) } 100%{ opacity:1; transform: scale(1) rotate(0) } }
@keyframes czDot { 0%,100%{ opacity:.35; transform: scale(1) } 50%{ opacity:1; transform: scale(1.5) } }
@keyframes czSlide { from{ transform: translateX(-120%) } to{ transform: translateX(320%) } }
@media (prefers-reduced-motion: reduce) { .cz, .cz *, .cz .cz-bar span { animation: none !important } .cz .cz-bar span { width: 100%; opacity:.5 } }
```

- [ ] **Step 3: Add chat JS** (append to the main `<script>` block, after `buildSunpathDigest`)

```js
  var chatFeed = document.getElementById('chatFeed');
  var chatInput = document.getElementById('chatInput');
  var chatSend = document.getElementById('chatSend');

  function escapeHtml(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function scrollChat() { chatFeed.scrollTop = chatFeed.scrollHeight; }

  function addUserBubble(text) {
    const el = document.createElement('div');
    el.className = 'msg user';
    el.innerHTML = '<div class="bubble">' + escapeHtml(text) + '</div>';
    chatFeed.appendChild(el); scrollChat();
    return el;
  }
  function addNovaBubble(html) {
    const el = document.createElement('div');
    el.className = 'msg nova';
    el.innerHTML = '<div class="bubble"><span class="tagchip">Nova</span><div class="bubble-text">' + html + '</div></div>';
    chatFeed.appendChild(el); scrollChat();
    return el;
  }
  const COZY_PHRASES = ['reading your day', 'checking your goals', 'thinking it through'];
  function addThinkingBubble() {
    const el = document.createElement('div');
    el.className = 'msg nova';
    el.innerHTML = '<div class="bubble"><span class="tagchip">Nova</span><div class="cz"><div class="cz-body">' +
      '<div class="cz-bar"><span></span></div><div class="cz-fact"><span class="cz-tag" id="czTag">' + COZY_PHRASES[0] +
      '</span><div class="cz-dots"><i></i><i></i><i></i></div></div></div></div></div>';
    chatFeed.appendChild(el); scrollChat();
    let i = 0;
    const timer = setInterval(function () {
      i = (i + 1) % COZY_PHRASES.length;
      const tag = el.querySelector('#czTag');
      if (tag) tag.textContent = COZY_PHRASES[i];
    }, 1600);
    return { el: el, stop: function () { clearInterval(timer); } };
  }

  function hasKey() { return !!(localStorage.getItem('mentor_api_key') || '').trim(); }
  function promptForKey() {
    const el = document.createElement('div');
    el.className = 'msg nova';
    el.innerHTML = '<div class="bubble"><span class="tagchip">Nova</span>' +
      '<div class="bubble-text">I need a Claude API key before I can reply. Paste one below — it stays in your browser only.</div>' +
      '<div class="key-prompt" style="margin-top:10px">' +
      '<input type="password" id="keyInput" placeholder="sk-ant-&hellip;" autocomplete="off" />' +
      '<button id="keySave">Save key</button></div></div>';
    chatFeed.appendChild(el); scrollChat();
    el.querySelector('#keySave').addEventListener('click', function () {
      const v = el.querySelector('#keyInput').value.trim();
      if (!v) return;
      localStorage.setItem('mentor_api_key', v);
      el.remove();
      addNovaBubble('Got it — ask away.');
    });
  }

  function runReply(text) {
    const think = addThinkingBubble();
    setTimeout(function () {
      think.stop(); think.el.remove();
      addNovaBubble('(stub reply — wired to Claude in the next step)');
    }, 1200);
  }

  function send(text) {
    text = text.trim();
    if (!text) return;
    addUserBubble(text);
    chatInput.value = '';
    if (!hasKey()) { promptForKey(); return; }
    runReply(text);
  }
  chatSend.addEventListener('click', function () { send(chatInput.value); });
  chatInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(chatInput.value); });
  document.getElementById('mentorSettings').addEventListener('click', function () { promptForKey(); });

  if (!hasKey()) {
    addNovaBubble('Hey, I\'m Nova. I read your Sunpath data so I can actually help.');
    promptForKey();
  } else {
    addNovaBubble('Hey, I\'m Nova. Ask me anything about your day.');
  }
```

- [ ] **Step 4: Structural verification**

Run: `grep -c 'function send' mentor.html; grep -c 'promptForKey' mentor.html`
Expected: both ≥ 1.

- [ ] **Step 5: Manual verification**

In the browser console on `mentor.html`, run `localStorage.removeItem('mentor_api_key')` and reload. Confirm Nova's greeting + the key-prompt bubble (with password input) appear. Type any text into the key field, click "Save key", confirm the prompt bubble's input disappears and "Got it" appears. Type a message and send; confirm a cozy-loader "thinking" bubble appears (rotating tag text, shimmer bar, pulsing dots) and is replaced by the stub reply after ~1.2s.

- [ ] **Step 6: Commit**

```bash
git add mentor.html
git commit -m "Add Mentor chat UI with cozy-loader thinking state (stub reply)"
```

---

### Task 5: Wire the real Claude API call

**Files:**
- Modify: `mentor.html`

**Interfaces:**
- Consumes: `buildSunpathDigest()` (Task 3), `addThinkingBubble`/`addNovaBubble`/`escapeHtml` (Task 4), `window.Nova.setExpression` (Task 2).
- Produces: real `runReply(text)`, replacing Task 4's stub.

- [ ] **Step 1: Replace the stub `runReply`**

```js
  const MENTOR_MODEL = 'claude-sonnet-5';
  let chatHistory = [];

  function novaSystemPrompt() {
    return 'You are Nova, a warm, direct personal mentor inside the user\'s Sunpath life-tracking dashboard. ' +
      'Use the data below to ground your answers in what is actually happening in their life. Be concise — ' +
      'a few sentences, not an essay — and speak like a supportive coach, not a generic assistant.\n\n' +
      'Current data:\n' + buildSunpathDigest();
  }

  async function runReply(text) {
    const think = addThinkingBubble();
    if (window.Nova) window.Nova.setExpression('thinking');
    chatHistory.push({ role: 'user', content: text });
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': localStorage.getItem('mentor_api_key') || '',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: MENTOR_MODEL,
          max_tokens: 512,
          system: novaSystemPrompt(),
          messages: chatHistory
        })
      });
      think.stop(); think.el.remove();
      if (!res.ok) {
        const errBody = await res.json().catch(function () { return {}; });
        const msg = (errBody && errBody.error && errBody.error.message) || ('Request failed (' + res.status + ')');
        addNovaBubble('Something went wrong: ' + escapeHtml(msg) + '. Check your key (gear icon) and try again.');
        if (window.Nova) window.Nova.setExpression('sad', 4);
        chatHistory.pop();
        return;
      }
      const data = await res.json();
      const reply = (data.content && data.content[0] && data.content[0].text) || '(empty reply)';
      chatHistory.push({ role: 'assistant', content: reply });
      addNovaBubble(escapeHtml(reply).replace(/\n/g, '<br>'));
      if (window.Nova) window.Nova.setExpression('happy', 4);
    } catch (e) {
      think.stop(); think.el.remove();
      addNovaBubble('Couldn\'t reach Claude — check your connection and try again.');
      if (window.Nova) window.Nova.setExpression('sad', 4);
      chatHistory.pop();
    }
  }
```

Remove Task 4's stub `runReply` function (this replaces it — same name, same call sites in `send()`, nothing else to change).

- [ ] **Step 2: Structural verification**

Run: `grep -c "api.anthropic.com/v1/messages" mentor.html; grep -c "anthropic-dangerous-direct-browser-access" mentor.html; grep -c "(stub reply" mentor.html`
Expected: first two ≥ 1, last one 0 (stub fully removed).

- [ ] **Step 3: Manual verification — happy path**

With a real Anthropic API key saved (via the gear icon or the first-run prompt), send "how am I tracking today?" in the chat. Confirm: a cozy-loader thinking bubble appears, Nova's face shows `thinking`, then a real reply appears that references actual numbers from `buildSunpathDigest()` (e.g. real goal count), and Nova's face settles to `happy`.

- [ ] **Step 4: Manual verification — error states**

Set an invalid key (`localStorage.setItem('mentor_api_key', 'bad-key')`), reload, send a message. Confirm a friendly error bubble appears (not a raw stack trace or blank state) and the chat remains usable. Then test with the OS network disabled/offline — confirm the "Couldn't reach Claude" bubble appears instead of a hang.

- [ ] **Step 5: Commit**

```bash
git add mentor.html
git commit -m "Wire Mentor chat to the Claude API, grounded in Sunpath data"
```

---

### Task 6: Final pass and ship

**Files:** none (verification + git operations only)

- [ ] **Step 1: Full click-through**

From `http://localhost:8000/today.html`: click the Mentor tile → confirm nav highlighting (Task 1) → confirm avatar idles (Task 2) → confirm chat + cozy loader + real Claude reply grounded in data (Tasks 3-5) → confirm the today.html tile itself now reads "Nova / ready" once a key is saved (reload `today.html` after saving a key on `mentor.html`).

- [ ] **Step 2: Mobile viewport check**

Resize the browser (or use dev-tools device toolbar) to a phone width (~390px). Confirm the avatar card, chat bubbles, and composer don't overflow horizontally and the bottombar doesn't overlap the composer.

- [ ] **Step 3: Confirm no unrelated files touched**

Run: `git status`
Expected: only `mentor.html`, `topbar.js`, `today.html` show as modified/new beyond what's already committed from Tasks 1-5; `ai-avatar.html`, `gym.html`, and `row/` are untouched by this plan.

- [ ] **Step 4: Push — only after explicit user confirmation**

```bash
git push origin main
```

Do not run this step until the user has confirmed they want it pushed (per the established sync workflow: confirm before every push).
