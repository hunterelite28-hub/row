'use client';

import { useEffect, useState } from 'react';
import {
  SUBSTANCE_DB,
  subExtraMl,
  subDoseLabel,
  loadWaterState,
  saveWaterState,
  normalize,
  dateKey,
  todayCount,
  setTodayCount,
  computeTargetMl,
  unitVolMl,
  unitLabelPlural,
  unitLabelSingular,
  fmtMl,
} from '@/lib/water';

function WaterHistory({ state, target }) {
  const days = [];
  for (let i = 6; i >= 1; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ date: d, count: state.logs[dateKey(d)] || 0 });
  }
  if (!days.length) return <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--faint)', padding: '12px 0' }}>No logs yet.</div>;
  const dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (
    <div>
      {days.map(({ date, count }, i) => {
        const lbl = dows[date.getDay()] + ' ' + (date.getMonth() + 1) + '/' + date.getDate();
        const pct = Math.min(100, (count / target) * 100);
        const miss = count < target;
        return (
          <div className="hist-row" key={i}>
            <span className="hist-date">{lbl}</span>
            <div className="hist-bar-wrap">
              <div className={'hist-bar-fill' + (miss ? ' miss' : '')} style={{ width: pct + '%' }} />
            </div>
            <span className="hist-count">
              {count}/{target}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function WaterSparkline({ state, target }) {
  const W = 280, H = 70, pad = 4;
  const days = 14;
  const data = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    data.push(state.logs[dateKey(d)] || 0);
  }
  const maxVal = Math.max(target, Math.max.apply(null, data)) || 1;
  const colW = (W - pad * 2) / data.length;
  const barW = colW * 0.7;
  const targetY = H - pad - (target / maxVal) * (H - pad * 2);
  return (
    <svg className="spark-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <line className="spark-target" x1="0" x2={W} y1={targetY.toFixed(1)} y2={targetY.toFixed(1)} />
      {data.map((v, i) => {
        const x = pad + i * colW + (colW - barW) / 2;
        const h = (v / maxVal) * (H - pad * 2);
        const y = H - pad - h;
        return <rect key={i} className={'spark-bar' + (v < target ? ' miss' : '')} x={x.toFixed(1)} y={y.toFixed(1)} width={barW.toFixed(1)} height={Math.max(0, h).toFixed(1)} rx="2" />;
      })}
    </svg>
  );
}

function SegControl({ id, options, value, onPick }) {
  return (
    <div className="seg" id={id}>
      {options.map((o) => (
        <button key={o.v} type="button" className={o.v === value ? 'active' : ''} onClick={() => onPick(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function WaterSettingsModal({ open, state, onChange, onClose, onImportedOrReset }) {
  const [subQuery, setSubQuery] = useState('');

  if (!open) return null;

  function patch(fn) {
    const next = { ...state };
    fn(next);
    saveWaterState(next);
    onChange(next);
  }

  const matches = subQuery.trim()
    ? SUBSTANCE_DB.filter((s) => s.name.toLowerCase().includes(subQuery.toLowerCase()) || s.cat.toLowerCase().includes(subQuery.toLowerCase())).slice(0, 8)
    : [];

  function addSub(sub) {
    if ((state.substances || []).find((x) => x.id === sub.id)) {
      alert('Already added — edit the dose below.');
      return;
    }
    patch((s) => {
      s.substances = [...s.substances, { id: sub.id, name: sub.name, cat: sub.cat, unit: sub.unit, mlPerUnit: sub.mlPerUnit, defaultDose: sub.defaultDose, dose: sub.defaultDose }];
    });
    setSubQuery('');
  }
  function updateSubDose(i, dose) {
    patch((s) => {
      s.substances[i] = { ...s.substances[i], dose };
    });
  }
  function removeSub(i) {
    patch((s) => {
      s.substances = s.substances.filter((_, idx) => idx !== i);
    });
  }

  function doExport() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'water-coach-data-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }
  function doImport(e) {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const parsed = JSON.parse(r.result);
        if (!confirm('Replace ALL current data with the imported file?')) return;
        saveWaterState(parsed);
        onImportedOrReset();
      } catch (err) {
        alert('Import failed: ' + err.message);
      }
    };
    r.readAsText(f);
    e.target.value = '';
  }
  function doReset() {
    if (!confirm('Wipe ALL water logs and settings? This cannot be undone.')) return;
    localStorage.removeItem('po_water_v1');
    onImportedOrReset();
    onClose();
  }

  return (
    <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>Water settings</h3>

        <div className="set-section">
          <h4>Profile</h4>
          <div className="field-row">
            <div className="field">
              <label>Weight</label>
              <input type="number" step="0.5" min="20" max="300" value={state.profile.weightKg} onChange={(e) => patch((s) => (s.profile.weightKg = parseFloat(e.target.value) || 0))} />
            </div>
            <div className="field">
              <label>Weight unit</label>
              <SegControl
                id="setWeightUnit"
                options={[{ v: 'kg', label: 'kg' }, { v: 'lb', label: 'lb' }]}
                value={state.weightUnit}
                onPick={(v) => patch((s) => (s.weightUnit = v))}
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Age</label>
              <input type="number" min="13" max="100" value={state.profile.age} onChange={(e) => patch((s) => (s.profile.age = parseFloat(e.target.value) || 0))} />
            </div>
            <div className="field">
              <label>Sex</label>
              <SegControl
                id="setSex"
                options={[{ v: 'm', label: 'Male' }, { v: 'f', label: 'Female' }, { v: 'o', label: 'Other' }]}
                value={state.profile.sex}
                onPick={(v) => patch((s) => (s.profile.sex = v))}
              />
            </div>
          </div>
          <div className="field">
            <label>Activity (training hours per week)</label>
            <input type="number" min="0" max="40" step="0.5" value={state.profile.activityHrsPerWeek} onChange={(e) => patch((s) => (s.profile.activityHrsPerWeek = parseFloat(e.target.value) || 0))} />
          </div>
        </div>

        <div className="set-section">
          <h4>Display</h4>
          <div className="field">
            <label>Show water as</label>
            <SegControl
              id="setUnit"
              options={[{ v: 'bottle', label: 'Bottles' }, { v: 'glass', label: 'Glasses' }, { v: 'oz', label: 'oz' }, { v: 'ml', label: 'ml' }]}
              value={state.unit}
              onPick={(v) => patch((s) => (s.unit = v))}
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Bottle size (ml)</label>
              <input type="number" min="100" max="2000" step="50" value={state.bottleMl} onChange={(e) => patch((s) => (s.bottleMl = parseFloat(e.target.value) || 500))} />
            </div>
            <div className="field">
              <label>Glass size (ml)</label>
              <input type="number" min="100" max="500" step="10" value={state.glassMl} onChange={(e) => patch((s) => (s.glassMl = parseFloat(e.target.value) || 250))} />
            </div>
          </div>
        </div>

        <div className="set-section">
          <h4>Caffeine</h4>
          <div className="field">
            <label>Average caffeine per day (mg)</label>
            <input type="number" min="0" max="1000" step="10" value={state.caffeineMgPerDay} onChange={(e) => patch((s) => (s.caffeineMgPerDay = parseFloat(e.target.value) || 0))} />
            <div className="field-hint">~1 cup of coffee = 95mg · espresso shot = 75mg · energy drink = 160mg. Above 200mg/day starts to add a small water requirement.</div>
          </div>
        </div>

        <div className="set-section">
          <h4>Stimulants &amp; meds</h4>
          <div className="field">
            <label>Search to add</label>
            <div className="search-wrap">
              <input type="text" className="search-input" placeholder="Type a name (Adderall, Concerta, Lithium…)" autoComplete="off" value={subQuery} onChange={(e) => setSubQuery(e.target.value)} />
              <div className={'search-results' + (subQuery.trim() ? ' show' : '')}>
                {subQuery.trim() && matches.length === 0 && (
                  <div className="search-result">
                    <span className="search-result-name">No matches</span>
                    <span className="search-result-meta">Try a different name or category</span>
                  </div>
                )}
                {matches.map((s) => {
                  const defaultExtra = (s.defaultDose || 0) * (s.mlPerUnit || 0);
                  return (
                    <div className="search-result" key={s.id} onClick={() => addSub(s)}>
                      <span className="search-result-name">
                        {s.name} <span className="search-result-add">+</span>
                      </span>
                      <span className="search-result-meta">
                        {s.cat} · {s.defaultDose} {s.unit} default → adds ~{fmtMl(defaultExtra)}/day · {s.note}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="field-hint">Each substance bumps your daily water target. Includes ADHD stims, diuretics, decongestants, nicotine, alcohol, and a few others.</div>
          </div>
          <div className="subs-list">
            {(!state.substances || !state.substances.length) && (
              <div style={{ fontSize: 12, color: 'var(--faint)', textAlign: 'center', padding: '14px 0', fontStyle: 'italic' }}>No substances added.</div>
            )}
            {(state.substances || []).map((s, i) => (
              <div className="sub-row" key={s.id}>
                <div className="sub-row-info">
                  <div className="sub-row-name">{s.name}</div>
                  <div className="sub-row-meta">
                    + {fmtMl(subExtraMl(s))} / day · {s.cat || ''}
                  </div>
                </div>
                <div className="sub-row-dose">
                  <input type="number" className="sub-dose-input" min="0" step="0.5" value={s.dose != null ? s.dose : s.defaultDose} onChange={(e) => updateSubDose(i, parseFloat(e.target.value) || 0)} />
                  <span className="sub-dose-unit">{s.unit || ''}</span>
                </div>
                <button className="sub-row-del" aria-label="Remove" onClick={() => removeSub(i)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="set-section">
          <h4>Data</h4>
          <div className="data-btn-row">
            <button className="btn-secondary" type="button" onClick={doExport}>
              Export JSON
            </button>
            <label className="btn-secondary" style={{ cursor: 'pointer' }}>
              Import JSON
              <input type="file" accept=".json" style={{ display: 'none' }} onChange={doImport} />
            </label>
            <button className="btn-secondary btn-danger" type="button" onClick={doReset}>
              Reset all
            </button>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-primary" type="button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// Full Water Coach widget: count row, progress bar, +/- actions, "why
// this target" breakdown, 7-day history, 14-day sparkline, and the
// settings modal. Shared by body.html's Water tile and po-water.html.
export default function WaterTracker({ onCounts }) {
  const [, setTick] = useState(0);
  const [state, setState] = useState(() => normalize({}));
  const [whyOpen, setWhyOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const bump = () => setTick((t) => t + 1);

  function refresh() {
    setState(loadWaterState());
    bump();
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const calc = computeTargetMl(state);
  const targetUnits = Math.ceil(calc.total / unitVolMl(state));
  const count = todayCount(state);
  const pctRaw = (count / targetUnits) * 100;
  const fillPct = Math.min(150, pctRaw) / 1.5;

  useEffect(() => {
    if (onCounts) onCounts(count, targetUnits);
  });

  function addOne() {
    setTodayCount(state, count + 1);
    refresh();
  }
  function subOne() {
    setTodayCount(state, Math.max(0, count - 1));
    refresh();
  }

  let helperText, helperGood;
  if (count === 0) {
    helperText = 'Start the day — first one in.';
    helperGood = false;
  } else if (pctRaw < 50) {
    helperText = 'Behind pace — drink one in the next hour.';
    helperGood = false;
  } else if (pctRaw < 100) {
    helperText = `${targetUnits - count} to go. Pacing well.`;
    helperGood = false;
  } else if (pctRaw < 130) {
    helperText = '✓ Target hit — top up if you train this evening.';
    helperGood = true;
  } else {
    helperText = 'Strong — way past target.';
    helperGood = true;
  }

  const u = state.weightUnit;
  const wDisp = state.profile.weightKg.toFixed(0);

  return (
    <>
      <div className="water-row">
        <span className="water-num">{count}</span>
        <span className="water-target">/ {targetUnits}</span>
        <button className="water-settings-btn" type="button" aria-label="Water settings" onClick={() => setSettingsOpen(true)}>
          ⚙
        </button>
      </div>

      <div className="water-bar-wrap">
        <div className="water-bar-track">
          <div className={'water-bar-fill' + (pctRaw > 100 ? ' over' : '')} style={{ width: fillPct + '%' }} />
          <div className="water-bar-zone" style={{ left: 65 / 1.5 + '%' }} />
          <div className="water-bar-zone" style={{ left: 100 / 1.5 + '%' }} />
        </div>
        <div className="water-bar-labels">
          <span>0</span>
          <span className="water-zone-name">healthy zone</span>
          <span>{Math.ceil(targetUnits * 1.5)}+</span>
        </div>
      </div>

      <div className="water-actions">
        <button className="water-minus-btn" type="button" aria-label="Undo last" disabled={count <= 0} onClick={subOne}>
          −
        </button>
        <button className="water-plus-btn" type="button" onClick={addOne}>
          <span>Drank a {unitLabelSingular(state)}</span>
          <span>↑</span>
        </button>
      </div>
      <div className={'water-helper' + (helperGood ? ' good' : '')}>{helperText}</div>

      <button className="why-toggle" type="button" aria-expanded={whyOpen} onClick={() => setWhyOpen((v) => !v)}>
        <span>Why this target?</span>
        <span className="why-arrow">▾</span>
      </button>
      <div className={'why-body' + (whyOpen ? ' show' : '')}>
        <div className="why-row">
          <span className="why-label">
            Base ({wDisp} {u} × 35 ml)
          </span>
          <span className="why-val">{fmtMl(calc.base)}</span>
        </div>
        {calc.exercise > 0 && (
          <div className="why-row">
            <span className="why-label">+ Exercise ({state.profile.activityHrsPerWeek} h/wk)</span>
            <span className="why-val">+ {fmtMl(calc.exercise)}</span>
          </div>
        )}
        {calc.caffeine > 0 && (
          <div className="why-row">
            <span className="why-label">+ Caffeine ({state.caffeineMgPerDay} mg/day)</span>
            <span className="why-val">+ {fmtMl(calc.caffeine)}</span>
          </div>
        )}
        {(state.substances || []).map((s) => (
          <div className="why-row" key={s.id}>
            <span className="why-label">
              + {s.name} ({subDoseLabel(s)})
            </span>
            <span className="why-val">+ {fmtMl(subExtraMl(s))}</span>
          </div>
        ))}
        {calc.adjust > 0 && (
          <div className="why-row">
            <span className="why-label">+ Sex / age adjustment</span>
            <span className="why-val">+ {fmtMl(calc.adjust)}</span>
          </div>
        )}
        <div className="why-row total">
          <span className="why-label">Daily target</span>
          <span className="why-val">
            {fmtMl(calc.total)} ≈ {targetUnits} {unitLabelPlural(state)}
          </span>
        </div>
      </div>

      <div className="water-divider">
        <span>LAST 7 DAYS</span>
      </div>
      <WaterHistory state={state} target={targetUnits} />

      <div className="water-divider">
        <span>LAST 14 DAYS</span>
      </div>
      <div className="spark-wrap">
        <WaterSparkline state={state} target={targetUnits} />
      </div>

      <WaterSettingsModal open={settingsOpen} state={state} onChange={setState} onClose={() => setSettingsOpen(false)} onImportedOrReset={refresh} />
    </>
  );
}
