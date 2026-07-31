'use client';

import { useEffect, useMemo, useState } from 'react';
import Dock from '@/components/Dock';
import AvatarBubble from '@/components/AvatarBubble';
import { usePull } from '@/hooks/usePull';
import {
  calKey,
  todayKey,
  fmtClock,
  esc,
  readJSON,
  waterProgress,
  stackToday,
  goalsToday,
  fitness,
  sessionTime,
  splitToday,
  learning,
  subjectName,
  library,
  growth,
  habits,
} from '@/lib/sunpath';

// ---------- sun arc geometry ----------
const CX = 195,
  CY = 182,
  R = 175;
function arcPos(p) {
  const th = Math.PI * (1 - p);
  return { x: CX + R * Math.cos(th), y: CY - R * Math.sin(th) };
}
function skyStops() {
  const hr = new Date().getHours();
  if (hr < 5 || hr >= 23) return ['#0B0F1E', '#12141F', '#241D22'];
  if (hr < 9) return ['#233054', '#4A3E62', '#D08A4C'];
  if (hr < 17) return ['#1C2C50', '#39456A', '#B57C4A'];
  return ['#161D36', '#33293E', '#A15A32'];
}

const DAYS_TITLE = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONS_TITLE = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
function dayHeading(d) {
  return DAYS_TITLE[d.getDay()] + ', ' + MONS_TITLE[d.getMonth()] + ' ' + d.getDate();
}
const DAYS_CAPS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONS_CAPS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];
function dateRowLabel(d) {
  return DAYS_CAPS[d.getDay()] + ', ' + MONS_CAPS[d.getMonth()] + ' ' + d.getDate();
}

// ---------- data assembly (ported from today.html's boot()) ----------
function dayEvents(dk) {
  const ev = [];
  const F = fitness();
  F.sessions.forEach((s) => {
    if (!s || s.date !== dk) return;
    const ts = sessionTime(s);
    if (!ts) return;
    const icon = s.type === 'run' ? '🏃' : s.type === 'gym' ? '🏋️' : '🥊';
    const label = s.type === 'run' ? 'Run' : s.type === 'gym' ? 'Gym' : 'Muay';
    const detail =
      s.type === 'run'
        ? (s.km ? s.km + ' km' : '') || (s.duration ? s.duration + ' min' : '')
        : s.split || (s.duration ? s.duration + ' min' : '') || '';
    ev.push({ ts, icon, label, detail });
  });
  const st = stackToday(dk);
  if (st.lastTs && st.taken > 0) {
    ev.push({ ts: st.lastTs, icon: '💊', label: 'Stack', detail: st.taken + '/' + st.total + ' taken' });
  }
  const L = learning();
  L.sessions.forEach((s) => {
    if (!s || s.date !== dk || !s.ts) return;
    ev.push({ ts: s.ts, icon: 'λ', label: subjectName(L, s.subjectId) || 'Study', detail: s.hours ? s.hours + ' h' : s.topic || '' });
  });
  goalsToday(dk).doneWithTs.forEach((g) => {
    const t = String(g.text || '');
    ev.push({ ts: g.doneAt, icon: '✓', label: 'Done', detail: t.length > 22 ? t.slice(0, 22) + '…' : t });
  });
  return ev.sort((a, b) => a.ts - b.ts);
}

