// Tests for the PWA's DB layer and sanitizer, run by evaluating app.js in
// Node with minimal browser stubs. Run: node --test mcp-server/test/db.test.mjs
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
let ctx;

before(async () => {
  const code = await readFile(join(here, '..', '..', 'app.js'), 'utf8');
  const storage = new Map();
  const sandbox = {
    localStorage: {
      getItem: k => storage.has(k) ? storage.get(k) : null,
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: k => storage.delete(k),
    },
    document: {
      addEventListener() {}, removeEventListener() {},
      getElementById() { return null; },
      querySelectorAll() { return []; },
      querySelector() { return null; },
      createElement() { return { style: {}, classList: { add() {}, remove() {} }, setAttribute() {}, addEventListener() {} }; },
      body: { appendChild() {} },
      documentElement: { setAttribute() {}, classList: { add() {}, remove() {}, toggle() {} } },
    },
    navigator: { language: 'es' },
    location: { hash: '', origin: 'http://localhost', pathname: '/', href: 'http://localhost/' },
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    Notification: undefined,
    fetch: () => Promise.reject(new Error('no network in tests')),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  ctx = vm.createContext(sandbox);
  vm.runInContext(code, ctx, { filename: 'app.js' });
});

test('addFood stamps a unique id and timestamp', () => {
  const r = vm.runInContext(`(() => {
    DB.addFood({ name: 'Pollo', kcal: 250 });
    const f = DB.todayFood();
    return JSON.stringify({ id: f[f.length-1].id, ts: f[f.length-1].ts });
  })()`, ctx);
  const { id, ts } = JSON.parse(r);
  assert.match(id, /^fd_/);
  assert.ok(ts);
});

test('removeFood removes by id and returns the entry', () => {
  const r = vm.runInContext(`(() => {
    DB.addFood({ name: 'Borrame', kcal: 100 });
    const f = DB.todayFood();
    const removed = DB.removeFood(f[f.length-1].id);
    return JSON.stringify({ name: removed?.name, stillThere: DB.todayFood().some(e => e.name === 'Borrame') });
  })()`, ctx);
  const { name, stillThere } = JSON.parse(r);
  assert.equal(name, 'Borrame');
  assert.equal(stillThere, false);
});

test('removeFood with unknown id is a safe no-op', () => {
  const r = vm.runInContext(`JSON.stringify(DB.removeFood('nope_123'))`, ctx);
  assert.equal(JSON.parse(r), null);
});

test('addExercise stamps id; removeExercise removes by id', () => {
  const r = vm.runInContext(`(() => {
    DB.addExercise({ name: 'Correr', duration: 30, kcalBurned: 250 });
    const ex = DB.todayExercise();
    const last = ex[ex.length-1];
    const removed = DB.removeExercise(last.id);
    return JSON.stringify({ id: last.id, removedName: removed?.name });
  })()`, ctx);
  const { id, removedName } = JSON.parse(r);
  assert.match(id, /^ex_/);
  assert.equal(removedName, 'Correr');
});

test('water add/remove touches per-day timestamp (for merge)', () => {
  const r = vm.runInContext(`(() => {
    DB.addWater(250);
    return JSON.stringify(Object.keys(DB.waterTs()).length > 0);
  })()`, ctx);
  assert.equal(JSON.parse(r), true);
});

test('migrateEntryIds stamps ids on legacy entries', () => {
  const r = vm.runInContext(`(() => {
    const log = DB.foodLog();
    const day = '2020-01-01';
    log[day] = [{ name: 'Legacy', kcal: 100 }];
    DB.saveFoodLog(log);
    DB.migrateEntryIds();
    return JSON.stringify(DB.foodLog()[day][0].id || null);
  })()`, ctx);
  assert.match(JSON.parse(r), /^mig_/);
});

test('sanitizeUntrusted coerces numeric fields, zeroes garbage', () => {
  const r = vm.runInContext(
    `JSON.stringify(sanitizeUntrusted({ kcal: '300', prot: 'garbage', qty: '1.5', name: 'X' }))`, ctx);
  const s = JSON.parse(r);
  assert.equal(s.kcal, 300);
  assert.equal(s.prot, 0);
  assert.equal(s.qty, 1.5);
  assert.equal(s.name, 'X');
});

test('DB.snapshot includes every synced domain', () => {
  const r = vm.runInContext(`JSON.stringify(Object.keys(DB.snapshot()).sort())`, ctx);
  assert.deepEqual(JSON.parse(r), [
    'completions','exerciseLog','foodLog','lifts','mealPlan','pantry',
    'recipes','settings','tasks','waterLog','waterTs','weightLog','wellness',
  ]);
});

test('client mergeClientServer unions same-day entries', () => {
  const r = vm.runInContext(`(() => {
    const m = mergeClientServer(
      { foodLog: { '2026-06-09': [{ id: 'a', name: 'Desayuno' }] } },
      { foodLog: { '2026-06-09': [{ id: 'b', name: 'Cena' }] } }
    );
    return JSON.stringify(m.foodLog['2026-06-09'].map(e => e.name).sort());
  })()`, ctx);
  assert.deepEqual(JSON.parse(r), ['Cena', 'Desayuno']);
});
