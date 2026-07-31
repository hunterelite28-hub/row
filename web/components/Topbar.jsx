'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pdropxqcdyppbjkaxgpo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7y8hvL8HV-X2YLHora2EKw_jhdTI7UH';

const BOTTOM_TABS = [
  { id: 'today', label: 'Today', href: '/' },
  { id: 'body', label: 'Body', href: '/body.html' },
  { id: 'mind', label: 'Mind', href: '/mind.html' },
  { id: 'money', label: 'Money', href: '/money.html' },
];

function calendarDateKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getWaterProgress() {
  let state = null;
  try {
    state = JSON.parse(localStorage.getItem('po_water_v1'));
  } catch (e) {}
  if (!state) return { done: 0, total: 0 };
  const todayKey = calendarDateKey();
  const done = (state.logs || {})[todayKey] || 0;
  const p = state.profile || { weightKg: 75 };
  const wKg = state.weightUnit === 'lb' ? (p.weightKg || 0) / 2.20462 : p.weightKg || 0;
  const base = wKg * 35;
  const exercise = ((p.activityHrsPerWeek || 0) / 7) * 500;
  const caffeine = Math.max(0, (state.caffeineMgPerDay || 0) - 200) * 1.5;
  const subs = (state.substances || []).reduce((s, x) => {
    const dose = (x && x.dose != null ? x.dose : x && x.defaultDose) || 0;
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
function classifyStatus(done, total) {
  if (total === 0) return 'idle';
  if (done >= total) return 'good';
  if (done >= total * 0.5) return 'warn';
  const h = new Date().getHours();
  if (h >= 23 && done < total * 0.5) return 'miss';
  return 'warn';
}
function defaultWaterState() {
  return {
    unit: 'bottle', bottleMl: 500, glassMl: 250, weightUnit: 'kg',
    profile: { weightKg: 75, age: 25, sex: 'm', activityHrsPerWeek: 5 },
    caffeineMgPerDay: 200, substances: [], logs: {},
  };
}
async function pushWaterMergedToSupabase(localWater) {
  try {
    const supa = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data, error } = await supa.from('app_state').select('data').eq('key', 'health').maybeSingle();
    // A failed read means we can't merge safely — writing now would
    // replace the whole health row (supplement stack included) with
    // water-only data. Skip; health.html pushes the full state later.
    if (error) return;
    const current = (data && data.data) || {};
    const merged = Object.assign({}, current, { po_water_v1: localWater });
    await supa.from('app_state').upsert({ key: 'health', data: merged, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  } catch (e) {}
}

// Ported from the legacy topbar.js — persistent top bar (system name,
// clock, water pill, finance shortcut, sync dot) + bottom tab bar, used
// by every "classic" (non-hub) page. `hub` is which of the 4 dock hubs
// this page belongs to; `pageLabel` is the short page name shown in the
// top bar (e.g. "GOALS").
export default function Topbar({ hub, pageLabel, suppressWaterPush }) {
  const [water, setWater] = useState({ done: 0, total: 0 });
  const [clock, setClock] = useState('');
  const [syncClass, setSyncClass] = useState('idle');
  const [flash, setFlash] = useState(false);
  const [lensIndex, setLensIndex] = useState(Math.max(0, BOTTOM_TABS.findIndex((t) => t.id === hub)));
  const [animateLens, setAnimateLens] = useState(false);
  const navigateTimer = useRef(null);

  function refreshWater() {
    setWater(getWaterProgress());
  }
  function refreshClock() {
    const d = new Date();
    setClock(String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'));
  }
  function refreshSync() {
    let cls = 'idle';
    if (!navigator.onLine) cls = 'off';
    else {
      let t = 0;
      try {
        t = parseInt(localStorage.getItem('os_last_sync') || '0', 10) || 0;
      } catch (e) {}
      if (Date.now() - t < 10 * 60 * 1000) cls = 'on';
    }
    setSyncClass(cls);
  }

  useEffect(() => {
    document.body.classList.add('has-bottombar');
    refreshWater();
    refreshClock();
    refreshSync();
    const onFocus = () => refreshWater();
    const onVisibility = () => {
      if (!document.hidden) {
        refreshWater();
        refreshClock();
        refreshSync();
      }
    };
    window.addEventListener('storage', refreshWater);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', refreshSync);
    window.addEventListener('offline', refreshSync);
    document.addEventListener('visibilitychange', onVisibility);
    const waterTimer = setInterval(refreshWater, 30 * 1000);
    const clockTimer = setInterval(refreshClock, 5 * 1000);
    const syncTimer = setInterval(refreshSync, 10 * 1000);
    return () => {
      document.body.classList.remove('has-bottombar');
      window.removeEventListener('storage', refreshWater);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', refreshSync);
      window.removeEventListener('offline', refreshSync);
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(waterTimer);
      clearInterval(clockTimer);
      clearInterval(syncTimer);
      if (navigateTimer.current) clearTimeout(navigateTimer.current);
    };
  }, []);

  function addWater() {
    let state = null;
    try {
      state = JSON.parse(localStorage.getItem('po_water_v1'));
    } catch (e) {}
    if (!state || typeof state !== 'object') state = defaultWaterState();
    state.logs = state.logs || {};
    const k = calendarDateKey();
    state.logs[k] = (state.logs[k] || 0) + 1;
    try {
      localStorage.setItem('po_water_v1', JSON.stringify(state));
    } catch (e) {}
    refreshWater();
    setFlash(true);
    setTimeout(() => setFlash(false), 220);
    // health.html owns the full "health" app_state row via its own
    // two-way sync — pushing a water-only merge from here too would race it.
    if (!suppressWaterPush) pushWaterMergedToSupabase(state);
  }

  function handleTabClick(e, tab, index) {
    if (tab.id === hub) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    setAnimateLens(true);
    setLensIndex(index);
    navigateTimer.current = setTimeout(() => {
      window.location.href = tab.href;
    }, 240);
  }

  const status = classifyStatus(water.done, water.total);
  const syncTitle = syncClass === 'off' ? 'Offline' : syncClass === 'idle' ? 'No recent sync' : 'Synced';

  return (
    <>
      <header className="topbar" role="navigation" aria-label="System bar">
        <a href="/" className="topbar-os" aria-label="Home">
          <span className="topbar-os-name">SUNPATH</span>
          <span className="topbar-os-sep">·</span>
          <span className="topbar-os-page">{pageLabel}</span>
        </a>
        <span className="topbar-clock">{clock}</span>
        <div className="topbar-water-wrap">
          <a href="/health.html#water" className={'topbar-water-pill' + (status === 'warn' || status === 'miss' ? ' ' + status : '')} aria-label="Water progress">
            <span className="topbar-pill-dot" />
            <span className="topbar-pill-count">{water.total ? `${water.done}/${water.total}` : '0/0'}</span>
          </a>
          <button className={'topbar-water-add' + (flash ? ' flash' : '')} aria-label="Log one drink" type="button" onClick={addWater}>
            +
          </button>
        </div>
        <a href="/money.html" className="topbar-finance-btn" aria-label="Finance">
          <span className="topbar-finance-icon">📊</span>
        </a>
        <span className="topbar-sync" title={syncTitle}>
          <span className={'topbar-sync-dot' + (syncClass !== 'on' ? ' ' + (syncClass === 'off' ? 'off' : 'idle') : '')} />
        </span>
      </header>

      <nav className="bottombar" role="navigation" aria-label="Sunpath areas">
        <span
          className="bottombar-lens"
          style={{
            width: `calc((100% - 10px) / ${BOTTOM_TABS.length})`,
            transition: animateLens ? '' : 'none',
            transform: `translateX(${lensIndex * 100}%)`,
          }}
        />
        {BOTTOM_TABS.map((tab, i) => (
          <a
            key={tab.id}
            href={tab.href}
            className={'bottombar-tab' + (tab.id === hub ? ' active' : '')}
            onClick={(e) => handleTabClick(e, tab, i)}
          >
            <span>{tab.label}</span>
          </a>
        ))}
      </nav>
    </>
  );
}
