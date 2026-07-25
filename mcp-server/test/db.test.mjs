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
  // app.js was split into shared/ core files (Electron desktop migration).
  // Load them in the same order the PWA does, concatenated into one script so
  // top-level function declarations hoist exactly as they did pre-split.
  const root = join(here, '..', '..');
  const files = ['shared/constants.js', 'shared/db.js', 'shared/core.js', 'shared/insights.js', 'app.js'];
  const parts = await Promise.all(files.map(f => readFile(join(root, f), 'utf8')));
  const code = parts.join('\n;\n');
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
  vm.runInContext(code, ctx, { filename: 'shared+app.js' });
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

test('addLiftEntry appends history and updates the latest cache', () => {
  const r = vm.runInContext(`(() => {
    DB.addLiftEntry('squat', { kg: 100, reps: 5, e1rm: 117, date: '2026-06-01' });
    DB.addLiftEntry('squat', { kg: 110, reps: 3, e1rm: 121, date: '2026-06-08' });
    const hist = DB.liftHistory('squat');
    const latest = DB.lifts().squat;
    return JSON.stringify({ n: hist.length, sorted: hist[0].date < hist[1].date, latestE1rm: latest.e1rm, hasId: !!hist[0].id });
  })()`, ctx);
  const { n, sorted, latestE1rm, hasId } = JSON.parse(r);
  assert.equal(n, 2);
  assert.equal(sorted, true);
  assert.equal(latestE1rm, 121);
  assert.equal(hasId, true);
});

test('Strength.progress flags PRs and Strength.prs picks the best', () => {
  const r = vm.runInContext(`(() => {
    const hist = [
      { date:'2026-06-01', e1rm:100, kg:90, reps:3 },
      { date:'2026-06-08', e1rm:95,  kg:85, reps:4 },
      { date:'2026-06-15', e1rm:110, kg:100, reps:3 },
    ];
    const prog = Strength.progress(hist);
    const prs = Strength.prs({ squat: hist });
    return JSON.stringify({ prFlags: prog.map(p => p.isPR), bestE1rm: prs.squat.e1rm });
  })()`, ctx);
  const { prFlags, bestE1rm } = JSON.parse(r);
  assert.deepEqual(prFlags, [true, false, true]);
  assert.equal(bestE1rm, 110);
});

test('Strength.volume sums sessions, reps and tonnage in range', () => {
  const r = vm.runInContext(`(() => {
    const today = new Date(); const d = s => { const x=new Date(today); x.setDate(x.getDate()-s); return x.toISOString().slice(0,10); };
    const log = { squat: [{date:d(1),kg:100,reps:5},{date:d(2),kg:100,reps:5}], bench: [{date:d(40),kg:80,reps:5}] };
    return JSON.stringify(Strength.volume(log, 7));
  })()`, ctx);
  const v = JSON.parse(r);
  assert.equal(v.sets, 2);
  assert.equal(v.reps, 10);
  assert.equal(v.tonnage, 1000);
  assert.equal(v.days, 2);
});

test('Strength.score01 is continuous and monotonic across tiers', () => {
  const r = vm.runInContext(`(() => {
    // male squat thresholds: [0.75,1.25,1.50,2.00,2.50] x bodyweight
    const bodyKg = 80;
    return JSON.stringify({
      zero: Strength.score01('squat', 0, bodyKg, 'male'),
      noBody: Strength.score01('squat', 100, null, 'male'),
      belowBronze: Strength.score01('squat', 40, bodyKg, 'male'),   // ratio 0.5 < 0.75
      atBronze: Strength.score01('squat', 60, bodyKg, 'male'),      // ratio 0.75
      midGoldSilver: Strength.score01('squat', 110, bodyKg, 'male'),// ratio 1.375, between silver(1.25) and gold(1.5)
      atDiamond: Strength.score01('squat', 240, bodyKg, 'male'),    // ratio 3.0 >= 2.5
      aboveDiamond: Strength.score01('squat', 400, bodyKg, 'male'),
    });
  })()`, ctx);
  const v = JSON.parse(r);
  assert.equal(v.zero, 0);
  assert.equal(v.noBody, 0);
  assert.ok(v.belowBronze > 0 && v.belowBronze < 0.2, 'below first tier scales toward it, capped under 0.2');
  assert.ok(v.atBronze > v.belowBronze, 'crossing into Bronce increases score');
  assert.ok(v.midGoldSilver > v.atBronze && v.midGoldSilver < 1, 'mid-ladder score sits strictly between');
  assert.equal(v.atDiamond, 1);
  assert.equal(v.aboveDiamond, 1, 'score never exceeds 1 past Diamante');
});

