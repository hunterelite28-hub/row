'use client';

import { useEffect, useRef, useState } from 'react';
import Dock from '@/components/Dock';
import { useCloudSync } from '@/hooks/useCloudSync';
import { readJSON, profile, computeAreaXp } from '@/lib/sunpath';

const AREA_META = [
  { id: 'strength', icon: '🔥', name: 'Strength', accent: 'var(--ember)', href: '/gym.html' },
  { id: 'intellect', icon: '🧠', name: 'Intellect', accent: '#6EA8E0', href: '/learning.html' },
  { id: 'vitality', icon: '❤️', name: 'Vitality', accent: '#E37B93', href: '/mind.html' },
  { id: 'perception', icon: '🌲', name: 'Perception', accent: 'var(--leaf)', href: '/habits.html' },
  { id: 'wealth', icon: '💰', name: 'Wealth', accent: '#B98CE0', href: '/money.html' },
  { id: 'education', icon: '🏛️', name: 'Education', accent: '#C08A5C', href: '/library.html' },
];

const DEFAULT_AREAS = [
  { id: 'strength', purpose: 'Gain strength, foster excellence, and sculpt the vessel of your excellence in life.', category: 'health and fitness', tags: [], resources: [] },
  {
    id: 'intellect', purpose: 'Nurture the engine of your existence with wisdom and knowledge.', category: 'knowledge', tags: ['Computer Science', 'Finance'],
    resources: [{ label: 'Introduction to Computer Science', url: null }, { label: 'Introduction to Python Programming', url: null }, { label: 'Foundations of Finance', url: null }],
  },
  { id: 'vitality', purpose: 'To find inner peace, connect with your self and embark on a journey of spiritual growth.', category: 'mind', tags: [], resources: [] },
  { id: 'perception', purpose: 'To foster discipline, find solitude and heed your responsibilities where you must.', category: 'lifestyle', tags: [], resources: [] },
  { id: 'wealth', purpose: 'To buy back your time, scale your impact, and build unshakable freedom.', category: 'money', tags: ['Trading'], resources: [{ label: 'TJR Bootcamp', url: null }] },
  { id: 'education', purpose: "To give you foundational tools, credentials, and access, but it's your job to outgrow it and think beyond the syllabus.", category: 'credentials', tags: [], resources: [{ label: 'A-Levels', url: null }] },
];

function readAreas() {
  const stored = readJSON('sunpath_life_areas', null);
  const xp = computeAreaXp();
  return AREA_META.map((meta) => {
    const def = DEFAULT_AREAS.find((a) => a.id === meta.id);
    const found = Array.isArray(stored) ? stored.find((a) => a && a.id === meta.id) : null;
    return Object.assign({}, def, found, { xp: xp[meta.id] || 0 });
  });
}
function writeAreas(areas) {
  localStorage.setItem('sunpath_life_areas', JSON.stringify(areas));
}
function writeProfile(p) {
  localStorage.setItem('sunpath_profile', JSON.stringify(p));
}
function levelFromXp(xp) {
  return Math.round((xp || 0) / 1000);
}

function XpBar({ xp, cap, color }) {
  const segs = 10;
  const per = cap / segs;
  const lit = Math.max(0, Math.min(segs, Math.floor((xp || 0) / per)));
  return (
    <div className="xp-bar" style={{ '--seg-color': color }}>
      {Array.from({ length: segs }, (_, i) => (
        <i key={i} className={i < lit ? 'on' : ''} />
      ))}
    </div>
  );
}

