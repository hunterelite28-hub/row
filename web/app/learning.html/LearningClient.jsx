'use client';

import { useEffect, useRef, useState } from 'react';
import Topbar from '@/components/Topbar';
import { useCloudSync } from '@/hooks/useCloudSync';

const SUBJ_KEY = 'learning_subjects';
const SESS_KEY = 'learning_sessions';
const ICONS = ['λ', '◎', '∑', '⊕', '△', '⬡', '⟨⟩', '✦', '◈', '⌘', '∞', '⚡'];
const ADD_RESOURCE_VALUE = '__add_resource__';

const DEFAULT_SUBJECTS = [{ id: 'py_default', name: 'Python', icon: 'λ', resources: ['CS50P (Harvard)', 'Python.org Docs', 'Automate the Boring Stuff', 'Real Python'] }];

function loadSubjects() {
  try {
    const s = JSON.parse(localStorage.getItem(SUBJ_KEY));
    return Array.isArray(s) && s.length ? s : JSON.parse(JSON.stringify(DEFAULT_SUBJECTS));
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_SUBJECTS));
  }
}
function saveSubjects(arr) {
  localStorage.setItem(SUBJ_KEY, JSON.stringify(arr));
}
function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(SESS_KEY) || '[]');
  } catch {
    return [];
  }
}
function saveSessions(arr) {
  localStorage.setItem(SESS_KEY, JSON.stringify(arr));
}