function computeSky(isToday, isPast, ev) {
  const NON_TODAY_STOPS = ['#1C2C50', '#39456A', '#B57C4A'];
  let stops, arcP, showDisc, showEvents, emptyText, hr = null;
  if (isToday) {
    const now = new Date();
    hr = now.getHours() + now.getMinutes() / 60;
    const night = hr < 5 || hr >= 23;
    stops = skyStops();
    if (night) {
      arcP = null;
      showDisc = false;
      showEvents = false;
      emptyText = "sun's down — recharge";
    } else {
      arcP = Math.max(0.015, Math.min(0.985, (hr - 5) / 18));
      showDisc = true;
      showEvents = true;
      emptyText = null;
    }
  } else if (isPast) {
    stops = NON_TODAY_STOPS;
    arcP = 1;
    showDisc = false;
    showEvents = true;
    emptyText = null;
  } else {
    stops = NON_TODAY_STOPS;
    arcP = null;
    showDisc = false;
    showEvents = false;
    emptyText = "this day hasn't happened yet";
  }

  let clusters = [];
  if (arcP != null && showEvents) {
    const MIN_GAP = 0.05;
    ev.forEach((e) => {
      const d = new Date(e.ts);
      const ehr = d.getHours() + d.getMinutes() / 60;
      const ep = Math.max(0.02, Math.min(0.98, (ehr - 5) / 18));
      if (ep > arcP + 0.01) return;
      const last = clusters[clusters.length - 1];
      if (last && ep - last.p < MIN_GAP) {
        last.count++;
        return;
      }
      clusters.push({ p: ep, icon: e.icon, count: 1 });
    });
    clusters = clusters.slice(0, 10);
  }

  return { stops, arcP, showDisc, showEvents, emptyText, hr, clusters };
}

function computeFocus(vk, isToday) {
  const gk = isToday ? undefined : vk;
  const G = goalsToday(gk);
  const W = waterProgress(vk);
  const st = stackToday(gk);
  const pct = G.total ? Math.round((G.done / G.total) * 100) : 0;
  const first = G.pending[0];
  const split = splitToday(vk);
  const loggedThatDay = fitness().sessions.some((x) => x && x.date === vk && x.type === 'gym');
  return { G, W, st, pct, first, split, loggedThatDay, isToday };
}

function computeGrid(vk, isToday, tk) {
  const isFuture = vk > tk;
  const gk = isToday ? undefined : vk;
  const F = fitness();
  const st = stackToday(gk);
  const W = waterProgress(vk);
  const L = learning();
  const Lib = library();
  const H = habits();
  const Gr = growth();
  const G = goalsToday(gk);
  const streak = (readJSON('goal_streak_v1', {}) || {}).count || 0;

  const daySessions = F.sessions.filter((x) => x && x.date === vk);
  const sessDesc = daySessions.length
    ? daySessions
        .map(
          (x) =>
            (x.type === 'run' ? 'run' : x.type === 'gym' ? 'gym' : 'muay') +
            (x.type === 'run' && x.km ? ' ' + x.km + 'km' : x.split ? ' ' + x.split : '')
        )
        .join(', ')
    : isFuture
      ? 'nothing planned'
      : 'rest day';

  const daySess = L.sessions.filter((x) => x && x.date === vk);
  const dayHours = daySess.reduce((t, x) => t + (parseFloat(x.hours) || 0), 0);
  const learnDesc = daySess.length ? (daySess[0].topic || 'session').slice(0, 22) : 'no session';

  const dayNotes = Lib.notes.filter((n) => n && n.ts && calKey(new Date(n.ts)) === vk);
  const libDesc = dayNotes.length ? String(dayNotes[0].text || '').slice(0, 40) : 'no notes this day';

  const dayReflection = Gr.notes.find((n) => n && n.ts && calKey(new Date(n.ts)) === vk);

  return { vk, isToday, G, H, F, st, W, streak, daySessions, sessDesc, dayHours, learnDesc, dayNotes, libDesc, Gr, dayReflection };
}

