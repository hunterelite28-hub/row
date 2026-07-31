'use client';

import { useEffect, useRef, useState } from 'react';
import Topbar from '@/components/Topbar';
import { useCloudSync } from '@/hooks/useCloudSync';

const TEMPLATE_VERSION = 5;

const STACK_DEFAULTS = [
  { id: 'm1', name: 'XXXXX - Supplement of choice', dose: '', window: 'morning', note: 'how much MG, meal times, any data below', tag: null, ordered: true },
  { id: 'm2', name: 'XXXXX - Supplement of choice', dose: '', window: 'morning', note: 'how much MG, meal times, any data below', tag: 'stack', ordered: true },
  { id: 'm3', name: 'XXXXX - Supplement of choice', dose: '', window: 'morning', note: 'how much MG, meal times, any data below', tag: null, ordered: true },
  { id: 'l1', name: 'XXXXX - Supplement of choice', dose: '', window: 'lunch', note: 'how much MG, meal times, any data below', tag: null, ordered: true },
  { id: 'l2', name: 'XXXXX - Supplement of choice', dose: '', window: 'lunch', note: 'how much MG, meal times, any data below', tag: null, ordered: true },
  { id: 'e1', name: 'XXXXX - Supplement of choice', dose: '', window: 'evening', note: 'how much MG, meal times, any data below', tag: null, ordered: true },
  { id: 'e2', name: 'XXXXX - Supplement of choice', dose: '', window: 'evening', note: 'how much MG, meal times, any data below', tag: 'not-ordered', ordered: false },
  { id: 'e3', name: 'XXXXX - Supplement of choice', dose: '', window: 'evening', note: 'how much MG, meal times, any data below', tag: null, ordered: true },
];

const STACK_WINDOWS = [
  { key: 'morning', icon: '🌅', title: 'Morning', time: '7–10 AM', cutoffHour: 10 },
  { key: 'lunch', icon: '🍽️', title: 'Lunch', time: '12–2 PM', cutoffHour: 14 },
  { key: 'evening', icon: '🌙', title: 'Evening', time: '9–11 PM', cutoffHour: 23 },
  { key: 'anytime', icon: '⏱️', title: 'Anytime', time: 'No fixed window', cutoffHour: null },
];

