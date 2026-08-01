// Shared water-tracker data layer ("Water Coach") — used by body.html's
// Water tile and po-water.html (the standalone page it also embeds via
// iframe on health.html).
export const SUBSTANCE_DB = [
  { id: 'adderall', name: 'Adderall (mixed amphetamine salts)', cat: 'ADHD stim', unit: 'mg', defaultDose: 20, mlPerUnit: 25, note: 'Stim · reduces thirst signal · dries you out' },
  { id: 'concerta', name: 'Concerta (methylphenidate ER)', cat: 'ADHD stim', unit: 'mg', defaultDose: 36, mlPerUnit: 13.9, note: 'Stim · reduces thirst signal' },
  { id: 'vyvanse', name: 'Vyvanse (lisdexamfetamine)', cat: 'ADHD stim', unit: 'mg', defaultDose: 50, mlPerUnit: 10, note: 'Stim prodrug · long acting' },
  { id: 'ritalin', name: 'Ritalin IR (methylphenidate)', cat: 'ADHD stim', unit: 'mg', defaultDose: 20, mlPerUnit: 20, note: 'Short-acting stim' },
  { id: 'focalin', name: 'Focalin / Focalin XR', cat: 'ADHD stim', unit: 'mg', defaultDose: 20, mlPerUnit: 20, note: 'Methylphenidate isomer' },
  { id: 'modafinil', name: 'Modafinil', cat: 'Wakefulness', unit: 'mg', defaultDose: 200, mlPerUnit: 1.75, note: 'Mild dehydrating effect' },
  { id: 'lithium', name: 'Lithium', cat: 'Mood', unit: 'mg', defaultDose: 600, mlPerUnit: 1.67, note: 'Critical — narrow therapeutic window, dehydration → toxicity' },
  { id: 'hctz', name: 'Hydrochlorothiazide (HCTZ)', cat: 'Diuretic', unit: 'mg', defaultDose: 25, mlPerUnit: 40, note: 'Direct diuretic — drink to compensate' },
  { id: 'lasix', name: 'Furosemide (Lasix)', cat: 'Diuretic', unit: 'mg', defaultDose: 40, mlPerUnit: 30, note: 'Loop diuretic · talk to your doctor about target' },
  { id: 'spironol', name: 'Spironolactone', cat: 'Diuretic', unit: 'mg', defaultDose: 50, mlPerUnit: 12, note: 'K-sparing diuretic' },
  { id: 'sudafed', name: 'Pseudoephedrine (Sudafed)', cat: 'Decongestant', unit: 'mg', defaultDose: 60, mlPerUnit: 4.17, note: 'Sympathomimetic · dries mucous membranes' },
  { id: 'phenyl', name: 'Phenylephrine', cat: 'Decongestant', unit: 'mg', defaultDose: 10, mlPerUnit: 20, note: 'Vasoconstrictor — mild' },
  { id: 'nicotine', name: 'Nicotine pouch (Velo / Zyn)', cat: 'Stim', unit: 'pouches/day', defaultDose: 4, mlPerUnit: 62.5, note: 'Vasoconstriction + dry mouth' },
  { id: 'nicpatch', name: 'Nicotine patch', cat: 'Stim', unit: 'mg', defaultDose: 14, mlPerUnit: 18, note: '24-h transdermal · sustained release' },
  { id: 'alcohol', name: 'Alcohol', cat: 'Depressant', unit: 'drinks/day', defaultDose: 1, mlPerUnit: 400, note: '~10ml urine per gram ethanol — adds up fast' },
  { id: 'cannabis', name: 'Cannabis / THC', cat: 'Other', unit: 'sessions/day', defaultDose: 1, mlPerUnit: 250, note: 'Cottonmouth — saliva gland inhibition' },
  { id: 'creatine', name: 'Creatine monohydrate', cat: 'Supplement', unit: 'g/day', defaultDose: 5, mlPerUnit: 80, note: 'Pulls water into muscle cells — drink more' },
  { id: 'preworkout', name: 'Pre-workout (caffeine + others)', cat: 'Stim', unit: 'servings/day', defaultDose: 1, mlPerUnit: 300, note: 'High-stim formula on top of caffeine' },
  { id: 'metformin', name: 'Metformin', cat: 'Glucose', unit: 'mg', defaultDose: 1000, mlPerUnit: 0.3, note: 'Mild GI fluid loss' },
  { id: 'sertraline', name: 'SSRI (sertraline / escitalopram / fluoxetine)', cat: 'SSRI', unit: 'mg', defaultDose: 50, mlPerUnit: 4, note: 'Mild dry mouth in some users' },
  { id: 'wellbutrin', name: 'Bupropion (Wellbutrin)', cat: 'NDRI', unit: 'mg', defaultDose: 300, mlPerUnit: 1.17, note: 'Stim-like profile' },
];

