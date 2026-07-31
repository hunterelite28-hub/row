'use client';

import { useEffect, useRef, useState } from 'react';
import Topbar from '@/components/Topbar';
import { useCloudSync } from '@/hooks/useCloudSync';
import { activeDateKey, calKey } from '@/lib/sunpath';

// ---------- storage helpers ----------
function storeGet(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch (e) {
    return null;
  }
}
function storeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}
function storeDelete(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {}
}
function storeListKeys(prefix) {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.indexOf(prefix) === 0) out.push(k);
  }
  return out;
}
function getGoals(key) {
  const g = storeGet(key);
  return Array.isArray(g) ? g : [];
}
function setGoals(key, list) {
  storeSet(key, list);
}

// ---------- date helpers ----------
function tomorrowDateString() {
  const now = new Date();
  const d = new Date(now);
  if (now.getHours() >= 5) d.setDate(d.getDate() + 1);
  return calKey(d);
}
function formatDate(yyyy_mm_dd) {
  const parts = yyyy_mm_dd.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const wk = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  return wk + ', ' + mo + ' ' + d.getDate();
}
function goalsKeyToday() {
  return 'goals:' + activeDateKey();
}
function goalsKeyTomorrow() {
  return 'goals:' + tomorrowDateString();
}

// ---------- rollover: pull undone older goals into today ----------
function rollover() {
  const todayDateStr = activeDateKey();
  const todayK = 'goals:' + todayDateStr;
  let today = getGoals(todayK);
  const texts = new Set(today.map((g) => g.text));

  storeListKeys('goals:').forEach((k) => {
    const dateStr = k.slice('goals:'.length);
    if (dateStr >= todayDateStr) return;
    const old = getGoals(k);
    old.forEach((g) => {
      if (!g.done && g.text && !texts.has(g.text)) {
        today.push({ text: g.text, done: false });
        texts.add(g.text);
      }
    });
    storeDelete(k);
  });
  setGoals(todayK, today);
}

// ---------- streak ----------
function loadStreak() {
  const s = storeGet('goal_streak_v1');
  if (s && typeof s.count === 'number') return s;
  return { count: 0, lastProcessedDate: '' };
}
function saveStreak(s) {
  storeSet('goal_streak_v1', s);
}
function processStreak() {
  const s = loadStreak();
  const todayDateStr = activeDateKey();
  const keys = storeListKeys('goals:')
    .map((k) => k.slice('goals:'.length))
    .filter((d) => d < todayDateStr)
    .sort();
  keys.forEach((dateStr) => {
    if (s.lastProcessedDate && dateStr <= s.lastProcessedDate) return;
    const list = getGoals('goals:' + dateStr);
    if (list.length === 0) {
      // don't break the streak on empty days
    } else if (list.every((g) => g.done)) s.count += 1;
    else s.count = 0;
    s.lastProcessedDate = dateStr;
  });
  saveStreak(s);
}

// ---------- personal goals ----------
const PERSONAL_KEY = 'personal_goals_v1';
const PG_CATEGORY_LABEL = {
  career: 'Career', health: 'Health', relationships: 'Relationships',
  growth: 'Growth', financial: 'Financial', adventure: 'Adventure',
};
function getPersonalGoals() {
  const g = storeGet(PERSONAL_KEY);
  return Array.isArray(g) ? g : [];
}
function setPersonalGoals(list) {
  storeSet(PERSONAL_KEY, list);
}

// ---------- Goal Ticker ----------
function buildTickerItems() {
  const goals = getGoals(goalsKeyToday());
  const total = goals.length;
  const done = goals.filter((g) => g.done).length;
  if (total === 0) return { items: [{ status: 'empty', text: 'No goals set for today — add one to get rolling.' }], done, total };
  if (done === total) return { items: [{ status: 'done', text: '✓ All goals done — solid day.' }], done, total };
  const items = goals.filter((g) => !g.done).map((g) => ({ status: 'pending', text: g.text }));
  return { items, done, total };
}
function statusGlyph(status) {
  if (status === 'done') return '✓';
  if (status === 'pending') return '○';
  return '·';
}

