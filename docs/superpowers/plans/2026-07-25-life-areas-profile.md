# Life Areas + Profile Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `areas.html` — a new Sunpath page combining a Profile card (avatar identity + aggregate Level) with a grid of 6 RPG-style Life Area stat cards (strength/intellect/vitality/perception/wealth/education), per `docs/superpowers/specs/2026-07-25-life-areas-profile-design.md`.

**Architecture:** `areas.html` is a new standalone page following the existing hub-page pattern (`today.html`/`body.html`/`mind.html`/`money.html`): `sunpath.css` for tokens/`.glassy`/`.grid2`, `sunpath.js` for `S.readJSON`/`S.esc`/`S.injectDock`, `sync.js` for `initCloudSync`. All content is self-rendered from two new `localStorage` keys (`sunpath_profile`, `sunpath_life_areas`) via inline `<script>`, matching how every other Sunpath page owns its own render/edit logic.

**Correction to the spec's nav section:** the spec describes the entry point as a "topbar.js" change, but `topbar.js`'s SUNPATH-branded topbar only exists on the *classic* pages (`gym.html`, `health.html`, `habits.html`, etc.) — the four hub pages (`today.html`/`body.html`/`mind.html`/`money.html`) don't include `topbar.js` at all. They use `sunpath.js`'s `injectDock()` for their bottom nav instead. So the avatar entry point is added there: `injectDock()` gains a companion `injectAvatarBubble()` call that renders a small fixed circular avatar button (linking to `areas.html`) on every page that already calls `injectDock()` — meaning `today.html`/`body.html`/`mind.html`/`money.html`/`areas.html` all get it automatically, with zero changes needed to those four existing files. This achieves the spec's intent (a persistent avatar tap-target, no new bottom-nav tab) correctly for the pages that actually need it.

**Tech Stack:** Static HTML/CSS/vanilla JS, `localStorage`, Supabase (via existing `sync.js`/`initCloudSync`). No build step, no test framework in this repo — verification steps use `node --check` and manual browser checks (seeding `localStorage` via devtools console), matching the convention in `docs/superpowers/plans/2026-07-24-today-day-navigation.md`.

## Global Constraints

