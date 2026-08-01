'use client';

import { useEffect, useRef, useState } from 'react';
import Topbar from '@/components/Topbar';
import { useCloudSync } from '@/hooks/useCloudSync';

const BOOK_KEY = 'library_books';
const NOTE_KEY = 'library_notes';
const STATUS = { reading: 'Reading', finished: 'Finished', toread: 'To Read' };
const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function loadBooks() {
  try {
    return JSON.parse(localStorage.getItem(BOOK_KEY) || '[]');
  } catch {
    return [];
  }
}
function saveBooks(a) {
  localStorage.setItem(BOOK_KEY, JSON.stringify(a));
}
function loadNotes() {
  try {
    return JSON.parse(localStorage.getItem(NOTE_KEY) || '[]');
  } catch {
    return [];
  }
}
function saveNotes(a) {
  localStorage.setItem(NOTE_KEY, JSON.stringify(a));
}
function uid() {
  return 'b' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}
function fmtDate(ts) {
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
function pct(book) {
  if (book.status === 'finished') return 100;
  const t = parseInt(book.totalPages) || 0, c = parseInt(book.currentPage) || 0;
  if (t > 0) return Math.max(0, Math.min(100, Math.round((c / t) * 100)));
  return null;
}
function showProgress(book) {
  return book.status !== 'toread' && pct(book) !== null;
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

function surround(ta, pre, post, onChange) {
  const s = ta.selectionStart, e = ta.selectionEnd, val = ta.value;
  const sel = val.slice(s, e);
  const next = val.slice(0, s) + pre + sel + post + val.slice(e);
  onChange(next);
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
function linePrefix(ta, prefix, onChange) {
  const s = ta.selectionStart, e = ta.selectionEnd, val = ta.value;
  const ls = val.lastIndexOf('\n', s - 1) + 1;
  const block = val.slice(ls, e);
  const newBlock = block ? block.split('\n').map((l) => (l ? prefix + l : l)).join('\n') : prefix;
  const next = val.slice(0, ls) + newBlock + val.slice(e);
  onChange(next);
  requestAnimationFrame(() => {
    ta.focus();
    ta.selectionStart = ls;
    ta.selectionEnd = ls + newBlock.length;
  });
}
function applyFmt(ta, fmt, onChange) {
  if (fmt === 'bold') surround(ta, '**', '**', onChange);
  else if (fmt === 'italic') surround(ta, '*', '*', onChange);
  else if (fmt === 'code') surround(ta, '`', '`', onChange);
  else if (fmt === 'bullet') linePrefix(ta, '- ', onChange);
}

function StarRating({ value, onChange, className, starClass }) {
  return (
    <div className={className}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={starClass + (i <= (value || 0) ? ' on' : '')} onClick={() => onChange(i === value ? 0 : i)}>
          ★
        </span>
      ))}
    </div>
  );
}

function BookCard({ book, noteCount, onOpen }) {
  const p = showProgress(book) ? pct(book) : null;
  return (
    <div className="book-card" onClick={() => onOpen(book.id)}>
      <div className="book-cover-wrap">{book.cover ? <img className="book-cover" src={book.cover} alt="cover" /> : <div className="book-cover-ph">📖</div>}</div>
      <div className="book-body">
        <div className="book-title">{book.title}</div>
        {book.author && <div className="book-author">{book.author}</div>}
        <div>
          <span className={'status-pill ' + book.status}>
            <span className="dot" />
            {STATUS[book.status]}
          </span>
        </div>
        {p !== null && (
          <div className="progress-row">
            <span className="progress-pct">{p}%</span>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: p + '%' }} />
            </div>
          </div>
        )}
        {noteCount > 0 && <div className="book-note-count">📝 {noteCount} {noteCount === 1 ? 'note' : 'notes'}</div>}
      </div>
    </div>
  );
}

function NoteItem({ note, onDelete, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(note.text);
  const taRef = useRef(null);

  function commit() {
    const v = val.trim();
    onSave(v || note.text);
    setEditing(false);
  }

  return (
    <div className="note-item">
      <div className="note-item-meta">
        <span className="note-item-page">{note.page ? 'p. ' + note.page : 'NOTE'}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="note-item-date">{fmtDate(note.ts)}</span>
          <span className="note-item-actions">
            <button className="note-edit" onClick={() => setEditing(true)}>
              [edit]
            </button>
            <button className="note-del" onClick={onDelete}>
              [del]
            </button>
          </span>
        </span>
      </div>
      {editing ? (
        <textarea
          ref={taRef}
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
          style={{
            width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-strong)', borderRadius: 8,
            color: 'var(--text-1)', fontFamily: 'var(--font)', fontSize: 14, lineHeight: 1.6, padding: '8px 10px', outline: 'none', minHeight: 60,
          }}
        />
      ) : (
        <div className="note-item-text" dangerouslySetInnerHTML={{ __html: renderMd(note.text) }} />
      )}
    </div>
  );
}