const SUPPLEMENT_DB = [
  { name: 'Creatine monohydrate', dose: '5g', window: 'anytime', note: 'Daily — consistency matters more than timing', icon: '🏋️', aliases: ['creatine'] },
  { name: 'Beta-alanine', dose: '2–5g', window: 'morning', note: 'Pre-workout — split doses to avoid tingles', icon: '🏋️', aliases: ['beta alanine'] },
  { name: 'L-citrulline', dose: '6–8g', window: 'morning', note: '~30 min pre-workout for pump', icon: '🏋️', aliases: ['citrulline'] },
  { name: 'BCAAs', dose: '5–10g', window: 'anytime', note: 'Around workout window', icon: '🏋️', aliases: ['bcaa'] },
  { name: 'Whey protein', dose: '25–40g', window: 'anytime', note: 'Post-workout or to hit daily target', icon: '🥤', aliases: ['whey'] },
  { name: 'Casein protein', dose: '25–40g', window: 'evening', note: 'Before bed for slow overnight aminos', icon: '🥤', aliases: ['casein'] },
  { name: 'L-carnitine', dose: '1–2g', window: 'morning', note: 'With carbs for best uptake', icon: '🏋️', aliases: ['carnitine'] },
  { name: 'Acetyl-L-carnitine', dose: '500mg–2g', window: 'morning', note: 'Cognitive variant — crosses BBB', icon: '🧠', aliases: ['alcar'] },
  { name: 'HMB', dose: '3g', window: 'anytime', note: 'Split 3x daily — muscle preservation', icon: '🏋️', aliases: ['hmb'] },
  { name: 'Glutamine', dose: '5g', window: 'anytime', note: 'Recovery — post-workout or before bed', icon: '🏋️', aliases: ['l-glutamine'] },
  { name: 'Vitamin D3', dose: '2000–5000 IU', window: 'lunch', note: 'Fat-soluble — take with biggest meal', icon: '☀️', aliases: ['vit d', 'vitamin d', 'd3', 'cholecalciferol'] },
  { name: 'Vitamin K2 (MK-7)', dose: '100–200 mcg', window: 'lunch', note: 'Pairs with D3 — same meal', icon: '💊', aliases: ['vit k', 'vitamin k', 'k2', 'mk7'] },
  { name: 'Vitamin C', dose: '500–1000mg', window: 'morning', note: 'Water-soluble — split if over 500mg', icon: '🍊', aliases: ['vit c', 'ascorbic acid'] },
  { name: 'Vitamin B12', dose: '500–1000mcg', window: 'morning', note: 'Methylcobalamin form preferred', icon: '⚡', aliases: ['b12', 'methylcobalamin'] },
  { name: 'B-complex', dose: '1 cap', window: 'morning', note: 'All B vitamins — energy', icon: '⚡', aliases: ['b complex', 'b vitamins'] },
  { name: 'Vitamin A', dose: '5000 IU', window: 'lunch', note: 'Fat-soluble — with fat', icon: '💊', aliases: ['vit a', 'retinol'] },
  { name: 'Vitamin E', dose: '400 IU', window: 'lunch', note: 'Fat-soluble — with fat', icon: '💊', aliases: ['vit e', 'tocopherol'] },
  { name: 'Folate', dose: '400–800mcg', window: 'morning', note: 'Methylfolate preferred', icon: '💊', aliases: ['folic acid', 'b9', 'methylfolate'] },
  { name: 'Biotin', dose: '30mcg–5mg', window: 'anytime', note: 'Hair, skin, nails', icon: '💅', aliases: ['biotin', 'b7'] },
  { name: 'Multivitamin', dose: '1 serving', window: 'lunch', note: 'Take with food', icon: '💊', aliases: ['multi', 'multivitamin'] },
  { name: 'Magnesium glycinate', dose: '200–400mg', window: 'evening', note: '30–60 min before bed — sleep helper', icon: '🌙', aliases: ['magnesium', 'mag glycinate', 'bisglycinate'] },
  { name: 'Magnesium L-threonate', dose: '144mg elemental', window: 'evening', note: 'Cognitive variant — crosses BBB', icon: '🧠', aliases: ['magtein', 'threonate'] },
  { name: 'Magnesium citrate', dose: '200–400mg', window: 'evening', note: 'Also supports digestion', icon: '🌙', aliases: ['mag citrate'] },
  { name: 'Zinc', dose: '15–30mg', window: 'evening', note: 'With food — not with calcium or iron', icon: '💊', aliases: ['zinc'] },
  { name: 'Iron', dose: '18–65mg', window: 'morning', note: 'Empty stomach with vit C', icon: '💊', aliases: ['iron'] },
  { name: 'Calcium', dose: '500mg', window: 'evening', note: 'With food — not with iron', icon: '🦴', aliases: ['calcium'] },
  { name: 'Selenium', dose: '100–200mcg', window: 'anytime', note: 'Thyroid + antioxidant', icon: '💊', aliases: ['selenium'] },
  { name: 'Iodine', dose: '150mcg', window: 'morning', note: 'Thyroid support', icon: '💊', aliases: ['iodine'] },
  { name: 'Omega-3 (Fish oil)', dose: '2–3g EPA+DHA', window: 'lunch', note: 'With biggest fatty meal', icon: '🐟', aliases: ['omega 3', 'omega3', 'fish oil', 'epa', 'dha'] },
  { name: 'Krill oil', dose: '500–1000mg', window: 'lunch', note: 'More absorbable than fish oil', icon: '🐟', aliases: ['krill'] },
  { name: 'MCT oil', dose: '1–2 tbsp', window: 'morning', note: 'Fast energy — start low', icon: '🥥', aliases: ['mct'] },
  { name: 'Flaxseed oil', dose: '1–2g', window: 'lunch', note: 'Plant omega-3 — with food', icon: '🌱', aliases: ['flax', 'flaxseed'] },
  { name: 'L-theanine', dose: '100–200mg', window: 'morning', note: 'Stacks with caffeine 2:1', icon: '🧠', aliases: ['theanine'] },
  { name: 'Caffeine', dose: '100–200mg', window: 'morning', note: 'Stack with L-theanine for cleaner focus', icon: '☕', aliases: ['caffeine'] },
  { name: 'Rhodiola rosea', dose: '200–400mg', window: 'morning', note: 'Adaptogen — energy and stress', icon: '🌿', aliases: ['rhodiola'] },
  { name: "Lion's mane", dose: '500–1000mg', window: 'morning', note: 'Cognitive support — daily', icon: '🍄', aliases: ['lions mane', 'hericium'] },
  { name: 'Bacopa monnieri', dose: '300–600mg', window: 'morning', note: 'With fat — long-term memory', icon: '🌿', aliases: ['bacopa'] },
  { name: 'Ginkgo biloba', dose: '120–240mg', window: 'morning', note: 'Circulation and cognition', icon: '🌿', aliases: ['ginkgo'] },
  { name: 'Alpha-GPC', dose: '300–600mg', window: 'morning', note: 'Choline — focus and learning', icon: '🧠', aliases: ['alpha gpc'] },
  { name: 'Phosphatidylserine', dose: '100–300mg', window: 'evening', note: 'Cortisol regulation', icon: '🧠', aliases: ['ps'] },
  { name: 'NAC', dose: '600–1800mg', window: 'morning', note: 'Glutathione precursor — split doses', icon: '💊', aliases: ['nac', 'n-acetyl cysteine'] },
  { name: 'Melatonin', dose: '0.3–3mg', window: 'evening', note: '30–60 min before bed — start low', icon: '🌙', aliases: ['melatonin'] },
  { name: 'Glycine', dose: '3g', window: 'evening', note: 'Body temp drop = better sleep onset', icon: '🌙', aliases: ['glycine'] },
  { name: 'Apigenin', dose: '50mg', window: 'evening', note: 'From chamomile — before bed', icon: '🌙', aliases: ['apigenin'] },
  { name: 'Ashwagandha', dose: '300–600mg', window: 'evening', note: 'KSM-66 form — stress and cortisol', icon: '🌿', aliases: ['ashwagandha', 'ksm-66'] },
  { name: 'L-tryptophan', dose: '500mg–1g', window: 'evening', note: 'Serotonin precursor — sleep onset', icon: '🌙', aliases: ['tryptophan'] },
  { name: 'GABA', dose: '500–750mg', window: 'evening', note: 'Calming — before bed', icon: '🌙', aliases: ['gaba'] },
  { name: 'Valerian root', dose: '300–600mg', window: 'evening', note: 'Sleep onset support', icon: '🌙', aliases: ['valerian'] },
  { name: 'Probiotics', dose: '10–50 billion CFU', window: 'morning', note: 'Empty stomach or with food', icon: '🦠', aliases: ['probiotic'] },
  { name: 'Quercetin', dose: '500–1000mg', window: 'anytime', note: 'Pairs well with vitamin C', icon: '🌿', aliases: ['quercetin'] },
  { name: 'Curcumin', dose: '500–1000mg', window: 'lunch', note: 'With black pepper + fat', icon: '🌿', aliases: ['curcumin', 'turmeric'] },
  { name: 'Resveratrol', dose: '250–500mg', window: 'morning', note: 'With fat for absorption', icon: '🍇', aliases: ['resveratrol'] },
  { name: 'CoQ10 / Ubiquinol', dose: '100–200mg', window: 'lunch', note: 'Fat-soluble — with biggest meal', icon: '💊', aliases: ['coq10', 'ubiquinol'] },
  { name: 'Alpha lipoic acid', dose: '300–600mg', window: 'morning', note: 'Empty stomach for absorption', icon: '💊', aliases: ['ala', 'alpha lipoic'] },
  { name: 'Glutathione', dose: '250–1000mg', window: 'morning', note: 'Liposomal form for absorption', icon: '💊', aliases: ['glutathione'] },
  { name: 'Astaxanthin', dose: '4–12mg', window: 'lunch', note: 'Fat-soluble — with fatty meal', icon: '💊', aliases: ['astaxanthin'] },
  { name: 'Berberine', dose: '500mg', window: 'lunch', note: 'Before meals — glucose support', icon: '💊', aliases: ['berberine'] },
  { name: 'Milk thistle', dose: '200–400mg', window: 'anytime', note: 'Silymarin — liver support', icon: '🌿', aliases: ['milk thistle', 'silymarin'] },
  { name: 'Spirulina', dose: '3–5g', window: 'morning', note: 'Algae — protein and antioxidants', icon: '🌱', aliases: ['spirulina'] },
  { name: 'Chlorella', dose: '2–4g', window: 'morning', note: 'Algae — detox support', icon: '🌱', aliases: ['chlorella'] },
  { name: 'Tongkat ali', dose: '200–400mg', window: 'morning', note: 'Cycle 8 weeks on/off', icon: '🌿', aliases: ['tongkat', 'longjack'] },
  { name: 'Fadogia agrestis', dose: '600mg', window: 'morning', note: 'Cycle 8 weeks on/off', icon: '🌿', aliases: ['fadogia'] },
  { name: 'DHEA', dose: '25–50mg', window: 'morning', note: 'Hormonal — consult doctor', icon: '💊', aliases: ['dhea'] },
  { name: 'Pregnenolone', dose: '10–50mg', window: 'morning', note: 'Hormonal — consult doctor', icon: '💊', aliases: ['pregnenolone'] },
  { name: 'Tribulus terrestris', dose: '250–750mg', window: 'morning', note: 'Libido and energy', icon: '🌿', aliases: ['tribulus'] },
  { name: 'Maca root', dose: '1.5–3g', window: 'morning', note: 'Adaptogen — energy and libido', icon: '🌿', aliases: ['maca'] },
  { name: 'Collagen peptides', dose: '10–20g', window: 'anytime', note: 'With vitamin C for synthesis', icon: '💅', aliases: ['collagen'] },
  { name: 'Glucosamine', dose: '1500mg', window: 'lunch', note: 'With food', icon: '🦴', aliases: ['glucosamine'] },
  { name: 'Chondroitin', dose: '1200mg', window: 'lunch', note: 'Often paired with glucosamine', icon: '🦴', aliases: ['chondroitin'] },
  { name: 'MSM', dose: '1–3g', window: 'anytime', note: 'Joint support', icon: '🦴', aliases: ['msm'] },
  { name: 'Hyaluronic acid', dose: '120–200mg', window: 'anytime', note: 'Skin and joint hydration', icon: '💅', aliases: ['hyaluronic', 'ha'] },
  { name: 'Cordyceps', dose: '1–3g', window: 'morning', note: 'Energy and endurance', icon: '🍄', aliases: ['cordyceps'] },
  { name: 'Reishi', dose: '1–2g', window: 'evening', note: 'Calming adaptogen', icon: '🍄', aliases: ['reishi', 'ganoderma'] },
  { name: 'Chaga', dose: '1–2g', window: 'morning', note: 'Antioxidant and immune', icon: '🍄', aliases: ['chaga'] },
];

