'use client';

import { useEffect, useRef, useState } from 'react';
import Topbar from '@/components/Topbar';
import { useCloudSync } from '@/hooks/useCloudSync';

const STORAGE_KEY = 'growth_notes';
const LOCK_KEY = 'growth_lock_hash';
const MAX_CHARS = 1200;

function loadNotes() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}
function saveNotes(notes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}
function hasLock() {
  return !!localStorage.getItem(LOCK_KEY);
}
async function hashPass(pw) {
  try {
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('growth::' + pw));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {}
  let h = 5381;
  const s = 'growth::' + pw;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return 'f' + h.toString(16);
}
async function checkPass(pw) {
  if (!pw) return false;
  return (await hashPass(pw)) === localStorage.getItem(LOCK_KEY);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}
function fmtDate(ts) {
  const d = new Date(ts);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const mons = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return days[d.getDay()] + ', ' + mons[d.getMonth()] + ' ' + d.getDate() + ' · ' + h + ':' + pad2(m) + ' ' + ampm;
}
function todayLabel() {
  const d = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const mons = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return days[d.getDay()] + ', ' + mons[d.getMonth()] + ' ' + d.getDate();
}

function NoteCard({ note, isLocked, onDelete, onUnlock }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);

  async function tryUnlock() {
    if (await checkPass(pw)) {
      onUnlock(note.id);
    } else {
      setErr(true);
      setTimeout(() => setErr(false), 400);
    }
  }

  return (
    <div className={'note-card' + (isLocked ? ' locked' : '')}>
      <div className="note-meta">
        <span className="note-date">{fmtDate(note.ts)}</span>
        <button className="note-delete" aria-label="Delete note" onClick={() => onDelete(note.id)}>
          ×
        </button>
      </div>
      <div className="note-text">{note.text}</div>
      {isLocked && (
        <div className={'note-lock-overlay' + (err ? ' err' : '')}>
          <div className="note-lock-ico">🔒</div>
          <div className="note-lock-row">
            <input
              type="password"
              className="note-lock-input"
              placeholder="Passcode"
              autoComplete="off"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  tryUnlock();
                }
              }}
            />
            <button className="note-lock-btn" onClick={tryUnlock}>
              Unlock
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PasscodeModal({ open, mode, onCancel, onSaved, onDisabled }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [err, setErr] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setP1('');
      setP2('');
      setErr('');
      setTimeout(() => inputRef.current && inputRef.current.focus(), 60);
    }
  }, [open]);

  if (!open) return null;

  async function save() {
    if (!p1) {
      setErr('Enter a passcode.');
      return;
    }
    if (p1 !== p2) {
      setErr('Passcodes don’t match.');
      return;
    }
    localStorage.setItem(LOCK_KEY, await hashPass(p1));
    onSaved();
  }
  function disable() {
    if (!confirm('Remove the lock from all entries? They will no longer be hidden.')) return;
    localStorage.removeItem(LOCK_KEY);
    onDisabled();
  }
  function onKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    }
  }

  return (
    <div className={'pc-modal-bg' + (open ? ' show' : '')} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="pc-modal">
        <h3>{mode === 'change' ? 'Change passcode' : 'Set passcode'}</h3>
        <input ref={inputRef} type="password" placeholder="Passcode" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} onKeyDown={onKeyDown} />
        <input type="password" placeholder="Confirm passcode" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} onKeyDown={onKeyDown} />
        <div className="pc-err">{err}</div>
        <div className="pc-actions">
          <button className="pc-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="pc-save" onClick={save}>
            Save
          </button>
        </div>
        {mode === 'change' && (
          <button className="pc-disable" onClick={disable}>
            Remove lock from all entries
          </button>
        )}
      </div>
    </div>
  );
}

export default function GrowthClient() {
  const [tick, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [text, setText] = useState('');
  const [unlocked, setUnlocked] = useState(new Set());
  const [pcOpen, setPcOpen] = useState(false);
  const [pcMode, setPcMode] = useState('set');
  const bump = () => setTick((t) => t + 1);

  useCloudSync({
    appKey: 'growth',
    syncedKeys: ['growth_notes', 'growth_lock_hash'],
    onApplied: bump,
  });

  useEffect(() => {
    setMounted(true);
    window.addEventListener('storage', bump);
    return () => window.removeEventListener('storage', bump);
  }, []);

  const notes = mounted ? loadNotes() : [];
  const locked = mounted && hasLock();
  const len = text.length;

  function addNote() {
    const t = text.trim();
    if (!t) return;
    const list = loadNotes();
    list.unshift({ id: 'g' + Date.now() + '_' + Math.random().toString(36).slice(2, 8), text: t, ts: Date.now() });
    saveNotes(list);
    setText('');
    bump();
  }
  function deleteNote(id) {
    saveNotes(loadNotes().filter((n) => n.id !== id));
    bump();
  }
  function unlockNote(id) {
    setUnlocked((prev) => new Set(prev).add(id));
  }

  return (
    <div className="growth-page">
      <Topbar hub="mind" pageLabel="GROWTH" />
      <div className="shell">
        <h1 className="page-title">
          GROWTH<span className="page-title-dot">.</span>
        </h1>
        <p className="page-sub">// reflect. notice. grow.</p>

        <div className="lock-bar">
          {mounted &&
            (!locked ? (
              <button className="lock-bar-btn" onClick={() => { setPcMode('set'); setPcOpen(true); }}>
                <span className="ico">🔒</span> Enable entry lock
              </button>
            ) : (
              <>
                <button className="lock-bar-btn" onClick={() => setUnlocked(new Set())}>
                  <span className="ico">🔓</span> Lock all
                </button>
                <button className="lock-bar-btn" onClick={() => { setPcMode('change'); setPcOpen(true); }}>
                  <span className="ico">⚙</span> Passcode
                </button>
              </>
            ))}
        </div>

        <div className="compose">
          <div className="compose-date">{todayLabel()}</div>
          <textarea
            className="compose-textarea"
            placeholder="What did you notice today? What are you learning? What do you want to remember?"
            maxLength={MAX_CHARS}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                addNote();
              }
            }}
          />
          <div className="compose-footer">
            <span className={'char-count' + (len >= 900 && len < MAX_CHARS ? ' near' : '') + (len >= MAX_CHARS ? ' over' : '')}>
              {len} / {MAX_CHARS}
            </span>
            <button className="btn-save" disabled={len === 0 || len > MAX_CHARS} onClick={addNote}>
              Save
            </button>
          </div>
        </div>

        {mounted && notes.length === 0 && (
          <div className="empty">
            No reflections yet.
            <br />
            Write your first one above.
          </div>
        )}
        {mounted && notes.length > 0 && <div className="os-sect">REFLECTION.LOG</div>}
        <div className="notes-list">
          {notes.map((note) => (
            <NoteCard key={note.id} note={note} isLocked={locked && !unlocked.has(note.id)} onDelete={deleteNote} onUnlock={unlockNote} />
          ))}
        </div>
      </div>

      <PasscodeModal
        open={pcOpen}
        mode={pcMode}
        onCancel={() => setPcOpen(false)}
        onSaved={() => {
          setUnlocked(new Set());
          setPcOpen(false);
          bump();
        }}
        onDisabled={() => {
          setUnlocked(new Set());
          setPcOpen(false);
          bump();
        }}
      />
    </div>
  );
}