function computeAiSuggest() {
  const hour = new Date().getHours();
  const G = goalsToday(),
    H = habits(),
    W = waterProgress(),
    st = stackToday(),
    F = fitness();

  if (W.total > 0 && W.done < Math.ceil(W.total * 0.5) && hour >= 15) {
    return {
      area: 'Health',
      html: 'You’re behind on <b>water</b> today (' + W.done + '/' + W.total + '). Catch up now.',
      why: 'Based on what you’ve logged against today’s target of ' + W.total + ' servings.',
      add: 'Drink water to catch up (' + (W.total - W.done) + ' left)',
    };
  }
  if (st.total > 0 && st.taken < st.total && hour >= 12) {
    return {
      area: 'Health',
      html: 'Finish today’s <b>supplement stack</b> — ' + st.taken + '/' + st.total + ' taken.',
      why: (st.total - st.taken) + ' item(s) still left in your stack for today.',
      add: 'Take remaining supplement stack items',
    };
  }
  if (G.total > 0 && G.pending.length > 0 && hour >= 17) {
    const t = String(G.pending[0].text || '');
    return {
      area: 'Goals',
      html: 'Close out <b>' + esc(t.length > 40 ? t.slice(0, 40) + '…' : t) + '</b> before the day resets.',
      why: G.pending.length + ' goal' + (G.pending.length === 1 ? '' : 's') + ' still open today.',
      add: t,
    };
  }
  if (H.list.length > 0 && H.doneToday < H.list.length && hour >= 20) {
    return {
      area: 'Habits',
      html: 'You’re at <b>' + H.doneToday + '/' + H.list.length + '</b> habits today — still time to close the gap.',
      why: 'Habits reset at midnight — closing the gap keeps your streaks alive.',
      add: 'Finish remaining habits for today',
    };
  }
  const last = F.sessions[0];
  if (last && last.date) {
    const days = Math.floor((Date.now() - new Date(last.date + 'T00:00:00').getTime()) / 864e5);
    if (days >= 3) {
      return {
        area: 'Fitness',
        html: 'It’s been <b>' + days + ' days</b> since your last ' + esc(last.type || 'workout') + '.',
        why: 'Consistency compounds — even a short session keeps momentum going.',
        add: 'Get a workout in today',
      };
    }
  }
  return {
    area: 'Goals',
    html: G.total ? 'Goals and habits look steady today — nice work.' : 'No goals set for today yet.',
    why: G.total ? 'Everything tracked so far today is on pace.' : 'Setting one small goal gives today direction.',
    add: G.total ? 'Add a stretch goal for today' : 'Set a goal for today',
  };
}

function computeAiSummary() {
  const G = goalsToday(),
    H = habits(),
    W = waterProgress(),
    st = stackToday();
  const parts = [];
  if (G.total > 0) parts.push(G.done / G.total);
  if (H.list.length > 0) parts.push(H.doneToday / H.list.length);
  if (W.total > 0) parts.push(Math.min(1, W.done / W.total));
  if (st.total > 0) parts.push(Math.min(1, st.taken / st.total));
  const pct = parts.length ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100) : null;
  const grade = pct == null ? null : pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F';

  const hour = new Date().getHours();
  const pod = hour < 5 ? 'Late night' : hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : hour < 22 ? 'Evening' : 'Late night';
  const FRAME = {
    Morning: 'set the tone for today',
    Afternoon: 'still time to make today count',
    Evening: 'wrap up strong',
    'Late night': 'rest matters too — recharge for tomorrow',
  };

  const goalsStatus = G.total ? G.done + '/' + G.total + ' done' : 'No goals or tasks set for today.';
  const goalsTip = !G.total
    ? 'Raise your baseline by setting one goal — small, consistent wins build long-term momentum.'
    : G.pending.length
      ? 'Close out “' + esc(String(G.pending[0].text || '').slice(0, 40)) + '” — your highest-leverage move right now.'
      : 'All goals done — add a stretch goal to keep the streak building.';

  const healthBits = [];
  if (W.total) healthBits.push(W.done + '/' + W.total + ' water');
  if (st.total) healthBits.push(st.taken + '/' + st.total + ' stack');
  const healthStatus = healthBits.length ? healthBits.join(' · ') : 'No health data synced yet.';
  const healthTip =
    W.total > 0 && W.done < W.total
      ? 'Catch up on water — you’re at ' + W.done + '/' + W.total + ' for today.'
      : st.total > 0 && st.taken < st.total
        ? 'Log the rest of today’s supplement stack.'
        : 'Maintain gains by periodizing training — alternate strength and endurance blocks for long-term health.';

  const L = learning();
  const todayHrs = L.sessions.filter((s) => s && s.date === todayKey()).reduce((t, s) => t + (parseFloat(s.hours) || 0), 0);
  const lastSession = L.sessions[0];
  const learnStatus = !L.sessions.length ? 'No learning sessions yet.' : todayHrs > 0 ? todayHrs.toFixed(1) + ' h logged today' : 'Nothing logged today';
  const learnTip =
    todayHrs > 0
      ? 'Good pace — review today’s notes before they fade.'
      : lastSession
        ? 'Stay ahead by revisiting ' + esc(subjectName(L, lastSession.subjectId) || 'your last subject') + ' — spaced review beats cramming.'
        : 'Log a session to start building your learning streak.';

  return {
    headline: pod + ' — ' + FRAME[pod] + (pct != null ? '. <b class="num">' + pct + '%</b> (' + grade + '-range)' : ''),
    cats: [
      { label: 'Goals & Tasks', status: goalsStatus, tip: goalsTip },
      { label: 'Health', status: healthStatus, tip: healthTip },
      { label: 'Learning', status: learnStatus, tip: learnTip },
    ],
  };
}

