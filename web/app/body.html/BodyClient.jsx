'use client';

import { useEffect, useRef, useState } from 'react';
import Dock from '@/components/Dock';
import AvatarBubble from '@/components/AvatarBubble';
import StackTracker from '@/components/StackTracker';
import WaterTracker from '@/components/WaterTracker';
import { usePull } from '@/hooks/usePull';
import { useCloudSync } from '@/hooks/useCloudSync';
import { readJSON, calKey, todayKey, esc, fmtClock, fmtDateStr, fitness, stackToday, waterProgress, splitToday } from '@/lib/sunpath';
import { getItems as stackGetItems, getTaken as stackGetTaken } from '@/lib/stack';

// ---------- Weight tile ----------
const WT_KEY = 'po_coach_weights';
const COACH_KEY = 'po_coach_v1';

function wtLoad() {
  const arr = readJSON(WT_KEY, []);
  return Array.isArray(arr) ? arr.slice().sort((a, b) => a.dateKey.localeCompare(b.dateKey)) : [];
}
function wtSaveAll(arr) {
  localStorage.setItem(WT_KEY, JSON.stringify(arr));
}
function wtDateKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function wtParseKey(key) {
  const p = key.split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}
function wtSmoothPath(points) {
  if (!points.length) return '';
  if (points.length === 1) return 'M ' + points[0].x + ' ' + points[0].y;
  let d = 'M ' + points[0].x.toFixed(2) + ' ' + points[0].y.toFixed(2);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1], curr = points[i];
    const cx = (prev.x + curr.x) / 2;
    d += ' Q ' + cx.toFixed(2) + ' ' + prev.y.toFixed(2) + ', ' + cx.toFixed(2) + ' ' + ((prev.y + curr.y) / 2).toFixed(2);
    d += ' T ' + curr.x.toFixed(2) + ' ' + curr.y.toFixed(2);
  }
  return d;
}
function estimate1RM(w, r) {
  if (r < 2) return w;
  return w * (1 + r / 30);
}
function units() {
  return (readJSON(COACH_KEY, {}) || {}).units || 'kg';
}

function WeightChart({ entries }) {
  const recent = entries.slice(-30);
  const weights = recent.map((e) => e.weight);
  const min = Math.min.apply(null, weights), max = Math.max.apply(null, weights);
  const pad = Math.max((max - min) * 0.15, 0.5);
  const yMin = min - pad, yMax = max + pad;
  const xLeft = 8, xRight = 312, yTop = 20, yBot = 110;
  const xRange = xRight - xLeft, yRange = yBot - yTop;
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

  return (
    <div className="wt-chart-wrap">
      <div className="wt-chart-yaxis">
        <span>{yMax.toFixed(1)}</span>
        <span>{yMin.toFixed(1)}</span>
      </div>
      <svg className="wt-chart" viewBox="0 0 320 130" preserveAspectRatio="none">
        <defs>
          <linearGradient id="wtFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9ED9A0" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#9ED9A0" stopOpacity="0" />
          </linearGradient>
          <filter id="wtGlow">
            <feGaussianBlur stdDeviation="1.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <line className="wt-grid" x1="0" y1="20" x2="320" y2="20" />
        <line className="wt-grid" x1="0" y1="65" x2="320" y2="65" />
        <line className="wt-grid" x1="0" y1="110" x2="320" y2="110" />
        <path className="wt-avg-line" d={avgPath} />
        <path className="wt-area" d={areaPath} />
        <path className="wt-line" filter="url(#wtGlow)" d={linePath} />
        {points.map((p, i) => {
          const isLast = i === points.length - 1;
          return <circle key={i} className={isLast ? 'wt-dot-today' : 'wt-dot'} cx={p.x.toFixed(2)} cy={p.y.toFixed(2)} r={isLast ? 5 : 3} />;
        })}
      </svg>
      <div className="wt-meta">
        {entries.length} {entries.length === 1 ? 'entry' : 'entries'} · last {recent.length} days
      </div>
    </div>
  );
}

const COMPOSITION = { enabled: true, yearsTraining: 1, windowDays: 30 };