export function subExtraMl(s) {
  const dose = (s.dose != null ? s.dose : s.defaultDose) || 0;
  return Math.max(0, dose * (s.mlPerUnit || 0));
}
export function subDoseLabel(s) {
  const dose = s.dose != null ? s.dose : s.defaultDose;
  return dose + ' ' + (s.unit || '');
}

const LS_KEY = 'po_water_v1';
const DEFAULTS = { unit: 'bottle', bottleMl: 500, glassMl: 250, caffeineMgPerDay: 200, profile: { weightKg: 75, age: 25, sex: 'm', activityHrsPerWeek: 5 } };

export function normalize(s) {
  s = s || {};
  s.unit = s.unit || DEFAULTS.unit;
  s.bottleMl = s.bottleMl || DEFAULTS.bottleMl;
  s.glassMl = s.glassMl || DEFAULTS.glassMl;
  s.weightUnit = s.weightUnit || 'kg';
  s.profile = Object.assign({}, DEFAULTS.profile, s.profile || {});
  s.caffeineMgPerDay = s.caffeineMgPerDay != null ? s.caffeineMgPerDay : DEFAULTS.caffeineMgPerDay;
  s.substances = Array.isArray(s.substances) ? s.substances : [];
  s.logs = s.logs && typeof s.logs === 'object' ? s.logs : {};
  return s;
}
export function loadWaterState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) {}
  return normalize({});
}
export function saveWaterState(state) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch (e) {}
}

export function dateKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
export function todayKey() {
  return dateKey(new Date());
}
export function todayCount(state) {
  return state.logs[todayKey()] || 0;
}
export function setTodayCount(state, n) {
  const k = todayKey();
  if (n <= 0) delete state.logs[k];
  else state.logs[k] = n;
  saveWaterState(state);
}

export function computeTargetMl(state) {
  const p = state.profile;
  const wKg = state.weightUnit === 'lb' ? p.weightKg / 2.20462 : p.weightKg;
  const base = wKg * 35;
  const exercise = ((p.activityHrsPerWeek || 0) / 7) * 500;
  const caffeine = Math.max(0, (state.caffeineMgPerDay || 0) - 200) * 1.5;
  const subs = (state.substances || []).reduce((s, x) => s + subExtraMl(x), 0);
  let adjust = 0;
  if (p.sex === 'm') adjust += 200;
  if ((p.age || 0) >= 50) adjust += 100;
  return { base, exercise, caffeine, subs, adjust, total: base + exercise + caffeine + subs + adjust };
}
export function unitVolMl(state) {
  if (state.unit === 'bottle') return state.bottleMl || 500;
  if (state.unit === 'glass') return state.glassMl || 250;
  if (state.unit === 'oz') return 30;
  return 1;
}
export function unitLabelPlural(state) {
  if (state.unit === 'bottle') return 'bottles';
  if (state.unit === 'glass') return 'glasses';
  if (state.unit === 'oz') return 'oz';
  return 'ml';
}
export function unitLabelSingular(state) {
  if (state.unit === 'bottle') return 'bottle';
  if (state.unit === 'glass') return 'glass';
  if (state.unit === 'oz') return 'oz';
  return 'ml';
}
export function fmtMl(ml) {
  if (ml >= 1000) return (ml / 1000).toFixed(1) + ' L';
  return Math.round(ml) + ' ml';
}
