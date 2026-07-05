// =============================================================
// SUNPATH shared runtime.
// - Injects the 4-hub dock (Today / Body / Mind / Money)
// - Pulls the classic pages' synced rows READ-ONLY from Supabase
//   into localStorage (never pushes — logging still happens on
//   the classic pages, which own their sync).
// - Shared data helpers used by the hub pages.
// =============================================================
window.Sunpath = (function () {
  'use strict';

  const SUPABASE_URL = 'https://pdropxqcdyppbjkaxgpo.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_7y8hvL8HV-X2YLHora2EKw_jhdTI7UH';

  // ---------- tiny utils ----------
  function readJSON(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function calKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function todayKey() { return calKey(new Date()); }
  // Goals/stack use a 5AM day boundary
  function activeDateKey() {
    const now = new Date();
    const d = new Date(now);
    if (now.getHours() < 5) d.setDate(d.getDate() - 1);
    return calKey(d);
  }
  function fmtShort(ts) {
    const d = new Date(ts);
    const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d.getDate() + ' ' + M[d.getMonth()];
  }
  function fmtDateStr(ds) {
    const p = String(ds || '').split('-').map(Number);
    if (p.length !== 3) return ds || '';
    const M = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    return p[2] + ' ' + M[p[1] - 1];
  }
  function fmtClock(ts) {
    const d = new Date(ts);
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---------- chrome ----------
  function fillDaterow(label) {
    const el = document.getElementById('spDaterow');
    if (!el) return;
    const d = new Date();
    const DAYS = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
    const MONS = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
    const streak = (readJSON('goal_streak_v1', {}) || {}).count || 0;
    el.innerHTML =
      (label ? '<span>' + label + '</span><span>·</span>' : '') +
      '<span>' + DAYS[d.getDay()] + ', ' + MONS[d.getMonth()] + ' ' + d.getDate() + '</span>' +
      '<span class="flame num">🔥 ' + streak + '</span>';
  }

  const DOCK = [
    { id: 'today', label: 'Today', href: 'today.html' },
    { id: 'body',  label: 'Body',  href: 'body.html' },
    { id: 'mind',  label: 'Mind',  href: 'mind.html' },
    { id: 'money', label: 'Money', href: 'money.html' }
  ];
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

  // ---------- read-only sync ----------
  // rows: { rowKey: { keys: [...], prefixes: [...] } }
  function pull(rows, onApplied) {
    const fire = () => { try { onApplied && onApplied(); } catch (e) {} };
    if (!window.supabase || !SUPABASE_URL || !SUPABASE_KEY) return;
    let supa;
    try { supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); } catch (e) { return; }
    function apply(rowKey, data) {
      if (!data || typeof data !== 'object') return;
      const spec = rows[rowKey] || {};
      const want = k =>
        (spec.keys || []).indexOf(k) !== -1 ||
        (spec.prefixes || []).some(p => k.indexOf(p) === 0);
      let changed = false;
      for (const k of Object.keys(data)) {
        if (!want(k)) continue;
        const v = JSON.stringify(data[k]);
        if (localStorage.getItem(k) !== v) {
          try { localStorage.setItem(k, v); changed = true; } catch (e) {}
        }
      }
      if (changed) fire();
    }
    Object.keys(rows).forEach(rk => {
      supa.from('app_state').select('data').eq('key', rk).maybeSingle()
        .then(r => { if (!r.error && r.data) apply(rk, r.data.data); })
        .catch(() => {});
      supa.channel('sunpath_' + rk)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'app_state', filter: 'key=eq.' + rk
        }, p => { if (p.new && p.new.data) apply(rk, p.new.data); })
        .subscribe();
    });
  }

  // ---------- domain helpers ----------
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

  function fitness() {
    const s = readJSON('fitness_sessions', []);
    const sessions = Array.isArray(s) ? s : [];
    const km = sessions.filter(x => x && x.type === 'run')
      .reduce((t, x) => t + (parseFloat(x.km) || 0), 0);
    return {
      sessions,
      km,
      runs: sessions.filter(x => x.type === 'run').length,
      gym: sessions.filter(x => x.type === 'gym').length,
      muay: sessions.filter(x => x.type === 'muay').length
    };
  }
  function sessionTime(sess) {
    // ids look like 'ft<ms>' — the log moment. Trustworthy for same-day logs.
    const m = /^ft(\d{10,})/.exec(sess && sess.id || '');
    return m ? parseInt(m[1], 10) : null;
  }

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

  function weight() {
    const entries = readJSON('po_coach_weights', []);
    const arr = (Array.isArray(entries) ? entries : [])
      .filter(e => e && e.dateKey && typeof e.weight === 'number')
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    if (!arr.length) return null;
    const last = arr[arr.length - 1];
    const cutoff = calKey(new Date(Date.now() - 30 * 864e5));
    let ref = null;
    for (const e of arr) { if (e.dateKey >= cutoff) { ref = e; break; } }
    if (!ref) ref = arr[0];
    return { entries: arr, last, delta30: last.weight - ref.weight };
  }

  function learning() {
    const sessions = readJSON('learning_sessions', []);
    const subjects = readJSON('learning_subjects', []);
    const arr = Array.isArray(sessions) ? sessions : [];
    const hours = arr.reduce((t, s) => t + (parseFloat(s.hours) || 0), 0);
    return { sessions: arr, subjects: Array.isArray(subjects) ? subjects : [], hours };
  }
  function subjectName(l, id) {
    const s = l.subjects.find(x => x.id === id);
    return s ? s.name : '';
  }

  function library() {
    const books = readJSON('library_books', []);
    const notes = readJSON('library_notes', []);
    return {
      books: Array.isArray(books) ? books : [],
      notes: Array.isArray(notes) ? notes : []
    };
  }
  function bookPct(b) {
    if (!b) return null;
    if (b.status === 'finished') return 100;
    const t = parseInt(b.totalPages) || 0, c = parseInt(b.currentPage) || 0;
    return t > 0 ? Math.max(0, Math.min(100, Math.round(c / t * 100))) : null;
  }

  function growth() {
    const notes = readJSON('growth_notes', []);
    return {
      notes: Array.isArray(notes) ? notes : [],
      locked: !!localStorage.getItem('growth_lock_hash')
    };
  }

  function habits() {
    const list = readJSON('habits_list', []);
    const log = readJSON('habits_log', {});
    const habitsArr = Array.isArray(list) ? list : [];
    const logObj = (log && typeof log === 'object') ? log : {};
    const tk = todayKey();
    const doneToday = habitsArr.filter(h => (logObj[tk] || []).indexOf(h.id) !== -1).length;
    function streakOf(id) {
      const d = new Date(); d.setHours(0, 0, 0, 0);
      if ((logObj[calKey(d)] || []).indexOf(id) === -1) d.setDate(d.getDate() - 1);
      let s = 0;
      for (let i = 0; i < 730; i++) {
        if ((logObj[calKey(d)] || []).indexOf(id) === -1) break;
        s++; d.setDate(d.getDate() - 1);
      }
      return s;
    }
    const best = habitsArr.reduce((m, h) => Math.max(m, streakOf(h.id)), 0);
    return { list: habitsArr, log: logObj, doneToday, bestStreak: best };
  }

  function money() {
    const hist = readJSON('nw:history', []);
    const arr = (Array.isArray(hist) ? hist : [])
      .filter(e => e && typeof e.v === 'number' && typeof e.t === 'number')
      .sort((a, b) => a.t - b.t);
    if (!arr.length) return null;
    const last = arr[arr.length - 1];
    const cutoff = Date.now() - 30 * 864e5;
    let ref = arr[0];
    for (const e of arr) { if (e.t >= cutoff) { ref = e; break; } }
    return { hist: arr, last, delta30: last.v - ref.v };
  }
  function subsList() {
    const subs = readJSON('subs', []);
    if (!Array.isArray(subs)) return [];
    return subs.map(s => {
      if (!s || typeof s !== 'object') return null;
      const name = s.name || s.title || s.label;
      const price = [s.price, s.amount, s.cost, s.sgd, s.value]
        .map(Number).find(n => !isNaN(n) && n > 0);
      return name ? { name: String(name), price: price || null, raw: s } : null;
    }).filter(Boolean);
  }

  function sparkPath(values, w, h, pad) {
    if (!values || values.length < 2) return '';
    const min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    const span = (max - min) || 1;
    const p = pad == null ? 4 : pad;
    const pts = values.map((v, i) => [
      p + (i / (values.length - 1)) * (w - 2 * p),
      (h - p) - ((v - min) / span) * (h - 2 * p)
    ]);
    return 'M ' + pts.map(pt => pt[0].toFixed(1) + ' ' + pt[1].toFixed(1)).join(' L ');
  }

  return {
    readJSON, pad2, calKey, todayKey, activeDateKey,
    fmtShort, fmtDateStr, fmtClock, esc,
    fillDaterow, injectDock, pull,
    waterProgress, stackToday, goalsToday,
    fitness, sessionTime, splitToday, weight,
    learning, subjectName, library, bookPct,
    growth, habits, money, subsList, sparkPath
  };
})();