- New page must visually match Sunpath's existing dark/glassy aesthetic (`sunpath.css` tokens, `.glassy`, `.grid2`, `.section`/`.sec-head`) — no new competing visual language.
- `sunpath_profile` and `sunpath_life_areas` are the only two new `localStorage` keys. No other page's existing keys are touched.
- No 5th bottom-nav tab. No Shards/Market/Inventory economy. XP is manually entered, not auto-computed from other pages' activity.
- `Level = round(XP / 1000)` per life area. `Avatar Level = round(totalXP / 6000)` (sum of all 6 areas' XP).
- Every generalized/shared file (`sunpath.js`, `sunpath.css`) must keep existing pages (`today.html`, `body.html`, `mind.html`, `money.html`) working unchanged — the avatar bubble is additive only.

---

### Task 1: Create `areas.html` — profile card, life-area grid, and edit modals

**Files:**
- Create: `areas.html`

**Interfaces:**
- Consumes: `S.readJSON(key, fallback)`, `S.esc(s)`, `S.injectDock(activeId)` (all existing, from `sunpath.js`).
- Produces: `localStorage['sunpath_profile']` → `{ name, avatarDataUrl, avatarEmoji }`; `localStorage['sunpath_life_areas']` → array of `{ id, xp, purpose, category, tags, resources }` (6 entries, one per `AREA_META` id: `strength`, `intellect`, `vitality`, `perception`, `wealth`, `education`). Both consumed by Task 2 (sync) and Task 3 (`S.profile()` reader in `sunpath.js` reads `sunpath_profile` directly).

- [ ] **Step 1: Write `areas.html`**

Create `areas.html` with this full content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0A0B0E">
<meta name="color-scheme" content="dark">
<title>Profile — Sunpath</title>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..800&family=Spline+Sans+Mono:wght@400;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="sunpath.css">
<script src="sunpath.js" defer></script>
<style>
.profile-card { padding: 20px 18px; display: flex; align-items: center; gap: 16px; position: relative; }
.profile-avatar {
  width: 64px; height: 64px; border-radius: 50%; flex: 0 0 auto;
  display: flex; align-items: center; justify-content: center;
  background: rgba(244,241,234,0.06); border: 1px solid var(--glass-border);
  overflow: hidden; font-size: 28px;
}
.profile-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.profile-body { flex: 1; min-width: 0; }
.profile-name { font-size: 17px; font-weight: 700; color: var(--ink); }
.profile-level { font-family: var(--mono); font-size: 11px; color: var(--sun); margin-top: 2px; letter-spacing: 0.04em; }
.profile-edit-btn {
  position: absolute; top: 14px; right: 14px;
  width: 30px; height: 30px; border-radius: 50%; border: none; cursor: pointer;
  background: rgba(244,241,234,0.08); color: var(--ink); font-size: 13px;
  display: flex; align-items: center; justify-content: center;
}
.xp-bar { display: flex; gap: 3px; margin-top: 8px; }
.xp-bar i { flex: 1; height: 6px; border-radius: 3px; background: rgba(244,241,234,0.08); display: block; }
.xp-bar i.on { background: var(--seg-color, var(--sun)); }
.xp-label { font-family: var(--mono); font-size: 10px; color: var(--faint); margin-top: 5px; }

.area-card { padding: 14px 14px 12px; position: relative; display: flex; flex-direction: column; cursor: pointer; }
.area-card-icon { font-size: 20px; }
.area-card-name { font-size: 13.5px; font-weight: 700; display: block; margin-top: 4px; }
.area-card-purpose { font-size: 10.5px; color: var(--muted); margin-top: 4px; line-height: 1.4; display: block; min-height: 28px; }
.area-card-level { font-family: var(--mono); font-size: 10px; color: var(--faint); margin-top: 8px; display: block; }
.area-card-cat {
  display: inline-block; margin-top: 6px; font-size: 9.5px; letter-spacing: 0.04em; text-transform: uppercase;
  color: var(--faint); border: 1px solid var(--line); border-radius: 999px; padding: 2px 7px; align-self: flex-start;
}
.area-card-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.area-card-tags span { font-size: 9.5px; color: var(--muted); background: rgba(244,241,234,0.06); border-radius: 999px; padding: 2px 7px; }
.area-card-res { margin-top: 6px; font-size: 10px; color: var(--faint); }
.area-card-res a { color: var(--muted); text-decoration: underline; }
.area-edit-btn {
  position: absolute; top: 10px; right: 10px;
  width: 24px; height: 24px; border-radius: 50%; border: none; cursor: pointer;
  background: rgba(244,241,234,0.08); color: var(--ink); font-size: 11px;
  display: flex; align-items: center; justify-content: center;
}

.modal-bg { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.65); backdrop-filter: blur(6px); z-index: 100; align-items: center; justify-content: center; padding: 20px; }
.modal-bg.show { display: flex; }
.modal { width: 100%; max-width: 480px; background: #14151c; border: 1px solid var(--glass-border); border-radius: 16px; padding: 22px; max-height: 88vh; overflow-y: auto; font-family: var(--display); color: var(--muted); }
.modal h3 { margin: 0 0 14px; font-size: 17px; font-weight: 700; color: var(--ink); }
.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.field label { font-size: 10.5px; color: var(--faint); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.field input[type="text"], .field input[type="number"], .field textarea {
  background: rgba(255,255,255,0.05); border: 1px solid var(--line); color: var(--ink);
  font-family: var(--display); font-size: 13px; padding: 9px 11px; border-radius: 10px; outline: none; width: 100%; resize: vertical;
}
.field input:focus, .field textarea:focus { border-color: rgba(158,217,160,0.4); }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.btn-primary { padding: 11px 16px; border: none; background: var(--sun); color: #0A0B0E; border-radius: 12px; font-family: var(--display); font-size: 13.5px; font-weight: 700; cursor: pointer; }
.btn-secondary { padding: 10px 15px; border: 1px solid var(--line); background: rgba(255,255,255,0.04); color: var(--ink); border-radius: 10px; font-family: var(--display); font-size: 12.5px; font-weight: 600; cursor: pointer; }
.modal-actions { display: flex; gap: 8px; margin-top: 6px; justify-content: flex-end; }
.avatar-upload-row { display: flex; align-items: center; gap: 12px; }
.avatar-upload-row .profile-avatar { width: 52px; height: 52px; font-size: 22px; }
.chip-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.chip { display: inline-flex; align-items: center; gap: 5px; background: rgba(244,241,234,0.07); border-radius: 999px; padding: 4px 6px 4px 10px; font-size: 11.5px; color: var(--ink); }
.chip button { border: none; background: none; color: var(--faint); cursor: pointer; font-size: 12px; line-height: 1; padding: 2px; }
.chip-add-row, .res-add-row { display: flex; gap: 6px; }
.chip-add-row input, .res-add-row input { flex: 1; }
.res-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
.res-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; background: rgba(244,241,234,0.05); border-radius: 8px; padding: 6px 10px; font-size: 11.5px; color: var(--ink); }
.res-row button { border: none; background: none; color: var(--faint); cursor: pointer; font-size: 12px; }
</style>
</head>
<body>
<div class="shellwrap">
  <div class="profile-card glassy" id="spProfileCard"></div>

  <div class="section">
    <div class="sec-head">Life Areas</div>
    <div class="grid2" id="spAreasGrid"></div>
  </div>
</div>

<div class="modal-bg" id="profileModalBg">
  <div class="modal">
    <h3>Edit profile</h3>
    <div class="field">
      <label>Avatar image</label>
      <div class="avatar-upload-row">
        <div class="profile-avatar" id="avatarPreviewWrap">
          <img id="avatarPreview" alt="" style="display:none">
          <span id="avatarPreviewFallback">🙂</span>
        </div>
        <input type="file" id="avatarFile" accept="image/*">
      </div>
    </div>
    <div class="field"><label>Name</label><input type="text" id="profileName" maxlength="40"></div>
    <div class="modal-actions">
      <button class="btn-secondary" id="profileCancel" type="button">Cancel</button>
      <button class="btn-primary" id="profileSave" type="button">Save</button>
    </div>
  </div>
</div>

<div class="modal-bg" id="areaModalBg">
  <div class="modal">
    <h3 id="areaModalTitle">Edit area</h3>
    <div class="field"><label>Purpose</label><textarea id="areaPurpose" rows="3" maxlength="240"></textarea></div>
    <div class="field-row">
      <div class="field"><label>XP</label><input type="number" id="areaXp" min="0" max="100000" step="10"></div>
      <div class="field"><label>Category</label><input type="text" id="areaCategory" maxlength="30"></div>
    </div>
    <div class="field">
      <label>Tags</label>
      <div class="chip-list" id="areaTagsList"></div>
      <div class="chip-add-row"><input type="text" id="areaTagInput" placeholder="Add a tag…"><button class="btn-secondary" id="areaTagAdd" type="button">+</button></div>
    </div>
    <div class="field">
      <label>Linked resources</label>
      <div class="res-list" id="areaResList"></div>
      <div class="res-add-row">
        <input type="text" id="areaResLabel" placeholder="Label">
        <input type="text" id="areaResUrl" placeholder="URL (optional)">
        <button class="btn-secondary" id="areaResAdd" type="button">+</button>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="areaCancel" type="button">Cancel</button>
      <button class="btn-primary" id="areaSave" type="button">Save</button>
    </div>
  </div>
</div>

<script>
(function () {
  'use strict';
  function boot() {
    const S = window.Sunpath;
    if (!S) return;

    const AREA_META = [
      { id: 'strength',   icon: '🔥', name: 'Strength',   accent: 'var(--ember)', href: 'gym.html' },
      { id: 'intellect',  icon: '🧠', name: 'Intellect',  accent: '#6EA8E0',      href: 'learning.html' },
      { id: 'vitality',   icon: '❤️', name: 'Vitality',   accent: '#E37B93',      href: 'mind.html' },
      { id: 'perception', icon: '🌲', name: 'Perception', accent: 'var(--leaf)',  href: 'habits.html' },
      { id: 'wealth',     icon: '💰', name: 'Wealth',     accent: '#B98CE0',      href: 'money.html' },
      { id: 'education',  icon: '🏛️', name: 'Education',  accent: '#C08A5C',      href: 'library.html' }
    ];

    const DEFAULT_AREAS = [
      { id: 'strength', xp: 16530, purpose: 'Gain strength, foster excellence, and sculpt the vessel of your excellence in life.', category: 'health and fitness', tags: [], resources: [] },
      { id: 'intellect', xp: 7650, purpose: 'Nurture the engine of your existence with wisdom and knowledge.', category: 'knowledge', tags: ['Computer Science', 'Finance'], resources: [
        { label: 'Introduction to Computer Science', url: null },
        { label: 'Introduction to Python Programming', url: null },
        { label: 'Foundations of Finance', url: null }
      ] },
      { id: 'vitality', xp: 7800, purpose: 'To find inner peace, connect with your self and embark on a journey of spiritual growth.', category: 'mind', tags: [], resources: [] },
      { id: 'perception', xp: 4350, purpose: 'To foster discipline, find solitude and heed your responsibilities where you must.', category: 'lifestyle', tags: [], resources: [] },
      { id: 'wealth', xp: 2500, purpose: 'To buy back your time, scale your impact, and build unshakable freedom.', category: 'money', tags: ['Trading'], resources: [
        { label: 'TJR Bootcamp', url: null }
      ] },
      { id: 'education', xp: 1000, purpose: "To give you foundational tools, credentials, and access, but it's your job to outgrow it and think beyond the syllabus.", category: 'credentials', tags: [], resources: [
        { label: 'A-Levels', url: null }
      ] }
    ];

    function readAreas() {
      const stored = S.readJSON('sunpath_life_areas', null);
      return AREA_META.map(meta => {
        const def = DEFAULT_AREAS.find(a => a.id === meta.id);
        const found = Array.isArray(stored) ? stored.find(a => a && a.id === meta.id) : null;
        return found ? Object.assign({}, def, found) : Object.assign({}, def);
      });
    }
    function writeAreas(areas) {
      localStorage.setItem('sunpath_life_areas', JSON.stringify(areas));
    }
    function readProfile() {
      const p = S.readJSON('sunpath_profile', null);
      return {
        name: (p && p.name) || 'Rame',
        avatarDataUrl: (p && p.avatarDataUrl) || null,
        avatarEmoji: (p && p.avatarEmoji) || '🙂'
      };
    }
    function writeProfile(p) {
      localStorage.setItem('sunpath_profile', JSON.stringify(p));
    }
    function levelFromXp(xp) { return Math.round((xp || 0) / 1000); }
    function xpBarHtml(xp, cap, color) {
      const segs = 10;
      const per = cap / segs;
      const lit = Math.max(0, Math.min(segs, Math.floor((xp || 0) / per)));
      let html = '<div class="xp-bar" style="--seg-color:' + color + '">';
      for (let i = 0; i < segs; i++) html += '<i class="' + (i < lit ? 'on' : '') + '"></i>';
      html += '</div>';
      return html;
    }

    function renderProfile() {
      const profile = readProfile();
      const areas = readAreas();
      const totalXp = areas.reduce((s, a) => s + (a.xp || 0), 0);
      const avatarLevel = Math.round(totalXp / 6000);
      const avatarHtml = profile.avatarDataUrl
        ? '<img src="' + profile.avatarDataUrl + '" alt="">'
        : profile.avatarEmoji;
      document.getElementById('spProfileCard').innerHTML =
        '<div class="profile-avatar">' + avatarHtml + '</div>' +
        '<div class="profile-body">' +
          '<div class="profile-name">' + S.esc(profile.name) + '</div>' +
          '<div class="profile-level num">Avatar Level ' + avatarLevel + '</div>' +
          xpBarHtml(totalXp, 600000, 'var(--sun)') +
          '<div class="xp-label num">' + totalXp.toLocaleString() + ' / 600,000 total EXP</div>' +
        '</div>' +
        '<button class="profile-edit-btn" id="spProfileEdit" type="button" aria-label="Edit profile">✎</button>';
      document.getElementById('spProfileEdit').addEventListener('click', openProfileModal);
    }

    function renderAreas() {
      const areas = readAreas();
      const html = AREA_META.map(meta => {
        const a = areas.find(x => x.id === meta.id);
        const lvl = levelFromXp(a.xp);
        const tagsHtml = a.tags && a.tags.length
          ? '<div class="area-card-tags">' + a.tags.map(t => '<span>' + S.esc(t) + '</span>').join('') + '</div>'
          : '';
        const resHtml = a.resources && a.resources.length
          ? '<div class="area-card-res">' + a.resources.map(r =>
              r.url ? '<a href="' + S.esc(r.url) + '" target="_blank" rel="noopener">' + S.esc(r.label) + '</a>' : S.esc(r.label)
            ).join(' · ') + '</div>'
          : '';
        return '<div class="area-card glassy" data-id="' + meta.id + '" data-href="' + meta.href + '">' +
          '<span class="area-card-icon">' + meta.icon + '</span>' +
          '<span class="area-card-name" style="color:' + meta.accent + '">' + meta.name + '</span>' +
          '<span class="area-card-purpose">' + S.esc(a.purpose) + '</span>' +
          xpBarHtml(a.xp, 100000, meta.accent) +
          '<span class="area-card-level num">Lv ' + lvl + ' · ' + (a.xp || 0).toLocaleString() + ' / 100,000</span>' +
          '<span class="area-card-cat">' + S.esc(a.category) + '</span>' +
          tagsHtml + resHtml +
          '<button class="area-edit-btn" data-id="' + meta.id + '" type="button" aria-label="Edit ' + meta.name + '">✎</button>' +
        '</div>';
      }).join('');
      document.getElementById('spAreasGrid').innerHTML = html;
    }

    document.getElementById('spAreasGrid').addEventListener('click', (e) => {
      const editBtn = e.target.closest('.area-edit-btn');
      if (editBtn) { openAreaModal(editBtn.getAttribute('data-id')); return; }
      const card = e.target.closest('.area-card');
      if (card) { window.location.href = card.getAttribute('data-href'); }
    });

    // ---- Profile edit modal ----
    let profileAvatarDraft = null;
    function updateAvatarPreview() {
      const img = document.getElementById('avatarPreview');
      const fallback = document.getElementById('avatarPreviewFallback');
      if (profileAvatarDraft) {
        img.src = profileAvatarDraft;
        img.style.display = 'block';
        fallback.style.display = 'none';
      } else {
        img.style.display = 'none';
        fallback.style.display = 'inline';
      }
    }
    function openProfileModal() {
      const p = readProfile();
      profileAvatarDraft = p.avatarDataUrl;
      document.getElementById('profileName').value = p.name;
      updateAvatarPreview();
      document.getElementById('profileModalBg').classList.add('show');
    }
    document.getElementById('avatarFile').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const size = 200;
          const canvas = document.createElement('canvas');
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext('2d');
          const scale = Math.max(size / img.width, size / img.height);
          const dw = img.width * scale, dh = img.height * scale;
          ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
          profileAvatarDraft = canvas.toDataURL('image/jpeg', 0.85);
          updateAvatarPreview();
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
    document.getElementById('profileCancel').addEventListener('click', () => {
      document.getElementById('profileModalBg').classList.remove('show');
    });
    document.getElementById('profileSave').addEventListener('click', () => {
      const name = document.getElementById('profileName').value.trim() || 'Rame';
      writeProfile({ name, avatarDataUrl: profileAvatarDraft, avatarEmoji: '🙂' });
      document.getElementById('profileModalBg').classList.remove('show');
      renderProfile();
    });

    // ---- Area edit modal ----
    let areaEditId = null;
    let areaTagsDraft = [];
    let areaResDraft = [];
    function renderTagsDraft() {
      document.getElementById('areaTagsList').innerHTML = areaTagsDraft.map((t, i) =>
        '<span class="chip">' + S.esc(t) + '<button data-i="' + i + '" type="button">×</button></span>'
      ).join('');
    }
    function renderResDraft() {
      document.getElementById('areaResList').innerHTML = areaResDraft.map((r, i) =>
        '<div class="res-row"><span>' + S.esc(r.label) + (r.url ? ' — ' + S.esc(r.url) : '') + '</span>' +
        '<button data-i="' + i + '" type="button">Remove</button></div>'
      ).join('');
    }
    function openAreaModal(id) {
      areaEditId = id;
      const a = readAreas().find(x => x.id === id);
      const meta = AREA_META.find(m => m.id === id);
      document.getElementById('areaModalTitle').textContent = 'Edit ' + meta.name;
      document.getElementById('areaPurpose').value = a.purpose || '';
      document.getElementById('areaXp').value = a.xp || 0;
      document.getElementById('areaCategory').value = a.category || '';
      areaTagsDraft = (a.tags || []).slice();
      areaResDraft = (a.resources || []).map(r => Object.assign({}, r));
      renderTagsDraft();
      renderResDraft();
      document.getElementById('areaModalBg').classList.add('show');
    }
    document.getElementById('areaTagsList').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      areaTagsDraft.splice(parseInt(btn.getAttribute('data-i'), 10), 1);
      renderTagsDraft();
    });
    function addTagFromInput() {
      const input = document.getElementById('areaTagInput');
      const v = input.value.trim();
      if (v) { areaTagsDraft.push(v); renderTagsDraft(); }
      input.value = '';
    }
    document.getElementById('areaTagAdd').addEventListener('click', addTagFromInput);
    document.getElementById('areaTagInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addTagFromInput(); }
    });
    document.getElementById('areaResList').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      areaResDraft.splice(parseInt(btn.getAttribute('data-i'), 10), 1);
      renderResDraft();
    });
    document.getElementById('areaResAdd').addEventListener('click', () => {
      const labelInput = document.getElementById('areaResLabel');
      const urlInput = document.getElementById('areaResUrl');
      const label = labelInput.value.trim();
      const url = urlInput.value.trim();
      if (label) { areaResDraft.push({ label, url: url || null }); renderResDraft(); }
      labelInput.value = ''; urlInput.value = '';
    });
    document.getElementById('areaCancel').addEventListener('click', () => {
      document.getElementById('areaModalBg').classList.remove('show');
    });
    document.getElementById('areaSave').addEventListener('click', () => {
      const areas = readAreas();
      const idx = areas.findIndex(x => x.id === areaEditId);
      const xp = Math.max(0, Math.min(100000, parseInt(document.getElementById('areaXp').value, 10) || 0));
      areas[idx] = {
        id: areaEditId,
        xp,
        purpose: document.getElementById('areaPurpose').value.trim(),
        category: document.getElementById('areaCategory').value.trim(),
        tags: areaTagsDraft.slice(),
        resources: areaResDraft.map(r => Object.assign({}, r))
      };
      writeAreas(areas);
      document.getElementById('areaModalBg').classList.remove('show');
      renderProfile();
      renderAreas();
    });

    S.injectDock('areas');
    renderProfile();
    renderAreas();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else { boot(); }
})();
</script>
</body>
</html>
```

- [ ] **Step 2: Syntax check**

Run: `node --check <(sed -n '/<script>/,/<\/script>/p' areas.html | sed '1d;$d')`
Expected: no output (exits 0).

- [ ] **Step 3: Manual browser verification**

From the repo root, run `python3 -m http.server 8080` (leave running), then open `http://localhost:8080/areas.html`. Confirm:
- A profile card renders at the top with a 🙂 fallback avatar, name "Rame", "Avatar Level 7" (39,830 total XP / 6000 rounds to 7), and a partially-lit XP bar.
- Below it, a 2-column grid of 6 cards: strength, intellect, vitality, perception, wealth, education — each showing its icon, purpose text, level/XP, category pill, and (for intellect/wealth/education) tags and linked resource text.
- Tapping anywhere on the strength card body (not the ✎ button) navigates to `gym.html`. Go back and confirm intellect → `learning.html`, vitality → `mind.html`, perception → `habits.html`, wealth → `money.html`, education → `library.html`.
- Tapping the ✎ on the wealth card opens the edit modal pre-filled with its Purpose, XP `2500`, category `money`, a "Trading" tag chip, and a "TJR Bootcamp" resource row.
- Change XP to `5000`, add a tag "Investing", click Save. Confirm the modal closes and the wealth card now shows "Lv 5" and the new tag chip.
- Tap the profile's ✎ button, type a new name "Test Name", click Save. Confirm the profile card updates to show "Test Name".
- Upload a small image via the avatar file input in the profile modal, confirm the preview updates immediately, click Save, confirm the profile card now shows the uploaded image instead of the 🙂 fallback.
- Reload the page. Confirm all edits (wealth XP/tag, profile name, avatar image) persisted.