function buildViewModel(viewDate) {
  const vk = calKey(viewDate);
  const tk = todayKey();
  const isToday = vk === tk;
  const isPast = vk < tk;
  const ev = dayEvents(vk);
  const sky = computeSky(isToday, isPast, ev);

  const greeting = isToday
    ? {
        mode: 'today',
        text: (() => {
          const h = Math.floor(sky.hr);
          return h < 5 ? 'Rest up,' : h < 12 ? 'Good morning,' : h < 17 ? 'Good afternoon,' : h < 23 ? 'Good evening,' : 'Rest up,';
        })(),
      }
    : { mode: 'other', text: dayHeading(viewDate) + '.' };

  let sub;
  if (isToday) {
    if (sky.arcP == null) {
      sub = { kind: 'plain', text: 'Your day runs 5:00 — 23:00. See you at sunrise.' };
    } else {
      const minsLeft = Math.max(0, (23 - sky.hr) * 60);
      sub = { kind: 'today', hh: Math.floor(minsLeft / 60), mm: Math.floor(minsLeft % 60), pct: Math.round(sky.arcP * 100) };
    }
  } else if (isPast) {
    sub = ev.length ? { kind: 'count', count: ev.length } : { kind: 'plain', text: 'Nothing logged that day.' };
  } else {
    sub = { kind: 'plain', text: 'Nothing logged yet.' };
  }

  const emptyChipText = isToday ? 'nothing logged yet — the day is young' : isPast ? 'nothing was logged this day' : 'nothing logged yet';

  return {
    vk,
    isToday,
    ev,
    sky,
    greeting,
    sub,
    emptyChipText,
    focus: computeFocus(vk, isToday),
    grid: computeGrid(vk, isToday, tk),
  };
}

