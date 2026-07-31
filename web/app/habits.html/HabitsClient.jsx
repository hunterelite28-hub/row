'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Topbar from '@/components/Topbar';
import { useCloudSync } from '@/hooks/useCloudSync';

const COLORS = ['#F97316', '#7DD3FC', '#86EFAC', '#FCA5A5', '#FCD34D', '#C4B5FD', '#F9A8D4', '#6EE7B7', '#A5B4FC', '#FDE68A'];
const MO = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

// ---- storage ----
function loadHabits() {
  try {
    return JSON.parse(localStorage.getItem('habits_list')) || [];
  } catch (e) {
    return [];
  }
}
function saveHabits(h) {
  localStorage.setItem('habits_list', JSON.stringify(h));
}
function loadLog() {
  try {
    return JSON.parse(localStorage.getItem('habits_log')) || {};
  } catch (e) {
    return {};
  }
}
function saveLog(l) {
  localStorage.setItem('habits_log', JSON.stringify(l));
}

// ---- date ----
function dkey(y, m0, d) {
  return y + '-' + String(m0 + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

// ---- grid geometry ----
function gridBounds(year) {
  const jan1 = new Date(year, 0, 1);
  const isoMon = (jan1.getDay() + 6) % 7;
  const start = new Date(year, 0, 1 - isoMon);
  const dec31 = new Date(year, 11, 31);
  const isoSun = (7 - dec31.getDay()) % 7;
  const end = new Date(year, 11, 31 + isoSun);
  const totalDays = Math.round((end - start) / 864e5) + 1;
  return { start, totalDays, numWeeks: totalDays / 7 };
}
function cellSize(numWeeks, windowWidth) {
  const w = Math.min(windowWidth, 680) - 32 - 28;
  const gap = 2;
  return Math.max(3, Math.floor((w - (numWeeks - 1) * gap) / numWeeks));
}

// ---- stats ----
function calcStreak(id, log) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (!(log[dkey(d.getFullYear(), d.getMonth(), d.getDate())] || []).includes(id)) {
    d.setDate(d.getDate() - 1);
  }
  let s = 0;
  for (let i = 0; i < 730; i++) {
    if (!(log[dkey(d.getFullYear(), d.getMonth(), d.getDate())] || []).includes(id)) break;
    s++;
    d.setDate(d.getDate() - 1);
  }
  return s;
}
function calcBestStreak(id, log) {
  const keys = Object.keys(log).filter((k) => (log[k] || []).includes(id)).sort();
  let best = 0, cur = 0, prev = null;
  for (const k of keys) {
    const d = new Date(k + 'T00:00:00');
    if (prev) {
      const diff = Math.round((d - prev) / 864e5);
      cur = diff === 1 ? cur + 1 : 1;
    } else cur = 1;
    best = Math.max(best, cur);
    prev = d;
  }
  return best;
}
function calcYearCompletions(id, log, year) {
  let n = 0;
  for (let m = 0; m < 12; m++) {
    const days = new Date(year, m + 1, 0).getDate();
    for (let d = 1; d <= days; d++) {
      if ((log[dkey(year, m, d)] || []).includes(id)) n++;
    }
  }
  return n;
}
function calcMonthlyData(id, log, year) {
  const t = new Date();
  return Array.from({ length: 12 }, (_, m) => {
    const isFutureMo = year > t.getFullYear() || (year === t.getFullYear() && m > t.getMonth());
    if (isFutureMo) return null;
    const days = new Date(year, m + 1, 0).getDate();
    const maxDay = year === t.getFullYear() && m === t.getMonth() ? t.getDate() : days;
    let n = 0;
    for (let d = 1; d <= maxDay; d++) {
      if ((log[dkey(year, m, d)] || []).includes(id)) n++;
    }
    return n;
  });
}

function buildChartPath(data) {
  const valid = data.filter((v) => v !== null);
  const max = Math.max(...valid, 1);
  const W = 300, H = 60;
  const pts = [];
  const moLabels = [];
  data.forEach((v, i) => {
    if (v === null) return;
    const x = (i / 11) * W;
    const y = H - (v / max) * H * 0.88 - H * 0.06;
    pts.push([x, y]);
    moLabels.push(MO[i].slice(0, 3));
  });
  if (pts.length < 2) return { pts: [], moLabels, linePath: '', areaPath: '', W, H };

  let linePath = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 5;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 5;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 5;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 5;
    linePath += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  const lastPt = pts[pts.length - 1];
  const areaPath = linePath + ` L ${lastPt[0]},${H} L ${pts[0][0]},${H} Z`;
  return { pts, moLabels, linePath, areaPath, W, H };
}

function YearGrid({ habit, log, viewYear, windowWidth, onToggle }) {
  const { start, totalDays, numWeeks } = gridBounds(viewYear);
  const cs = cellSize(numWeeks, windowWidth);
  const gap = 2;
  const t = new Date();
  t.setHours(0, 0, 0, 0);

  const cells = useMemo(() => {
    const out = [];
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(start.getTime() + i * 864e5);
      out.push(d);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewYear, totalDays]);

  const monthLabels = [];
  for (let m = 0; m < 12; m++) {
    const firstOfMonth = new Date(viewYear, m, 1);
    if (firstOfMonth < start) continue;
    const dayOff = Math.round((firstOfMonth - start) / 864e5);
    const col = Math.floor(dayOff / 7);
    monthLabels.push({ m, left: col * (cs + gap) });
  }

  return (
    <div className="year-grid-wrap">
      <div className="year-month-row">
        {monthLabels.map(({ m, left }) => (
          <span key={m} className="year-month-lbl" style={{ left }}>
            {MO[m]}
          </span>
        ))}
      </div>
      <div className="year-grid" style={{ '--cell': cs + 'px', '--cgap': gap + 'px' }}>
        {cells.map((d, i) => {
          if (d.getFullYear() !== viewYear) {
            return <div key={i} className="year-cell no-click" style={{ background: 'transparent' }} />;
          }
          if (d > t) {
            return <div key={i} className="year-cell no-click" style={{ background: 'rgba(255,255,255,0.04)' }} />;
          }
          const isDone = (log[dkey(d.getFullYear(), d.getMonth(), d.getDate())] || []).includes(habit.id);
          const isToday = d.getTime() === t.getTime();
          const style = {
            background: isDone ? habit.color : isToday ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
            opacity: isDone ? (isToday ? 1 : 0.85) : undefined,
            outline: isToday ? `1.5px solid ${habit.color}` : undefined,
            outlineOffset: isToday ? '1px' : undefined,
          };
          return <div key={i} className="year-cell" style={style} onClick={() => onToggle(habit.id, d)} />;
        })}
      </div>
    </div>
  );
}

function Chart({ habit, log, viewYear }) {
  const data = calcMonthlyData(habit.id, log, viewYear);
  const { pts, moLabels, linePath, areaPath, W, H } = buildChartPath(data);

  if (pts.length < 2) {
    return (
      <>
        <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-4)' }}>
          NO DATA FOR {viewYear}
        </div>
        <div className="chart-month-row" />
      </>
    );
  }

  const gradId = 'cg_' + habit.id;
  return (
    <>
      <div className="chart-svg-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: 64 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={habit.color} stopOpacity="0.45" />
              <stop offset="100%" stopColor={habit.color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradId})`} />
          <path d={linePath} fill="none" stroke={habit.color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </div>
      <div className="chart-month-row">
        {moLabels.map((m, i) => (
          <span key={i} className="chart-month-lbl">
            {m}
          </span>
        ))}
      </div>
    </>
  );
}

function HabitModal({ open, editingId, name, setName, color, setColor, onCancel, onSave, onDelete }) {
  const inputRef = useRef(null);
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current && inputRef.current.focus(), 80);
  }, [open]);
  useEffect(() => {
    document.body.classList.toggle('topbar-modal-open', open);
    return () => document.body.classList.remove('topbar-modal-open');
  }, [open]);

  return (
    <div className={'modal-bg' + (open ? ' show' : '')} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <div className="modal-title">{editingId ? 'EDIT HABIT' : 'NEW HABIT'}</div>
        <div className="form-field">
          <label className="form-label">Name</label>
          <input
            ref={inputRef}
            className="form-input"
            placeholder="e.g. Morning Run"
            maxLength={40}
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSave()}
          />
        </div>
        <div className="form-field">
          <label className="form-label">Color</label>
          <div className="color-grid">
            {COLORS.map((c) => (
              <div key={c} className={'color-swatch' + (c === color ? ' selected' : '')} style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-primary" onClick={onSave}>
            Save
          </button>
        </div>
        {editingId && (
          <button className="btn-danger" onClick={onDelete}>
            Delete Habit
          </button>
        )}
      </div>
    </div>
  );
}

export default function HabitsClient() {
  const [tick, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [selectedHabitId, setSelectedHabitId] = useState(null);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [windowWidth, setWindowWidth] = useState(680);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [colorInput, setColorInput] = useState(COLORS[0]);

  const bump = () => setTick((t) => t + 1);

  useCloudSync({ appKey: 'habits', syncedKeys: ['habits_list', 'habits_log'], onApplied: bump });

  useEffect(() => {
    setMounted(true);
    setWindowWidth(window.innerWidth);
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    window.addEventListener('storage', bump);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('storage', bump);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const habits = mounted ? loadHabits() : [];
  const log = mounted ? loadLog() : {};
  const activeId = habits.find((h) => h.id === selectedHabitId) ? selectedHabitId : habits[0] && habits[0].id;
  const habit = habits.find((h) => h.id === activeId);

  const now = new Date();
  const dateSub = mounted ? DAYS[now.getDay()] + ' · ' + String(now.getDate()).padStart(2, '0') + ' ' + MO[now.getMonth()] + ' ' + now.getFullYear() : '';

  function toggleCell(id, date) {
    const l = loadLog();
    const k = dkey(date.getFullYear(), date.getMonth(), date.getDate());
    const arr = (l[k] || []).slice();
    const i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1);
    else arr.push(id);
    if (arr.length) l[k] = arr;
    else delete l[k];
    saveLog(l);
    bump();
  }
  function markDone() {
    if (!habit) return;
    toggleCell(habit.id, new Date());
  }

  function openAdd() {
    setEditingId(null);
    setColorInput(COLORS[0]);
    setNameInput('');
    setModalOpen(true);
  }
  function openEdit(h) {
    setEditingId(h.id);
    setColorInput(h.color);
    setNameInput(h.name);
    setModalOpen(true);
  }
  function closeModal() {
    setModalOpen(false);
  }
  function saveModal() {
    const name = nameInput.trim();
    if (!name) return;
    const list = loadHabits();
    if (editingId) {
      const idx = list.findIndex((h) => h.id === editingId);
      if (idx >= 0) {
        list[idx].name = name;
        list[idx].color = colorInput;
      }
    } else {
      const newH = { id: 'h_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5), name, color: colorInput };
      list.push(newH);
      setSelectedHabitId(newH.id);
    }
    saveHabits(list);
    setModalOpen(false);
    bump();
  }
  function deleteHabit() {
    if (!editingId || !confirm('Delete this habit and all its data?')) return;
    const list = loadHabits().filter((h) => h.id !== editingId);
    const l = loadLog();
    Object.keys(l).forEach((k) => {
      l[k] = (l[k] || []).filter((id) => id !== editingId);
      if (!l[k].length) delete l[k];
    });
    saveHabits(list);
    saveLog(l);
    if (selectedHabitId === editingId) setSelectedHabitId(list[0] ? list[0].id : null);
    setModalOpen(false);
    bump();
  }

  const isDoneToday = habit && (log[dkey(now.getFullYear(), now.getMonth(), now.getDate())] || []).includes(habit.id);

  return (
    <div className="habits-page">
      <Topbar hub="today" pageLabel="HABITS" />
      <div className="shell">
        <div className="page-header">
          <div className="page-title">
            HABITS<span className="page-title-dot">.</span>
          </div>
          <div className="page-sub">{dateSub}</div>
        </div>

        <div className="selector-wrap">
          {habits.map((h) => (
            <button
              key={h.id}
              className={'habit-circle' + (h.id === activeId ? ' active' : '')}
              title={h.name}
              style={{
                background: h.color + '28',
                borderColor: h.id === activeId ? h.color : 'transparent',
                boxShadow: h.id === activeId ? `0 0 0 3px ${h.color}22` : 'none',
                color: h.color,
              }}
              onClick={() => setSelectedHabitId(h.id)}
            >
              {h.name.slice(0, 2).toUpperCase()}
            </button>
          ))}
          <button className="add-circle" title="Add habit" onClick={openAdd}>
            +
          </button>
        </div>

        {mounted && habits.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">◎</span>
            NO HABITS YET
            <br />
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)' }}>TAP + TO START TRACKING</span>
          </div>
        )}

        {habit && (
          <div>
            <div className="detail-head">
              <div className="detail-name">{habit.name.toUpperCase()}</div>
              <button className="detail-edit-btn" onClick={() => openEdit(habit)}>
                ···
              </button>
            </div>

            <div className="year-card">
              <div className="year-nav">
                <button className="year-nav-btn" onClick={() => setViewYear((y) => y - 1)}>
                  ‹
                </button>
                <span className="year-label">{viewYear}</span>
                <button className="year-nav-btn" onClick={() => setViewYear((y) => y + 1)}>
                  ›
                </button>
              </div>
              <YearGrid habit={habit} log={log} viewYear={viewYear} windowWidth={windowWidth} onToggle={toggleCell} />
            </div>

            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-val">{calcYearCompletions(habit.id, log, viewYear)}</div>
                <div className="stat-label">COMPLETIONS</div>
              </div>
              <div className="stat-card">
                <div className="stat-val">{calcStreak(habit.id, log)}</div>
                <div className="stat-label">STREAK</div>
              </div>
              <div className="stat-card">
                <div className="stat-val">{calcBestStreak(habit.id, log)}</div>
                <div className="stat-label">BEST</div>
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-head">
                <span className="chart-title">COMPLETIONS / MONTH</span>
              </div>
              <Chart habit={habit} log={log} viewYear={viewYear} />
            </div>

            <button className={'mark-done-btn ' + (isDoneToday ? 'done' : 'undone')} style={{ '--habit-color': habit.color }} onClick={markDone}>
              {isDoneToday ? '✓  DONE TODAY' : 'MARK AS DONE'}
            </button>
          </div>
        )}
      </div>

      <HabitModal
        open={modalOpen}
        editingId={editingId}
        name={nameInput}
        setName={setNameInput}
        color={colorInput}
        setColor={setColorInput}
        onCancel={closeModal}
        onSave={saveModal}
        onDelete={deleteHabit}
      />
    </div>
  );
}