function NoteCompose({ bookId, onAdded }) {
  const [text, setText] = useState('');
  const [page, setPage] = useState('');
  const taRef = useRef(null);

  function submit() {
    const t = text.trim();
    if (!t) return;
    const all = loadNotes();
    const p = page.trim() ? parseInt(page) || null : null;
    all.unshift({ id: uid(), bookId, text: t, page: p, ts: Date.now() });
    saveNotes(all);
    setText('');
    setPage('');
    onAdded();
  }

  return (
    <div className="note-compose">
      <div className="note-fmt-bar">
        <button className="fmt-btn b" title="Bold (⌘/Ctrl+B)" onClick={() => applyFmt(taRef.current, 'bold', setText)}>
          B
        </button>
        <button className="fmt-btn i" title="Italic (⌘/Ctrl+I)" onClick={() => applyFmt(taRef.current, 'italic', setText)}>
          I
        </button>
        <button className="fmt-btn c" title="Code" onClick={() => applyFmt(taRef.current, 'code', setText)}>
          &lt;/&gt;
        </button>
        <button className="fmt-btn" title="Bullet" onClick={() => applyFmt(taRef.current, 'bullet', setText)}>
          •
        </button>
      </div>
      <textarea
        ref={taRef}
        placeholder="Add a note…  **bold**  *italic*  `code`"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.metaKey || e.ctrlKey) {
            const k = e.key.toLowerCase();
            if (k === 'b') {
              e.preventDefault();
              applyFmt(taRef.current, 'bold', setText);
            } else if (k === 'i') {
              e.preventDefault();
              applyFmt(taRef.current, 'italic', setText);
            } else if (k === 'enter') {
              e.preventDefault();
              submit();
            }
          }
        }}
      />
      <div className="note-compose-footer">
        <input className="note-page-input" type="number" placeholder="p. (opt)" min="0" inputMode="numeric" value={page} onChange={(e) => setPage(e.target.value)} />
        <button className="note-add-btn" disabled={!text.trim()} onClick={submit}>
          + Note
        </button>
      </div>
    </div>
  );
}

function DetailView({ book, notes, onBack, onEdit, bump }) {
  const sortedNotes = notes.slice().sort((a, b) => b.ts - a.ts);
  const p = book.status !== 'toread' ? pct(book) : null;
  const total = parseInt(book.totalPages) || 0;
  const [curPage, setCurPage] = useState(String(parseInt(book.currentPage) || 0));

  useEffect(() => {
    setCurPage(String(parseInt(book.currentPage) || 0));
  }, [book.id, book.currentPage]);

  function setRating(r) {
    const books = loadBooks().map((b) => (b.id === book.id ? { ...b, rating: r } : b));
    saveBooks(books);
    bump();
  }
  function commitPage() {
    let v = parseInt(curPage) || 0;
    v = Math.max(0, Math.min(total, v));
    const books = loadBooks().map((b) => (b.id === book.id ? { ...b, currentPage: v } : b));
    saveBooks(books);
    bump();
  }

  return (
    <div>
      <button className="detail-back" onClick={onBack}>
        ← Library
      </button>
      <div className="detail-top">
        {book.cover ? <img className="detail-cover" src={book.cover} alt="cover" /> : <div className="detail-cover-ph">📖</div>}
        <div className="detail-info">
          <div className="detail-title">{book.title}</div>
          {book.author && <div className="detail-author">{book.author}</div>}
          <div>
            <span className={'status-pill ' + book.status} style={{ marginTop: 10 }}>
              <span className="dot" />
              {STATUS[book.status]}
            </span>
          </div>
          <StarRating value={book.rating} onChange={setRating} className="detail-stars" starClass="detail-star" />
          <button className="detail-edit" onClick={() => onEdit(book)}>
            ⚙ Edit book
          </button>
        </div>
      </div>

      {book.status !== 'toread' && (
        <div className="detail-progress">
          {p !== null && (
            <div className="progress-row">
              <span className="progress-pct">{p}%</span>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: p + '%' }} />
              </div>
            </div>
          )}
          {total > 0 && (
            <div className="page-update">
              Page <input type="number" value={curPage} min="0" max={total} inputMode="numeric" onChange={(e) => setCurPage(e.target.value)} onBlur={commitPage} /> of {total}
            </div>
          )}
        </div>
      )}

      <div className="notes-head">// Notes</div>
      <NoteCompose bookId={book.id} onAdded={bump} />
      <div className="note-list">
        {sortedNotes.length === 0 && <div className="note-empty">No notes yet — add your first above.</div>}
        {sortedNotes.map((n) => (
          <NoteItem
            key={n.id}
            note={n}
            onDelete={() => {
              saveNotes(loadNotes().filter((x) => x.id !== n.id));
              bump();
            }}
            onSave={(text) => {
              saveNotes(loadNotes().map((x) => (x.id === n.id ? { ...x, text } : x)));
              bump();
            }}
          />
        ))}
      </div>
    </div>
  );
}