// ---------- presentational pieces ----------
function SkySvg({ sky }) {
  const { stops, arcP, showDisc, showEvents, emptyText, clusters } = sky;
  const sp = arcP != null ? arcPos(arcP) : null;
  return (
    <svg className="sky" viewBox="0 -30 390 230">
      <defs>
        <linearGradient id="skyfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stops[0]} stopOpacity="0.85" />
          <stop offset="60%" stopColor={stops[1]} stopOpacity="0.45" />
          <stop offset="100%" stopColor={stops[2]} stopOpacity="0.22" />
        </linearGradient>
        <linearGradient id="arcdone" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#E4572E" />
          <stop offset="100%" stopColor="#F2A65A" />
        </linearGradient>
        <radialGradient id="sunglow">
          <stop offset="0%" stopColor="#FFD9A0" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#F2A65A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M20 182 A175 175 0 0 1 370 182 Z" fill="url(#skyfill)" />
      <path d="M20 182 A175 175 0 0 1 370 182" fill="none" stroke="rgba(244,241,234,0.14)" strokeWidth="1.6" strokeDasharray="2 6" />
      {arcP != null && sp && (
        <>
          <path
            d={`M20 182 A175 175 0 0 1 ${sp.x.toFixed(1)} ${sp.y.toFixed(1)}`}
            fill="none"
            stroke="url(#arcdone)"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          {showEvents &&
            clusters.map((c, i) => {
              const m = arcPos(c.p);
              return (
                <g key={i}>
                  <circle cx={m.x.toFixed(1)} cy={m.y.toFixed(1)} r={c.count > 1 ? 6 : 4.5} fill="#F2A65A" />
                  <text
                    x={m.x.toFixed(1)}
                    y={(m.y - 12).toFixed(1)}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#F4F1EA"
                    fontFamily={c.count > 1 ? 'Spline Sans Mono, monospace' : undefined}
                  >
                    {c.count > 1 ? `×${c.count}` : c.icon}
                  </text>
                </g>
              );
            })}
          {showDisc && (
            <>
              <circle cx={sp.x.toFixed(1)} cy={sp.y.toFixed(1)} r="26" fill="url(#sunglow)" />
              <circle cx={sp.x.toFixed(1)} cy={sp.y.toFixed(1)} r="9" fill="#FFD9A0" />
            </>
          )}
        </>
      )}
      {arcP == null && emptyText && (
        <text x="195" y="120" textAnchor="middle" fontSize="12" fill="rgba(244,241,234,0.4)" fontFamily="Spline Sans Mono, monospace">
          {emptyText}
        </text>
      )}
      <line x1="0" y1="182" x2="390" y2="182" stroke="rgba(244,241,234,0.14)" strokeWidth="1" />
      <circle cx="20" cy="182" r="3" fill="rgba(244,241,234,0.35)" />
      <circle cx="370" cy="182" r="3" fill="rgba(244,241,234,0.2)" />
    </svg>
  );
}

function renderSub(sub) {
  if (sub.kind === 'today') {
    return (
      <>
        <b className="num">
          {sub.hh}h {sub.mm}m
        </b>{' '}
        left in your day — you&rsquo;re {sub.pct}% through.
      </>
    );
  }
  if (sub.kind === 'count') {
    return (
      <>
        <b className="num">{sub.count}</b> thing{sub.count === 1 ? '' : 's'} logged that day.
      </>
    );
  }
  return sub.text;
}

function LoggedChips({ ev, emptyChipText }) {
  if (!ev.length) {
    return (
      <span className="log-chip glassy" style={{ color: 'var(--faint)' }}>
        {emptyChipText}
      </span>
    );
  }
  return ev.map((e, i) => (
    <span className="log-chip glassy" key={i}>
      <span className="t num">{fmtClock(e.ts)}</span>
      <b>{e.label}</b>
      {e.detail ? ` ${e.detail}` : ''}
    </span>
  ));
}