function GoalTicker({ tick }) {
  const [cycleIdx, setCycleIdx] = useState(0);
  const [item, setItem] = useState(null);
  const [fading, setFading] = useState(false);
  const [meta, setMeta] = useState('0/0');
  const timerRef = useRef(null);

  function showNext(resetToZero) {
    const { items, done, total } = buildTickerItems();
    setMeta(done + '/' + total);
    setCycleIdx((prev) => {
      const idx = resetToZero ? 0 : prev >= items.length ? 0 : prev;
      setItem(items[idx]);
      return (idx + 1) % items.length;
    });
  }

  useEffect(() => {
    showNext(true);
    setFading(false);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        showNext(false);
        setFading(false);
      }, 220);
    }, 5000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  if (!item) return null;

  return (
    <div className="goal-ticker" aria-live="polite" aria-atomic="true">
      <div className="goal-ticker-led">
        <span className="goal-ticker-led-dot" />
      </div>
      <div className="goal-ticker-label">GOALS</div>
      <div className="goal-ticker-stage">
        <div className={'goal-ticker-row' + (fading ? ' is-fading' : '')}>
          <span className="goal-ticker-status" data-status={item.status}>
            {statusGlyph(item.status)}
          </span>
          <span className="goal-ticker-text">{item.text}</span>
        </div>
      </div>
      <div className="goal-ticker-meta">{meta}</div>
    </div>
  );
}

// ---------- Goal row (today / tomorrow lists) ----------
function GoalRow({ goal, idx, storageKey, readOnly, onChange }) {
  const [editing, setEditing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const textRef = useRef(null);

  function startEdit() {
    if (editing) return;
    setEditing(true);
    requestAnimationFrame(() => {
      const el = textRef.current;
      if (!el) return;
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
  }
  function commitEdit() {
    const el = textRef.current;
    setEditing(false);
    if (!el) return;
    const next = el.textContent.trim();
    if (next && next !== goal.text) {
      const list = getGoals(storageKey);
      if (list[idx]) {
        list[idx].text = next;
        setGoals(storageKey, list);
      }
      onChange();
    } else {
      el.textContent = goal.text;
    }
  }
  function cancelEdit() {
    if (textRef.current) textRef.current.textContent = goal.text;
    setEditing(false);
  }
  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      textRef.current.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  }

  function toggleDone(checked) {
    const list = getGoals(storageKey);
    if (!list[idx]) return;
    list[idx].done = checked;
    if (checked) list[idx].doneAt = Date.now();
    else delete list[idx].doneAt;
    setGoals(storageKey, list);
    onChange();
  }
  function toggleQueue() {
    const list = getGoals(storageKey);
    if (!list[idx]) return;
    list[idx].queued = !list[idx].queued;
    setGoals(storageKey, list);
    setFlashing(true);
    setTimeout(() => {
      setFlashing(false);
      onChange();
    }, 480);
  }
  function remove() {
    const list = getGoals(storageKey);
    list.splice(idx, 1);
    setGoals(storageKey, list);
    onChange();
  }

  function onDragStart(e) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  }
  function onDragOver(e) {
    e.preventDefault();
    setDragOver(true);
  }
  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
    const to = idx;
    if (isNaN(from) || isNaN(to) || from === to) return;
    const list = getGoals(storageKey);
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    setGoals(storageKey, list);
    onChange();
  }

  const className =
    'gm-row' +
    (goal.done ? ' gm-row-done' : '') +
    (goal.queued ? ' gm-row-queued' : '') +
    (dragOver ? ' is-drag-over' : '') +
    (flashing ? ' is-queue-flashing' : '');

  return (
    <li
      className={className}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <span className="gm-handle">⋮⋮</span>
      <input
        type="checkbox"
        className="gm-check"
        checked={!!goal.done}
        disabled={readOnly}
        title={readOnly ? 'Activates at 5 AM tomorrow' : undefined}
        onChange={(e) => toggleDone(e.target.checked)}
      />
      <span
        className="gm-text"
        ref={textRef}
        contentEditable={editing}
        suppressContentEditableWarning
        onClick={startEdit}
        onBlur={editing ? commitEdit : undefined}
        onKeyDown={editing ? handleKeyDown : undefined}
      >
        {goal.text}
      </span>
      <button
        type="button"
        className={'gm-queue-btn' + (goal.queued ? ' gm-queue-active' : '')}
        title="Queue for productivity window"
        disabled={readOnly}
        onClick={toggleQueue}
      >
        ⚡
      </button>
      <button type="button" className="goal-delete" aria-label="Delete goal" onClick={remove}>
        ×
      </button>
    </li>
  );
}