function pad2(n) {
  return String(n).padStart(2, '0');
}
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(ds) {
  const [, m, d] = ds.split('-').map(Number);
  return d + ' ' + MONS[m - 1];
}
function uid() {
  return 'l' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

function IconGrid({ current, onSelect }) {
  return (
    <div className="icon-grid">
      {ICONS.map((ic) => (
        <button key={ic} type="button" className={'icon-opt' + (ic === current ? ' active' : '')} onClick={() => onSelect(ic)}>
          {ic}
        </button>
      ))}
    </div>
  );
}

function ResourceList({ resources, onChange }) {
  return (
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
              onChange(next);
            }}
          />
          <button
            type="button"
            className="resource-del"
            onClick={() => {
              const next = resources.slice();
              next.splice(i, 1);
              onChange(next);
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="resource-add" onClick={() => onChange([...resources, ''])}>
        + Add Resource
      </button>
    </div>
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
    setTimeout(() => document.getElementById('newResourceInput')?.focus(), 50);
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
    let res = resource === ADD_RESOURCE_VALUE ? '' : resource;
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
              <input
                id="newResourceInput"
                type="text"
                placeholder="New resource name…"
                maxLength={60}
                value={newResourceInput}
                onChange={(e) => setNewResourceInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && commitNewResource()}
              />
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
          <IconGrid current={icon} onSelect={setIcon} />
        </div>
        <div className="field">
          <label>Resources</label>
          <ResourceList resources={resources} onChange={setResources} />
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

export default function LearningClient() {
  const [tick, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [logModal, setLogModal] = useState({ open: false, session: null });
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModal, setEditModal] = useState({ open: false, id: null });
  const bump = () => setTick((t) => t + 1);

  useCloudSync({ appKey: 'learning', syncedKeys: ['learning_subjects', 'learning_sessions'], onApplied: bump });

  useEffect(() => {
    setMounted(true);
    const subs = loadSubjects();
    setActiveId(subs[0] ? subs[0].id : null);
    window.addEventListener('storage', bump);
    return () => window.removeEventListener('storage', bump);
  }, []);

  const subjects = mounted ? loadSubjects() : [];
  const subject = subjects.find((s) => s.id === activeId) || subjects[0];
  const sessions = subject ? loadSessions().filter((s) => s.subjectId === subject.id) : [];
  const totalHrs = sessions.reduce((t, s) => t + (parseFloat(s.hours) || 0), 0);
  const uniqueTopics = sessions.reduce((t, s) => t + (s.topicsCount != null ? parseInt(s.topicsCount) || 0 : s.topic ? 1 : 0), 0);
  const hrsDisplay = totalHrs % 1 === 0 ? totalHrs + '.0H' : totalHrs.toFixed(1) + 'H';

  function selectSubject(id) {
    setActiveId(id);
  }
  function deleteSession(id) {
    saveSessions(loadSessions().filter((s) => s.id !== id));
    bump();
  }
  function saveSession(data) {
    let list = loadSessions();
    if (logModal.session) {
      list = list.map((s) => (s.id === logModal.session.id ? { ...s, ...data } : s));
    } else {
      list.unshift({ id: uid(), subjectId: activeId, ...data, ts: Date.now() });
    }
    list.sort((a, b) => b.date.localeCompare(a.date));
    saveSessions(list);
    setLogModal({ open: false, session: null });
    bump();
  }
  function saveNewSubject(data) {
    const subjs = loadSubjects();
    const newSubj = { id: uid(), ...data };
    subjs.push(newSubj);
    saveSubjects(subjs);
    setActiveId(newSubj.id);
    setAddModalOpen(false);
    bump();
  }
  function saveEditSubject(data) {
    const subjs = loadSubjects().map((s) => (s.id === editModal.id ? { ...s, ...data } : s));
    saveSubjects(subjs);
    setEditModal({ open: false, id: null });
    bump();
  }
  function deleteSubject() {
    if (!editModal.id) return;
    if (!confirm('Delete this subject and all its sessions?')) return;
    const subjs = loadSubjects().filter((s) => s.id !== editModal.id);
    const sess = loadSessions().filter((s) => s.subjectId !== editModal.id);
    saveSubjects(subjs);
    saveSessions(sess);
    setActiveId(subjs[0] ? subjs[0].id : null);
    setEditModal({ open: false, id: null });
    bump();
  }

  const editingSubject = editModal.id ? subjects.find((s) => s.id === editModal.id) : null;

  return (
    <div className="learning-page">
      <Topbar hub="mind" pageLabel="LEARN" />
      <div className="shell">
        <div className="subject-tabs-wrap">
          {subjects.map((s) => (
            <SubjectTab key={s.id} subject={s} active={s.id === (subject && subject.id)} onSelect={selectSubject} onLongPress={(id) => setEditModal({ open: true, id })} />
          ))}
          <button className="subject-add-btn" title="Add subject" onClick={() => setAddModalOpen(true)}>
            +
          </button>
        </div>

        {!mounted || !subject ? (
          mounted && <div className="no-subjects">No subjects yet.<br />Tap + to add your first.</div>
        ) : (
          <div>
            <div className="subj-header">
              <div>
                <div className="subj-title">
                  <span className="subj-title-icon">{subject.icon}</span>
                  {subject.name}
                </div>
              </div>
              <button className="log-btn" onClick={() => setLogModal({ open: true, session: null })}>
                + Log Session
              </button>
            </div>
            <div className="subj-sub">// track topics, hours &amp; resources</div>

            <div className="stats-row">
              <div className="stat-card">
                <span className="stat-val">{hrsDisplay}</span>
                <span className="stat-label">Total Hours</span>
              </div>
              <div className="stat-card">
                <span className="stat-val">{sessions.length}</span>
                <span className="stat-label">Sessions</span>
              </div>
              <div className="stat-card">
                <span className="stat-val">{uniqueTopics}</span>
                <span className="stat-label">Topics</span>
              </div>
            </div>

            <div className="log-card">
              <div className="log-card-header">// Session Log</div>
              <div>
                {sessions.length === 0 ? (
                  <div className="log-empty">
                    <div className="log-empty-icon">{subject.icon}</div>
                    <div className="log-empty-text">No Sessions Yet</div>
                  </div>
                ) : (
                  sessions.slice(0, 30).map((s) => (
                    <div className="session-row" key={s.id}>
                      <div className="session-icon">{subject.icon}</div>
                      <div className="session-body">
                        <div className="session-topic">{s.topic || '—'}</div>
                        <div className="session-meta">
                          {[s.hours ? s.hours + 'h' : '', s.topicsCount != null && s.topicsCount !== '' ? s.topicsCount + (parseInt(s.topicsCount) === 1 ? ' topic' : ' topics') : '', s.resource || '']
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                        {s.notes && <div className="session-notes">{s.notes}</div>}
                      </div>
                      <div className="session-right">
                        <div className="session-date">{fmtDate(s.date)}</div>
                        <button className="session-edit" onClick={() => setLogModal({ open: true, session: s })}>
                          [EDIT]
                        </button>
                        <button className="session-del" onClick={() => deleteSession(s.id)}>
                          [DEL]
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <LogSessionModal open={logModal.open} subject={subject} editingSession={logModal.session} onCancel={() => setLogModal({ open: false, session: null })} onSave={saveSession} />
      <SubjectModal open={addModalOpen} mode="add" onCancel={() => setAddModalOpen(false)} onSave={saveNewSubject} />
      <SubjectModal open={editModal.open} mode="edit" subject={editingSubject} onCancel={() => setEditModal({ open: false, id: null })} onSave={saveEditSubject} onDelete={deleteSubject} />
    </div>
  );
}

function SubjectTab({ subject, active, onSelect, onLongPress }) {
  const timerRef = useRef(null);
  return (
    <button
      className={'subject-tab' + (active ? ' active' : '')}
      onClick={() => onSelect(subject.id)}
      onPointerDown={() => {
        timerRef.current = setTimeout(() => onLongPress(subject.id), 600);
      }}
      onPointerUp={() => clearTimeout(timerRef.current)}
      onPointerLeave={() => clearTimeout(timerRef.current)}
    >
      <span className="subject-tab-icon">{subject.icon}</span>
      {subject.name}
    </button>
  );
}