function computeComposition(entries) {
  if (!COMPOSITION.enabled || entries.length < 2) return null;
  const coach = readJSON(COACH_KEY, {}) || {};
  const exercises = Array.isArray(coach.exercises) ? coach.exercises : [];
  const logs = coach.logs && typeof coach.logs === 'object' ? coach.logs : {};
  const u = units();

  const windowDays = COMPOSITION.windowDays;
  const now = wtParseKey(entries[entries.length - 1].dateKey);
  const start = new Date(now);
  start.setDate(start.getDate() - windowDays);

  const startEntry = entries.find((e) => wtParseKey(e.dateKey) >= start);
  const endEntry = entries[entries.length - 1];
  if (!startEntry || startEntry === endEntry) return null;
  const weightDelta = endEntry.weight - startEntry.weight;
  const actualDays = Math.max(1, Math.round((wtParseKey(endEntry.dateKey) - wtParseKey(startEntry.dateKey)) / 86400000));
  const weeks = actualDays / 7;

  let strengthRatios = [];
  let workoutDays = new Set();
  exercises.forEach((ex) => {
    const exLogs = (logs[ex.id] || []).slice();
    if (exLogs.length < 2 || ex.bw) {
      exLogs.forEach((l) => {
        if (new Date(l.date) >= start) workoutDays.add(String(l.date).slice(0, 10));
      });
      return;
    }
    const inWin = exLogs.filter((l) => new Date(l.date) >= start);
    const before = exLogs.filter((l) => new Date(l.date) < start);
    inWin.forEach((l) => workoutDays.add(String(l.date).slice(0, 10)));
    if (!inWin.length || !before.length) return;
    const avg = (arr) => arr.reduce((s, l) => s + estimate1RM(l.weight, l.reps), 0) / arr.length;
    const a = avg(before), b = avg(inWin);
    if (a <= 0) return;
    strengthRatios.push(b / a);
  });
  const strengthDelta = strengthRatios.length ? strengthRatios.reduce((s, r) => s + r, 0) / strengthRatios.length - 1 : 0;
  const sessionsPerWeek = (workoutDays.size / actualDays) * 7;
  const frequencyFactor = Math.max(0.4, Math.min(1.2, sessionsPerWeek / 4));

  const yt = COMPOSITION.yearsTraining;
  let maxMuscleKgPerWeek;
  if (yt <= 1) maxMuscleKgPerWeek = 0.45;
  else if (yt === 2) maxMuscleKgPerWeek = 0.23;
  else maxMuscleKgPerWeek = 0.11;
  const unitConv = u === 'lb' ? 2.20462 : 1;
  const maxMusclePerWeek = maxMuscleKgPerWeek * unitConv;

  const strengthBoost = Math.max(0.5, Math.min(1.5, 1 + strengthDelta * 4));
  let estMuscle = maxMusclePerWeek * weeks * strengthBoost * frequencyFactor;

  let estFat, headlineCls, headline;
  if (weightDelta > 0) {
    estMuscle = Math.min(estMuscle, weightDelta);
    estFat = Math.max(0, weightDelta - estMuscle);
    const musclePct = estMuscle / weightDelta;
    if (musclePct >= 0.6 && strengthDelta > 0) {
      headlineCls = 'good';
      headline = '+' + weightDelta.toFixed(1) + ' ' + u + ' — mostly muscle, strength up.';
    } else if (musclePct >= 0.35) {
      headlineCls = 'warn';
      headline = '+' + weightDelta.toFixed(1) + ' ' + u + ' — mixed. Tighten kcal or push lifts harder.';
    } else {
      headlineCls = 'bad';
      headline = '+' + weightDelta.toFixed(1) + ' ' + u + ' — mostly fat. Strength flat. Cut kcal.';
    }
  } else {
    const wDown = Math.abs(weightDelta);
    if (strengthDelta >= 0) {
      estMuscle = Math.min(maxMusclePerWeek * weeks * 0.3, 0.5);
      estFat = wDown + estMuscle;
      headlineCls = 'good';
      headline = '−' + wDown.toFixed(1) + ' ' + u + ' — strength holding, fat dropping.';
    } else {
      const lossPct = Math.min(0.4, Math.abs(strengthDelta) * 2);
      estMuscle = -wDown * lossPct;
      estFat = -(wDown + estMuscle);
      headlineCls = 'warn';
      headline = '−' + wDown.toFixed(1) + ' ' + u + ' — strength slipping. You may be losing muscle.';
    }
  }

  const totalAbs = Math.abs(estMuscle) + Math.abs(estFat) || 1;
  const musclePct = (Math.abs(estMuscle) / totalAbs) * 100;
  const fatPct = (Math.abs(estFat) / totalAbs) * 100;
  const sd = strengthDelta * 100;
  const sdStr = (sd >= 0 ? '+' : '') + sd.toFixed(1) + '%';
  const muscleSign = estMuscle >= 0 ? '+' : '';
  const fatSign = estFat >= 0 ? '+' : '';

  return {
    windowLabel: 'last ' + actualDays + 'd',
    headline,
    headlineCls,
    musclePct,
    fatPct,
    foot:
      '~' + muscleSign + estMuscle.toFixed(1) + ' ' + u + ' muscle · ' +
      '~' + fatSign + estFat.toFixed(1) + ' ' + u + ' fat · ' +
      'strength ' + sdStr + ' · ' + sessionsPerWeek.toFixed(1) + ' sessions/wk' +
      (strengthRatios.length ? '' : ' (no lift data)'),
  };
}

