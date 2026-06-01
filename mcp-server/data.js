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

// Bidirectional merge: PWA localStorage → server JSON
export function mergeSync(serverData, clientData) {
  const s = serverData || {};
  const c = sanitize(clientData) || {};

  // Settings: merge, client wins for same keys (user may have changed on phone)
  const settings = { ...s.settings, ...c.settings };

  // Food log: union by date; within a date, use whichever has more entries
  const foodLog = { ...s.foodLog };
  Object.entries(c.foodLog || {}).forEach(([date, entries]) => {
    if (!foodLog[date] || entries.length > foodLog[date].length) {
      foodLog[date] = entries;
    }
  });

  // Water log: sum per date (take max to avoid double-counting)
  const waterLog = { ...s.waterLog };
  Object.entries(c.waterLog || {}).forEach(([date, ml]) => {
    waterLog[date] = Math.max(waterLog[date] || 0, ml);
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

  // Exercise log: union by date; within a date, use whichever has more entries
  const exerciseLog = { ...s.exerciseLog };
  Object.entries(c.exerciseLog || {}).forEach(([date, entries]) => {
    if (!exerciseLog[date] || entries.length > exerciseLog[date].length) {
      exerciseLog[date] = entries;
    }
  });

  // Meal plan: union by date; within a date, use whichever has more entries
  const mealPlan = { ...s.mealPlan };
  Object.entries(c.mealPlan || {}).forEach(([date, entries]) => {
    if (!mealPlan[date] || entries.length > mealPlan[date].length) {
      mealPlan[date] = entries;
    }
  });

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

  return { settings, tasks, completions, foodLog, waterLog, weightLog, recipes, exerciseLog, mealPlan, wellness, lifts };
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