function GoalList({ goals, storageKey, readOnly, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const visible = goals.length > 5 ? (expanded ? goals : goals.slice(0, 5)) : goals;
  return (
    <>
      {visible.map((g, i) => (
        <GoalRow key={i} goal={g} idx={i} storageKey={storageKey} readOnly={readOnly} onChange={onChange} />
      ))}
      {goals.length > 5 && (
        <button type="button" className="gm-show-toggle" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less ▴' : `Show ${goals.length - 5} more ▾`}
        </button>
      )}
    </>
  );
}

// ---------- personal goal row ----------
function PersonalRow({ goal, idx, onChange }) {
  function toggleDone(checked) {
    const list = getPersonalGoals();
    if (!list[idx]) return;
    list[idx].done = checked;
    if (checked) list[idx].doneAt = Date.now();
    else delete list[idx].doneAt;
    setPersonalGoals(list);
    onChange();
  }
  function remove() {
    const list = getPersonalGoals();
    list.splice(idx, 1);
    setPersonalGoals(list);
    onChange();
  }
  return (
    <li className={'gm-row' + (goal.done ? ' gm-row-done' : '')}>
      <input type="checkbox" className="gm-check" checked={!!goal.done} onChange={(e) => toggleDone(e.target.checked)} />
      <span className="gm-text" style={{ cursor: 'default' }}>
        {goal.text}
      </span>
      {goal.category && (
        <span className="pg-tag" data-cat={goal.category}>
          {PG_CATEGORY_LABEL[goal.category] || goal.category}
        </span>
      )}
      {goal.target && <span className="pg-target">{goal.target}</span>}
      <button type="button" className="goal-delete" aria-label="Delete goal" onClick={remove}>
        ×
      </button>
    </li>
  );
}

// ---------- add/polish form ----------
function AddForm({ placeholder, onAdd, showPolish, statusEl }) {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState('');
  const [statusError, setStatusError] = useState(false);
  const statusTimer = useRef(null);

  function showStatus(message, isError) {
    setStatus(message);
    setStatusError(!!isError);
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => {
      setStatus('');
      setStatusError(false);
    }, 3500);
  }
  function commit() {
    const text = value.trim();
    if (!text) return;
    onAdd(text);
    setValue('');
  }
  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    }
  }
  // ANTHROPIC_API_KEY is never configured client-side (as in the legacy
  // page) — Polish always falls back to a plain add.
  function handlePolish() {
    const text = value.trim();
    if (!text) return;
    onAdd(text);
    setValue('');
    showStatus('Polish needs an Anthropic API key — added as-typed.', false);
  }

  return (
    <div className="goal-input-wrap gm-input-wrap">
      <input className="gm-input" type="text" placeholder={placeholder} autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={handleKeyDown} />
      <button type="button" className="gm-add" onClick={commit}>
        + Add
      </button>
      {showPolish && (
        <button type="button" className="gm-polish" onClick={handlePolish}>
          ✨ Polish
        </button>
      )}
      <div className={'gm-status' + (statusError ? ' gm-status-error' : '')}>{status}</div>
    </div>
  );
}

