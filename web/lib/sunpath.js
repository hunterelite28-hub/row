// Pure, client-only data readers ported from the legacy sunpath.js
// `window.Sunpath` object. Same localStorage keys and shapes — no
// data migration needed, both the static pages and this app read the
// same state.

export function readJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v == null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

function pad2(n) {
  return String(n).padStart(2, '0');
}
export function calKey(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
export function todayKey() {
  return calKey(new Date());
}
// Goals/stack use a 5AM day boundary
export function activeDateKey() {
  const now = new Date();
  const d = new Date(now);
  if (now.getHours() < 5) d.setDate(d.getDate() - 1);
  return calKey(d);
}
export function fmtDateStr(ds) {
  const p = String(ds || '').split('-').map(Number);
  if (p.length !== 3) return ds || '';
  const M = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return p[2] + ' ' + M[p[1] - 1];
}
export function fmtClock(ts) {
  const d = new Date(ts);
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function profile() {
  const p = readJSON('sunpath_profile', null);
  return {
    name: (p && p.name) || 'Rame',
    avatarDataUrl: (p && p.avatarDataUrl) || null,
    avatarEmoji: (p && p.avatarEmoji) || '🙂',
  };
}

export function waterProgress(dateKey) {
  const state = readJSON('po_water_v1', null);
  if (!state) return { done: 0, total: 0 };
  const dk = dateKey || todayKey();
  const done = (state.logs || {})[dk] || 0;
  const p = state.profile || { weightKg: 75 };
  const wKg = state.weightUnit === 'lb' ? (p.weightKg || 0) / 2.20462 : (p.weightKg || 0);
  const base = wKg * 35;
  const exercise = ((p.activityHrsPerWeek || 0) / 7) * 500;
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

export function stackToday(dateKey) {
  const items = readJSON('stack:items', []);
  const dk = dateKey || activeDateKey();
  const taken = readJSON('stack:taken:' + dk, {});
  const times = Object.keys(taken).map((k) => taken[k]).filter((t) => typeof t === 'number');
  return {
    total: Array.isArray(items) ? items.length : 0,
    taken: Object.keys(taken).length,
    lastTs: times.length ? Math.max.apply(null, times) : null,
  };
}

export function goalsToday(dateKey) {
  const dk = dateKey || activeDateKey();
  const list = readJSON('goals:' + dk, []);
  const arr = Array.isArray(list) ? list : [];
  return {
    total: arr.length,
    done: arr.filter((g) => g && g.done).length,
    pending: arr.filter((g) => g && !g.done),
    doneWithTs: arr.filter((g) => g && g.done && g.doneAt),
  };
}

export function fitness() {
  const s = readJSON('fitness_sessions', []);
  const sessions = Array.isArray(s) ? s : [];
  const km = sessions.filter((x) => x && x.type === 'run').reduce((t, x) => t + (parseFloat(x.km) || 0), 0);
  return {
    sessions,
    km,
    runs: sessions.filter((x) => x.type === 'run').length,
    gym: sessions.filter((x) => x.type === 'gym').length,
    muay: sessions.filter((x) => x.type === 'muay').length,
  };
}
export function sessionTime(sess) {
  // ids look like 'ft<ms>' — the log moment. Trustworthy for same-day logs.
  const m = /^ft(\d{10,})/.exec((sess && sess.id) || '');
  return m ? parseInt(m[1], 10) : null;
}

export function splitToday(dateKey) {
  const state = readJSON('po_coach_v1', null);
  let rotation = ['push', 'pull', 'legs', 'rest'];
  let anchorDate = '2026-05-12',
    anchorIndex = rotation.indexOf('rest');
  if (state && Array.isArray(state.splitRotation) && state.splitRotation.length) {
    rotation = state.splitRotation.map((x) => String(x));
    if (state.splitAnchor && state.splitAnchor.date && state.splitAnchor.index != null) {
      anchorDate = state.splitAnchor.date;
      anchorIndex = state.splitAnchor.index;
    }
  }
  const a = new Date(anchorDate + 'T00:00:00');
  const t = dateKey ? new Date(dateKey + 'T00:00:00') : new Date();
  t.setHours(0, 0, 0, 0);
  const diff = Math.round((t - a) / 864e5);
  const idx = (((anchorIndex + diff) % rotation.length) + rotation.length) % rotation.length;
  return String(rotation[idx] || '');
}

export function learning() {
  const sessions = readJSON('learning_sessions', []);
  const subjects = readJSON('learning_subjects', []);
  const arr = Array.isArray(sessions) ? sessions : [];
  const hours = arr.reduce((t, s) => t + (parseFloat(s.hours) || 0), 0);
  return { sessions: arr, subjects: Array.isArray(subjects) ? subjects : [], hours };
}
export function subjectName(l, id) {
  const s = l.subjects.find((x) => x.id === id);
  return s ? s.name : '';
}

export function library() {
  const books = readJSON('library_books', []);
  const notes = readJSON('library_notes', []);
  return {
    books: Array.isArray(books) ? books : [],
    notes: Array.isArray(notes) ? notes : [],
  };
}

export function growth() {
  const notes = readJSON('growth_notes', []);
  return {
    notes: Array.isArray(notes) ? notes : [],
    locked: !!localStorage.getItem('growth_lock_hash'),
  };
}

export function habits() {
  const list = readJSON('habits_list', []);
  const log = readJSON('habits_log', {});
  const habitsArr = Array.isArray(list) ? list : [];
  const logObj = log && typeof log === 'object' ? log : {};
  const tk = todayKey();
  const doneToday = habitsArr.filter((h) => (logObj[tk] || []).indexOf(h.id) !== -1).length;
  function streakOf(id) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if ((logObj[calKey(d)] || []).indexOf(id) === -1) d.setDate(d.getDate() - 1);
    let s = 0;
    for (let i = 0; i < 730; i++) {
      if ((logObj[calKey(d)] || []).indexOf(id) === -1) break;
      s++;
      d.setDate(d.getDate() - 1);
    }
    return s;
  }
  const best = habitsArr.reduce((m, h) => Math.max(m, streakOf(h.id)), 0);
  return { list: habitsArr, log: logObj, doneToday, bestStreak: best };
}