function FocusCard({ focus }) {
  const { G, W, st, pct, first, split, loggedThatDay, isToday } = focus;
  return (
    <>
      <a className="focus-top" href="/goals.html">
        <span
          className="ring"
          style={{ background: `conic-gradient(var(--leaf) 0 ${pct}%, rgba(244,241,234,0.1) ${pct}% 100%)` }}
        >
          <i className="num">{G.total ? `${G.done}/${G.total}` : '—'}</i>
        </span>
        <span>
          <span className="what">{first ? first.text : G.total ? 'All goals done — solid day.' : 'No goals set that day'}</span>
          <span className="whatsub" style={{ display: 'block' }}>
            {first
              ? 'top of the list · tap to manage'
              : G.total
                ? isToday
                  ? 'plan tomorrow tonight'
                  : 'nothing left that day'
                : isToday
                  ? "tap to add today's goals"
                  : 'no goals that day'}
          </span>
        </span>
      </a>
      <div className="rows" style={{ marginTop: '10px' }}>
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
            <span className="end num">
              {W.done}/{W.total}
            </span>
          </a>
        )}
        {st.total > 0 && (
          <a className="rowi" href="/health.html">
            <span className="ic">💊</span>
            <span className="tx">
              <span className="t1">Supplement stack</span>
              <span className="t2">{st.taken >= st.total ? 'all taken' : `${st.total - st.taken} still to take`}</span>
            </span>
            <span className={'end' + (st.taken >= st.total ? '' : ' act')}>
              {st.taken >= st.total ? (
                <b>
                  {st.taken}/{st.total}
                </b>
              ) : (
                `${st.taken}/${st.total}`
              )}
            </span>
          </a>
        )}
        {split && split.toLowerCase() !== 'rest' && (
          <a className="rowi" href="/gym.html">
            <span className="ic">🏋️</span>
            <span className="tx">
              <span className="t1">{split.charAt(0).toUpperCase() + split.slice(1)} session</span>
              <span className="t2">{loggedThatDay ? 'logged — nice' : isToday ? "today's split day" : "that day's split"}</span>
            </span>
            <span className={'end' + (loggedThatDay ? '' : ' act')}>{loggedThatDay ? <b>✓</b> : isToday ? '+ LOG' : '—'}</span>
          </a>
        )}
      </div>
    </>
  );
}

function ModuleGrid({ grid }) {
  const { vk, isToday, G, H, F, st, W, streak, daySessions, sessDesc, dayHours, learnDesc, dayNotes, libDesc, Gr, dayReflection } = grid;
  const kmDisplay = F.km % 1 === 0 ? F.km : F.km.toFixed(1);
  const dayHoursDisplay = dayHours % 1 === 0 ? dayHours : dayHours.toFixed(1);

  let quote;
  if (Gr.locked) {
    quote = dayReflection ? 'Locked · written that day — tap to unlock.' : 'Reflections are locked.';
  } else if (dayReflection) {
    const t = String(dayReflection.text || '');
    quote = `“${t.length > 110 ? t.slice(0, 110) + '…' : t}”`;
  } else {
    quote = 'No reflection this day.';
  }

  return (
    <>
      <a className="mod glassy" href="/goals.html">
        <span className="k">{isToday ? 'Today' : 'Goals'} — Goals</span>
        <span className="v num">
          {G.total ? `${G.done}/${G.total}` : '—'} <small>done</small>
        </span>
        <span className="d">
          {isToday ? (
            streak > 0 ? (
              <>
                <b>🔥 {streak}</b> day streak
              </>
            ) : (
              'start a streak today'
            )
          ) : G.total ? (
            'goals for that day'
          ) : (
            'no goals set that day'
          )}
        </span>
      </a>
      <a className="mod glassy" href="/habits.html">
        <span className="k">{isToday ? 'Today' : 'Habits'} — Habits</span>
        <span className="v num">
          {H.bestStreak} <small>day streak</small>
        </span>
        {H.list.length ? (
          <span className="dots">
            {H.list.slice(0, 7).map((h) => (
              <i key={h.id} className={(H.log[vk] || []).indexOf(h.id) !== -1 ? 'on' : ''} />
            ))}
          </span>
        ) : (
          <span className="d">no habits yet</span>
        )}
      </a>
      <a className="mod glassy" href="/gym.html">
        <span className="k">Body — Fitness</span>
        <span className="v num">
          {daySessions.length || '—'} <small>session{daySessions.length === 1 ? '' : 's'}</small>
        </span>
        <span className="d">
          {sessDesc} · {kmDisplay}km all-time
        </span>
      </a>
      <a className="mod glassy" href="/health.html">
        <span className="k">Body — Health</span>
        <span className="v num">
          {st.total ? `${st.taken}/${st.total}` : '—'} <small>stack</small>
        </span>
        <span className="d">
          water{' '}
          <b className={W.done >= W.total ? '' : 'warm'}>
            {W.done}/{W.total}
          </b>
        </span>
      </a>
      <a className="mod glassy" href="/learning.html">
        <span className="k">Mind — Learning</span>
        <span className="v num">
          {dayHoursDisplay} <small>hours</small>
        </span>
        <span className="d">{learnDesc}</span>
      </a>
      <a className="mod glassy" href="/library.html">
        <span className="k">Mind — Library</span>
        <span className="v num">
          {dayNotes.length} <small>note{dayNotes.length === 1 ? '' : 's'}</small>
        </span>
        <span className="d">{libDesc}</span>
      </a>
      <a className="glassy card" style={{ gridColumn: '1/-1' }} href="/growth.html">
        <span className="k">Growth{dayReflection ? ' — that day' : ''}</span>
        <div style={{ marginTop: '8px' }}>
          <span className="quote-q">{quote}</span>
        </div>
      </a>
    </>
  );
}