// ---------- page ----------
export default function GoalsClient() {
  const [tick, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  const bump = () => setTick((t) => t + 1);

  useCloudSync({
    appKey: 'goals',
    syncedPrefixes: ['goals:', 'personal_goals_v1'],
    onApplied: bump,
  });

  useEffect(() => {
    rollover();
    processStreak();

    // Pick up an "+Add" handed off from the Today hub's AI Suggest tile.
    try {
      const pending = sessionStorage.getItem('goals_pending_add');
      sessionStorage.removeItem('goals_pending_add');
      if (pending) {
        const key = goalsKeyToday();
        const list = getGoals(key);
        list.push({ text: String(pending), done: false });
        setGoals(key, list);
      }
    } catch (e) {}

    setMounted(true);
    bump();

    window.addEventListener('storage', bump);
    return () => window.removeEventListener('storage', bump);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) {
    return (
      <div className="goals-page">
        <Topbar hub="today" pageLabel="GOALS" />
      </div>
    );
  }

  const todayList = getGoals(goalsKeyToday());
  const tomorrowList = getGoals(goalsKeyTomorrow());
  const personalList = getPersonalGoals();
  const streak = loadStreak();

  const total = todayList.length;
  const done = todayList.filter((g) => g.done).length;
  const label = total === 0 ? 'no goals yet' : done === total ? 'all done — solid day' : 'complete';

  const now = new Date();
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MFULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dashDateSub = DAYS[now.getDay()] + ', ' + now.getDate() + ' ' + MFULL[now.getMonth()] + ' ' + now.getFullYear();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const dashWkLabel = 'WK OF ' + weekStart.getDate() + ' ' + MONS[weekStart.getMonth()];

  function pushRemaining() {
    const today = getGoals(goalsKeyToday());
    const remaining = today.filter((g) => !g.done);
    if (remaining.length === 0) return;
    if (!confirm(`Move ${remaining.length} unchecked goal${remaining.length === 1 ? '' : 's'} to tomorrow?`)) return;
    const tomorrow = getGoals(goalsKeyTomorrow());
    const seen = new Set(tomorrow.map((g) => g.text));
    remaining.forEach((g) => {
      if (!seen.has(g.text)) {
        tomorrow.push({ text: g.text, done: false });
        seen.add(g.text);
      }
    });
    setGoals(goalsKeyTomorrow(), tomorrow);
    setGoals(goalsKeyToday(), today.filter((g) => g.done));
    bump();
  }
  function addToday(text) {
    const key = goalsKeyToday();
    const list = getGoals(key);
    list.push({ text, done: false });
    setGoals(key, list);
    bump();
  }
  function addTomorrow(text) {
    const key = goalsKeyTomorrow();
    const list = getGoals(key);
    list.push({ text, done: false });
    setGoals(key, list);
    bump();
  }
  function addPersonal(text, category, target) {
    const list = getPersonalGoals();
    list.push({ text, category, target, done: false });
    setPersonalGoals(list);
    bump();
  }

  return (
    <div className="goals-page">
      <Topbar hub="today" pageLabel="GOALS" />
      <div className="page">

      <div className="dash-header">
        <div className="dash-header-left">
          <div className="dash-title-text">
            GOALS<span className="dash-title-dot">.</span>
          </div>
          <div className="dash-title-sub">{dashDateSub}</div>
        </div>
        <div className="dash-header-right">
          <div className="dash-wk-label">{dashWkLabel}</div>
        </div>
      </div>

      <div className="ticker-row">
        <GoalTicker tick={tick} />
      </div>

      <div className="section">
        <div className="os-sect">PERSONAL.GOALS</div>
        <div className="gm-card">
          <div className="gm-header">
            <div className="gm-header-left">
              <div className="gm-eyebrow">All-time — things I&rsquo;m working toward</div>
            </div>
          </div>
          <ul className="goal-list gm-list">
            {personalList.map((g, i) => (
              <PersonalRow key={i} goal={g} idx={i} onChange={bump} />
            ))}
          </ul>
          {personalList.length === 0 && <div className="empty-state">No personal goals yet — add one below.</div>}
          <PersonalAddForm onAdd={addPersonal} />
        </div>
      </div>

      <div className="section">
        <div className="os-sect">TODO.TODAY</div>

        <div className={'gm-card' + (total > 0 && done === total ? ' gm-all-done' : '')}>
          <div className="gm-header">
            <div className="gm-header-left">
              <div className="gm-eyebrow">Today — {formatDate(activeDateKey())}</div>
              <div className="gm-progress-row">
                <span className="gm-progress-num">{done}</span>
                <span className="gm-progress-total">/ {total}</span>
                <span className="gm-progress-label">{label}</span>
              </div>
            </div>
            <div className={'gm-streak' + (streak.count > 0 ? ' gm-streak-active' : '')}>
              <span className="gm-streak-icon">⚡</span>
              <span className="gm-streak-num">{streak.count}</span>
              <span>day streak</span>
            </div>
          </div>
          <div className="gm-bar">
            {todayList.map((g, i) => (
              <div key={i} className={'gm-bar-seg' + (g.done ? ' gm-bar-seg-done' : '')} />
            ))}
          </div>
          <ul className="goal-list gm-list">
            <GoalList goals={todayList} storageKey={goalsKeyToday()} readOnly={false} onChange={bump} />
          </ul>
          {todayList.length === 0 && <div className="empty-state">No goals for today yet — add one below.</div>}
          {total > 0 && done < total && (
            <button type="button" className="gm-push-btn" onClick={pushRemaining}>
              Push remaining to tomorrow
            </button>
          )}
          <AddForm placeholder="Add a goal for today…" onAdd={addToday} showPolish />
        </div>

        <div className="gm-card gm-card-tomorrow">
          <div className="gm-header">
            <div className="gm-header-left">
              <div className="gm-eyebrow">Plan tomorrow — {formatDate(tomorrowDateString())}</div>
              <div className="gm-tomorrow-sub">Write tonight, locked until 5 AM.</div>
            </div>
            <div className="gm-tomorrow-count">{tomorrowList.length} planned</div>
          </div>
          <ul className="goal-list gm-list">
            <GoalList goals={tomorrowList} storageKey={goalsKeyTomorrow()} readOnly onChange={bump} />
          </ul>
          {tomorrowList.length === 0 && <div className="empty-state">Nothing planned for tomorrow yet</div>}
          <AddForm placeholder="Add a goal for tomorrow…" onAdd={addTomorrow} showPolish />
        </div>
      </div>
      </div>
    </div>
  );
}

function PersonalAddForm({ onAdd }) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState('career');
  const [target, setTarget] = useState('');

  function commit() {
    const t = text.trim();
    if (!t) return;
    onAdd(t, category, target.trim());
    setText('');
    setTarget('');
  }

  return (
    <div className="goal-input-wrap gm-input-wrap">
      <input
        className="gm-input"
        type="text"
        placeholder="A goal to work toward…"
        autoComplete="off"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
        }}
      />
      <select className="pg-select" value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="career">Career</option>
        <option value="health">Health</option>
        <option value="relationships">Relationships</option>
        <option value="growth">Growth</option>
        <option value="financial">Financial</option>
        <option value="adventure">Adventure</option>
      </select>
      <input className="gm-input pg-target-input" type="text" placeholder="Target (optional)" autoComplete="off" value={target} onChange={(e) => setTarget(e.target.value)} />
      <button type="button" className="gm-add" onClick={commit}>
        + Add
      </button>
    </div>
  );
}
