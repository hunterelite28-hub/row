'use client';

import { useEffect, useRef, useState } from 'react';
import Dock from '@/components/Dock';
import AvatarBubble from '@/components/AvatarBubble';
import { usePull } from '@/hooks/usePull';
import { useCloudSync } from '@/hooks/useCloudSync';
import { readJSON, calKey, todayKey, fmtShort, learning, library, growth } from '@/lib/sunpath';

const ICONS = ['λ', '◎', '∑', '⊕', '△', '⬡', '⟨⟩', '✦', '◈', '⌘', '∞', '⚡'];
const ADD_RESOURCE_VALUE = '__add_resource__';
const DEFAULT_SUBJECTS = [{ id: 'py_default', name: 'Python', icon: 'λ', resources: ['CS50P (Harvard)', 'Python.org Docs', 'Automate the Boring Stuff', 'Real Python'] }];
const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function loadSubjects() {
  const s = readJSON('learning_subjects', null);
  return Array.isArray(s) && s.length ? s : JSON.parse(JSON.stringify(DEFAULT_SUBJECTS));
}
function saveSubjects(a) {
  localStorage.setItem('learning_subjects', JSON.stringify(a));
}
function loadSessions() {
  return readJSON('learning_sessions', []);
}
function saveSessions(a) {
  localStorage.setItem('learning_sessions', JSON.stringify(a));
}
function todayStr() {
  const d = new Date();
  return calKey(d);
}
function fmtDateShort(ds) {
  const p = ds.split('-').map(Number);
  return p[2] + ' ' + MONS[p[1] - 1];
}
function uidL() {
  return 'l' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

function LearningTile({ tick, bump }) {
  const [activeId, setActiveId] = useState(null);
  const [logModal, setLogModal] = useState({ open: false, session: null });
  const [addOpen, setAddOpen] = useState(false);
  const [editModal, setEditModal] = useState({ open: false, id: null });

  const subjects = loadSubjects();
  useEffect(() => {
    if (!subjects.find((s) => s.id === activeId)) setActiveId(subjects[0] ? subjects[0].id : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
  const subject = subjects.find((s) => s.id === activeId) || subjects[0];
  const sessions = subject ? loadSessions().filter((s) => s.subjectId === subject.id) : [];
  const totalHrs = sessions.reduce((t, s) => t + (parseFloat(s.hours) || 0), 0);
  const uniqueTopics = sessions.reduce((t, s) => t + (s.topicsCount != null ? parseInt(s.topicsCount) || 0 : s.topic ? 1 : 0), 0);
  const hrsDisplay = totalHrs % 1 === 0 ? totalHrs + '.0H' : totalHrs.toFixed(1) + 'H';
  const editingSubject = editModal.id ? subjects.find((s) => s.id === editModal.id) : null;

  function saveSession(data) {
    let list = loadSessions();
    if (logModal.session) list = list.map((s) => (s.id === logModal.session.id ? { ...s, ...data } : s));
    else list.unshift({ id: uidL(), subjectId: activeId, ...data, ts: Date.now() });
    list.sort((a, b) => b.date.localeCompare(a.date));
    saveSessions(list);
    setLogModal({ open: false, session: null });
    bump();
  }
  function saveNewSubject(data) {
    const subjs = loadSubjects();
    const newSubj = { id: uidL(), ...data };
    subjs.push(newSubj);
    saveSubjects(subjs);
    setActiveId(newSubj.id);
    setAddOpen(false);
    bump();
  }
  function saveEditSubject(data) {
    saveSubjects(loadSubjects().map((s) => (s.id === editModal.id ? { ...s, ...data } : s)));
    setEditModal({ open: false, id: null });
    bump();
  }
  function deleteSubject() {
    if (!confirm('Delete this subject and all its sessions?')) return;
    saveSubjects(loadSubjects().filter((s) => s.id !== editModal.id));
    saveSessions(loadSessions().filter((s) => s.subjectId !== editModal.id));
    setActiveId(null);
    setEditModal({ open: false, id: null });
    bump();
  }

  return (
    <>
      <div className="ln-tabs">
        {subjects.map((s) => (
          <LnTab key={s.id} subject={s} active={s.id === (subject && subject.id)} onSelect={setActiveId} onLongPress={(id) => setEditModal({ open: true, id })} />
        ))}
        <button className="ln-add-btn" title="Add subject" onClick={() => setAddOpen(true)}>
          +
        </button>
      </div>
      {!subject ? (
        <div className="ln-no-subj">
          No subjects yet.
          <br />
          Tap + to add your first.
        </div>
      ) : (
        <div>
          <div className="ln-subj-header">
            <div>
              <div className="ln-subj-title">
                <span className="ln-subj-title-icon">{subject.icon}</span>
                {subject.name}
              </div>
            </div>
            <button className="ln-log-btn" onClick={() => setLogModal({ open: true, session: null })}>
              + Log Session
            </button>
          </div>
          <div className="ln-subj-sub">// track topics, hours &amp; resources</div>
          <div className="ln-stats">
            <div className="ln-stat">
              <span className="ln-stat-v">{hrsDisplay}</span>
              <span className="ln-stat-l">Total Hours</span>
            </div>
            <div className="ln-stat">
              <span className="ln-stat-v">{sessions.length}</span>
              <span className="ln-stat-l">Sessions</span>
            </div>
            <div className="ln-stat">
              <span className="ln-stat-v">{uniqueTopics}</span>
              <span className="ln-stat-l">Topics</span>
            </div>
          </div>
          <div className="ln-log-card">
            <div className="ln-log-head">// Session Log</div>
            <div>
              {sessions.length === 0 ? (
                <div className="ln-empty">
                  <div className="ln-empty-icon">{subject.icon}</div>No sessions yet — log your first.
                </div>
              ) : (
                sessions.slice(0, 30).map((s) => (
                  <div className="ln-session" key={s.id}>
                    <div className="ln-session-icon">{subject.icon}</div>
                    <div className="ln-session-body">
                      <div className="ln-session-topic">{s.topic || '—'}</div>
                      <div className="ln-session-meta">
                        {[s.hours ? s.hours + 'h' : '', s.topicsCount != null && s.topicsCount !== '' ? s.topicsCount + (parseInt(s.topicsCount) === 1 ? ' topic' : ' topics') : '', s.resource || '']
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      {s.notes && <div className="ln-session-notes">{s.notes}</div>}
                    </div>
                    <div className="ln-session-right">
                      <div className="ln-session-date">{fmtDateShort(s.date)}</div>
                      <button className="ln-session-edit" onClick={() => setLogModal({ open: true, session: s })}>
                        Edit
                      </button>
                      <button
                        className="ln-session-del"
                        onClick={() => {
                          saveSessions(loadSessions().filter((x) => x.id !== s.id));
                          bump();
                        }}
                      >
                        Del
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <LogSessionModal open={logModal.open} subject={subject} editingSession={logModal.session} onCancel={() => setLogModal({ open: false, session: null })} onSave={saveSession} />
      <SubjectModal open={addOpen} mode="add" onCancel={() => setAddOpen(false)} onSave={saveNewSubject} />
      <SubjectModal open={editModal.open} mode="edit" subject={editingSubject} onCancel={() => setEditModal({ open: false, id: null })} onSave={saveEditSubject} onDelete={deleteSubject} />
    </>
  );
}

function LnTab({ subject, active, onSelect, onLongPress }) {
  const timerRef = useRef(null);
  return (
    <button
      className={'ln-tab' + (active ? ' active' : '')}
      onClick={() => onSelect(subject.id)}
      onPointerDown={() => {
        timerRef.current = setTimeout(() => onLongPress(subject.id), 600);
      }}
      onPointerUp={() => clearTimeout(timerRef.current)}
      onPointerLeave={() => clearTimeout(timerRef.current)}
    >
      <span className="ln-tab-icon">{subject.icon}</span>
      {subject.name}
    </button>
  );
}

function LogSessionModal({ open, subject, editingSession, onCancel, onSave }) {
  const [date, setDate] = useState(todayStr());
  const [hours, setHours] = useState('');
  const [topic, setTopic] = useState('');
  const [topicsCount, setTopicsCount] = useState('');
  const [notes, setNotes] = useState('');
  const [resource, setResource] = useState('');
  const [showNewResource, setShowNewResource] = useState(false);
  const [newResourceInput, setNewResourceInput] = useState('');
  const topicRef = useRef(null);

  useEffect(() => {
    if (!open || !subject) return;
    setDate(editingSession ? editingSession.date : todayStr());
    setHours(editingSession && editingSession.hours ? String(editingSession.hours) : '');
    setTopic(editingSession ? editingSession.topic || '' : '');
    setTopicsCount(editingSession && editingSession.topicsCount != null ? String(editingSession.topicsCount) : '');
    setNotes(editingSession ? editingSession.notes || '' : '');
    setResource(editingSession ? editingSession.resource || '' : (Array.isArray(subject.resources) && subject.resources[0]) || '');
    setShowNewResource(false);
    setNewResourceInput('');
    setTimeout(() => topicRef.current && topicRef.current.focus(), 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingSession, subject && subject.id]);

  if (!open || !subject) return null;
  const resourceOptions = (Array.isArray(subject.resources) ? subject.resources : []).slice();
  if (resource && !resourceOptions.includes(resource)) resourceOptions.unshift(resource);

  function handleResourceChange(v) {
    if (v !== ADD_RESOURCE_VALUE) {
      setResource(v);
      setShowNewResource(false);
      return;
    }
    setShowNewResource(true);
    setTimeout(() => document.getElementById('mindNewResourceInput')?.focus(), 50);
  }
  function commitNewResource() {
    const name = newResourceInput.trim();
    if (!name) {
      setShowNewResource(false);
      return;
    }
    const subjs = loadSubjects();
    const s = subjs.find((x) => x.id === subject.id);
    if (s) {
      if (!Array.isArray(s.resources)) s.resources = [];
      if (!s.resources.includes(name)) s.resources.push(name);
      saveSubjects(subjs);
    }
    setResource(name);
    setShowNewResource(false);
    setNewResourceInput('');
  }
  function save() {
    const h = parseFloat(hours) || 0;
    const t = topic.trim();
    const tc = topicsCount === '' ? null : parseInt(topicsCount) || 0;
    const res = resource === ADD_RESOURCE_VALUE ? '' : resource;
    const n = notes.trim();
    const d = date || todayStr();
    if (!t && !h) return;
    onSave({ date: d, hours: h, topic: t, topicsCount: tc, resource: res, notes: n });
  }

  return (
    <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <div className="modal-title">{editingSession ? '// Edit Session' : '// New Session'}</div>
        <div className="field">
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Hours Spent</label>
          <input type="number" placeholder="e.g. 1.5" step="0.25" min="0" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} />
        </div>
        <div className="field">
          <label>Topic / Chapter</label>
          <input ref={topicRef} type="text" placeholder="e.g. Lists & Dicts, Functions, OOP..." maxLength={100} value={topic} onChange={(e) => setTopic(e.target.value)} />
        </div>
        <div className="field">
          <label>Topics / Chapters Learnt</label>
          <input type="number" placeholder="e.g. 3" step="1" min="0" inputMode="numeric" value={topicsCount} onChange={(e) => setTopicsCount(e.target.value)} />
        </div>
        <div className="field">
          <label>Resource</label>
          <select value={resource || ''} onChange={(e) => handleResourceChange(e.target.value)}>
            {resourceOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
            <option value={ADD_RESOURCE_VALUE}>+ Add new resource…</option>
          </select>
          {showNewResource && (
            <div className="resource-row" style={{ marginTop: 8 }}>
              <input id="mindNewResourceInput" type="text" placeholder="New resource name…" maxLength={60} value={newResourceInput} onChange={(e) => setNewResourceInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commitNewResource()} />
              <button className="btn-save" type="button" style={{ flex: '0 0 auto', padding: '11px 14px' }} onClick={commitNewResource}>
                Add
              </button>
            </div>
          )}
        </div>
        <div className="field">
          <label>Notes</label>
          <textarea placeholder="Key concepts, things to revisit..." value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-save" onClick={save}>
            {editingSession ? 'Update' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SubjectModal({ open, mode, subject, onCancel, onSave, onDelete }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
  const [resources, setResources] = useState(['']);
  const nameRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && subject) {
      setName(subject.name);
      setIcon(subject.icon);
      setResources([...(subject.resources || [])]);
    } else {
      setName('');
      setIcon(ICONS[0]);
      setResources(['']);
    }
    setTimeout(() => nameRef.current && nameRef.current.focus(), 80);
  }, [open, mode, subject]);

  if (!open) return null;
  function save() {
    const n = name.trim();
    if (!n) {
      nameRef.current && nameRef.current.focus();
      return;
    }
    onSave({ name: n, icon, resources: resources.filter((r) => r.trim()) });
  }

  return (
    <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <div className="modal-title">{mode === 'edit' ? '// Edit Subject' : '// New Subject'}</div>
        <div className="field">
          <label>Subject Name</label>
          <input ref={nameRef} type="text" placeholder="e.g. Python, SQL, Spanish..." maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Icon</label>
          <div className="icon-grid">
            {ICONS.map((ic) => (
              <button key={ic} type="button" className={'icon-opt' + (ic === icon ? ' active' : '')} onClick={() => setIcon(ic)}>
                {ic}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Resources</label>
          <div className="resource-list">
            {resources.map((r, i) => (
              <div className="resource-row" key={i}>
                <input
                  type="text"
                  placeholder="e.g. CS50P (Harvard)"
                  maxLength={60}
                  value={r}
                  onChange={(e) => {
                    const next = resources.slice();
                    next[i] = e.target.value;
                    setResources(next);
                  }}
                />
                <button
                  type="button"
                  className="resource-del"
                  onClick={() => {
                    const next = resources.slice();
                    next.splice(i, 1);
                    setResources(next);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="resource-add" onClick={() => setResources([...resources, ''])}>
              + Add Resource
            </button>
          </div>
        </div>
        <div className="modal-actions">
          {mode === 'edit' && (
            <button className="btn-danger" onClick={onDelete}>
              Delete
            </button>
          )}
          <button className="btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-save" onClick={save}>
            {mode === 'edit' ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Library tile ----------
const STATUS = { reading: 'Reading', finished: 'Finished', toread: 'To Read' };
function loadBooks() {
  return readJSON('library_books', []);
}
function saveBooks(a) {
  localStorage.setItem('library_books', JSON.stringify(a));
}
function loadNotesLib() {
  return readJSON('library_notes', []);
}
function saveNotesLib(a) {
  localStorage.setItem('library_notes', JSON.stringify(a));
}
function uidB() {
  return 'b' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}
function fmtDateLong(ts) {
  const d = new Date(ts);
  return d.getDate() + ' ' + MONS[d.getMonth()] + ' ' + d.getFullYear();
}
function mdInline(s) {
  return s
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
    .replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
}
function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function renderMd(text) {
  return mdInline(escHtml(text));
}
function pctBook(book) {
  if (book.status === 'finished') return 100;
  const t = parseInt(book.totalPages) || 0, c = parseInt(book.currentPage) || 0;
  if (t > 0) return Math.max(0, Math.min(100, Math.round((c / t) * 100)));
  return null;
}
function showProgress(book) {
  return book.status !== 'toread' && pctBook(book) !== null;
}
function processCover(file, cb) {
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => {
      const maxW = 380;
      let w = img.width, h = img.height;
      if (w > maxW) {
        h = Math.round((h * maxW) / w);
        w = maxW;
      }
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      cb(c.toDataURL('image/jpeg', 0.72));
    };
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
}
function applyFmt(ta, fmt, onChange) {
  const s = ta.selectionStart, e = ta.selectionEnd, val = ta.value;
  if (fmt === 'bullet') {
    const ls = val.lastIndexOf('\n', s - 1) + 1;
    const block = val.slice(ls, e);
    const newBlock = block ? block.split('\n').map((l) => (l ? '- ' + l : l)).join('\n') : '- ';
    onChange(val.slice(0, ls) + newBlock + val.slice(e));
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ls;
      ta.selectionEnd = ls + newBlock.length;
    });
    return;
  }
  const pre = fmt === 'bold' ? '**' : fmt === 'italic' ? '*' : '`';
  const post = pre;
  const sel = val.slice(s, e);
  onChange(val.slice(0, s) + pre + sel + post + val.slice(e));
  requestAnimationFrame(() => {
    ta.focus();
    if (sel) {
      ta.selectionStart = s + pre.length;
      ta.selectionEnd = e + pre.length;
    } else {
      ta.selectionStart = ta.selectionEnd = s + pre.length;
    }
  });
}

function LnLibTile({ tick, bump }) {
  const [activeBookId, setActiveBookId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState(null);

  const books = loadBooks();
  const notes = loadNotesLib();
  const activeBook = activeBookId ? books.find((b) => b.id === activeBookId) : null;

  useEffect(() => {
    if (activeBookId && !books.some((b) => b.id === activeBookId)) setActiveBookId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const counts = { all: books.length, reading: 0, finished: 0, toread: 0 };
  books.forEach((b) => {
    counts[b.status] = (counts[b.status] || 0) + 1;
  });
  const filters = [['all', 'All'], ['reading', 'Reading'], ['finished', 'Finished'], ['toread', 'To Read']];
  const shown = filter === 'all' ? books : books.filter((b) => b.status === filter);

  function saveBook(data) {
    const list = loadBooks();
    if (editingBook) {
      const i = list.findIndex((b) => b.id === editingBook.id);
      if (i >= 0) list[i] = { ...list[i], ...data };
    } else {
      list.unshift({ id: uidB(), ...data, ts: Date.now() });
    }
    saveBooks(list);
    setModalOpen(false);
    setEditingBook(null);
    bump();
  }
  function deleteBook() {
    if (!editingBook) return;
    if (!confirm('Delete this book and all its notes?')) return;
    saveBooks(loadBooks().filter((b) => b.id !== editingBook.id));
    saveNotesLib(loadNotesLib().filter((n) => n.bookId !== editingBook.id));
    if (activeBookId === editingBook.id) setActiveBookId(null);
    setModalOpen(false);
    setEditingBook(null);
    bump();
  }

  return (
    <>
      {activeBook ? (
        <LbDetail
          book={activeBook}
          notes={notes.filter((n) => n.bookId === activeBook.id)}
          onBack={() => setActiveBookId(null)}
          onEdit={(b) => {
            setEditingBook(b);
            setModalOpen(true);
          }}
          bump={bump}
        />
      ) : (
        <div>
          <div className="lb-toolbar">
            <div className="lb-filter-row">
              {filters.map(([k, label]) => (
                <button key={k} className={'lb-filter-chip' + (filter === k ? ' active' : '')} onClick={() => setFilter(k)}>
                  {label} {counts[k] || 0}
                </button>
              ))}
            </div>
            <button
              className="lb-add-btn"
              onClick={() => {
                setEditingBook(null);
                setModalOpen(true);
              }}
            >
              + Add
            </button>
          </div>
          {books.length === 0 && (
            <div className="lb-empty">
              <span className="ico">📚</span>No books yet
              <br />
              <span style={{ fontSize: 10, opacity: 0.7 }}>tap + add to start your shelf</span>
            </div>
          )}
          {books.length > 0 && shown.length === 0 && <div className="lb-note-empty">No books in this shelf.</div>}
          {shown.length > 0 && (
            <div className="lb-book-list">
              {shown.map((b) => {
                const p = showProgress(b) ? pctBook(b) : null;
                const noteN = notes.filter((n) => n.bookId === b.id).length;
                return (
                  <div className="lb-book-card" key={b.id} onClick={() => setActiveBookId(b.id)}>
                    <div className="lb-book-cover-wrap">{b.cover ? <img className="lb-book-cover" src={b.cover} alt="cover" /> : <div className="lb-book-cover-ph">📖</div>}</div>
                    <div className="lb-book-body">
                      <div className="lb-book-title">{b.title}</div>
                      {b.author && <div className="lb-book-author">{b.author}</div>}
                      <div>
                        <span className={'lb-status-pill ' + b.status}>
                          <span className="dot" />
                          {STATUS[b.status]}
                        </span>
                      </div>
                      {p !== null && (
                        <div className="lb-progress-row">
                          <span className="lb-progress-pct">{p}%</span>
                          <div className="lb-progress-track">
                            <div className="lb-progress-fill" style={{ width: p + '%' }} />
                          </div>
                        </div>
                      )}
                      {noteN > 0 && <div className="lb-note-count">📝 {noteN} {noteN === 1 ? 'note' : 'notes'}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <LbBookModal
        open={modalOpen}
        editing={editingBook}
        onCancel={() => {
          setModalOpen(false);
          setEditingBook(null);
        }}
        onSave={saveBook}
        onDelete={deleteBook}
      />
    </>
  );
}

function LbDetail({ book, notes, onBack, onEdit, bump }) {
  const sortedNotes = notes.slice().sort((a, b) => b.ts - a.ts);
  const p = book.status !== 'toread' ? pctBook(book) : null;
  const total = parseInt(book.totalPages) || 0;
  const [curPage, setCurPage] = useState(String(parseInt(book.currentPage) || 0));
  const [noteText, setNoteText] = useState('');
  const [notePage, setNotePage] = useState('');
  const taRef = useRef(null);

  useEffect(() => {
    setCurPage(String(parseInt(book.currentPage) || 0));
  }, [book.id, book.currentPage]);

  function setRating(r) {
    saveBooks(loadBooks().map((b) => (b.id === book.id ? { ...b, rating: r } : b)));
    bump();
  }
  function commitPage() {
    let v = parseInt(curPage) || 0;
    v = Math.max(0, Math.min(total, v));
    saveBooks(loadBooks().map((b) => (b.id === book.id ? { ...b, currentPage: v } : b)));
    bump();
  }
  function addNote() {
    const t = noteText.trim();
    if (!t) return;
    const all = loadNotesLib();
    const p2 = notePage.trim() ? parseInt(notePage) || null : null;
    all.unshift({ id: uidB(), bookId: book.id, text: t, page: p2, ts: Date.now() });
    saveNotesLib(all);
    setNoteText('');
    setNotePage('');
    bump();
  }

  return (
    <div>
      <button className="lb-detail-back" onClick={onBack}>
        ← Library
      </button>
      <div className="lb-detail-top">
        {book.cover ? <img className="lb-detail-cover" src={book.cover} alt="cover" /> : <div className="lb-detail-cover-ph">📖</div>}
        <div className="lb-detail-info">
          <div className="lb-detail-title">{book.title}</div>
          {book.author && <div className="lb-detail-author">{book.author}</div>}
          <div>
            <span className={'lb-status-pill ' + book.status} style={{ marginTop: 10 }}>
              <span className="dot" />
              {STATUS[book.status]}
            </span>
          </div>
          <div className="lb-detail-stars">
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className={'lb-detail-star' + (i <= (book.rating || 0) ? ' on' : '')} onClick={() => setRating(i === book.rating ? 0 : i)}>
                ★
              </span>
            ))}
          </div>
          <button className="lb-detail-edit" onClick={() => onEdit(book)}>
            ⚙ Edit book
          </button>
        </div>
      </div>

      {book.status !== 'toread' && (
        <div className="lb-detail-progress">
          {p !== null && (
            <div className="lb-progress-row">
              <span className="lb-progress-pct">{p}%</span>
              <div className="lb-progress-track">
                <div className="lb-progress-fill" style={{ width: p + '%' }} />
              </div>
            </div>
          )}
          {total > 0 && (
            <div className="lb-page-update">
              Page <input type="number" value={curPage} min="0" max={total} inputMode="numeric" onChange={(e) => setCurPage(e.target.value)} onBlur={commitPage} /> of {total}
            </div>
          )}
        </div>
      )}

      <div className="lb-notes-head">// Notes</div>
      <div className="lb-note-compose">
        <div className="lb-note-fmt-bar">
          <button className="lb-fmt-btn b" title="Bold (⌘/Ctrl+B)" onClick={() => applyFmt(taRef.current, 'bold', setNoteText)}>
            B
          </button>
          <button className="lb-fmt-btn i" title="Italic (⌘/Ctrl+I)" onClick={() => applyFmt(taRef.current, 'italic', setNoteText)}>
            I
          </button>
          <button className="lb-fmt-btn c" title="Code" onClick={() => applyFmt(taRef.current, 'code', setNoteText)}>
            &lt;/&gt;
          </button>
          <button className="lb-fmt-btn" title="Bullet" onClick={() => applyFmt(taRef.current, 'bullet', setNoteText)}>
            •
          </button>
        </div>
        <textarea ref={taRef} placeholder="Add a note…  **bold**  *italic*  `code`" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
        <div className="lb-note-compose-footer">
          <input className="lb-note-page-input" type="number" placeholder="p. (opt)" min="0" inputMode="numeric" value={notePage} onChange={(e) => setNotePage(e.target.value)} />
          <button className="lb-note-add-btn" disabled={!noteText.trim()} onClick={addNote}>
            + Note
          </button>
        </div>
      </div>
      <div className="lb-note-list">
        {sortedNotes.length === 0 && <div className="lb-note-empty">No notes yet — add your first above.</div>}
        {sortedNotes.map((n) => (
          <LbNoteItem
            key={n.id}
            note={n}
            onDelete={() => {
              saveNotesLib(loadNotesLib().filter((x) => x.id !== n.id));
              bump();
            }}
            onSave={(text) => {
              saveNotesLib(loadNotesLib().map((x) => (x.id === n.id ? { ...x, text } : x)));
              bump();
            }}
          />
        ))}
      </div>
    </div>
  );
}

function LbNoteItem({ note, onDelete, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(note.text);

  function commit() {
    const v = val.trim();
    onSave(v || note.text);
    setEditing(false);
  }

  return (
    <div className="lb-note-item">
      <div className="lb-note-item-meta">
        <span className="lb-note-item-page">{note.page ? 'p. ' + note.page : 'NOTE'}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="lb-note-item-date">{fmtDateLong(note.ts)}</span>
          <span className="lb-note-item-actions">
            <button className="lb-note-edit" onClick={() => setEditing(true)}>
              edit
            </button>
            <button className="lb-note-del" onClick={onDelete}>
              del
            </button>
          </span>
        </span>
      </div>
      {editing ? (
        <textarea
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: 8, color: 'var(--ink)', fontFamily: 'var(--display)', fontSize: 13.5, lineHeight: 1.55, padding: '8px 10px', outline: 'none', minHeight: 56 }}
        />
      ) : (
        <div className="lb-note-item-text" dangerouslySetInnerHTML={{ __html: renderMd(note.text) }} />
      )}
    </div>
  );
}

function LbBookModal({ open, editing, onCancel, onSave, onDelete }) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [status, setStatus] = useState('reading');
  const [current, setCurrent] = useState('');
  const [total, setTotal] = useState('');
  const [tags, setTags] = useState('');
  const [cover, setCover] = useState('');
  const [rating, setRating] = useState(0);
  const fileRef = useRef(null);
  const titleRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title || '');
      setAuthor(editing.author || '');
      setStatus(editing.status || 'reading');
      setCurrent(editing.currentPage ? String(editing.currentPage) : '');
      setTotal(editing.totalPages ? String(editing.totalPages) : '');
      setTags((editing.tags || []).join(', '));
      setCover(editing.cover || '');
      setRating(editing.rating || 0);
    } else {
      setTitle('');
      setAuthor('');
      setStatus('reading');
      setCurrent('');
      setTotal('');
      setTags('');
      setCover('');
      setRating(0);
      setTimeout(() => titleRef.current && titleRef.current.focus(), 80);
    }
  }, [open, editing]);

  if (!open) return null;
  function save() {
    const t = title.trim();
    if (!t) {
      titleRef.current && titleRef.current.focus();
      return;
    }
    onSave({ title: t, author: author.trim(), status, currentPage: parseInt(current) || 0, totalPages: parseInt(total) || 0, tags: tags.split(',').map((x) => x.trim()).filter(Boolean), rating, cover });
  }

  return (
    <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <div className="modal-title">{editing ? '// Edit Book' : '// New Book'}</div>
        <div className="field">
          <label>Cover (title page)</label>
          <div className="lb-cover-pick" onClick={() => fileRef.current && fileRef.current.click()}>
            {cover ? <img src={cover} alt="cover preview" /> : <span>📷 Tap to add cover</span>}
          </div>
          {cover && (
            <button className="lb-cover-clear" style={{ display: 'block' }} onClick={() => setCover('')}>
              Remove cover
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              if (f) processCover(f, setCover);
              e.target.value = '';
            }}
          />
        </div>
        <div className="field">
          <label>Title</label>
          <input ref={titleRef} type="text" placeholder="e.g. Atomic Habits" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Author</label>
          <input type="text" placeholder="e.g. James Clear" maxLength={80} value={author} onChange={(e) => setAuthor(e.target.value)} />
        </div>
        <div className="field">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="reading">Reading</option>
            <option value="finished">Finished</option>
            <option value="toread">To Read</option>
          </select>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Current Page</label>
            <input type="number" placeholder="0" min="0" inputMode="numeric" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="field">
            <label>Total Pages</label>
            <input type="number" placeholder="0" min="0" inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Tags (comma separated, optional)</label>
          <input type="text" placeholder="e.g. habits, psychology" maxLength={80} value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>
        <div className="field">
          <label>Rating</label>
          <div className="lb-modal-stars">
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className={'lb-modal-star' + (i <= rating ? ' on' : '')} onClick={() => setRating(i === rating ? 0 : i)}>
                ★
              </span>
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-save" onClick={save}>
            Save
          </button>
        </div>
        {editing && (
          <button className="btn-danger" onClick={onDelete}>
            Delete Book
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- Gratitude tile ----------
function loadGratitude() {
  return readJSON('gratitude_notes', []);
}
function saveGratitude(a) {
  localStorage.setItem('gratitude_notes', JSON.stringify(a));
}
function uidG() {
  return 'g' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

function GratitudeTile({ tick, bump }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [text, setText] = useState('');
  const notes = loadGratitude();
  const last = notes[0];
  const rest = notes.slice(1, 5);

  function save() {
    const t = text.trim();
    if (!t) return;
    const list = loadGratitude();
    list.unshift({ id: uidG(), text: t, ts: Date.now() });
    saveGratitude(list);
    setText('');
    setModalOpen(false);
    bump();
  }

  return (
    <div className="glassy card">
      {last && <div className="quote-q">“{String(last.text || '').length > 140 ? String(last.text).slice(0, 140) + '…' : last.text}”</div>}
      <div className="rows" style={{ marginTop: last ? 8 : 0 }}>
        <a
          className="rowi"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setText('');
            setModalOpen(true);
          }}
        >
          <span className="ic">🙏</span>
          <span className="tx">
            <span className="t1" style={{ color: 'var(--muted)', fontWeight: 400 }}>
              What are you grateful for today?
            </span>
          </span>
          <span className="end act">WRITE</span>
        </a>
      </div>
      {rest.length > 0 && (
        <div className="gr-list">
          {rest.map((n) => (
            <div className="gr-entry" key={n.id}>
              <div className="gr-entry-body">
                <span className="gr-entry-text">{String(n.text || '').slice(0, 80)}</span>
                <span className="gr-entry-date">{fmtShort(n.ts)}</span>
              </div>
              <button
                className="gr-entry-del"
                onClick={() => {
                  saveGratitude(loadGratitude().filter((x) => x.id !== n.id));
                  bump();
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal">
            <div className="modal-title">// Gratitude</div>
            <div className="field">
              <label>What are you grateful for today?</label>
              <textarea placeholder="Big or small — write it down..." autoFocus value={text} onChange={(e) => setText(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button className="btn-save" onClick={save}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- page ----------
export default function MindClient() {
  const [tick, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  const bump = () => setTick((t) => t + 1);

  useEffect(() => setMounted(true), []);
  usePull({ goals: { keys: ['goal_streak_v1'] }, growth: { keys: ['growth_notes', 'growth_lock_hash'] } }, bump);
  useCloudSync({ appKey: 'learning', syncedKeys: ['learning_subjects', 'learning_sessions'], onApplied: bump });
  useCloudSync({ appKey: 'library', syncedKeys: ['library_books', 'library_notes'], onApplied: bump });
  useCloudSync({ appKey: 'gratitude', syncedKeys: ['gratitude_notes'], onApplied: bump });

  const L = mounted ? learning() : { sessions: [], subjects: [], hours: 0 };
  const Lib = mounted ? library() : { books: [], notes: [] };
  const Gr = mounted ? growth() : { notes: [], locked: false };
  const tk = todayKey();
  const todayH = L.sessions.filter((s) => s && s.date === tk).reduce((t, s) => t + (parseFloat(s.hours) || 0), 0);
  const cut = calKey(new Date(Date.now() - 6 * 864e5));
  const wk = L.sessions.filter((s) => s && s.date >= cut).reduce((t, s) => t + (parseFloat(s.hours) || 0), 0);
  const reading = Lib.books.filter((b) => b && b.status === 'reading').length;
  const lastGrowth = Gr.notes[0];

  return (
    <div className="mind-page">
      <div className="shellwrap">
        <div className="daterow" />
        <div className="pagehead">
          <h1>
            {mounted && todayH > 0 ? (
              <>
                {todayH} {todayH === 1 ? 'hour' : 'hours'} in —<br />
                your brain says <em>thanks.</em>
              </>
            ) : (
              <>
                Feed the
                <br />
                <em>curiosity.</em>
              </>
            )}
          </h1>
          <div className="sub">
            {mounted ? (wk > 0 ? <><b>{wk % 1 === 0 ? wk : wk.toFixed(1)}h</b> this week</> : 'nothing this week yet') : ''}
            {mounted && Lib.books.some((b) => b && b.status === 'reading') ? ' · a book is waiting.' : mounted ? '.' : ''}
          </div>
        </div>

        <div className="section" id="secLearning">
          <div className="sec-head">
            Learning<span className="more">{mounted ? (L.hours % 1 === 0 ? L.hours : L.hours.toFixed(1)) + 'H LOGGED' : ''}</span>
          </div>
          <div className="glassy card">{mounted && <LearningTile tick={tick} bump={bump} />}</div>
        </div>

        <div className="section" id="secLibrary">
          <div className="sec-head">
            Library
            <span className="more">{mounted ? Lib.books.length + ' BOOK' + (Lib.books.length === 1 ? '' : 'S') + (reading ? ' · ' + reading + ' OPEN' : '') : ''}</span>
          </div>
          <div className="glassy card">{mounted && <LnLibTile tick={tick} bump={bump} />}</div>
        </div>

        <div className="section" id="secGrowth">
          <div className="sec-head">
            Growth<span className="more">{mounted && lastGrowth ? 'LAST · ' + fmtShort(lastGrowth.ts).toUpperCase() : ''}</span>
          </div>
          <a className="glassy card" href="/growth.html">
            {mounted && (
              <>
                {Gr.locked ? (
                  <div className="quote-q">{lastGrowth ? 'Locked · last written ' + fmtShort(lastGrowth.ts) + ' — tap to unlock.' : 'Reflections are locked.'}</div>
                ) : lastGrowth ? (
                  <div className="quote-q">“{String(lastGrowth.text || '').length > 140 ? String(lastGrowth.text).slice(0, 140) + '…' : lastGrowth.text}”</div>
                ) : null}
                <div className="rows" style={{ marginTop: Gr.locked || lastGrowth ? 8 : 0 }}>
                  <div className="rowi">
                    <span className="ic">✎</span>
                    <span className="tx">
                      <span className="t1" style={{ color: 'var(--muted)', fontWeight: 400 }}>
                        What did you notice today?
                      </span>
                    </span>
                    <span className="end act">WRITE</span>
                  </div>
                </div>
              </>
            )}
          </a>
        </div>

        <div className="section" id="secGratitude">
          <div className="sec-head">
            Gratitude<span className="more">{mounted ? (() => { const n = loadGratitude(); return n.length ? n.length + (n.length === 1 ? ' entry' : ' entries') : ''; })() : ''}</span>
          </div>
          {mounted && <GratitudeTile tick={tick} bump={bump} />}
        </div>
      </div>
      <AvatarBubble />
      <Dock activeId="mind" />
    </div>
  );
}
