'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import Topbar from '@/components/Topbar';

// ============================================================
// CONFIG — ported verbatim from gym.html's inline <script> block.
// ============================================================
const CONFIG = {
  appTitle: 'Progressive Overload Coach',
  units: 'kg',
  gyms: [
    { id: 'home', name: 'Home Gym' },
    { id: 'comm', name: 'Commercial Gym' },
  ],
  days: [
    { id: 'push', name: 'Push' },
    { id: 'pull', name: 'Pull' },
    { id: 'legs', name: 'Legs' },
  ],
  splitRotation: ['push', 'pull', 'legs', 'rest'],
  splitAnchor: { date: '2026-05-12', splitId: 'rest' },
  upgradeAtReps: 8,
  composition: { enabled: true, yearsTraining: 1, windowDays: 30 },
  defaultExercises: [
    { name: 'Bench press', gym: 'comm', day: 'push', repMin: 5, repMax: 8, step: 2.5, startWeight: 60 },
    { name: 'Overhead press', gym: 'comm', day: 'push', repMin: 5, repMax: 8, step: 2.5, startWeight: 35 },
    { name: 'Tricep pushdown', gym: 'comm', day: 'push', repMin: 8, repMax: 12, step: 2.5, startWeight: 25 },
    { name: 'Pull-ups', gym: 'both', day: 'pull', repMin: 5, repMax: 10, step: 1, startWeight: 0, bw: true },
    { name: 'Barbell row', gym: 'comm', day: 'pull', repMin: 6, repMax: 10, step: 2.5, startWeight: 50 },
    { name: 'Bicep curl', gym: 'comm', day: 'pull', repMin: 8, repMax: 12, step: 1.25, startWeight: 15 },
    { name: 'Back squat', gym: 'comm', day: 'legs', repMin: 5, repMax: 8, step: 5, startWeight: 80 },
    { name: 'Romanian deadlift', gym: 'comm', day: 'legs', repMin: 6, repMax: 10, step: 5, startWeight: 60 },
    { name: 'Leg press', gym: 'comm', day: 'legs', repMin: 8, repMax: 12, step: 5, startWeight: 100 },
  ],
};

// ============================================================
// The exercise-logging / prescription / history UI ("Progressive
// Overload Coach") is permanently hidden on the live page
// (style="display:none" on its wrapping .po-header/.card, with no
// toggle anywhere in the original script) — replaced by Hevy sync.
// Its stored state (po_coach_v1) is NOT dead, though: the day pill
// + rotation modal (both visible) read/write state.splitRotation /
// splitAnchor, and the weight composition estimate reads
// state.exercises / state.logs as a frozen historical strength
// trend. So loadState/normalize/saveState are ported, but the
// exercise-select/logging/prescription/sparkline/history/settings
// render functions that only ever painted into hidden DOM are not.
// ============================================================
const LS_KEY = 'po_coach_v1';

function buildDefaultExercises() {
  return CONFIG.defaultExercises.map((e, i) => Object.assign({ id: 'seed_' + i + '_' + Date.now() }, e));
}
function normalizeCoachState(s) {
  s = s || {};
  s.units = s.units || CONFIG.units || 'kg';
  s.gyms = Array.isArray(s.gyms) && s.gyms.length ? s.gyms : CONFIG.gyms.slice();
  s.days = Array.isArray(s.days) && s.days.length ? s.days : CONFIG.days.slice();
  s.exercises = Array.isArray(s.exercises) ? s.exercises : buildDefaultExercises();
  s.logs = s.logs && typeof s.logs === 'object' ? s.logs : {};
  s.filterGym = s.filterGym || s.gyms[0].id;
  s.filterDay = s.filterDay || s.days[0].id;
  if (!Array.isArray(s.splitRotation) || !s.splitRotation.length) {
    s.splitRotation = (CONFIG.splitRotation || ['Push', 'Pull', 'Legs', 'Rest']).map((x) =>
      (CONFIG.days || []).find((d) => d.id === x) ? CONFIG.days.find((d) => d.id === x).name : x === 'rest' ? 'Rest' : x.charAt(0).toUpperCase() + x.slice(1)
    );
  }
  if (!s.splitAnchor || !s.splitAnchor.date || s.splitAnchor.index == null) {
    const oldId = (CONFIG.splitAnchor && CONFIG.splitAnchor.splitId) || null;
    let idx = 0;
    if (oldId) {
      const oldName = (CONFIG.days || []).find((d) => d.id === oldId);
      const targetName = oldName ? oldName.name : oldId === 'rest' ? 'Rest' : oldId;
      const found = s.splitRotation.findIndex((n) => n.toLowerCase() === targetName.toLowerCase());
      if (found >= 0) idx = found;
    }
    s.splitAnchor = { date: (CONFIG.splitAnchor && CONFIG.splitAnchor.date) || new Date().toISOString().slice(0, 10), index: idx };
  }
  return s;
}
function loadCoachState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return normalizeCoachState(JSON.parse(raw));
  } catch (e) {}
  return normalizeCoachState({});
}
function estimate1RM(w, r) {
  if (r < 2) return w;
  return w * (1 + r / 30);
}

// ============================================================
// FITNESS SESSION TRACKER — reactified (self-contained, only
// touches fitness_sessions; no ordering hazard with the cloud-sync
// effect below since it just reads/writes localStorage directly
// same as the imperative original).
// ============================================================
const FT_MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function ftLoad() {
  try {
    return JSON.parse(localStorage.getItem('fitness_sessions') || '[]');
  } catch (e) {
    return [];
  }
}
function ftSave(sessions) {
  localStorage.setItem('fitness_sessions', JSON.stringify(sessions));
}
function ftPad2(n) {
  return String(n).padStart(2, '0');
}
function ftTodayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + ftPad2(d.getMonth() + 1) + '-' + ftPad2(d.getDate());
}
function ftWeekStart(d) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  dt.setDate(dt.getDate() - dt.getDay());
  return dt;
}
function ftFmtDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return d + ' ' + FT_MONS[m - 1];
}
function ftWeekLabel() {
  const ws = ftWeekStart(new Date());
  return 'WK OF ' + ws.getDate() + ' ' + FT_MONS[ws.getMonth()];
}