- [ ] **Step 4: Commit**

```bash
git add areas.html
git commit -m "areas: add Life Areas + Profile page"
```

---

### Task 2: Add cloud sync to `areas.html`

**Files:**
- Modify: `areas.html` (end of the `<script>` block, right after `renderAreas();` in Task 1's boot sequence)

**Interfaces:**
- Consumes: `window.initCloudSync` (from `sync.js`, not yet included in `areas.html`'s `<head>` — added in this task).
- Produces: nothing new consumed elsewhere — this task only adds sync behavior to the page built in Task 1.

- [ ] **Step 1: Include `sync.js`**

In `areas.html`, replace:

```html
<script src="sunpath.js" defer></script>
```

with:

```html
<script src="sunpath.js" defer></script>
<script src="sync.js" defer></script>
```

- [ ] **Step 2: Wire `initCloudSync`**

Replace the boot sequence at the end of the `boot()` function:

```javascript
    S.injectDock('areas');
    renderProfile();
    renderAreas();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else { boot(); }
})();
```

with:

```javascript
    S.injectDock('areas');
    renderProfile();
    renderAreas();

    if (typeof initCloudSync === 'function') {
      initCloudSync({
        appKey: 'areas',
        syncedKeys: ['sunpath_profile', 'sunpath_life_areas'],
        onApplied: () => { renderProfile(); renderAreas(); }
      });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else { boot(); }
})();
```

- [ ] **Step 3: Syntax check**

Run: `node --check <(sed -n '/<script>/,/<\/script>/p' areas.html | sed '1d;$d')`
Expected: no output.

- [ ] **Step 4: Manual sync verification**

With the static server still running, open `http://localhost:8080/areas.html` in two different browser profiles (or one normal + one incognito window, so they don't share `localStorage`). In window A, edit the strength card's XP to `20000` and save. In window B, reload the page. Confirm the strength card shows the updated XP within a few seconds (cloud pull) — same cross-device sync behavior as `habits.html`/`money.html` already have.

- [ ] **Step 5: Commit**

```bash
git add areas.html
git commit -m "areas: wire cloud sync for profile and life-area data"
```

---

### Task 3: Wire the avatar entry point into `sunpath.js` / `sunpath.css`

**Files:**
- Modify: `sunpath.js:64-98` (`DOCK`, `injectDock`)
- Modify: `sunpath.css` (after the `.dock-lens` block, around line 240)

**Interfaces:**
- Consumes: `readJSON` (existing, same file), `sunpath_profile` (Task 1's key).
- Produces: `S.profile()` — new exported reader, `{ name, avatarDataUrl, avatarEmoji }`, callable by any future page that wants a lightweight profile read without duplicating the parsing logic `areas.html` already has inline.

- [ ] **Step 1: Add the `profile()` domain helper**

In `sunpath.js`, right after the `fillDaterow` function and before the `const DOCK = [...]` line (i.e., immediately above line 64), add:

```javascript
  function profile() {
    const p = readJSON('sunpath_profile', null);
    return {
      name: (p && p.name) || 'Rame',
      avatarDataUrl: (p && p.avatarDataUrl) || null,
      avatarEmoji: (p && p.avatarEmoji) || '🙂'
    };
  }

```

- [ ] **Step 2: Add `injectAvatarBubble` and call it from `injectDock`**

Replace the `injectDock` function (lines 70-98):

```javascript
  function injectDock(activeId) {
    if (document.getElementById('spDock')) return;
    const nav = document.createElement('nav');
    nav.className = 'dock glassy';
    nav.id = 'spDock';
    nav.setAttribute('aria-label', 'Sunpath areas');
    nav.innerHTML =
      '<span class="dock-lens" id="spDockLens"></span>' +
      DOCK.map(t =>
        '<a href="' + t.href + '" data-id="' + t.id + '"' + (t.id === activeId ? ' class="on"' : '') + '>' + t.label + '</a>'
      ).join('');
    document.body.appendChild(nav);
    const tabs = Array.prototype.slice.call(nav.querySelectorAll('a'));
    const lens = document.getElementById('spDockLens');
    const idx = Math.max(0, DOCK.findIndex(t => t.id === activeId));
    lens.style.transition = 'none';
    lens.style.transform = 'translateX(' + (idx * 100) + '%)';
    requestAnimationFrame(() => { lens.style.transition = ''; });
    tabs.forEach((t, i) => {
      t.addEventListener('click', (e) => {
        if (t.classList.contains('on')) { e.preventDefault(); return; }
        e.preventDefault();
        lens.style.transform = 'translateX(' + (i * 100) + '%)';
        tabs.forEach(x => x.classList.remove('on'));
        t.classList.add('on');
        setTimeout(() => { window.location.href = t.getAttribute('href'); }, 230);
      });
    });
  }
```

with:

```javascript
  function injectDock(activeId) {
    injectAvatarBubble(activeId);
    if (document.getElementById('spDock')) return;
    const nav = document.createElement('nav');
    nav.className = 'dock glassy';
    nav.id = 'spDock';
    nav.setAttribute('aria-label', 'Sunpath areas');
    nav.innerHTML =
      '<span class="dock-lens" id="spDockLens"></span>' +
      DOCK.map(t =>
        '<a href="' + t.href + '" data-id="' + t.id + '"' + (t.id === activeId ? ' class="on"' : '') + '>' + t.label + '</a>'
      ).join('');
    document.body.appendChild(nav);
    const tabs = Array.prototype.slice.call(nav.querySelectorAll('a'));
    const lens = document.getElementById('spDockLens');
    const idx = Math.max(0, DOCK.findIndex(t => t.id === activeId));
    lens.style.transition = 'none';
    lens.style.transform = 'translateX(' + (idx * 100) + '%)';
    requestAnimationFrame(() => { lens.style.transition = ''; });
    tabs.forEach((t, i) => {
      t.addEventListener('click', (e) => {
        if (t.classList.contains('on')) { e.preventDefault(); return; }
        e.preventDefault();
        lens.style.transform = 'translateX(' + (i * 100) + '%)';
        tabs.forEach(x => x.classList.remove('on'));
        t.classList.add('on');
        setTimeout(() => { window.location.href = t.getAttribute('href'); }, 230);
      });
    });
  }
  function injectAvatarBubble(activeId) {
    // Skip on the profile page itself — a "go to profile" button while
    // already on the profile page would just collide with its own edit button.
    if (activeId === 'areas' || document.getElementById('spAvatarBubble')) return;
    const p = profile();
    const a = document.createElement('a');
    a.id = 'spAvatarBubble';
    a.className = 'avatar-bubble glassy';
    a.href = 'areas.html';
    a.setAttribute('aria-label', 'Profile & life areas');
    a.innerHTML = p.avatarDataUrl
      ? '<img src="' + p.avatarDataUrl + '" alt="">'
      : '<span class="avatar-bubble-fallback">' + p.avatarEmoji + '</span>';
    document.body.appendChild(a);
  }
```

- [ ] **Step 3: Export `profile` from `sunpath.js`**

Replace the `return { ... }` export block at the end of the file:

```javascript
  return {
    readJSON, pad2, calKey, todayKey, activeDateKey,
    fmtShort, fmtDateStr, fmtClock, esc,
    fillDaterow, injectDock, pull,
    waterProgress, stackToday, goalsToday,
    fitness, sessionTime, splitToday, weight,
    learning, subjectName, library, bookPct,
    growth, habits, money, subsList, sparkPath
  };
```

with:

```javascript
  return {
    readJSON, pad2, calKey, todayKey, activeDateKey,
    fmtShort, fmtDateStr, fmtClock, esc,
    fillDaterow, injectDock, pull, profile,
    waterProgress, stackToday, goalsToday,
    fitness, sessionTime, splitToday, weight,
    learning, subjectName, library, bookPct,
    growth, habits, money, subsList, sparkPath
  };
```

- [ ] **Step 4: Add `.avatar-bubble` CSS**

In `sunpath.css`, right after the `@media (prefers-reduced-motion: reduce) { .dock-lens { transition: none; } }` line (end of the `/* ---- dock ---- */` block), add:

```css
.avatar-bubble {
  position: fixed; z-index: 40;
  top: max(14px, env(safe-area-inset-top));
  right: max(14px, env(safe-area-inset-right));
  width: 44px; height: 44px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
  transition: transform .15s ease;
}
.avatar-bubble:active { transform: scale(0.92); }
.avatar-bubble img { width: 100%; height: 100%; object-fit: cover; display: block; }
.avatar-bubble-fallback { font-size: 20px; line-height: 1; }
```

- [ ] **Step 5: Syntax check**

Run: `node --check sunpath.js`
Expected: no output.

- [ ] **Step 6: Manual browser verification**

With the static server running, open `http://localhost:8080/today.html`. Confirm a small circular avatar bubble appears fixed in the top-right corner (showing the 🙂 fallback, or the image you uploaded in Task 1 if you kept it). Tap it — confirm it navigates to `areas.html`.

Open `http://localhost:8080/body.html`, `http://localhost:8080/mind.html`, `http://localhost:8080/money.html` — confirm the same avatar bubble appears on each and navigates to `areas.html`.

Open `http://localhost:8080/areas.html` directly — confirm the avatar bubble does **not** appear here (it would collide with the profile card's own ✎ button in the same corner).

Confirm on all four pages (today/body/mind/money) that the existing 4-tab bottom dock still works exactly as before — tapping "Body" still goes to `body.html`, etc.

- [ ] **Step 7: Commit**

```bash
git add sunpath.js sunpath.css
git commit -m "sunpath: add avatar entry point to the hub dock"
```

---

### Task 4: Final end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Clear local test data**

In the devtools console on any Sunpath page (`localhost`, not a real device):

```javascript
localStorage.removeItem('sunpath_profile');
localStorage.removeItem('sunpath_life_areas');
location.reload();
```

- [ ] **Step 2: Full fresh-state pass**

Open `http://localhost:8080/areas.html` on a clean slate. Confirm:
- Profile card shows "Rame", the 🙂 fallback avatar, and the seeded Avatar Level (7) computed from the default 6 areas.
- All 6 life-area cards render with their seeded Notion-sourced Purpose/XP/category/tags/resources (per Task 1 Step 3's expected values).
- No console errors on load.

- [ ] **Step 3: Regression-check the 4 existing hub pages**

Open `http://localhost:8080/today.html`, `http://localhost:8080/body.html`, `http://localhost:8080/mind.html`, `http://localhost:8080/money.html`. Confirm each still loads normally, the 4-tab bottom dock still works, and the new avatar bubble is present and functional on all four — no console errors on any of them.

- [ ] **Step 4: Regression-check a classic page**

Open `http://localhost:8080/gym.html` (uses `topbar.js`, untouched by this plan). Confirm its topbar (SUNPATH wordmark, water pill, finance button, sync dot) and its own bottom nav still render and work exactly as before — this plan never touched `topbar.js`.

- [ ] **Step 5: Mobile-width check**

Resize the browser to ~390px width and revisit `areas.html`. Confirm the profile card and the 2-column area grid both remain readable and don't overflow horizontally, and the edit modals (profile + a life area) still fit on-screen and are scrollable if needed.

- [ ] **Step 6: Stop the local server**

Run: `kill %1` (or `Ctrl+C` the `python3 -m http.server 8080` process from Task 1, Step 3).