function weightStreak(entries) {
  let streak = 0;
  let cursor = new Date();
  if (!entries.find((e) => e.dateKey === wtDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (entries.find((e) => e.dateKey === wtDateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
function weightDelta7d(entries) {
  const last = entries[entries.length - 1];
  const lastDate = wtParseKey(last.dateKey);
  const cutoff = new Date(lastDate);
  cutoff.setDate(cutoff.getDate() - 7);
  const baseline = entries.find((e) => wtParseKey(e.dateKey) >= cutoff) || entries[0];
  return last.weight - baseline.weight;
}

function WeightTile() {
  const [tick, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const bump = () => setTick((t) => t + 1);
  useEffect(() => setMounted(true), []);

  const entries = mounted ? wtLoad() : [];
  const u = mounted ? units() : 'kg';
  const last = entries[entries.length - 1] || null;
  const todayK = wtDateKey(new Date());
  const todayEntry = entries.find((e) => e.dateKey === todayK);
  const streak = mounted ? weightStreak(entries) : 0;
  const delta = entries.length >= 2 ? weightDelta7d(entries) : 0;
  const comp = entries.length >= 2 ? computeComposition(entries) : null;

  function save() {
    const v = parseFloat(inputVal || (todayEntry ? '' : last ? last.weight.toFixed(1) : ''));
    if (isNaN(v) || v <= 0) return;
    const key = wtDateKey(new Date());
    const arr = wtLoad();
    const existing = arr.find((e) => e.dateKey === key);
    if (existing) existing.weight = v;
    else arr.push({ dateKey: key, weight: v });
    arr.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    wtSaveAll(arr);
    setEditing(false);
    setInputVal('');
    bump();
  }

  const showLocked = todayEntry && !editing;

  return (
    <div className="glassy card wt-card">
      <div className="wt-row">
        <span className="wt-num">{last ? last.weight.toFixed(1) : '—'}</span>
        <span className="wt-unit">{u}</span>
      </div>
      {mounted && entries.length >= 2 && Math.abs(delta) >= 0.05 && (
        <div className="wt-delta">
          {delta > 0 ? '↑' : '↓'} {delta > 0 ? '+' : '−'}
          {Math.abs(delta).toFixed(1)} {u} · last 7d
        </div>
      )}
      {mounted && streak >= 2 && (
        <div className="wt-streak">
          🔥<span>{streak} day streak</span>
        </div>
      )}
      {mounted && entries.length === 0 && <div className="wt-empty">Log your first weight to start tracking.</div>}

      {mounted && entries.length >= 2 && (
        <>
          <WeightChart entries={entries} />
          <div className="wt-legend">
            <span className="wt-legend-item">
              <span className="wt-legend-dot" />
              DAILY
            </span>
            <span className="wt-legend-item">
              <span className="wt-legend-dot wt-legend-dot-avg" />
              7-DAY AVG
            </span>
          </div>
          {comp && (
            <div className="wt-comp">
              <div className="wt-comp-h">
                <span className="wt-comp-label">Composition estimate</span>
                <span className="wt-comp-window">{comp.windowLabel}</span>
              </div>
              <div className={'wt-comp-headline ' + comp.headlineCls}>{comp.headline}</div>
              <div className="wt-comp-bars">
                <div className="wt-comp-bar muscle" style={{ width: comp.musclePct.toFixed(1) + '%' }} />
                <div className="wt-comp-bar fat" style={{ width: comp.fatPct.toFixed(1) + '%' }} />
              </div>
              <div className="wt-comp-foot">{comp.foot}</div>
            </div>
          )}
        </>
      )}

      {showLocked ? (
        <div className="wt-locked">
          <div className="wt-locked-info">
            <span className="wt-locked-check">✓</span>
            <div>
              <div className="wt-locked-label">LOGGED TODAY</div>
              <div className="wt-locked-value">
                {todayEntry.weight.toFixed(1)} {u}
              </div>
            </div>
          </div>
          <button
            className="wt-edit-btn"
            type="button"
            onClick={() => {
              setEditing(true);
              setInputVal(todayEntry.weight.toFixed(1));
            }}
          >
            Edit
          </button>
        </div>
      ) : (
        mounted && (
          <div className="wt-input-row">
            <div className="wt-input-top">
              <input
                type="number"
                step="0.1"
                className="wt-input"
                placeholder="Enter weight"
                inputMode="decimal"
                aria-label="Today's weight"
                value={inputVal || (todayEntry ? todayEntry.weight.toFixed(1) : last && !inputVal ? '' : '')}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && save()}
              />
              <span className="wt-unit-static">{u}</span>
              <button className="wt-save-btn" type="button" onClick={save}>
                Save
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

// ---------- Hevy tile ----------
const HEVY_MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function hevyGetKey() {
  return localStorage.getItem('hevy_api_key') || '';
}
function hevyPad2(n) {
  return String(n).padStart(2, '0');
}
function hevyDkey(ms) {
  const d = new Date(ms);
  return d.getFullYear() + '-' + hevyPad2(d.getMonth() + 1) + '-' + hevyPad2(d.getDate());
}
function hevyNormalize(raw) {
  return (raw || [])
    .map((w) => {
      if (!w || !w.id) return null;
      const start = Date.parse(w.start_time) || null;
      const end = Date.parse(w.end_time) || null;
      let volume = 0, sets = 0;
      const exercises = (w.exercises || []).map((ex) => {
        let best = null;
        (ex.sets || []).forEach((s) => {
          const kg = Number(s.weight_kg) || 0, reps = Number(s.reps) || 0;
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
  let sessions = readJSON('fitness_sessions', []);
  if (!Array.isArray(sessions)) sessions = [];
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
    localStorage.setItem('fitness_sessions', JSON.stringify(sessions));
  }
  return added;
}

function HevyTile({ pullTick }) {
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
      const stored = localStorage.getItem('body_hv_collapsed');
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
      setWorkouts(readJSON('hevy_workouts_cache', []));
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    setHasKey(!!hevyGetKey());
    setWorkouts(readJSON('hevy_workouts_cache', []));
    if (!mountedRef.current) {
      mountedRef.current = true;
      if (hevyGetKey()) sync(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pullTick]);

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

  const weekAgo = Date.now() - 7 * 864e5;
  const wk = workouts.filter((w) => w.start >= weekAgo);
  const lastW = workouts[0];

  return (
    <div className="glassy card">
      <div className="hv-header">
        <button className="hv-refresh" type="button" disabled={syncing} onClick={() => (hasKey ? sync(true) : setErr('Connect Hevy first.'))}>
          {syncing ? '↻ …' : '↻ Sync'}
        </button>
        <button
          className="hv-refresh hv-collapse"
          type="button"
          aria-label="Collapse"
          onClick={() => {
            const next = !collapsed;
            setCollapsed(next);
            try {
              localStorage.setItem('body_hv_collapsed', next ? '1' : '0');
            } catch (e) {}
          }}
        >
          <span>⌄</span>
        </button>
      </div>
      {!hasKey && (
        <div className="hv-connect">
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
        <div className={collapsed ? 'hv-collapsed-body' : ''}>
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
                <div className="hv-item" key={w.id}>
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
                      <span className="hv-ex-name" style={{ color: 'var(--faint)' }}>
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
    </div>
  );
}

// ---------- Strava tile ----------
const RUN_TYPES = { Run: 1, TrailRun: 1, VirtualRun: 1 };
function svCreds() {
  return { id: localStorage.getItem('strava_client_id') || '', secret: localStorage.getItem('strava_client_secret') || '' };
}
function svTokens() {
  return readJSON('strava_tokens', null);
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
  let sessions = readJSON('fitness_sessions', []);
  if (!Array.isArray(sessions)) sessions = [];
  let added = 0;
  runs.forEach((r) => {
    const marker = '_sv' + r.id;
    if (sessions.some((s) => s && String(s.id || '').indexOf(marker) !== -1)) return;
    sessions.unshift({ id: 'ft' + r.start + marker, type: 'run', date: hevyDkey(r.start), km: r.km, duration: r.mins, notes: r.name });
    added++;
  });
  if (added) {
    sessions.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    localStorage.setItem('fitness_sessions', JSON.stringify(sessions));
  }
}
function svPace(r) {
  if (!r.km || !r.mins) return '';
  const p = r.mins / r.km;
  return Math.floor(p) + ':' + hevyPad2(Math.round((p % 1) * 60)) + ' /km';
}

function StravaTile({ pullTick }) {
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
      const stored = localStorage.getItem('body_sv_collapsed');
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
      setRuns(readJSON('strava_cache', []));
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    setConnected(svConnected());
    setRuns(readJSON('strava_cache', []));
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
  }, [pullTick]);

  function connect() {
    const id = idInput.trim(), sec = secretInput.trim();
    if (!id || !sec) {
      setErr('Both Client ID and Secret are needed.');
      return;
    }
    localStorage.setItem('strava_client_id', id);
    localStorage.setItem('strava_client_secret', sec);
    const redirectUri = window.location.origin + window.location.pathname;
    window.location.href =
      'https://www.strava.com/oauth/authorize' + '?client_id=' + encodeURIComponent(id) + '&response_type=code' + '&redirect_uri=' + encodeURIComponent(redirectUri) + '&approval_prompt=auto&scope=activity:read_all';
  }
  function disconnect() {
    if (!confirm('Disconnect Strava on this device? Bridged runs stay.')) return;
    ['strava_client_id', 'strava_client_secret', 'strava_tokens', 'strava_cache'].forEach((k) => localStorage.removeItem(k));
    setConnected(false);
    setRuns([]);
  }

  const weekAgo = Date.now() - 7 * 864e5;
  const wk = runs.filter((r) => r.start >= weekAgo);
  const lastR = runs[0];

  return (
    <div className="glassy card">
      <div className="hv-header">
        <button className="hv-refresh" type="button" disabled={syncing} onClick={() => (connected ? sync(true) : setErr('Connect Strava first.'))}>
          {syncing ? '↻ …' : '↻ Sync'}
        </button>
        <button
          className="hv-refresh hv-collapse"
          type="button"
          aria-label="Collapse"
          onClick={() => {
            const next = !collapsed;
            setCollapsed(next);
            try {
              localStorage.setItem('body_sv_collapsed', next ? '1' : '0');
            } catch (e) {}
          }}
        >
          <span>⌄</span>
        </button>
      </div>
      {!connected && (
        <div className="hv-connect">
          <div className="hv-connect-title">Connect Strava</div>
          <p className="hv-connect-p">
            One-time setup: at strava.com/settings/api create an API application, then paste its Client ID and Client Secret below. Both stay on this device only. You&rsquo;ll be sent to Strava once to approve read
            access.
          </p>
          <p className="hv-connect-p">
            Set its <b>Authorization Callback Domain</b> to exactly: <b style={{ color: 'var(--sun)' }}>{domain}</b> (no https://, no path).
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
        <div className={collapsed ? 'hv-collapsed-body' : ''}>
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
                <div className="hv-item" key={r.id}>
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
    </div>
  );
}

// ---------- Today + Sessions tiles ----------
function TodayTile() {
  const F = fitness();
  const st = stackToday();
  const W = waterProgress();
  const split = splitToday();
  const splitNice = split ? split.charAt(0).toUpperCase() + split.slice(1) : '';
  const isRest = split.toLowerCase() === 'rest';
  const gymLogged = F.sessions.some((x) => x && x.date === todayKey());

  const bits = [];
  if (st.total) bits.push(st.taken >= st.total ? 'stack done' : st.total - st.taken + ' supps left');
  if (W.total)
    bits.push(
      W.done >= W.total ? (
        'water done'
      ) : (
        <>
          <b className="warm">{W.total - W.done} glasses</b> to go
        </>
      )
    );

  return (
    <>
      <div className="pagehead">
        <h1>
          {isRest ? (
            <>
              Rest day —<br />
              let it <em>rebuild.</em>
            </>
          ) : (
            <>
              {splitNice} day —<br />
              show <em>up.</em>
            </>
          )}
        </h1>
        <div className="sub">
          {bits.length
            ? bits.reduce((acc, b, i) => (
                <>
                  {acc}
                  {i > 0 && ' · '}
                  {b}
                </>
              ), '')
            : 'Log something and this page comes alive.'}
          {bits.length ? '.' : ''}
        </div>
      </div>

      <div className="section" id="secToday">
        <div className="sec-head">
          Today
          <span className="more">{splitNice ? new Date().toLocaleDateString('en-SG', { weekday: 'short' }).toUpperCase() + ' · ' + splitNice.toUpperCase() + ' DAY' : ''}</span>
        </div>
        <div className="glassy card">
          <div className="rows">
            {st.total > 0 && (
              <a className="rowi" href="/health.html">
                <span className="ic">💊</span>
                <span className="tx">
                  <span className="t1">Supplement stack</span>
                  <span className="t2">{st.taken >= st.total ? 'all taken' + (st.lastTs ? ' by ' + fmtClock(st.lastTs) : '') : st.total - st.taken + ' still to take'}</span>
                </span>
                <span className="end">
                  <b>
                    {st.taken}/{st.total}
                  </b>
                </span>
              </a>
            )}
            {W.total > 0 && (
              <a className="rowi" href="/health.html#water">
                <span className="ic">💧</span>
                <span className="tx">
                  <span className="t1">Water</span>
                  <span className="meter">
                    {Array.from({ length: Math.min(W.total, 10) }, (_, i) => (
                      <i key={i} className={i < W.done ? 'on' : ''} />
                    ))}
                  </span>
                </span>
                <span className="end">
                  {W.done}/{W.total}
                </span>
              </a>
            )}
            <a className="rowi" href="/gym.html">
              <span className="ic">🏋️</span>
              <span className="tx">
                <span className="t1">{isRest ? 'Rest day' : splitNice + ' session'}</span>
                <span className="t2">{gymLogged ? 'session logged today' : isRest ? 'recovery counts too' : 'not logged yet'}</span>
              </span>
              <span className={'end' + (gymLogged || isRest ? '' : ' act')}>{gymLogged ? <b>✓</b> : isRest ? '—' : '+ LOG'}</span>
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

function SessionsTile() {
  const F = fitness();
  const rows = F.sessions.slice(0, 4);
  const km = F.km % 1 === 0 ? F.km : F.km.toFixed(1);
  return (
    <div className="section" id="secSessions">
      <div className="sec-head">
        Recent sessions
        <span className="more">ALL-TIME · {km} KM</span>
      </div>
      <div className="glassy card">
        <div className="rows">
          {rows.length === 0 && (
            <div className="rowi">
              <span className="tx">
                <span className="t2">No sessions yet — log your first on Fitness.</span>
              </span>
            </div>
          )}
          {rows.map((s, i) => {
            const icon = s.type === 'run' ? '🏃' : s.type === 'gym' ? '🏋️' : '🥊';
            const title = s.type === 'run' ? 'Run' + (s.km ? ' — ' + s.km + ' km' : '') : s.type === 'gym' ? 'Gym' + (s.split ? ' — ' + s.split : '') : 'Muay Thai';
            const sub = [s.duration ? s.duration + ' min' : '', s.notes || ''].filter(Boolean).join(' · ');
            return (
              <a className="rowi" href="/gym.html" key={i}>
                <span className="ic">{icon}</span>
                <span className="tx">
                  <span className="t1">{title}</span>
                  {sub && <span className="t2">{sub}</span>}
                </span>
                <span className="end">{fmtDateStr(s.date)}</span>
              </a>
            );
          })}
        </div>
      </div>
      <div className="chiprow">
        <span className="chip glassy">
          <b>{km}</b> km
        </span>
        <span className="chip glassy">
          <b>{F.runs}</b> runs
        </span>
        <span className="chip glassy">
          <b>{F.gym}</b> gym
        </span>
        <span className="chip glassy">
          <b>{F.muay}</b> muay
        </span>
      </div>
    </div>
  );
}

function StackTile() {
  const [tick, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  const bump = () => setTick((t) => t + 1);
  useEffect(() => setMounted(true), []);
  if (!mounted) return (
    <div className="section" id="secStack">
      <div className="sec-head">Supplements</div>
      <div className="glassy card" />
    </div>
  );
  const items = stackGetItems();
  const taken = stackGetTaken();
  const total = items.length;
  const done = items.filter((i) => taken[i.id]).length;
  return (
    <div className="section" id="secStack">
      <div className="sec-head">
        Supplements
        <span className="more">
          {done}/{total}
        </span>
      </div>
      <div className="glassy card">
        <StackTracker tick={tick} bump={bump} progressLabel />
      </div>
    </div>
  );
}

function WaterTile() {
  const [counts, setCounts] = useState({ count: 0, target: 0 });
  return (
    <div className="section" id="secWater">
      <div className="sec-head">
        Water
        <span className="more">
          {counts.count}/{counts.target}
        </span>
      </div>
      <div className="glassy card">
        <WaterTracker onCounts={(count, target) => setCounts((c) => (c.count === count && c.target === target ? c : { count, target }))} />
      </div>
    </div>
  );
}

export default function BodyClient() {
  const [pullTick, setPullTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  usePull(
    {
      goals: { keys: ['goal_streak_v1'] },
      'po-coach': { keys: ['fitness_sessions', 'po_coach_v1', 'po_coach_weights'] },
      'fitness-sync': { keys: ['hevy_api_key', 'hevy_workouts_cache', 'strava_client_id', 'strava_client_secret', 'strava_tokens', 'strava_cache'] },
    },
    () => setPullTick((t) => t + 1)
  );
  // Two-way (not read-only pull): the Supplements tile below edits these keys
  // directly, so local changes need to push to Supabase too, or they get
  // clobbered by the next pull/remount. Same key set as health.html's sync.
  useCloudSync({
    appKey: 'health',
    syncedKeys: ['stack:items', 'stack:version', 'stack:low', 'po_water_v1'],
    syncedPrefixes: ['stack:taken:'],
    onApplied: () => setPullTick((t) => t + 1),
  });

  return (
    <div className="body-page">
      <div className="shellwrap">
        <div className="daterow" />
        {mounted && <TodayTile key={'today-' + pullTick} />}

        <div className="section" id="secWeight">
          <div className="sec-head">Weight</div>
          <WeightTile key={'weight-' + pullTick} />
        </div>

        <div className="section" id="secWorkouts">
          <div className="sec-head">
            Workouts<span className="more">synced from Hevy</span>
          </div>
          <HevyTile pullTick={pullTick} />
        </div>

        <div className="section" id="secRuns">
          <div className="sec-head">
            Runs<span className="more">synced from Strava</span>
          </div>
          <StravaTile pullTick={pullTick} />
        </div>

        <StackTile key={'stack-' + pullTick} />
        {mounted && <WaterTile key={'water-' + pullTick} />}
        {mounted && <SessionsTile key={'sessions-' + pullTick} />}
      </div>
      <AvatarBubble />
      <Dock activeId="body" />
    </div>
  );
}
