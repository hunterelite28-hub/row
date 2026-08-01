'use client';

import { useEffect, useRef, useState } from 'react';
import { STACK_WINDOWS, SUPPLEMENT_DB, getItems, setItems, getTaken, setTaken, getLow, setLow, metaText, getStackIssues } from '@/lib/stack';

export function StackTicker({ tick }) {
  const [idx, setIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    setIdx(0);
    setFading(false);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const issues = getStackIssues();
      if (issues.length <= 1) return;
      setFading(true);
      setTimeout(() => {
        setIdx((i) => (i + 1) % issues.length);
        setFading(false);
      }, 280);
    }, 5000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const issues = getStackIssues();
  const totalItems = getItems().length;
  const hasMissed = issues.some((i) => i.type === 'missed');
  const status = issues.length === 0 ? '' : hasMissed ? 'status-missed' : 'status-low';
  const message = issues.length === 0 ? 'All caught up — keep it rolling' : issues[idx % issues.length].text;
  const count = issues.length === 0 ? `0/${totalItems}` : `${issues.length}/${totalItems}`;

  return (
    <div className={'stack-ticker' + (status ? ' ' + status : '')}>
      <span className="stack-ticker-dot" />
      <span className="stack-ticker-label">STACK</span>
      <span className="stack-ticker-sep">·</span>
      <span className={'stack-ticker-msg' + (fading ? ' is-fading' : '')}>{message}</span>
      <span className="stack-ticker-count">{count}</span>
    </div>
  );
}