function FitnessTile({ tick }) {
  const [sessions, setSessions] = useState([]);
  const [collapsed, setCollapsed] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeType, setActiveType] = useState('run');
  const [form, setForm] = useState({ date: '', km: '', runDuration: '', runNotes: '', gymSplit: '', gymNotes: '', muayDuration: '', muayNotes: '' });

  useEffect(() => {
    setSessions(ftLoad());
    try {
      const stored = localStorage.getItem('ft_log_collapsed');
      setCollapsed(stored === null ? true : stored === '1');
    } catch (e) {}
  }, [tick]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem('ft_log_collapsed', next ? '1' : '0');
    } catch (e) {}
  }

  function openModal() {
    setForm({ date: ftTodayStr(), km: '', runDuration: '', runNotes: '', gymSplit: '', gymNotes: '', muayDuration: '', muayNotes: '' });
    setActiveType('run');
    setModalOpen(true);
  }

  function saveSession() {
    const date = form.date || ftTodayStr();
    const session = { id: 'ft' + Date.now(), type: activeType, date };
    if (activeType === 'run') {
      const km = parseFloat(form.km);
      const dur = parseInt(form.runDuration, 10);
      if (!isNaN(km) && km > 0) session.km = km;
      if (!isNaN(dur) && dur > 0) session.duration = dur;
      session.notes = form.runNotes.trim();
    } else if (activeType === 'gym') {
      session.split = form.gymSplit.trim();
      session.notes = form.gymNotes.trim();
    } else {
      const dur = parseInt(form.muayDuration, 10);
      if (!isNaN(dur) && dur > 0) session.duration = dur;
      session.notes = form.muayNotes.trim();
    }
    const next = [session, ...sessions];
    next.sort((a, b) => b.date.localeCompare(a.date));
    ftSave(next);
    setSessions(next);
    setModalOpen(false);
  }

  function deleteSession(id) {
    const next = sessions.filter((s) => s.id !== id);
    ftSave(next);
    setSessions(next);
  }

  const ws = ftWeekStart(new Date());
  const weekSessions = sessions.filter((s) => new Date(s.date + 'T00:00:00') >= ws);
  const km = weekSessions.filter((s) => s.type === 'run').reduce((t, s) => t + (parseFloat(s.km) || 0), 0);

  function detailFor(s) {
    if (s.type === 'run') {
      let d = (s.km ? s.km + 'km' : '') + (s.km && s.duration ? ' in ' : '') + (s.duration ? s.duration + 'min' : '');
      if (s.notes) d += (d ? ' · ' : '') + s.notes;
      return d;
    }
    if (s.type === 'gym') {
      if (s.split && s.notes) return s.split + ' · ' + s.notes;
      return s.split || s.notes || '';
    }
    return (s.duration ? s.duration + 'min' : '') + (s.duration && s.notes ? ' · ' : '') + (s.notes || '');
  }

  return (
    <section className={'ft-section' + (collapsed ? ' hv-collapsed' : '')} id="ftSection">
      <div className="ft-header">
        <div>
          <div className="ft-title">Fitness</div>
          <div className="ft-sub">// running, gym &amp; muay thai</div>
        </div>
        <button className="ft-log-btn" onClick={openModal}>
          + Log Session
        </button>
      </div>
      <div className="ft-week-label">{ftWeekLabel()}</div>
      <div className="ft-stats-grid">
        <div className="ft-stat-card">
          <span className="ft-stat-val km">{km % 1 === 0 ? km : km.toFixed(1)}</span>
          <span className="ft-stat-label">Total KM</span>
        </div>
        <div className="ft-stat-card">
          <span className="ft-stat-val run">{weekSessions.filter((s) => s.type === 'run').length}</span>
          <span className="ft-stat-label">Runs</span>
        </div>
        <div className="ft-stat-card">
          <span className="ft-stat-val gym">{weekSessions.filter((s) => s.type === 'gym').length}</span>
          <span className="ft-stat-label">Gym Sess.</span>
        </div>
        <div className="ft-stat-card">
          <span className="ft-stat-val muay">{weekSessions.filter((s) => s.type === 'muay').length}</span>
          <span className="ft-stat-label">Muay Thai</span>
        </div>
      </div>
      <div className="ft-log-section">
        <div className="ft-log-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          // Session Log
          <button className="hv-refresh hv-collapse" type="button" aria-label="Collapse" onClick={toggleCollapsed}>
            <span>⌄</span>
          </button>
        </div>
        <div className="ft-log-list">
          {sessions.length === 0 && <div className="ft-empty">No sessions yet. Tap Log Session to start.</div>}
          {sessions.slice(0, 20).map((s) => {
            const icon = s.type === 'run' ? '▶▶' : s.type === 'gym' ? '[+]' : '✦';
            const iconCls = s.type === 'run' ? 'run' : s.type === 'gym' ? 'gym' : 'muay';
            const label = s.type === 'run' ? 'RUN' : s.type === 'gym' ? 'GYM' : 'MUAY THAI';
            const detail = detailFor(s);
            return (
              <div className="ft-log-row" key={s.id}>
                <div className={'ft-log-icon ' + iconCls}>{icon}</div>
                <div className="ft-log-body">
                  <div className="ft-log-type">{label}</div>
                  {detail && <div className="ft-log-detail">{detail}</div>}
                </div>
                <div className="ft-log-right">
                  <div className="ft-log-date">{ftFmtDate(s.date)}</div>
                  <button className="ft-del-btn" onClick={() => deleteSession(s.id)}>
                    [DEL]
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={'ft-modal-bg' + (modalOpen ? ' show' : '')} onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
        <div className="ft-modal">
          <div className="ft-modal-title">Log Session</div>
          <div className="ft-type-row">
            <button className={'ft-type-btn' + (activeType === 'run' ? ' active' : '')} onClick={() => setActiveType('run')}>
              ▶▶ Run
            </button>
            <button className={'ft-type-btn' + (activeType === 'gym' ? ' active' : '')} onClick={() => setActiveType('gym')}>
              [+] Gym
            </button>
            <button className={'ft-type-btn muay' + (activeType === 'muay' ? ' active' : '')} onClick={() => setActiveType('muay')}>
              ✦ Muay Thai
            </button>
          </div>
          {activeType === 'run' && (
            <div>
              <div className="ft-input-row ft-field">
                <div>
                  <label>Distance (km)</label>
                  <input className="ft-input" type="number" step="0.1" min="0" inputMode="decimal" placeholder="5.0" value={form.km} onChange={(e) => setForm({ ...form, km: e.target.value })} />
                </div>
                <div>
                  <label>Duration (min)</label>
                  <input className="ft-input" type="number" min="0" inputMode="numeric" placeholder="30" value={form.runDuration} onChange={(e) => setForm({ ...form, runDuration: e.target.value })} />
                </div>
              </div>
              <div className="ft-field">
                <label>Notes (route, pace…)</label>
                <input className="ft-input" type="text" maxLength={120} placeholder="e.g. Punggol coastal loop" value={form.runNotes} onChange={(e) => setForm({ ...form, runNotes: e.target.value })} />
              </div>
            </div>
          )}
          {activeType === 'gym' && (
            <div>
              <div className="ft-field">
                <label>Split / Focus</label>
                <input className="ft-input" type="text" maxLength={120} placeholder="e.g. Push – Chest / Shoulders / Tris" value={form.gymSplit} onChange={(e) => setForm({ ...form, gymSplit: e.target.value })} />
              </div>
              <div className="ft-field">
                <label>Notes</label>
                <input className="ft-input" type="text" maxLength={120} placeholder="Optional" value={form.gymNotes} onChange={(e) => setForm({ ...form, gymNotes: e.target.value })} />
              </div>
            </div>
          )}
          {activeType === 'muay' && (
            <div>
              <div className="ft-field">
                <label>Duration (min)</label>
                <input className="ft-input" type="number" min="0" inputMode="numeric" placeholder="60" value={form.muayDuration} onChange={(e) => setForm({ ...form, muayDuration: e.target.value })} />
              </div>
              <div className="ft-field">
                <label>Notes</label>
                <input className="ft-input" type="text" maxLength={120} placeholder="Optional" value={form.muayNotes} onChange={(e) => setForm({ ...form, muayNotes: e.target.value })} />
              </div>
            </div>
          )}
          <div className="ft-field">
            <label>Date</label>
            <input className="ft-input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="ft-modal-actions">
            <button className="ft-cancel-btn" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button className="ft-save-btn" onClick={saveSession}>
              Save
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// HEVY + STRAVA — same components/logic as body.html's BodyClient
// (not extracted to a shared file, matching this migration's existing
// precedent of leaving already-shipped page-local copies alone rather
// than risking a refactor of working code — see health.html's Stack
// tracker). Reads/writes the same hevy_/strava_/fitness_sessions keys.
// ============================================================
const HEVY_MONS = FT_MONS;
function hevyGetKey() {
  return localStorage.getItem('hevy_api_key') || '';
}
function hevyDkey(ms) {
  const d = new Date(ms);
  return d.getFullYear() + '-' + ftPad2(d.getMonth() + 1) + '-' + ftPad2(d.getDate());
}
function hevyNormalize(raw) {
  return (raw || [])
    .map((w) => {
      if (!w || !w.id) return null;
      const start = Date.parse(w.start_time) || null;
      const end = Date.parse(w.end_time) || null;
      let volume = 0,
        sets = 0;
      const exercises = (w.exercises || []).map((ex) => {
        let best = null;
        (ex.sets || []).forEach((s) => {
          const kg = Number(s.weight_kg) || 0,
            reps = Number(s.reps) || 0;
          volume += kg * reps;
          sets++;
          if (!best || kg > best.kg) best = { kg, reps };
        });
        return { name: ex.title || ex.name || 'Exercise', sets: (ex.sets || []).length, best };
      });
      return { id: String(w.id), title: w.title || 'Workout', start, end, mins: start && end ? Math.max(1, Math.round((end - start) / 60000)) : null, volume: Math.round(volume), sets, exercises };
    })
    .filter((w) => w && w.start);
}
async function hevyFetchWorkouts() {
  const res = await fetch('https://api.hevyapp.com/v1/workouts?page=1&pageSize=10', { headers: { 'api-key': hevyGetKey(), Accept: 'application/json' } });
  if (res.status === 401 || res.status === 403) throw new Error('Hevy rejected the key — check it and try again.');
  if (!res.ok) throw new Error('Hevy error ' + res.status);
  const data = await res.json();
  return hevyNormalize(data.workouts || []);
}
function hevyBridge(workouts) {
  let sessions = ftLoad();
  let added = 0;
  workouts.forEach((w) => {
    const marker = '_hv' + w.id;
    if (sessions.some((s) => s && String(s.id || '').indexOf(marker) !== -1)) return;
    const entry = { id: 'ft' + w.start + marker, type: 'gym', date: hevyDkey(w.start), split: w.title, notes: 'Hevy' };
    if (w.mins) entry.duration = w.mins;
    sessions.unshift(entry);
    added++;
  });
  if (added) {
    sessions.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    ftSave(sessions);
  }
  return added;
}

function HevyTile({ tick }) {
  const [collapsed, setCollapsed] = useState(true);
  const [workouts, setWorkouts] = useState([]);
  const [keyInput, setKeyInput] = useState('');
  const [err, setErr] = useState('');
  const [err2, setErr2] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('hv_collapsed');
      setCollapsed(stored === null ? true : stored === '1');
    } catch (e) {}
  }, []);

  async function sync(showErr) {
    setSyncing(true);
    try {
      const w = await hevyFetchWorkouts();
      localStorage.setItem('hevy_workouts_cache', JSON.stringify(w));
      hevyBridge(w);
      setWorkouts(w);
      setErr2('');
    } catch (e) {
      if (showErr) {
        if (hevyGetKey()) setErr2(e.message);
        else setErr(e.message);
      }
      try {
        setWorkouts(JSON.parse(localStorage.getItem('hevy_workouts_cache') || '[]'));
      } catch (e2) {}
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    setHasKey(!!hevyGetKey());
    try {
      setWorkouts(JSON.parse(localStorage.getItem('hevy_workouts_cache') || '[]'));
    } catch (e) {}
    if (!mountedRef.current) {
      mountedRef.current = true;
      if (hevyGetKey()) sync(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  function saveKey() {
    const k = keyInput.trim();
    if (!k) {
      setErr('Paste a key first.');
      return;
    }
    localStorage.setItem('hevy_api_key', k);
    setKeyInput('');
    setHasKey(true);
    setWorkouts([]);
    sync(true);
  }
  function disconnect() {
    if (!confirm('Disconnect Hevy on this device? Bridged sessions stay.')) return;
    localStorage.removeItem('hevy_api_key');
    localStorage.removeItem('hevy_workouts_cache');
    setHasKey(false);
    setWorkouts([]);
  }

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem('hv_collapsed', next ? '1' : '0');
    } catch (e) {}
  }

  const weekAgo = Date.now() - 7 * 864e5;
  const wk = workouts.filter((w) => w.start >= weekAgo);
  const lastW = workouts[0];

  return (
    <section className={'hv-section' + (collapsed ? ' hv-collapsed' : '')} id="hvSection">
      <div className="hv-header">
        <div>
          <div className="hv-title">Workouts</div>
          <div className="hv-sub">// synced from Hevy</div>
        </div>
        <div className="hv-actions">
          <button className="hv-refresh" type="button" disabled={syncing} onClick={() => (hasKey ? sync(true) : setErr('Connect Hevy first.'))}>
            {syncing ? '↻ …' : '↻ Sync'}
          </button>
          <button className="hv-refresh hv-collapse" type="button" aria-label="Collapse" onClick={toggleCollapsed}>
            <span>⌄</span>
          </button>
        </div>
      </div>
      {!hasKey && (
        <div className="hv-card">
          <div className="hv-connect-title">Connect Hevy</div>
          <p className="hv-connect-p">Paste your API key from the Hevy app — hevy.com → Settings → Developer (needs Hevy Pro). The key is stored on this device only and never synced.</p>
          <div className="hv-key-row">
            <input type="password" placeholder="Hevy API key" autoComplete="off" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveKey()} />
            <button type="button" onClick={saveKey}>
              Save
            </button>
          </div>
          <div className="hv-err">{err}</div>
        </div>
      )}
      {hasKey && (
        <div>
          <div className="hv-stats">
            <div className="hv-stat">
              <span className="hv-stat-v">{wk.length}</span>
              <span className="hv-stat-l">This week</span>
            </div>
            <div className="hv-stat">
              <span className="hv-stat-v">{Math.round(wk.reduce((t, w) => t + w.volume, 0)).toLocaleString()}</span>
              <span className="hv-stat-l">kg vol / wk</span>
            </div>
            <div className="hv-stat">
              <span className="hv-stat-v">{lastW ? new Date(lastW.start).getDate() + ' ' + HEVY_MONS[new Date(lastW.start).getMonth()] : '—'}</span>
              <span className="hv-stat-l">Last workout</span>
            </div>
          </div>
          <div className="hv-err">{err2}</div>
          <div className="hv-list">
            {workouts.length === 0 && <div className="hv-empty">No workouts yet — log one in Hevy and hit Sync.</div>}
            {workouts.slice(0, 6).map((w) => {
              const d = new Date(w.start);
              return (
                <div className="hv-card" key={w.id}>
                  <div className="hv-wo-head">
                    <span className="hv-wo-title">{w.title}</span>
                    <span className="hv-wo-date">
                      {d.getDate()} {HEVY_MONS[d.getMonth()]}
                    </span>
                  </div>
                  <div className="hv-wo-meta">{[w.mins ? w.mins + ' min' : '', w.exercises.length + ' exercises', w.sets + ' sets', w.volume ? w.volume.toLocaleString() + ' kg' : ''].filter(Boolean).join(' · ')}</div>
                  {w.exercises.slice(0, 4).map((ex, i) => (
                    <div className="hv-ex" key={i}>
                      <span className="hv-ex-name">{ex.name}</span>
                      <span className="hv-ex-best">{ex.best && ex.best.kg ? ex.best.kg + 'kg × ' + ex.best.reps : ex.sets + ' set' + (ex.sets === 1 ? '' : 's')}</span>
                    </div>
                  ))}
                  {w.exercises.length > 4 && (
                    <div className="hv-ex">
                      <span className="hv-ex-name" style={{ color: 'var(--text-3)' }}>
                        + {w.exercises.length - 4} more
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button className="hv-disconnect" type="button" onClick={disconnect}>
            disconnect hevy
          </button>
        </div>
      )}
    </section>
  );
}

const RUN_TYPES = { Run: 1, TrailRun: 1, VirtualRun: 1 };
function svCreds() {
  return { id: localStorage.getItem('strava_client_id') || '', secret: localStorage.getItem('strava_client_secret') || '' };
}
function svTokens() {
  try {
    return JSON.parse(localStorage.getItem('strava_tokens') || 'null');
  } catch (e) {
    return null;
  }
}
function svSaveTokens(t) {
  localStorage.setItem('strava_tokens', JSON.stringify({ access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at }));
}
function svConnected() {
  const c = svCreds();
  return !!(c.id && c.secret && svTokens());
}
async function svTokenPost(params) {
  const c = svCreds();
  const body = new URLSearchParams(Object.assign({ client_id: c.id, client_secret: c.secret }, params));
  const res = await fetch('https://www.strava.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
  if (!res.ok) throw new Error('Strava auth failed (' + res.status + ') — check ID/secret.');
  return res.json();
}
async function svAccessToken() {
  let t = svTokens();
  if (!t) throw new Error('Not connected.');
  if (t.expires_at * 1000 < Date.now() + 5 * 60 * 1000) {
    t = await svTokenPost({ grant_type: 'refresh_token', refresh_token: t.refresh_token });
    svSaveTokens(t);
  }
  return t.access_token;
}
async function svFetchRuns() {
  const at = await svAccessToken();
  const res = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=20', { headers: { Authorization: 'Bearer ' + at } });
  if (res.status === 401) throw new Error('Strava rejected the token — reconnect.');
  if (!res.ok) throw new Error('Strava error ' + res.status);
  const acts = await res.json();
  return (acts || [])
    .filter((a) => a && RUN_TYPES[a.sport_type || a.type])
    .map((a) => ({ id: String(a.id), name: a.name || 'Run', start: Date.parse(a.start_date), km: Math.round((a.distance || 0) / 10) / 100, mins: Math.max(1, Math.round((a.moving_time || 0) / 60)) }))
    .filter((a) => a.start);
}
function svBridge(runs) {
  let sessions = ftLoad();
  let added = 0;
  runs.forEach((r) => {
    const marker = '_sv' + r.id;
    if (sessions.some((s) => s && String(s.id || '').indexOf(marker) !== -1)) return;
    sessions.unshift({ id: 'ft' + r.start + marker, type: 'run', date: hevyDkey(r.start), km: r.km, duration: r.mins, notes: r.name });
    added++;
  });
  if (added) {
    sessions.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    ftSave(sessions);
  }
}
function svPace(r) {
  if (!r.km || !r.mins) return '';
  const p = r.mins / r.km;
  return Math.floor(p) + ':' + ftPad2(Math.round((p % 1) * 60)) + ' /km';
}

function StravaTile({ tick }) {
  const [collapsed, setCollapsed] = useState(true);
  const [runs, setRuns] = useState([]);
  const [idInput, setIdInput] = useState('');
  const [secretInput, setSecretInput] = useState('');
  const [err, setErr] = useState('');
  const [err2, setErr2] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [domain, setDomain] = useState('');
  const initRef = useRef(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('sv_collapsed');
      setCollapsed(stored === null ? true : stored === '1');
    } catch (e) {}
    setDomain(window.location.hostname || '(open this page on your deployed site, not a local file)');
  }, []);

  async function sync(showErr) {
    setSyncing(true);
    try {
      const r = await svFetchRuns();
      localStorage.setItem('strava_cache', JSON.stringify(r));
      svBridge(r);
      setRuns(r);
      setErr2('');
    } catch (e) {
      if (showErr) {
        if (svConnected()) setErr2(e.message);
        else setErr(e.message);
      }
      try {
        setRuns(JSON.parse(localStorage.getItem('strava_cache') || '[]'));
      } catch (e2) {}
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    setConnected(svConnected());
    try {
      setRuns(JSON.parse(localStorage.getItem('strava_cache') || '[]'));
    } catch (e) {}
    if (!initRef.current) {
      initRef.current = true;
      (async () => {
        const q = new URLSearchParams(window.location.search);
        const code = q.get('code');
        if (code) {
          window.history.replaceState({}, '', window.location.pathname);
          try {
            const t = await svTokenPost({ grant_type: 'authorization_code', code });
            svSaveTokens(t);
            setConnected(true);
            sync(true);
            return;
          } catch (e) {
            setErr(e.message);
          }
        }
        if (svConnected()) sync(false);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  function connect() {
    const id = idInput.trim(),
      sec = secretInput.trim();
    if (!id || !sec) {
      setErr('Both Client ID and Secret are needed.');
      return;
    }
    localStorage.setItem('strava_client_id', id);
    localStorage.setItem('strava_client_secret', sec);
    const redirectUri = window.location.origin + window.location.pathname;
    window.location.href = 'https://www.strava.com/oauth/authorize' + '?client_id=' + encodeURIComponent(id) + '&response_type=code' + '&redirect_uri=' + encodeURIComponent(redirectUri) + '&approval_prompt=auto&scope=activity:read_all';
  }
  function disconnect() {
    if (!confirm('Disconnect Strava on this device? Bridged runs stay.')) return;
    ['strava_client_id', 'strava_client_secret', 'strava_tokens', 'strava_cache'].forEach((k) => localStorage.removeItem(k));
    setConnected(false);
    setRuns([]);
  }
  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem('sv_collapsed', next ? '1' : '0');
    } catch (e) {}
  }

  const weekAgo = Date.now() - 7 * 864e5;
  const wk = runs.filter((r) => r.start >= weekAgo);
  const lastR = runs[0];

  return (
    <section className={'hv-section' + (collapsed ? ' hv-collapsed' : '')} id="svSection">
      <div className="hv-header">
        <div>
          <div className="hv-title">Runs</div>
          <div className="hv-sub">// synced from Strava</div>
        </div>
        <div className="hv-actions">
          <button className="hv-refresh" type="button" disabled={syncing} onClick={() => (connected ? sync(true) : setErr('Connect Strava first.'))}>
            {syncing ? '↻ …' : '↻ Sync'}
          </button>
          <button className="hv-refresh hv-collapse" type="button" aria-label="Collapse" onClick={toggleCollapsed}>
            <span>⌄</span>
          </button>
        </div>
      </div>
      {!connected && (
        <div className="hv-card">
          <div className="hv-connect-title">Connect Strava</div>
          <p className="hv-connect-p">One-time setup: at strava.com/settings/api create an API application, then paste its Client ID and Client Secret below. Both stay on this device only. You&rsquo;ll be sent to Strava once to approve read access.</p>
          <p className="hv-connect-p">
            Set its <b>Authorization Callback Domain</b> to exactly: <b style={{ color: '#F2A65A' }}>{domain}</b> (no https://, no path).
          </p>
          <div className="hv-key-row" style={{ marginBottom: 8 }}>
            <input type="text" placeholder="Client ID" autoComplete="off" inputMode="numeric" value={idInput} onChange={(e) => setIdInput(e.target.value)} />
          </div>
          <div className="hv-key-row">
            <input type="password" placeholder="Client Secret" autoComplete="off" value={secretInput} onChange={(e) => setSecretInput(e.target.value)} />
            <button type="button" onClick={connect}>
              Connect
            </button>
          </div>
          <div className="hv-err">{err}</div>
        </div>
      )}
      {connected && (
        <div>
          <div className="hv-stats">
            <div className="hv-stat">
              <span className="hv-stat-v">{wk.length}</span>
              <span className="hv-stat-l">Runs / wk</span>
            </div>
            <div className="hv-stat">
              <span className="hv-stat-v">{Math.round(wk.reduce((t, r) => t + r.km, 0) * 10) / 10 || 0}</span>
              <span className="hv-stat-l">km / wk</span>
            </div>
            <div className="hv-stat">
              <span className="hv-stat-v">{lastR ? new Date(lastR.start).getDate() + ' ' + HEVY_MONS[new Date(lastR.start).getMonth()] : '—'}</span>
              <span className="hv-stat-l">Last run</span>
            </div>
          </div>
          <div className="hv-err">{err2}</div>
          <div className="hv-list">
            {runs.length === 0 && <div className="hv-empty">No runs yet — lace up.</div>}
            {runs.slice(0, 6).map((r) => {
              const d = new Date(r.start);
              return (
                <div className="hv-card" key={r.id}>
                  <div className="hv-wo-head">
                    <span className="hv-wo-title">{r.name}</span>
                    <span className="hv-wo-date">
                      {d.getDate()} {HEVY_MONS[d.getMonth()]}
                    </span>
                  </div>
                  <div className="hv-wo-meta">{[r.km ? r.km + ' km' : '', r.mins ? r.mins + ' min' : '', svPace(r)].filter(Boolean).join(' · ')}</div>
                </div>
              );
            })}
          </div>
          <button className="hv-disconnect" type="button" onClick={disconnect}>
            disconnect strava
          </button>
        </div>
      )}
    </section>
  );
}

export default function GymClient() {
  const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);
  const bumpRef = useRef(bump);
  bumpRef.current = bump;

  useEffect(() => {
    bootGym(bumpRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="gym-page">
      <Topbar hub="body" pageLabel="FITNESS" />
      <div className="po-shell">
        <FitnessTile tick={tick} />

        <button className="po-day-pill" type="button" id="dayPill" title="Tap to switch the day filter to today's split">
          <span className="po-day-date" id="dayPillDate">
            —
          </span>
          <span className="po-day-sep">·</span>
          <span className="po-day-split" id="dayPillSplit">
            —
          </span>
        </button>

        {/* WEIGHT + PROGRESS PHOTOS */}
        <div className="wt-section">
          <div className="wt-divider">
            <span>WEIGHT</span>
          </div>

          <div className="wt-card">
            <div className="wt-row">
              <span className="wt-num" id="wtNum">
                —
              </span>
              <span className="wt-unit" id="wtUnit">
                kg
              </span>
            </div>
            <div className="wt-delta hidden" id="wtDelta"></div>
            <div className="wt-streak hidden" id="wtStreak">
              🔥<span id="wtStreakNum">0 day streak</span>
            </div>

            <div className="wt-empty" id="wtEmpty">
              Log your first weight to start tracking.
            </div>

            <div className="wt-chart-wrap hidden" id="wtChartWrap">
              <div className="wt-chart-yaxis">
                <span id="wtYAxisMax">—</span>
                <span id="wtYAxisMin">—</span>
              </div>
              <svg className="wt-chart" viewBox="0 0 320 130" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="wtFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#6ee7b7" stopOpacity="0" />
                  </linearGradient>
                  <filter id="wtGlow">
                    <feGaussianBlur stdDeviation="1.5" result="b" />
                    <feMerge>
                      <feMergeNode in="b" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <line className="wt-grid" x1="0" y1="20" x2="320" y2="20"></line>
                <line className="wt-grid" x1="0" y1="65" x2="320" y2="65"></line>
                <line className="wt-grid" x1="0" y1="110" x2="320" y2="110"></line>
                <g id="wtChartContent"></g>
              </svg>
              <div className="wt-meta" id="wtMeta">
                0 entries
              </div>
            </div>

            <div className="wt-legend hidden" id="wtLegend">
              <span className="wt-legend-item">
                <span className="wt-legend-dot"></span>DAILY
              </span>
              <span className="wt-legend-item">
                <span className="wt-legend-dot wt-legend-dot-avg"></span>7-DAY AVG
              </span>
            </div>

            <div className="wt-comp hidden" id="wtComp">
              <div className="wt-comp-h">
                <span className="wt-comp-label">Composition estimate</span>
                <span className="wt-comp-window" id="wtCompWindow">
                  last 30d
                </span>
              </div>
              <div className="wt-comp-headline" id="wtCompHeadline">
                —
              </div>
              <div className="wt-comp-bars" id="wtCompBars"></div>
              <div className="wt-comp-foot" id="wtCompFoot">
                —
              </div>
            </div>

            <div className="wt-locked hidden" id="wtLocked">
              <div className="wt-locked-info">
                <span className="wt-locked-check">✓</span>
                <div>
                  <div className="wt-locked-label">LOGGED TODAY</div>
                  <div className="wt-locked-value" id="wtLockedValue">
                    — kg
                  </div>
                </div>
              </div>
              <button className="wt-edit-btn" id="wtEditBtn">
                Edit
              </button>
            </div>

            <div className="wt-input-row" id="wtInputRow">
              <div className="wt-input-top">
                <input type="number" step="0.1" className="wt-input" id="wtInput" placeholder="Enter weight" inputMode="decimal" aria-label="Today's weight" />
                <span className="wt-unit-static" id="wtUnitStatic">
                  kg
                </span>
                <button className="wt-save-btn" id="wtSaveBtn">
                  Save
                </button>
              </div>
            </div>
          </div>

          {/* Progress photos hidden for now — remove style to bring back */}
          <button className="wt-progress-link" id="wtProgressLink" type="button" aria-label="Open progress photos" style={{ display: 'none' }}>
            <div>
              <div className="wt-progress-label">PROGRESS PHOTOS</div>
              <div className="wt-progress-count" id="wtProgressCount">
                0 photos
              </div>
            </div>
            <span className="wt-progress-arrow">→</span>
          </button>
        </div>

        <div className="wt-overlay" id="wtOverlay" aria-hidden="true">
          <div className="wt-overlay-inner">
            <div className="wt-overlay-h">
              <button className="wt-back" id="wtBack" aria-label="Back">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
              <div className="wt-overlay-title">Progress</div>
            </div>
            <div className="wt-overlay-actions">
              <button className="wt-overlay-action wt-overlay-primary" id="wtTakePhotoBtn">
                Take Photo
              </button>
              <button className="wt-overlay-action wt-overlay-secondary" id="wtFromLibraryBtn">
                From Library
              </button>
            </div>
            <input type="file" id="wtFileCamera" accept="image/*" capture="environment" style={{ display: 'none' }} />
            <input type="file" id="wtFileLibrary" accept="image/*" style={{ display: 'none' }} />
            <div className="wt-photo-grid" id="wtPhotoGrid">
              <div className="wt-photo-empty">No photos yet · tap Take Photo to start</div>
            </div>
          </div>
        </div>

        <div className="wt-cam" id="wtCam" aria-hidden="true">
          <div className="wt-cam-stage">
            <video className="wt-cam-video" id="wtCamVideo" autoPlay playsInline muted></video>
            <canvas id="wtCamCanvas" style={{ display: 'none' }}></canvas>
          </div>
          <div className="wt-cam-actions">
            <button className="wt-cam-btn" id="wtCamCancel">
              Cancel
            </button>
            <button className="wt-cam-shutter" id="wtCamShutter" aria-label="Capture"></button>
            <button className="wt-cam-btn" id="wtCamFlip" aria-label="Flip camera">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
            </button>
          </div>
        </div>

        <div className="wt-viewer" id="wtViewer" data-mode="single" aria-hidden="true">
          <div className="wt-viewer-single">
            <div className="wt-viewer-stage">
              <img id="wtViewerImg" alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>
            <div className="wt-viewer-meta">
              <div className="wt-viewer-date" id="wtViewerDate">
                —
              </div>
              <div className="wt-viewer-weight" id="wtViewerWeight">
                —
              </div>
            </div>
            <div className="wt-viewer-actions">
              <button className="wt-viewer-btn wt-viewer-compare" id="wtViewerCompare">
                Compare
              </button>
              <button className="wt-viewer-btn wt-viewer-close" id="wtViewerClose">
                Close
              </button>
              <button className="wt-viewer-btn wt-viewer-delete" id="wtViewerDelete">
                Delete
              </button>
            </div>
          </div>

          <div className="wt-viewer-compare-view">
            <div className="wt-compare-stage">
              <div className="wt-compare-side" id="wtCmpSideA">
                <img id="wtCmpImgA" alt="" />
                <div className="wt-compare-meta-line" id="wtCmpMetaA">
                  —
                </div>
              </div>
              <button type="button" className="wt-compare-side wt-compare-other" id="wtCmpSideB" title="Tap to compare to a different photo" aria-label="Compare to a different photo">
                <img id="wtCmpImgB" alt="" />
                <div className="wt-compare-meta-line" id="wtCmpMetaB">
                  —
                </div>
              </button>
            </div>
            <div className="wt-compare-headline" id="wtCompareHeadline">
              —
            </div>
            <div className="wt-viewer-actions">
              <button className="wt-viewer-btn wt-viewer-back" id="wtCompareBack">
                ← Back
              </button>
              <button className="wt-viewer-btn wt-viewer-close" id="wtCompareClose">
                Close
              </button>
              <button className="wt-viewer-btn wt-viewer-delete" id="wtCompareDelete">
                Delete
              </button>
            </div>
          </div>
        </div>

        <HevyTile tick={tick} />
        <StravaTile tick={tick} />
      </div>

      {/* Rotation editor modal — reachable via the day pill above */}
      <div className="po-modal-bg" id="rotModalBg">
        <div className="po-modal">
          <h3>Edit split rotation</h3>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '-6px 0 14px', lineHeight: 1.45 }}>
            Days cycle in this order, repeating forever. Today is whichever entry is highlighted. Use <strong>Today is →</strong> to jump the cycle to a different starting day.
          </p>
          <div className="rot-list" id="rotList"></div>
          <button className="po-add-row-btn" id="rotAddBtn">
            + Add day
          </button>
          <div className="po-modal-actions">
            <button className="po-btn-secondary" id="rotCancel">
              Cancel
            </button>
            <button className="po-btn-primary" id="rotSave">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// bootGym — the day-pill + rotation-modal + weight/photos +
// cloud-sync logic, ported near-verbatim and run in a single
// mount effect (see MoneyClient.jsx for why: this is inherently
// imperative DOM-driven code with tightly coupled render functions;
// nothing is gained by reactifying it). Crucially, this preserves
// the ORIGINAL file's execution order exactly — first paint
// (renderDayPill/wtRender/photosRender) happens as plain sequential
// code BEFORE the cloud-sync section reassigns localStorage.setItem/
// removeItem, so there is no risk of the money.html effect-ordering
// bug (a first-paint write racing an about-to-be-installed sync
// monkeypatch) — it can't happen when it's all one linear script.
// ============================================================
function bootGym(bumpRef) {
  const $ = (id) => document.getElementById(id);
  function escape(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  let state = loadCoachState();

  // ---------- day pill ----------
  function todaySplit() {
    try {
      const rot = state.splitRotation;
      if (!rot || !rot.length) return { name: '—', index: 0 };
      const a = new Date(state.splitAnchor.date);
      const t = new Date();
      a.setHours(0, 0, 0, 0);
      t.setHours(0, 0, 0, 0);
      const diffDays = Math.round((t - a) / 86400000);
      const idx = (((state.splitAnchor.index + diffDays) % rot.length) + rot.length) % rot.length;
      return { name: rot[idx], index: idx };
    } catch (e) {
      return { name: (state.splitRotation && state.splitRotation[0]) || '—', index: 0 };
    }
  }
  function todayDateLabel() {
    const d = new Date();
    const dows = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const mons = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return dows[d.getDay()] + ', ' + mons[d.getMonth()] + ' ' + d.getDate();
  }
  function isRestName(name) {
    return /^rest\b/i.test(name || '');
  }
  function splitLabel(name) {
    if (!name) return '—';
    return (isRestName(name) ? 'REST DAY' : name + ' DAY').toUpperCase();
  }
  function renderDayPill() {
    const split = todaySplit();
    $('dayPillDate').textContent = todayDateLabel();
    const splitEl = $('dayPillSplit');
    splitEl.textContent = splitLabel(split.name);
    splitEl.classList.toggle('is-rest', isRestName(split.name));
  }
  function renderAll() {
    renderDayPill();
  }

  // ---------- rotation modal ----------
  let rotDraft = null;
  let rotDraftTodayIdx = 0;
  function openRotationModal() {
    rotDraft = (state.splitRotation || []).slice();
    if (!rotDraft.length) rotDraft = ['Push', 'Pull', 'Legs', 'Rest'];
    rotDraftTodayIdx = todaySplit().index;
    if (rotDraftTodayIdx >= rotDraft.length) rotDraftTodayIdx = 0;
    renderRotList();
    $('rotModalBg').classList.add('show');
  }
  function renderRotList() {
    const list = $('rotList');
    list.innerHTML = rotDraft
      .map((name, i) => {
        const isToday = i === rotDraftTodayIdx;
        return (
          '<div class="rot-row ' +
          (isToday ? 'is-today' : '') +
          '" data-i="' +
          i +
          '">' +
          '<span class="rot-row-num">' +
          (i + 1) +
          '</span>' +
          '<input type="text" value="' +
          escape(name) +
          '" placeholder="e.g. Arms" maxlength="30">' +
          (isToday ? '<span class="rot-today-tag">TODAY</span>' : '<button type="button" class="rot-today-btn" data-action="today">Today is →</button>') +
          '<button type="button" class="rot-mini" data-action="up" aria-label="Move up">↑</button>' +
          '<button type="button" class="rot-mini" data-action="down" aria-label="Move down">↓</button>' +
          '<button type="button" class="rot-mini rot-mini-del" data-action="del" aria-label="Delete">×</button>' +
          '</div>'
        );
      })
      .join('');
    list.querySelectorAll('.rot-row').forEach((row) => {
      const i = parseInt(row.dataset.i, 10);
      row.querySelector('input').addEventListener('input', (e) => {
        rotDraft[i] = e.target.value;
      });
      const upBtn = row.querySelector('[data-action="up"]');
      const dnBtn = row.querySelector('[data-action="down"]');
      const delBtn = row.querySelector('[data-action="del"]');
      const todayBtn = row.querySelector('[data-action="today"]');
      if (upBtn)
        upBtn.addEventListener('click', () => {
          if (i === 0) return;
          [rotDraft[i - 1], rotDraft[i]] = [rotDraft[i], rotDraft[i - 1]];
          if (rotDraftTodayIdx === i) rotDraftTodayIdx = i - 1;
          else if (rotDraftTodayIdx === i - 1) rotDraftTodayIdx = i;
          renderRotList();
        });
      if (dnBtn)
        dnBtn.addEventListener('click', () => {
          if (i >= rotDraft.length - 1) return;
          [rotDraft[i + 1], rotDraft[i]] = [rotDraft[i], rotDraft[i + 1]];
          if (rotDraftTodayIdx === i) rotDraftTodayIdx = i + 1;
          else if (rotDraftTodayIdx === i + 1) rotDraftTodayIdx = i;
          renderRotList();
        });
      if (delBtn)
        delBtn.addEventListener('click', () => {
          if (rotDraft.length <= 1) {
            alert('Need at least one day in the cycle.');
            return;
          }
          rotDraft.splice(i, 1);
          if (rotDraftTodayIdx >= rotDraft.length) rotDraftTodayIdx = rotDraft.length - 1;
          else if (i < rotDraftTodayIdx) rotDraftTodayIdx--;
          renderRotList();
        });
      if (todayBtn)
        todayBtn.addEventListener('click', () => {
          rotDraftTodayIdx = i;
          renderRotList();
        });
    });
  }
  $('dayPill').addEventListener('click', () => openRotationModal());
  $('rotAddBtn').addEventListener('click', () => {
    rotDraft.push('New day');
    renderRotList();
    setTimeout(() => {
      const inputs = $('rotList').querySelectorAll('input');
      const last = inputs[inputs.length - 1];
      if (last) {
        last.focus();
        last.select();
      }
    }, 30);
  });
  $('rotCancel').addEventListener('click', () => {
    $('rotModalBg').classList.remove('show');
    rotDraft = null;
  });
  $('rotSave').addEventListener('click', () => {
    const cleaned = rotDraft.map((s) => (s || '').trim()).filter(Boolean);
    if (!cleaned.length) {
      alert('Need at least one day in the cycle.');
      return;
    }
    let newTodayIdx = rotDraftTodayIdx;
    if (newTodayIdx >= cleaned.length) newTodayIdx = 0;
    state.splitRotation = cleaned;
    state.splitAnchor = { date: new Date().toISOString().slice(0, 10), index: newTodayIdx };
    saveState();
    $('rotModalBg').classList.remove('show');
    rotDraft = null;
    renderAll();
  });
  function saveState() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  // ---------- weight tracker + composition + photos ----------
  const WT_KEY = 'po_coach_weights';
  const PHOTO_KEY = 'po_coach_photos';

  function wtLoad() {
    try {
      const raw = localStorage.getItem(WT_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.sort((a, b) => a.dateKey.localeCompare(b.dateKey)) : [];
    } catch (e) {
      return [];
    }
  }
  function wtSave(arr) {
    try {
      localStorage.setItem(WT_KEY, JSON.stringify(arr));
    } catch (e) {}
  }
  function wtDateKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function wtParseKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function wtSmoothPath(points) {
    if (!points.length) return '';
    if (points.length === 1) return 'M ' + points[0].x + ' ' + points[0].y;
    let d = 'M ' + points[0].x.toFixed(2) + ' ' + points[0].y.toFixed(2);
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1],
        curr = points[i];
      const cx = (prev.x + curr.x) / 2;
      d += ' Q ' + cx.toFixed(2) + ' ' + prev.y.toFixed(2) + ', ' + cx.toFixed(2) + ' ' + ((prev.y + curr.y) / 2).toFixed(2);
      d += ' T ' + curr.x.toFixed(2) + ' ' + curr.y.toFixed(2);
    }
    return d;
  }

  let wtEntries = wtLoad();

  function wtSaveEntry(weight) {
    const key = wtDateKey(new Date());
    const existing = wtEntries.find((e) => e.dateKey === key);
    if (existing) existing.weight = weight;
    else {
      wtEntries.push({ dateKey: key, weight });
      wtEntries.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    }
    wtSave(wtEntries);
    wtRender();
  }

  function wtRender() {
    const last = wtEntries[wtEntries.length - 1] || null;
    const todayKey = wtDateKey(new Date());
    const todayEntry = wtEntries.find((e) => e.dateKey === todayKey);
    const u = state.units;

    $('wtUnit').textContent = u;
    $('wtUnitStatic').textContent = u;
    $('wtNum').textContent = last ? last.weight.toFixed(1) : '—';

    if (todayEntry) {
      $('wtEmpty').classList.add('hidden');
      $('wtLockedValue').textContent = todayEntry.weight.toFixed(1) + ' ' + u;
      $('wtLocked').classList.remove('hidden');
      $('wtInputRow').classList.add('hidden');
    } else {
      if (wtEntries.length === 0) $('wtEmpty').classList.remove('hidden');
      else $('wtEmpty').classList.add('hidden');
      $('wtLocked').classList.add('hidden');
      $('wtInputRow').classList.remove('hidden');
      if (last && !$('wtInput').value) $('wtInput').value = last.weight.toFixed(1);
    }

    if (wtEntries.length >= 2) {
      $('wtChartWrap').classList.remove('hidden');
      $('wtLegend').classList.remove('hidden');
      wtRenderChart();
      wtRenderDelta();
      wtRenderComposition();
    } else {
      $('wtChartWrap').classList.add('hidden');
      $('wtLegend').classList.add('hidden');
      $('wtDelta').classList.add('hidden');
      $('wtComp').classList.add('hidden');
    }
    wtRenderStreak();
  }

  function wtRenderStreak() {
    const el = $('wtStreak');
    let streak = 0;
    let cursor = new Date(new Date());
    if (!wtEntries.find((e) => e.dateKey === wtDateKey(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (wtEntries.find((e) => e.dateKey === wtDateKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    if (streak >= 2) {
      $('wtStreakNum').textContent = streak + ' day streak';
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }

  function wtRenderChart() {
    const recent = wtEntries.slice(-30);
    const weights = recent.map((e) => e.weight);
    const min = Math.min.apply(null, weights);
    const max = Math.max.apply(null, weights);
    const pad = Math.max((max - min) * 0.15, 0.5);
    const yMin = min - pad,
      yMax = max + pad;
    const xLeft = 8,
      xRight = 312,
      yTop = 20,
      yBot = 110;
    const xRange = xRight - xLeft,
      yRange = yBot - yTop;
    const xFor = (i) => (recent.length === 1 ? xRight : xLeft + (i / (recent.length - 1)) * xRange);
    const yFor = (w) => yBot - ((w - yMin) / (yMax - yMin)) * yRange;
    const points = recent.map((e, i) => ({ x: xFor(i), y: yFor(e.weight) }));
    const linePath = wtSmoothPath(points);
    const areaPath = linePath + ' L ' + points[points.length - 1].x.toFixed(2) + ' ' + yBot + ' L ' + points[0].x.toFixed(2) + ' ' + yBot + ' Z';
    const avgPoints = recent.map((_, i) => {
      const start = Math.max(0, i - 6);
      const win = recent.slice(start, i + 1);
      const avg = win.reduce((s, p) => s + p.weight, 0) / win.length;
      return { x: xFor(i), y: yFor(avg) };
    });
    const avgPath = wtSmoothPath(avgPoints);
    let html = '<path class="wt-avg-line" d="' + avgPath + '"></path>' + '<path class="wt-area" d="' + areaPath + '"></path>' + '<path class="wt-line" filter="url(#wtGlow)" d="' + linePath + '"></path>';
    points.forEach((p, i) => {
      const cls = i === points.length - 1 ? 'wt-dot-today' : 'wt-dot';
      const r = i === points.length - 1 ? 5 : 3;
      html += '<circle class="' + cls + '" cx="' + p.x.toFixed(2) + '" cy="' + p.y.toFixed(2) + '" r="' + r + '"/>';
    });
    $('wtChartContent').innerHTML = html;
    $('wtYAxisMax').textContent = yMax.toFixed(1);
    $('wtYAxisMin').textContent = yMin.toFixed(1);
    $('wtMeta').textContent = wtEntries.length + ' ' + (wtEntries.length === 1 ? 'entry' : 'entries') + ' · last ' + recent.length + ' days';
  }

  function wtRenderDelta() {
    const last = wtEntries[wtEntries.length - 1];
    const lastDate = wtParseKey(last.dateKey);
    const cutoff = new Date(lastDate);
    cutoff.setDate(cutoff.getDate() - 7);
    const baseline = wtEntries.find((e) => wtParseKey(e.dateKey) >= cutoff) || wtEntries[0];
    const diff = last.weight - baseline.weight;
    const el = $('wtDelta');
    if (Math.abs(diff) < 0.05) {
      el.classList.add('hidden');
      return;
    }
    const arrow = diff > 0 ? '↑' : '↓';
    const sign = diff > 0 ? '+' : '−';
    el.textContent = arrow + ' ' + sign + Math.abs(diff).toFixed(1) + ' ' + state.units + ' · last 7d';
    el.classList.toggle('up', diff > 0);
    el.classList.toggle('down', diff < 0);
    el.classList.remove('hidden');
  }

  function wtRenderComposition() {
    const compEl = $('wtComp');
    if (!CONFIG.composition || !CONFIG.composition.enabled) {
      compEl.classList.add('hidden');
      return;
    }
    const windowDays = CONFIG.composition.windowDays || 30;
    if (wtEntries.length < 2) {
      compEl.classList.add('hidden');
      return;
    }

    const now = wtParseKey(wtEntries[wtEntries.length - 1].dateKey);
    const start = new Date(now);
    start.setDate(start.getDate() - windowDays);

    const startEntry = wtEntries.find((e) => wtParseKey(e.dateKey) >= start);
    const endEntry = wtEntries[wtEntries.length - 1];
    if (!startEntry || startEntry === endEntry) {
      compEl.classList.add('hidden');
      return;
    }
    const weightDelta = endEntry.weight - startEntry.weight;
    const actualDays = Math.max(1, Math.round((wtParseKey(endEntry.dateKey) - wtParseKey(startEntry.dateKey)) / 86400000));
    const weeks = actualDays / 7;

    let strengthRatios = [];
    let workoutDays = new Set();
    state.exercises.forEach((ex) => {
      const logs = (state.logs[ex.id] || []).slice();
      if (logs.length < 2 || ex.bw) {
        logs.forEach((l) => {
          if (new Date(l.date) >= start) workoutDays.add(l.date.slice(0, 10));
        });
        return;
      }
      const inWin = logs.filter((l) => new Date(l.date) >= start);
      const before = logs.filter((l) => new Date(l.date) < start);
      inWin.forEach((l) => workoutDays.add(l.date.slice(0, 10)));
      if (!inWin.length || !before.length) return;
      const avg = (arr) => arr.reduce((s, l) => s + estimate1RM(l.weight, l.reps), 0) / arr.length;
      const a = avg(before),
        b = avg(inWin);
      if (a <= 0) return;
      strengthRatios.push(b / a);
    });
    const strengthDelta = strengthRatios.length ? strengthRatios.reduce((s, r) => s + r, 0) / strengthRatios.length - 1 : 0;
    const sessionsPerWeek = (workoutDays.size / actualDays) * 7;
    const frequencyFactor = Math.max(0.4, Math.min(1.2, sessionsPerWeek / 4));

    const yt = CONFIG.composition.yearsTraining || 1;
    let maxMuscleKgPerWeek;
    if (yt <= 1) maxMuscleKgPerWeek = 0.45;
    else if (yt === 2) maxMuscleKgPerWeek = 0.23;
    else maxMuscleKgPerWeek = 0.11;
    const unitConv = state.units === 'lb' ? 2.20462 : 1;
    const maxMusclePerWeek = maxMuscleKgPerWeek * unitConv;

    const strengthBoost = Math.max(0.5, Math.min(1.5, 1 + strengthDelta * 4));
    let estMuscle = maxMusclePerWeek * weeks * strengthBoost * frequencyFactor;

    let estFat;
    let headlineCls = '';
    let headline = '';
    if (weightDelta > 0) {
      estMuscle = Math.min(estMuscle, weightDelta);
      estFat = Math.max(0, weightDelta - estMuscle);
      const musclePct = estMuscle / weightDelta;
      if (musclePct >= 0.6 && strengthDelta > 0) {
        headlineCls = 'good';
        headline = '+' + weightDelta.toFixed(1) + ' ' + state.units + ' — mostly muscle, strength up.';
      } else if (musclePct >= 0.35) {
        headlineCls = 'warn';
        headline = '+' + weightDelta.toFixed(1) + ' ' + state.units + ' — mixed. Tighten kcal or push lifts harder.';
      } else {
        headlineCls = 'bad';
        headline = '+' + weightDelta.toFixed(1) + ' ' + state.units + ' — mostly fat. Strength flat. Cut kcal.';
      }
    } else {
      const wDown = Math.abs(weightDelta);
      if (strengthDelta >= 0) {
        estMuscle = Math.min(maxMusclePerWeek * weeks * 0.3, 0.5);
        estFat = wDown + estMuscle;
        headlineCls = 'good';
        headline = '−' + wDown.toFixed(1) + ' ' + state.units + ' — strength holding, fat dropping.';
      } else {
        const lossPct = Math.min(0.4, Math.abs(strengthDelta) * 2);
        estMuscle = -wDown * lossPct;
        estFat = -(wDown + estMuscle);
        headlineCls = 'warn';
        headline = '−' + wDown.toFixed(1) + ' ' + state.units + ' — strength slipping. You may be losing muscle.';
      }
    }

    compEl.classList.remove('hidden');
    $('wtCompWindow').textContent = 'last ' + actualDays + 'd';
    const headlineEl = $('wtCompHeadline');
    headlineEl.textContent = headline;
    headlineEl.className = 'wt-comp-headline ' + headlineCls;

    const totalAbs = Math.abs(estMuscle) + Math.abs(estFat) || 1;
    const musclePct = (Math.abs(estMuscle) / totalAbs) * 100;
    const fatPct = (Math.abs(estFat) / totalAbs) * 100;
    $('wtCompBars').innerHTML = '<div class="wt-comp-bar muscle" style="width:' + musclePct.toFixed(1) + '%"></div>' + '<div class="wt-comp-bar fat" style="width:' + fatPct.toFixed(1) + '%"></div>';

    const sd = strengthDelta * 100;
    const sdStr = (sd >= 0 ? '+' : '') + sd.toFixed(1) + '%';
    const muscleSign = estMuscle >= 0 ? '+' : '';
    const fatSign = estFat >= 0 ? '+' : '';
    const freqStr = sessionsPerWeek.toFixed(1) + ' sessions/wk';
    $('wtCompFoot').textContent = '~' + muscleSign + estMuscle.toFixed(1) + ' ' + state.units + ' muscle · ' + '~' + fatSign + estFat.toFixed(1) + ' ' + state.units + ' fat · ' + 'strength ' + sdStr + ' · ' + freqStr + (strengthRatios.length ? '' : ' (no lift data)');
  }

  $('wtSaveBtn').addEventListener('click', () => {
    const v = parseFloat($('wtInput').value);
    if (isNaN(v) || v <= 0) return;
    wtSaveEntry(v);
  });
  $('wtInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('wtSaveBtn').click();
  });
  $('wtEditBtn').addEventListener('click', () => {
    $('wtLocked').classList.add('hidden');
    $('wtInputRow').classList.remove('hidden');
    const todayEntry = wtEntries.find((e) => e.dateKey === wtDateKey(new Date()));
    if (todayEntry) $('wtInput').value = todayEntry.weight.toFixed(1);
    $('wtInput').focus();
    $('wtInput').select();
  });

  // ---------- progress photos ----------
  let photos = [];
  try {
    const raw = localStorage.getItem(PHOTO_KEY);
    if (raw) photos = JSON.parse(raw);
  } catch (e) {
    photos = [];
  }

  function photosSave() {
    try {
      localStorage.setItem(PHOTO_KEY, JSON.stringify(photos));
      return true;
    } catch (e) {
      return false;
    }
  }
  function compressPhotoDataUrl(dataUrl, maxDim, quality) {
    maxDim = maxDim || 1080;
    quality = quality == null ? 0.75 : quality;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (w > maxDim || h > maxDim) {
          if (w >= h) {
            h = Math.round(h * (maxDim / w));
            w = maxDim;
          } else {
            w = Math.round(w * (maxDim / h));
            h = maxDim;
          }
        }
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        try {
          resolve(c.toDataURL('image/jpeg', quality));
        } catch (e) {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }
  async function uploadPhotoToStorage(dataUrl) {
    if (!pcSupa) return null;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const filename = 'photo_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10) + '.jpg';
      const { error } = await pcSupa.storage.from('progress-photos').upload(filename, blob, { contentType: 'image/jpeg', upsert: false });
      if (error) return null;
      const { data } = pcSupa.storage.from('progress-photos').getPublicUrl(filename);
      return data ? data.publicUrl : null;
    } catch (e) {
      return null;
    }
  }
  function photoFmtDate(key) {
    const d = wtParseKey(key);
    const mons = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return mons[d.getMonth()] + ' ' + d.getDate();
  }
  function photoCurrentWeight() {
    const last = wtEntries[wtEntries.length - 1];
    return last ? last.weight.toFixed(1) + ' ' + state.units : '—';
  }
  function photosRender() {
    const grid = $('wtPhotoGrid');
    if (!photos.length) {
      grid.innerHTML = '<div class="wt-photo-empty">No photos yet · tap Take Photo to start</div>';
    } else {
      grid.innerHTML = photos
        .map(
          (p) =>
            '<button class="wt-photo-card" data-id="' +
            p.id +
            '" type="button">' +
            '<img src="' +
            (p.url || p.dataUrl) +
            '" alt="">' +
            '<div class="wt-photo-overlay"></div>' +
            '<div class="wt-photo-meta">' +
            '<span class="wt-photo-date">' +
            photoFmtDate(p.dateKey) +
            '</span>' +
            '<span class="wt-photo-weight">' +
            (p.weight || '—') +
            '</span>' +
            '</div>' +
            '</button>'
        )
        .join('');
      grid.querySelectorAll('.wt-photo-card').forEach((card) => {
        card.addEventListener('click', () => openPhoto(card.dataset.id));
      });
    }
    if (!photos.length) $('wtProgressCount').textContent = '0 photos';
    else if (photos.length === 1) $('wtProgressCount').textContent = '1 photo · latest ' + photoFmtDate(photos[0].dateKey);
    else $('wtProgressCount').textContent = photos.length + ' photos · latest ' + photoFmtDate(photos[0].dateKey);
  }
  async function photosAdd(dataUrl) {
    let compressed = dataUrl;
    try {
      compressed = await compressPhotoDataUrl(dataUrl);
    } catch (e) {}
    const id = 'p' + Date.now() + '_' + Math.floor(Math.random() * 999);
    const entry = { id, dataUrl: compressed, dateKey: wtDateKey(new Date()), weight: photoCurrentWeight() };
    photos.unshift(entry);
    if (!photosSave()) {
      try {
        entry.dataUrl = await compressPhotoDataUrl(dataUrl, 800, 0.6);
      } catch (e) {}
      if (!photosSave()) {
        photos.shift();
        alert('Phone storage is full — delete some older progress photos before adding a new one.');
        return;
      }
    }
    photosRender();
    uploadPhotoToStorage(entry.dataUrl).then((url) => {
      if (!url) return;
      const e = photos.find((p) => p.id === id);
      if (!e) return;
      e.url = url;
      delete e.dataUrl;
      photosSave();
      photosRender();
    });
  }
  function fileToPhoto(file) {
    const r = new FileReader();
    r.onload = (e) => photosAdd(e.target.result);
    r.readAsDataURL(file);
  }

  $('wtProgressLink').addEventListener('click', () => {
    photosRender();
    $('wtOverlay').classList.add('is-open');
    document.body.style.overflow = 'hidden';
  });
  $('wtBack').addEventListener('click', () => {
    $('wtOverlay').classList.remove('is-open');
    document.body.style.overflow = '';
  });

  let camStream = null;
  let camFacing = 'environment';
  async function openCam() {
    $('wtCam').classList.add('is-open');
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: camFacing } }, audio: false });
      $('wtCamVideo').srcObject = camStream;
    } catch (e) {
      try {
        camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        $('wtCamVideo').srcObject = camStream;
      } catch (e2) {
        closeCam();
        alert('Camera unavailable. Use "From Library" instead.');
        throw e2;
      }
    }
  }
  function closeCam() {
    if (camStream) {
      camStream.getTracks().forEach((t) => t.stop());
      camStream = null;
    }
    $('wtCamVideo').srcObject = null;
    $('wtCam').classList.remove('is-open');
  }
  $('wtTakePhotoBtn').addEventListener('click', async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        await openCam();
        return;
      } catch (e) {}
    }
    $('wtFileCamera').click();
  });
  $('wtFileCamera').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) fileToPhoto(f);
    e.target.value = '';
  });
  $('wtFromLibraryBtn').addEventListener('click', () => $('wtFileLibrary').click());
  $('wtFileLibrary').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) fileToPhoto(f);
    e.target.value = '';
  });
  $('wtCamCancel').addEventListener('click', closeCam);
  $('wtCamFlip').addEventListener('click', async () => {
    camFacing = camFacing === 'environment' ? 'user' : 'environment';
    if (camStream) camStream.getTracks().forEach((t) => t.stop());
    try {
      await openCam();
    } catch (e) {}
  });
  $('wtCamShutter').addEventListener('click', () => {
    const video = $('wtCamVideo'),
      canvas = $('wtCamCanvas');
    if (!video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    closeCam();
    photosAdd(dataUrl);
  });

  let activePhotoId = null;
  let comparePhotoId = null;
  let pvDeleteConfirm = false;
  function openPhoto(id) {
    const p = photos.find((x) => x.id === id);
    if (!p) return;
    activePhotoId = id;
    $('wtViewerImg').src = p.url || p.dataUrl;
    $('wtViewerDate').textContent = photoFmtDate(p.dateKey).toUpperCase();
    $('wtViewerWeight').textContent = p.weight || '—';
    $('wtViewer').dataset.mode = 'single';
    $('wtViewer').classList.add('is-open');
    pvDeleteConfirm = false;
    $('wtViewerDelete').textContent = 'Delete';
    $('wtViewerDelete').classList.remove('is-confirm');
    $('wtViewerCompare').disabled = photos.length < 2;
    $('wtViewerCompare').style.opacity = photos.length < 2 ? '0.4' : '';
  }
  function closePhoto() {
    $('wtViewer').classList.remove('is-open');
    $('wtViewer').dataset.mode = 'single';
    activePhotoId = null;
    comparePhotoId = null;
  }
  function parseWeightStr(w) {
    if (!w) return null;
    const m = String(w).match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }
  function fmtDelta(diff, units) {
    if (diff == null) return '';
    if (Math.abs(diff) < 0.05) return '· no change';
    const sign = diff > 0 ? '+' : '−';
    return '· ' + sign + Math.abs(diff).toFixed(1) + ' ' + units;
  }
  function defaultCompareFor(activeId) {
    const idx = photos.findIndex((p) => p.id === activeId);
    if (idx === -1) return null;
    if (photos[idx + 1]) return photos[idx + 1].id;
    if (photos[idx - 1]) return photos[idx - 1].id;
    return null;
  }
  function openCompare(activeId, otherId) {
    const A = photos.find((p) => p.id === activeId);
    const B = photos.find((p) => p.id === otherId);
    if (!A || !B) return;
    activePhotoId = activeId;
    comparePhotoId = otherId;
    $('wtCmpImgA').src = A.url || A.dataUrl;
    $('wtCmpImgB').src = B.url || B.dataUrl;
    $('wtCmpMetaA').textContent = photoFmtDate(A.dateKey) + ' · ' + (A.weight || '—');
    $('wtCmpMetaB').textContent = photoFmtDate(B.dateKey) + ' · ' + (B.weight || '—');
    const wA = parseWeightStr(A.weight);
    const wB = parseWeightStr(B.weight);
    const headEl = $('wtCompareHeadline');
    let cls = 'flat',
      headline = photoFmtDate(A.dateKey) + ' → ' + photoFmtDate(B.dateKey);
    if (wA != null && wB != null) {
      const diff = wA - wB;
      headline += ' ' + fmtDelta(diff, state.units);
      if (Math.abs(diff) < 0.05) cls = 'flat';
      else if (diff > 0) cls = 'up';
      else cls = 'down';
    }
    headEl.textContent = headline;
    headEl.className = 'wt-compare-headline ' + cls;
    $('wtViewer').dataset.mode = 'compare';
    $('wtViewer').classList.add('is-open');
    pvDeleteConfirm = false;
    $('wtCompareDelete').textContent = 'Delete';
    $('wtCompareDelete').classList.remove('is-confirm');
  }
  function cycleCompareTarget() {
    if (!activePhotoId) return;
    const others = photos.filter((p) => p.id !== activePhotoId);
    if (!others.length) return;
    const curIdx = others.findIndex((p) => p.id === comparePhotoId);
    const nextIdx = (curIdx + 1) % others.length;
    openCompare(activePhotoId, others[nextIdx].id);
  }
  function deleteActivePhoto(deleteBtn) {
    if (!activePhotoId) return;
    if (!pvDeleteConfirm) {
      pvDeleteConfirm = true;
      deleteBtn.textContent = 'Confirm delete?';
      deleteBtn.classList.add('is-confirm');
      setTimeout(() => {
        pvDeleteConfirm = false;
        deleteBtn.textContent = 'Delete';
        deleteBtn.classList.remove('is-confirm');
      }, 3000);
      return;
    }
    photos = photos.filter((p) => p.id !== activePhotoId);
    photosSave();
    photosRender();
    closePhoto();
  }

  $('wtViewerClose').addEventListener('click', closePhoto);
  $('wtCompareClose').addEventListener('click', closePhoto);
  $('wtViewerDelete').addEventListener('click', () => deleteActivePhoto($('wtViewerDelete')));
  $('wtCompareDelete').addEventListener('click', () => deleteActivePhoto($('wtCompareDelete')));
  $('wtViewerCompare').addEventListener('click', () => {
    if (!activePhotoId) return;
    const otherId = defaultCompareFor(activePhotoId);
    if (!otherId) {
      alert('Need at least one other photo to compare.');
      return;
    }
    openCompare(activePhotoId, otherId);
  });
  $('wtCompareBack').addEventListener('click', () => {
    if (activePhotoId) {
      $('wtViewer').dataset.mode = 'single';
    } else {
      closePhoto();
    }
  });
  $('wtCmpSideB').addEventListener('click', cycleCompareTarget);

  // ---------- BOOT (first paint — before cloud-sync monkeypatches setItem) ----------
  renderAll();
  wtRender();
  photosRender();

  // ---------- CLOUD SYNC via Supabase ----------
  const SUPABASE_URL = 'https://pdropxqcdyppbjkaxgpo.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_7y8hvL8HV-X2YLHora2EKw_jhdTI7UH';
  const APP_KEY = 'po-coach';
  const PC_SYNCED_KEYS = ['po_coach_v1', 'po_coach_workout_done', 'po_coach_weights', 'po_coach_photos', 'fitness_sessions'];

  let pcSupa = null;
  let pcPushTimer = null;
  let pcSuppressSync = false;
  let pcPendingRemote = null;
  let pcLastSyncedJson = null;

  const _pcOrigSet = localStorage.setItem.bind(localStorage);
  const _pcOrigRemove = localStorage.removeItem.bind(localStorage);
  localStorage.setItem = function (k, v) {
    _pcOrigSet(k, v);
    try {
      if (!pcSuppressSync && PC_SYNCED_KEYS.indexOf(k) !== -1) pcSchedulePush();
    } catch (e) {}
  };
  localStorage.removeItem = function (k) {
    _pcOrigRemove(k);
    try {
      if (!pcSuppressSync && PC_SYNCED_KEYS.indexOf(k) !== -1) pcSchedulePush();
    } catch (e) {}
  };

  function pcCollectState() {
    const out = {};
    for (const k of PC_SYNCED_KEYS) {
      const v = localStorage.getItem(k);
      if (v == null) continue;
      let val;
      try {
        val = JSON.parse(v);
      } catch (e) {
        continue;
      }
      if (k === 'po_coach_photos' && Array.isArray(val)) {
        val = val.filter((p) => p && p.url).map((p) => ({ id: p.id, url: p.url, dateKey: p.dateKey, weight: p.weight }));
      }
      out[k] = val;
    }
    return out;
  }

  function pcIsUserEditing() {
    const ae = document.activeElement;
    if (!ae) return false;
    const tag = ae.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (ae.getAttribute && ae.getAttribute('contenteditable') === 'true') return true;
    return false;
  }

  function pcRerender() {
    try {
      state = loadCoachState();
    } catch (e) {}
    try {
      wtEntries = wtLoad();
    } catch (e) {}
    try {
      const raw = localStorage.getItem(PHOTO_KEY);
      photos = raw ? JSON.parse(raw) : [];
    } catch (e) {
      photos = [];
    }
    try {
      renderAll();
    } catch (e) {}
    try {
      wtRender();
    } catch (e) {}
    try {
      photosRender();
    } catch (e) {}
    try {
      bumpRef.current();
    } catch (e) {}
  }

  function pcApplyRemoteState(remote) {
    if (!remote || typeof remote !== 'object') return false;
    pcSuppressSync = true;
    let changed = false;
    try {
      for (const k of PC_SYNCED_KEYS) {
        if (k === 'po_coach_photos') {
          let localPhotos = [];
          try {
            localPhotos = JSON.parse(localStorage.getItem(k) || '[]');
          } catch (e) {}
          const remotePhotos = Array.isArray(remote[k]) ? remote[k] : [];
          const remoteIds = new Set(remotePhotos.map((p) => p && p.id));
          const localOnly = localPhotos.filter((p) => p && !p.url && !remoteIds.has(p.id));
          const merged = [...remotePhotos, ...localOnly];
          const incoming = JSON.stringify(merged);
          if (localStorage.getItem(k) !== incoming) {
            try {
              _pcOrigSet(k, incoming);
              changed = true;
            } catch (e) {}
          }
          continue;
        }
        if (k in remote) {
          const incoming = JSON.stringify(remote[k]);
          const local = localStorage.getItem(k);
          if (local !== incoming) {
            try {
              _pcOrigSet(k, incoming);
              changed = true;
            } catch (e) {}
          }
        } else if (localStorage.getItem(k) != null) {
          try {
            _pcOrigRemove(k);
            changed = true;
          } catch (e) {}
        }
      }
    } finally {
      pcSuppressSync = false;
    }
    if (changed) {
      try {
        pcRerender();
      } catch (e) {}
    }
    return changed;
  }

  function pcMaybeApplyRemote(remote) {
    if (pcIsUserEditing()) {
      pcPendingRemote = remote;
      return;
    }
    pcApplyRemoteState(remote);
  }
  function pcApplyPendingIfReady() {
    if (pcPendingRemote && !pcIsUserEditing()) {
      const r = pcPendingRemote;
      pcPendingRemote = null;
      pcApplyRemoteState(r);
    }
  }

  async function pcPushNow() {
    if (!pcSupa) return;
    const st = pcCollectState();
    const json = JSON.stringify(st);
    if (json === pcLastSyncedJson) return;
    try {
      const { error } = await pcSupa.from('app_state').upsert({ key: APP_KEY, data: st, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (!error) {
        pcLastSyncedJson = json;
        try {
          _pcOrigSet('os_last_sync', String(Date.now()));
        } catch (e) {}
      }
    } catch (e) {}
  }
  function pcSchedulePush() {
    if (pcSuppressSync) return;
    clearTimeout(pcPushTimer);
    pcPushTimer = setTimeout(pcPushNow, 250);
  }
  function pcFlushPushOnUnload() {
    if (!pcSupa) return;
    const st = pcCollectState();
    const json = JSON.stringify(st);
    if (json === pcLastSyncedJson) return;
    try {
      fetch(SUPABASE_URL + '/rest/v1/app_state?on_conflict=key', {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ key: APP_KEY, data: st, updated_at: new Date().toISOString() }),
        keepalive: true,
      }).catch(() => {});
      pcLastSyncedJson = json;
    } catch (e) {}
  }

  (async function pcInitCloudSync() {
    if (!SUPABASE_URL || !SUPABASE_KEY) return;
    if (SUPABASE_URL.indexOf('PASTE-') === 0 || SUPABASE_KEY.indexOf('PASTE-') === 0) return;
    pcSupa = createSupabaseClient(SUPABASE_URL, SUPABASE_KEY);
    try {
      const { data, error } = await pcSupa.from('app_state').select('data').eq('key', APP_KEY).maybeSingle();
      if (!error && data && data.data && Object.keys(data.data).length > 0) {
        pcLastSyncedJson = JSON.stringify(data.data);
        pcMaybeApplyRemote(data.data);
        try {
          _pcOrigSet('os_last_sync', String(Date.now()));
        } catch (e) {}
      } else if (Object.keys(pcCollectState()).length > 0) {
        pcSchedulePush();
      }
    } catch (e) {}
    pcSupa
      .channel('app_state_' + APP_KEY)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_state', filter: 'key=eq.' + APP_KEY }, (payload) => {
        if (!payload.new || !payload.new.data) return;
        const incoming = JSON.stringify(payload.new.data);
        if (incoming === pcLastSyncedJson) return;
        pcLastSyncedJson = incoming;
        pcMaybeApplyRemote(payload.new.data);
      })
      .subscribe();
  })();

  document.addEventListener(
    'focusout',
    () => {
      setTimeout(pcApplyPendingIfReady, 0);
    },
    true
  );
  window.addEventListener('pagehide', pcFlushPushOnUnload);
  window.addEventListener('beforeunload', pcFlushPushOnUnload);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pcFlushPushOnUnload();
  });
}
