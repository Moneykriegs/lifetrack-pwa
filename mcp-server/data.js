import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir  = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = join(__dir, 'data');
const DATA_FILE = join(DATA_DIR, 'lifetrack.json');

const DEFAULTS = {
  settings: {
    name: 'Usuario',
    calorieGoal: 2000,
    waterGoal: 2500,
    weightGoal: null,
    height: null,
    age: null,
    gender: 'male',
    activityLevel: 'moderate'
  },
  tasks:       [],
  completions: {},
  foodLog:     {},
  waterLog:    {},
  weightLog:   [],
  recipes:     [],
  exerciseLog: {},
  mealPlan:    {},
  wellness:    {}
};

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function today() {
  return new Date().toISOString().split('T')[0];
}

export function getData() {
  ensureDir();
  if (!existsSync(DATA_FILE)) {
    writeFileSync(DATA_FILE, JSON.stringify(DEFAULTS, null, 2));
    return structuredClone(DEFAULTS);
  }
  try {
    return JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function saveData(data) {
  ensureDir();
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Strip prototype-pollution vectors from untrusted client input.
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
function sanitize(value, depth = 0) {
  if (depth > 8 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(v => sanitize(v, depth + 1));
  const clean = Object.create(null);
  for (const [k, v] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(k)) continue;
    clean[k] = sanitize(v, depth + 1);
  }
  return clean;
}

// Union two entry arrays, deduping by stable id (fingerprint fallback for
// legacy entries without one). Mirrors unionEntries in the PWA's app.js.
function unionEntries(serverArr, clientArr) {
  const out = [], seen = new Set();
  const keyOf = e => (e && e.id != null) ? `id:${e.id}` : `fp:${JSON.stringify(e)}`;
  [...(serverArr || []), ...(clientArr || [])].forEach(e => {
    const k = keyOf(e);
    if (!seen.has(k)) { seen.add(k); out.push(e); }
  });
  return out;
}

// Per-day union for { "YYYY-MM-DD": [entries] } logs
function unionDayLog(serverLog, clientLog) {
  const merged = { ...(serverLog || {}) };
  Object.entries(clientLog || {}).forEach(([date, entries]) => {
    merged[date] = merged[date] ? unionEntries(merged[date], entries) : entries;
  });
  return merged;
}

// Bidirectional merge: PWA localStorage → server JSON
export function mergeSync(serverData, clientData) {
  const s = serverData || {};
  const c = sanitize(clientData) || {};

  // Settings: merge, client wins for same keys (user may have changed on phone)
  const settings = { ...s.settings, ...c.settings };

  // Food log: entry-level union per date (same-day adds from two devices are both kept)
  const foodLog = unionDayLog(s.foodLog, c.foodLog);

  // Water log: per-day newer-timestamp wins so deletions sync; legacy days fall back to max
  const waterTs  = { ...(s.waterTs || {}) };
  const waterLog = { ...s.waterLog };
  Object.entries(c.waterLog || {}).forEach(([date, ml]) => {
    const cTs = (c.waterTs || {})[date] || 0;
    const sTs = (s.waterTs || {})[date] || 0;
    if (cTs || sTs) {
      if (cTs >= sTs) { waterLog[date] = ml; waterTs[date] = cTs; }
    } else {
      waterLog[date] = Math.max(waterLog[date] || 0, ml);
    }
  });

  // Weight log: merge by date (client wins same date)
  const weightMap = new Map();
  [...(s.weightLog || []), ...(c.weightLog || [])].forEach(w => weightMap.set(w.date, w));
  const weightLog = [...weightMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  // Tasks: union by id (client wins same id)
  const taskMap = new Map();
  [...(s.tasks || []), ...(c.tasks || [])].forEach(t => taskMap.set(t.id, t));
  const tasks = [...taskMap.values()];

  // Completions: merge object per date
  const completions = { ...s.completions };
  Object.entries(c.completions || {}).forEach(([date, done]) => {
    completions[date] = { ...(completions[date] || {}), ...done };
  });

  // Recipes: field-level merge — server base (keeps enriched micro fields) + client wins basics
  const recipeMap = new Map();
  (s.recipes || []).forEach(r => recipeMap.set(r.id, r));
  (c.recipes || []).forEach(r => {
    if (recipeMap.has(r.id)) {
      // Merge: server is base (has perVitA, perIron, etc.), client fields override basics
      // Client never sends per-micro keys so they are preserved from server
      recipeMap.set(r.id, { ...recipeMap.get(r.id), ...r });
    } else {
      recipeMap.set(r.id, r);
    }
  });
  const recipes = [...recipeMap.values()];

  // Exercise log + meal plan: entry-level union per date
  const exerciseLog = unionDayLog(s.exerciseLog, c.exerciseLog);
  const mealPlan    = unionDayLog(s.mealPlan, c.mealPlan);

  // Wellness: client wins same date (newest timestamp)
  const wellness = { ...s.wellness };
  Object.entries(c.wellness || {}).forEach(([date, entry]) => {
    const cur = wellness[date];
    if (!cur || (entry.ts && (!cur.ts || entry.ts > cur.ts))) wellness[date] = entry;
  });

  // Lifts: per-exercise, keep the entry with the newer date
  const lifts = { ...s.lifts };
  Object.entries(c.lifts || {}).forEach(([id, entry]) => {
    const cur = lifts[id];
    if (!cur || (entry.date && (!cur.date || entry.date >= cur.date))) lifts[id] = entry;
  });

  // Lift history: entry-level union per lift
  const liftLog = { ...(s.liftLog || {}) };
  Object.entries(c.liftLog || {}).forEach(([id, entries]) => {
    liftLog[id] = liftLog[id] ? unionEntries(liftLog[id], entries) : entries;
  });

  // Gym weekly plan: last-writer-wins per day (deliberate edit, not a log)
  const gymPlanTs = { ...(s.gymPlanTs || {}) };
  const gymPlan   = { ...(s.gymPlan || {}) };
  Object.entries(c.gymPlan || {}).forEach(([day, exercises]) => {
    const cTs = (c.gymPlanTs || {})[day] || 0;
    const sTs = (s.gymPlanTs || {})[day] || 0;
    if (cTs >= sTs) { gymPlan[day] = exercises; gymPlanTs[day] = cTs; }
  });

  // Pantry: union by item id
  const pantry = unionEntries(s.pantry, c.pantry);

  return { settings, tasks, completions, foodLog, waterLog, waterTs, weightLog, recipes, exerciseLog, mealPlan, wellness, lifts, liftLog, gymPlan, gymPlanTs, pantry };
}

// Calculate estimated TDEE from profile
export function calcTDEE(settings, weightKg) {
  const { height, age, gender, activityLevel, calorieGoal } = settings;
  if (!height || !age || !weightKg) return calorieGoal || 2000;

  const w = weightKg, h = height, a = age;
  const bmr = gender === 'female'
    ? 10 * w + 6.25 * h - 5 * a - 161
    : 10 * w + 6.25 * h - 5 * a + 5;

  const multipliers = {
    sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9
  };
  return Math.round(bmr * (multipliers[activityLevel] || 1.55));
}