test('Strength.muscleScores mixes lifts per group and exposes imbalance', () => {
  const r = vm.runInContext(`(() => {
    const bodyKg = 80, sex = 'male';
    // Only squat trained — legs should score, chest/shoulders/arms should be ~0
    const legsOnly = Strength.muscleScores({ squat: { e1rm: 150 } }, bodyKg, sex);
    // No data at all
    const none = Strength.muscleScores({}, bodyKg, sex);
    // All four trained evenly
    const balanced = Strength.muscleScores({
      squat: { e1rm: 150 }, bench: { e1rm: 100 }, deadlift: { e1rm: 200 }, ohp: { e1rm: 65 },
    }, bodyKg, sex);
    return JSON.stringify({ legsOnly, none, balanced });
  })()`, ctx);
  const { legsOnly, none, balanced } = JSON.parse(r);
  assert.ok(legsOnly.legs > 0, 'legs score from squat-only training');
  assert.equal(legsOnly.chest, 0, 'chest is pure bench — untrained stays 0');
  assert.equal(none.legs, 0); assert.equal(none.back, 0); assert.equal(none.chest, 0);
  assert.equal(none.shoulders, 0); assert.equal(none.arms, 0);
  ['legs','back','chest','shoulders','arms'].forEach(k => {
    assert.ok(balanced[k] > 0, `${k} should score once its contributing lifts are trained`);
    assert.ok(balanced[k] <= 1);
  });
});

test('Strength.plateLoad breaks down a real barbell load with IWF plates', () => {
  const r = vm.runInContext(`(() => {
    return JSON.stringify({
      empty: Strength.plateLoad(20, 'male'),          // bar only
      hundred: Strength.plateLoad(100, 'male'),       // 40kg/side -> greedy 25+15
      women: Strength.plateLoad(42.5, 'female'),      // 15kg bar, 13.75kg/side
      inexact: Strength.plateLoad(21, 'male'),        // 0.5kg/side, unloadable with this set
    });
  })()`, ctx);
  const { empty, hundred, women, inexact } = JSON.parse(r);
  assert.equal(empty.barKg, 20);
  assert.deepEqual(empty.perSide, []);
  assert.equal(empty.achievable, true);

  assert.equal(hundred.barKg, 20);
  assert.deepEqual(hundred.perSide, [25, 15]); // greedy heaviest-first: fewest plates
  assert.equal(hundred.totalKg, 100);
  assert.equal(hundred.achievable, true);

  assert.equal(women.barKg, 15);
  assert.ok(women.perSide.reduce((a,b)=>a+b,0) <= 13.75 + 1e-6);

  assert.equal(inexact.achievable, false, 'a target that cannot be loaded exactly is flagged');
  assert.ok(inexact.totalKg < 21, 'rounds down rather than over-representing the lift');
});

test('DB.snapshot includes every synced domain', () => {
  const r = vm.runInContext(`JSON.stringify(Object.keys(DB.snapshot()).sort())`, ctx);
  assert.deepEqual(JSON.parse(r), [
    'completions','exerciseLog','foodLog','gymPlan','gymPlanTs','liftLog','lifts',
    'mealPlan','pantry','recipes','settings','tasks','waterLog','waterTs',
    'weightLog','wellness',
  ]);
});

test('gym plan day CRUD is editable inline (add/update/remove)', () => {
  const r = vm.runInContext(`(() => {
    DB.addGymPlanExercise('mon', { name: 'Sentadilla', sets: 4, reps: 8, kg: 100 });
    const day1 = DB.gymPlanDay('mon');
    const id = day1[0].id;
    DB.updateGymPlanExercise('mon', id, { kg: 105 });
    const updatedKg = DB.gymPlanDay('mon')[0].kg;
    DB.removeGymPlanExercise('mon', id);
    return JSON.stringify({ addedCount: day1.length, updatedKg, afterRemove: DB.gymPlanDay('mon').length });
  })()`, ctx);
  const { addedCount, updatedKg, afterRemove } = JSON.parse(r);
  assert.equal(addedCount, 1);
  assert.equal(updatedKg, 105);
  assert.equal(afterRemove, 0);
});

test('copyGymPlanDay duplicates exercises with fresh ids', () => {
  const r = vm.runInContext(`(() => {
    DB.addGymPlanExercise('tue', { name: 'Press banca', sets: 3, reps: 10, kg: 60 });
    DB.copyGymPlanDay('tue', 'thu');
    const tue = DB.gymPlanDay('tue'), thu = DB.gymPlanDay('thu');
    return JSON.stringify({ sameName: thu[0].name === tue[0].name, differentId: thu[0].id !== tue[0].id });
  })()`, ctx);
  const { sameName, differentId } = JSON.parse(r);
  assert.equal(sameName, true);
  assert.equal(differentId, true);
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