// ---- storage ----
const storeGet = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k));
  } catch {
    return null;
  }
};
const storeSet = (k, v) => localStorage.setItem(k, JSON.stringify(v));

function getActiveDate() {
  const now = new Date();
  if (now.getHours() < 5) now.setDate(now.getDate() - 1);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function todayTakenKey() {
  return `stack:taken:${getActiveDate()}`;
}
function getItems() {
  const storedVersion = storeGet('stack:version');
  const stored = storeGet('stack:items');
  if (Array.isArray(stored) && stored.length) return stored;
  if (storedVersion != null) return Array.isArray(stored) ? stored : [];
  const fresh = JSON.parse(JSON.stringify(STACK_DEFAULTS));
  storeSet('stack:items', fresh);
  storeSet('stack:version', TEMPLATE_VERSION);
  return fresh;
}
function setItems(items) {
  storeSet('stack:items', items);
}
function getTaken() {
  return storeGet(todayTakenKey()) || {};
}
function setTaken(map) {
  storeSet(todayTakenKey(), map);
}
function getLow() {
  return storeGet('stack:low') || [];
}
function setLow(arr) {
  storeSet('stack:low', arr);
}

function metaText(item) {
  const parts = [];
  if (item.dose) parts.push(item.dose);
  if (item.note) parts.push(item.note);
  return parts.join(' · ');
}

function getStackIssues() {
  const items = getItems();
  const taken = getTaken();
  const low = getLow();
  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const missed = [];
  const lowList = [];
  items.forEach((item) => {
    const win = STACK_WINDOWS.find((w) => w.key === (item.window || 'anytime'));
    const isPastCutoff = win && win.cutoffHour !== null && nowHour > win.cutoffHour;
    const isTaken = !!taken[item.id];
    if (isPastCutoff && !isTaken) missed.push({ type: 'missed', text: `${item.name} — missed ${win.title.toLowerCase()} dose` });
    if (low.includes(item.id)) lowList.push({ type: 'low', text: `${item.name} — running low, reorder soon` });
  });
  return [...missed, ...lowList];
}

function StackTicker({ tick }) {
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
      <div className="sf-eyebrow stack-add-label">Add to stack</div>
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

export default function HealthClient() {
  const [tick, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  const bump = () => setTick((t) => t + 1);

  useCloudSync({
    appKey: 'health',
    syncedKeys: ['stack:items', 'stack:version', 'stack:low', 'po_water_v1'],
    syncedPrefixes: ['stack:taken:'],
    onApplied: bump,
  });

  useEffect(() => {
    setMounted(true);
    const id = setInterval(bump, 60 * 1000);
    window.addEventListener('storage', bump);
    return () => {
      clearInterval(id);
      window.removeEventListener('storage', bump);
    };
  }, []);

  const items = mounted ? getItems() : [];
  const taken = mounted ? getTaken() : {};
  const low = mounted ? getLow() : [];
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
    <div className="health-page">
      <Topbar hub="body" pageLabel="HEALTH" suppressWaterPush />
      <main>
        <div className="section-title">Daily Stack</div>

        <div className="stack-card">
          {mounted && <StackTicker tick={tick} />}

          <div className="stack-head">
            <div className="sf-eyebrow">Daily stack</div>
            <div className="sf-title">Tap each as you take it</div>
            <div className="stack-progress-text">
              {mounted ? `${takenCount} / ${totalCount} taken today · resets at 5 AM` : '— / — taken today · resets at 5 AM'}
            </div>
          </div>

          <div className="stack-progress-track">
            <div className="stack-progress-fill" style={{ width: pct + '%' }} />
          </div>

          <div>
            {mounted && items.length === 0 && <div className="stack-window-empty">No items yet — add one below to start your stack.</div>}
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
        </div>

        <section id="water" className="water-embed">
          <div className="section-title">Water Tracker</div>
          <iframe src="/po-water.html" className="water-iframe" loading="lazy" title="Water Tracker" />
        </section>

        <div className="attribution">// editable template · all data stays in your browser</div>
      </main>
    </div>
  );
}