function ProfileModal({ open, onCancel, onSave }) {
  const [name, setName] = useState('');
  const [avatarDraft, setAvatarDraft] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const p = profile();
    setName(p.name);
    setAvatarDraft(p.avatarDataUrl);
  }, [open]);

  if (!open) return null;

  function onFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 200;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const scale = Math.max(size / img.width, size / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
        setAvatarDraft(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }
  function save() {
    onSave({ name: name.trim() || 'Rame', avatarDataUrl: avatarDraft, avatarEmoji: '🙂' });
  }

  return (
    <div className={'modal-bg' + (open ? ' show' : '')} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <h3>Edit profile</h3>
        <div className="field">
          <label>Avatar image</label>
          <div className="avatar-upload-row">
            <div className="profile-avatar">{avatarDraft ? <img src={avatarDraft} alt="" /> : <span>🙂</span>}</div>
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} />
          </div>
        </div>
        <div className="field">
          <label>Name</label>
          <input type="text" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function AreaModal({ open, areaId, onCancel, onSave }) {
  const [purpose, setPurpose] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [resources, setResources] = useState([]);
  const [resLabel, setResLabel] = useState('');
  const [resUrl, setResUrl] = useState('');

  useEffect(() => {
    if (!open || !areaId) return;
    const a = readAreas().find((x) => x.id === areaId);
    setPurpose(a.purpose || '');
    setCategory(a.category || '');
    setTags((a.tags || []).slice());
    setResources((a.resources || []).map((r) => ({ ...r })));
    setResLabel('');
    setResUrl('');
  }, [open, areaId]);

  if (!open || !areaId) return null;
  const meta = AREA_META.find((m) => m.id === areaId);

  function addTag() {
    const v = tagInput.trim();
    if (v) setTags([...tags, v]);
    setTagInput('');
  }
  function addResource() {
    const label = resLabel.trim();
    const url = resUrl.trim();
    if (label) setResources([...resources, { label, url: url || null }]);
    setResLabel('');
    setResUrl('');
  }
  function save() {
    onSave({ id: areaId, purpose: purpose.trim(), category: category.trim(), tags: tags.slice(), resources: resources.map((r) => ({ ...r })) });
  }

  return (
    <div className={'modal-bg' + (open ? ' show' : '')} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <h3>Edit {meta.name}</h3>
        <div className="field">
          <label>Purpose</label>
          <textarea rows={3} maxLength={240} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        </div>
        <div className="field">
          <label>Category</label>
          <input type="text" maxLength={30} value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <div className="field">
          <label>Tags</label>
          <div className="chip-list">
            {tags.map((t, i) => (
              <span className="chip" key={i}>
                {t}
                <button
                  type="button"
                  onClick={() => {
                    const next = tags.slice();
                    next.splice(i, 1);
                    setTags(next);
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="chip-add-row">
            <input type="text" placeholder="Add a tag…" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} />
            <button className="btn-secondary" type="button" onClick={addTag}>
              +
            </button>
          </div>
        </div>
        <div className="field">
          <label>Linked resources</label>
          <div className="res-list">
            {resources.map((r, i) => (
              <div className="res-row" key={i}>
                <span>
                  {r.label}
                  {r.url ? ' — ' + r.url : ''}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const next = resources.slice();
                    next.splice(i, 1);
                    setResources(next);
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className="res-add-row">
            <input type="text" placeholder="Label" value={resLabel} onChange={(e) => setResLabel(e.target.value)} />
            <input type="text" placeholder="URL (optional)" value={resUrl} onChange={(e) => setResUrl(e.target.value)} />
            <button className="btn-secondary" type="button" onClick={addResource}>
              +
            </button>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AreasClient() {
  const [tick, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [areaModalId, setAreaModalId] = useState(null);
  const bump = () => setTick((t) => t + 1);

  useCloudSync({ appKey: 'areas', syncedKeys: ['sunpath_profile', 'sunpath_life_areas'], onApplied: bump });
  useEffect(() => setMounted(true), []);

  const prof = mounted ? profile() : { name: 'Rame', avatarDataUrl: null, avatarEmoji: '🙂' };
  const areas = mounted ? readAreas() : [];
  const totalXp = areas.reduce((s, a) => s + (a.xp || 0), 0);
  const avatarLevel = Math.round(totalXp / 6000);

  function saveProfile(data) {
    writeProfile(data);
    setProfileModalOpen(false);
    bump();
  }
  function saveArea(data) {
    const list = readAreas();
    const idx = list.findIndex((x) => x.id === data.id);
    list[idx] = data;
    writeAreas(list.map(({ xp, ...rest }) => rest));
    setAreaModalId(null);
    bump();
  }

  return (
    <div className="areas-page">
      <div className="shellwrap">
        <div className="profile-card glassy">
          {mounted && (
            <>
              <div className="profile-avatar">{prof.avatarDataUrl ? <img src={prof.avatarDataUrl} alt="" /> : prof.avatarEmoji}</div>
              <div className="profile-body">
                <div className="profile-name">{prof.name}</div>
                <div className="profile-level">Avatar Level {avatarLevel}</div>
                <XpBar xp={totalXp} cap={600000} color="var(--sun)" />
                <div className="xp-label">{totalXp.toLocaleString()} / 600,000 total EXP</div>
              </div>
              <button className="profile-edit-btn" aria-label="Edit profile" onClick={() => setProfileModalOpen(true)}>
                ✎
              </button>
            </>
          )}
        </div>

        <div className="section">
          <div className="sec-head">Life Areas</div>
          <div className="grid2">
            {mounted &&
              AREA_META.map((meta) => {
                const a = areas.find((x) => x.id === meta.id);
                const lvl = levelFromXp(a.xp);
                return (
                  <a key={meta.id} className="area-card glassy" href={meta.href}>
                    <span className="area-card-icon">{meta.icon}</span>
                    <span className="area-card-name" style={{ color: meta.accent }}>
                      {meta.name}
                    </span>
                    <span className="area-card-purpose">{a.purpose}</span>
                    <XpBar xp={a.xp} cap={100000} color={meta.accent} />
                    <span className="area-card-level">
                      Lv {lvl} · {(a.xp || 0).toLocaleString()} / 100,000
                    </span>
                    <span className="area-card-cat">{a.category}</span>
                    {a.tags && a.tags.length > 0 && (
                      <div className="area-card-tags">
                        {a.tags.map((t, i) => (
                          <span key={i}>{t}</span>
                        ))}
                      </div>
                    )}
                    {a.resources && a.resources.length > 0 && (
                      <div className="area-card-res">
                        {a.resources.map((r, i) => (
                          <span key={i}>
                            {i > 0 && ' · '}
                            {r.url ? (
                              <a href={r.url} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>
                                {r.label}
                              </a>
                            ) : (
                              r.label
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      className="area-edit-btn"
                      type="button"
                      aria-label={'Edit ' + meta.name}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setAreaModalId(meta.id);
                      }}
                    >
                      ✎
                    </button>
                  </a>
                );
              })}
          </div>
        </div>
      </div>

      <ProfileModal open={profileModalOpen} onCancel={() => setProfileModalOpen(false)} onSave={saveProfile} />
      <AreaModal open={!!areaModalId} areaId={areaModalId} onCancel={() => setAreaModalId(null)} onSave={saveArea} />

      <Dock activeId="areas" />
    </div>
  );
}