const ASK_CHIPS = ['What to focus on?', 'Am I behind?', 'Health check', 'Habits to build?'];

function askNova(text) {
  text = String(text || '').trim();
  if (!text) return;
  try {
    sessionStorage.setItem('mentor_pending_prompt', text);
  } catch (e) {}
  window.location.href = '/mentor.html';
}

function AiSuggest() {
  const [whyOpen, setWhyOpen] = useState(false);
  const sug = computeAiSuggest();
  function handleAdd() {
    try {
      sessionStorage.setItem('goals_pending_add', sug.add);
    } catch (e) {}
    window.location.href = '/goals.html';
  }
  return (
    <>
      <span className="k">AI Suggest</span>
      <span className="ai-suggest-tag">{sug.area}</span>
      <div className="ai-suggest-text" dangerouslySetInnerHTML={{ __html: sug.html }} />
      <div className={'ai-suggest-why' + (whyOpen ? ' on' : '')}>{sug.why}</div>
      <div className="ai-suggest-actions">
        <button type="button" className="ai-btn primary" onClick={handleAdd}>
          + Add
        </button>
        <button type="button" className="ai-btn" onClick={() => setWhyOpen((w) => !w)}>
          Why?
        </button>
      </div>
    </>
  );
}

function AiSummary() {
  const sum = computeAiSummary();
  return (
    <>
      <span className="k">AI Summary</span>
      <div className="ai-summary-head" dangerouslySetInnerHTML={{ __html: sum.headline }} />
      <div className="ai-summary-cats">
        {sum.cats.map((c) => (
          <div className="ai-summary-cat" key={c.label}>
            <span className="k">{c.label}</span>
            <div className="status">{c.status}</div>
            <div className="tip">{c.tip}</div>
          </div>
        ))}
      </div>
    </>
  );
}