function StackItemRow({ item, isTaken, isLow, isMissed, onToggle, onLow, onDelete, onUpdate }) {
  const [editingName, setEditingName] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const nameRef = useRef(null);
  const metaRef = useRef(null);

  function focusAndPlace(el) {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  function startEditName() {
    setEditingName(true);
    requestAnimationFrame(() => nameRef.current && focusAndPlace(nameRef.current));
  }
  function commitName() {
    setEditingName(false);
    const el = nameRef.current;
    if (!el) return;
    const val = el.textContent.trim();
    if (val) onUpdate(item.id, 'name', val);
    else el.textContent = item.name;
  }
  function startEditMeta() {
    setEditingMeta(true);
    requestAnimationFrame(() => metaRef.current && focusAndPlace(metaRef.current));
  }
  function commitMeta() {
    setEditingMeta(false);
    const el = metaRef.current;
    if (!el) return;
    const text = el.textContent.trim();
    const parts = text.split(/\s*·\s*/);
    onUpdate(item.id, 'dose', parts[0] || '');
    onUpdate(item.id, 'note', parts.slice(1).join(' · '));
  }

  return (
    <div className={'stack-item' + (isTaken ? ' taken' : '') + (isMissed ? ' missed' : '')}>
      <button className={'stack-check' + (isTaken ? ' checked' : '')} aria-label="Mark taken" onClick={() => onToggle(item.id)}>
        {isTaken ? '✓' : ''}
      </button>
      <div className="stack-item-body">
        <div className="stack-item-name" onClick={() => !editingName && startEditName()}>
          <span
            className="stack-item-name-text"
            ref={nameRef}
            contentEditable={editingName}
            suppressContentEditableWarning
            onBlur={editingName ? commitName : undefined}
            onKeyDown={(e) => {
              if (!editingName) return;
              if (e.key === 'Enter') {
                e.preventDefault();
                nameRef.current.blur();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setEditingName(false);
                nameRef.current.textContent = item.name;
              }
            }}
          >
            {item.name}
          </span>
          {item.tag === 'stack' && <span className="stack-item-tag tag-stack">stack</span>}
          {item.tag === 'not-ordered' && <span className="stack-item-tag tag-not-ordered">not ordered</span>}
        </div>
        <div
          className="stack-item-meta"
          ref={metaRef}
          contentEditable={editingMeta}
          suppressContentEditableWarning
          onClick={() => !editingMeta && startEditMeta()}
          onBlur={editingMeta ? commitMeta : undefined}
          onKeyDown={(e) => {
            if (!editingMeta) return;
            if (e.key === 'Enter') {
              e.preventDefault();
              metaRef.current.blur();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              setEditingMeta(false);
              metaRef.current.textContent = metaText(item);
            }
          }}
        >
          {metaText(item)}
        </div>
      </div>
      <button className={'stack-low-btn' + (isLow ? ' is-low' : '')} onClick={() => onLow(item.id)}>
        ↓ Running low
      </button>
      <button className="stack-item-del" aria-label="Delete" onClick={() => onDelete(item.id)}>
        ×
      </button>
    </div>
  );
}

function AddStackForm({ onAdd }) {
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [win, setWin] = useState('morning');
  const [pendingNote, setPendingNote] = useState('');
  const [showResults, setShowResults] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowResults(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  function searchSupplements(q) {
    const query = q.toLowerCase().trim();
    if (!query) return [];
    const starts = [];
    const contains = [];
    SUPPLEMENT_DB.forEach((s) => {
      const nameLC = s.name.toLowerCase();
      const aliases = (s.aliases || []).map((a) => a.toLowerCase());
      const allNames = [nameLC, ...aliases];
      if (allNames.some((n) => n.startsWith(query))) starts.push(s);
      else if (allNames.some((n) => n.includes(query))) contains.push(s);
    });
    return [...starts, ...contains].slice(0, 6);
  }

  const matches = name.trim() ? searchSupplements(name) : [];

  function pickResult(s) {
    setName(s.name);
    setDose(s.dose);
    setWin(s.window);
    setPendingNote(s.note);
    setShowResults(false);
  }
  function commitAdd() {
    const v = name.trim();
    if (!v) return;
    onAdd(v, dose, win, pendingNote);
    setName('');
    setDose('');
    setPendingNote('');
    setShowResults(false);
  }
  function handleNameKeyDown(e) {
    if (e.key === 'Enter') {
      if (showResults && matches.length) {
        e.preventDefault();
        pickResult(matches[0]);
        return;
      }
      commitAdd();
    }
    if (e.key === 'Escape') setShowResults(false);
  }

  return (
    <div className="stack-add-wrap">
      <div className="stack-add-label">Add to stack</div>
      <div className="stack-add-row">
        <div className="stack-name-wrap" ref={wrapRef}>
          <input
            type="text"
            placeholder="Name (e.g. B-complex)"
            className="stack-input"
            autoComplete="off"
            spellCheck={false}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setPendingNote('');
              setShowResults(true);
            }}
            onFocus={() => name.trim() && setShowResults(true)}
            onKeyDown={handleNameKeyDown}
          />
          <div className="stack-search-results" hidden={!showResults || matches.length === 0}>
            {matches.map((s) => {
              const winMeta = STACK_WINDOWS.find((w) => w.key === s.window) || STACK_WINDOWS[3];
              return (
                <button key={s.name} type="button" className="stack-result" onClick={() => pickResult(s)}>
                  <div className="stack-result-icon">{s.icon || '💊'}</div>
                  <div className="stack-result-body">
                    <div className="stack-result-name">{s.name}</div>
                    <div className="stack-result-meta">
                      {s.dose} · {winMeta.icon} {winMeta.title.toLowerCase()} · {s.note}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <input
          type="text"
          placeholder="Dose (e.g. 1 cap)"
          className="stack-input"
          value={dose}
          onChange={(e) => setDose(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commitAdd()}
        />
        <select className="stack-input stack-select" value={win} onChange={(e) => setWin(e.target.value)}>
          <option value="morning">Morning</option>
          <option value="lunch">Lunch</option>
          <option value="evening">Evening</option>
          <option value="anytime">Anytime</option>
        </select>
        <button type="button" className="stack-add-btn" onClick={commitAdd}>
          + Add
        </button>
      </div>
    </div>
  );
}

// Full stack tracker: ticker + progress bar + grouped items + add form.
// Shared by health.html and body.html's Supplements tile.
export default function StackTracker({ tick, bump, progressLabel = true }) {
  const items = getItems();
  const taken = getTaken();
  const low = getLow();
  const totalCount = items.length;
  const takenCount = items.filter((i) => taken[i.id]).length;
  const pct = totalCount === 0 ? 0 : (takenCount / totalCount) * 100;

  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;

  function toggleTaken(id) {
    const t = getTaken();
    if (t[id]) delete t[id];
    else t[id] = Date.now();
    setTaken(t);
    bump();
  }
  function toggleLow(id) {
    const l = getLow();
    if (l.includes(id)) setLow(l.filter((x) => x !== id));
    else {
      l.push(id);
      setLow(l);
    }
    bump();
  }
  function deleteItem(id) {
    setItems(getItems().filter((i) => i.id !== id));
    const t = getTaken();
    delete t[id];
    setTaken(t);
    setLow(getLow().filter((x) => x !== id));
    bump();
  }
  function addItem(name, dose, windowKey, note = '') {
    const v = String(name || '').trim();
    if (!v) return;
    const list = getItems();
    const id = 'custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    list.push({
      id, name: v,
      dose: String(dose || '').trim(),
      window: ['morning', 'lunch', 'evening', 'anytime'].includes(windowKey) ? windowKey : 'anytime',
      note: String(note || '').trim(),
      tag: null, ordered: true,
    });
    setItems(list);
    bump();
  }
  function updateItem(id, field, value) {
    const list = getItems();
    const item = list.find((i) => i.id === id);
    if (!item) return;
    item[field] = value;
    setItems(list);
    bump();
  }

  return (
    <>
      <StackTicker tick={tick} />
      {progressLabel && <div className="stack-progress-text">{`${takenCount} / ${totalCount} taken today · resets at 5 AM`}</div>}
      <div className="stack-progress-track">
        <div className="stack-progress-fill" style={{ width: pct + '%' }} />
      </div>
      <div>
        {items.length === 0 && <div className="stack-window-empty">No items yet — add one below to start your stack.</div>}
        {STACK_WINDOWS.map((win) => {
          const winItems = items.filter((i) => (i.window || 'anytime') === win.key);
          if (winItems.length === 0) return null;
          const isPastCutoff = win.cutoffHour !== null && nowHour > win.cutoffHour;
          return (
            <div className="stack-window" key={win.key}>
              <div className="stack-window-header">
                <span className="stack-window-icon">{win.icon}</span>
                <span className="stack-window-title">{win.title}</span>
                <span className="stack-window-time">{win.time}</span>
              </div>
              {winItems.map((item) => (
                <StackItemRow
                  key={item.id}
                  item={item}
                  isTaken={!!taken[item.id]}
                  isLow={low.includes(item.id)}
                  isMissed={!taken[item.id] && isPastCutoff}
                  onToggle={toggleTaken}
                  onLow={toggleLow}
                  onDelete={deleteItem}
                  onUpdate={updateItem}
                />
              ))}
            </div>
          );
        })}
      </div>
      <AddStackForm onAdd={addItem} />
    </>
  );
}