function BookModal({ open, editing, onCancel, onSave, onDelete }) {
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
    const tagArr = tags.split(',').map((x) => x.trim()).filter(Boolean);
    onSave({
      title: t,
      author: author.trim(),
      status,
      currentPage: parseInt(current) || 0,
      totalPages: parseInt(total) || 0,
      tags: tagArr,
      rating,
      cover,
    });
  }

  return (
    <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <div className="modal-title">{editing ? '// Edit Book' : '// New Book'}</div>
        <div className="field">
          <label>Cover (title page)</label>
          <div className="cover-pick" onClick={() => fileRef.current && fileRef.current.click()}>
            {cover ? <img src={cover} alt="cover preview" /> : <span>📷 Tap to add cover</span>}
          </div>
          {cover && (
            <button className="cover-clear" style={{ display: 'block' }} onClick={() => setCover('')}>
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
          <StarRating value={rating} onChange={setRating} className="modal-stars" starClass="modal-star" />
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

export default function LibraryClient() {
  const [tick, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [activeBookId, setActiveBookId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const bump = () => setTick((t) => t + 1);

  useCloudSync({ appKey: 'library', syncedKeys: ['library_books', 'library_notes'], onApplied: bump });

  useEffect(() => {
    setMounted(true);
    window.addEventListener('storage', bump);
    return () => window.removeEventListener('storage', bump);
  }, []);

  const books = mounted ? loadBooks() : [];
  const notes = mounted ? loadNotes() : [];
  const activeBook = activeBookId ? books.find((b) => b.id === activeBookId) : null;

  useEffect(() => {
    if (activeBookId && mounted && !books.some((b) => b.id === activeBookId)) setActiveBookId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, mounted]);

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
      list.unshift({ id: uid(), ...data, ts: Date.now() });
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
    saveNotes(loadNotes().filter((n) => n.bookId !== editingBook.id));
    if (activeBookId === editingBook.id) setActiveBookId(null);
    setModalOpen(false);
    setEditingBook(null);
    bump();
  }

  return (
    <div className="library-page">
      <Topbar hub="mind" pageLabel="LIBRARY" />
      <div className="shell">
        {activeBook ? (
          <DetailView
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
            <div className="page-header">
              <div className="page-title">
                LIBRARY<span className="page-title-dot">.</span>
              </div>
              <div className="page-sub">// books &amp; reading notes</div>
            </div>
            <div className="toolbar">
              <div className="filter-row">
                {filters.map(([k, label]) => (
                  <button key={k} className={'filter-chip' + (filter === k ? ' active' : '')} onClick={() => setFilter(k)}>
                    {label} {counts[k] || 0}
                  </button>
                ))}
              </div>
              <button
                className="add-book-btn"
                onClick={() => {
                  setEditingBook(null);
                  setModalOpen(true);
                }}
              >
                + Add
              </button>
            </div>

            {mounted && books.length === 0 && (
              <div className="empty">
                <span className="ico">📚</span>NO BOOKS YET
                <br />
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)' }}>TAP + ADD TO START YOUR SHELF</span>
              </div>
            )}
            {mounted && books.length > 0 && shown.length === 0 && <div className="note-empty">No books in this shelf.</div>}
            {mounted && shown.length > 0 && (
              <div className="book-list">
                {shown.map((b) => (
                  <BookCard key={b.id} book={b} noteCount={notes.filter((n) => n.bookId === b.id).length} onOpen={setActiveBookId} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <BookModal
        open={modalOpen}
        editing={editingBook}
        onCancel={() => {
          setModalOpen(false);
          setEditingBook(null);
        }}
        onSave={saveBook}
        onDelete={deleteBook}
      />
    </div>
  );
}