// ---------- page ----------
export default function TodayPage() {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [mounted, setMounted] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [askInput, setAskInput] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Re-render the sky every minute, but only when today is the viewed day
  // (matches the legacy setInterval in today.html).
  useEffect(() => {
    if (!mounted) return;
    const id = setInterval(() => {
      setViewDate((d) => (calKey(d) === todayKey() ? new Date(d) : d));
    }, 60 * 1000);
    return () => clearInterval(id);
  }, [mounted]);

  usePull(
    {
      goals: { prefixes: ['goals:'], keys: ['goal_streak_v1'] },
      'po-coach': { keys: ['fitness_sessions', 'po_coach_v1', 'po_coach_weights'] },
      health: { keys: ['stack:items', 'po_water_v1'], prefixes: ['stack:taken:'] },
      learning: { keys: ['learning_subjects', 'learning_sessions'] },
      library: { keys: ['library_books', 'library_notes'] },
      growth: { keys: ['growth_notes', 'growth_lock_hash'] },
      habits: { keys: ['habits_list', 'habits_log'] },
      finance: { keys: ['nw:history', 'subs'] },
    },
    () => setRefreshTick((t) => t + 1)
  );

  const vm = useMemo(() => (mounted ? buildViewModel(viewDate) : null), [mounted, viewDate, refreshTick]);

  function prevDay() {
    setViewDate((d) => {
      const nd = new Date(d);
      nd.setDate(nd.getDate() - 1);
      return nd;
    });
  }
  function nextDay() {
    setViewDate((d) => {
      const nd = new Date(d);
      nd.setDate(nd.getDate() + 1);
      return nd;
    });
  }
  function jumpToday() {
    setViewDate(new Date());
  }
  function handleAskSubmit(e) {
    e.preventDefault();
    askNova(askInput);
    setAskInput('');
  }

  return (
    <div className="today-page">
      <a className="mentor-fab" href="/mentor.html" title="Ask Nova" aria-label="Open Nova, your AI mentor">
        ✨
      </a>
      <div className="shellwrap">
        <div className="daterow">
          <button className="day-arrow" type="button" aria-label="Previous day" onClick={prevDay}>
            ‹
          </button>
          <span className="daterow-label">{mounted ? dateRowLabel(viewDate) : ''}</span>
          <button className="day-arrow" type="button" aria-label="Next day" onClick={nextDay}>
            ›
          </button>
          <button className="day-today-jump num" type="button" hidden={!vm || vm.isToday} onClick={jumpToday}>
            Today
          </button>
        </div>

        <div className="hero">
          <div className="hero-head">
            <h1>
              {vm ? (
                vm.greeting.mode === 'today' ? (
                  <>
                    {vm.greeting.text}
                    <br />
                    Rame.
                  </>
                ) : (
                  vm.greeting.text
                )
              ) : (
                <>
                  Hello,
                  <br />
                  Rame.
                </>
              )}
            </h1>
            <span>
              <AvatarBubble inline />
            </span>
          </div>
          <div className="sub">{vm && renderSub(vm.sub)}</div>
          <div className="skywrap">
            <div>{vm && <SkySvg sky={vm.sky} />}</div>
            <div className="sky-caps">
              <span>05:00</span>
              <span>23:00</span>
            </div>
          </div>
          <div className="logged">{vm && <LoggedChips ev={vm.ev} emptyChipText={vm.emptyChipText} />}</div>
        </div>

        <div className="section section-focus">
          <div className="sec-head">
            Up next
            <span className="more num">{vm && vm.focus.G.total ? `${vm.focus.G.total - vm.focus.G.done} of ${vm.focus.G.total} goals left` : ''}</span>
          </div>
          <div className="glassy card">{vm && <FocusCard focus={vm.focus} />}</div>
        </div>

        <div className="section section-mentor">
          <div className="ai-row2">
            <div className="glassy card ai-tile ai-suggest">{vm && <AiSuggest />}</div>
            <div className="glassy card ai-tile ai-ask">
              <span className="k">AI Ask</span>
              <div className="ask-chiprow">
                {ASK_CHIPS.map((c) => (
                  <button key={c} type="button" className="prompt-chip" onClick={() => askNova(c)}>
                    {c}
                  </button>
                ))}
              </div>
              <form className="ai-ask-form" onSubmit={handleAskSubmit}>
                <input
                  value={askInput}
                  onChange={(e) => setAskInput(e.target.value)}
                  type="text"
                  placeholder="Ask anything about your day…"
                  autoComplete="off"
                />
                <button type="submit" aria-label="Ask Nova">
                  &rarr;
                </button>
              </form>
            </div>
          </div>
          <div className="glassy card ai-tile ai-summary">{vm && <AiSummary />}</div>
        </div>

        <div className="section section-grid">
          <div className="grid2">{vm && <ModuleGrid grid={vm.grid} />}</div>
        </div>
      </div>
      <Dock activeId="today" />
    </div>
  );
}
