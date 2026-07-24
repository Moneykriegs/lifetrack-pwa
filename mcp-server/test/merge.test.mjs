// Tests for mergeSync — the bidirectional sync merge.
// Run: node --test mcp-server/test/
// These pin the entry-level union semantics that replaced the old
// "longer array wins" merge (which silently lost same-day entries).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeSync } from '../data.js';

const day = '2026-06-09';

test('same-day food entries from two devices are both kept (union)', () => {
  const server = { foodLog: { [day]: [{ id: 'a', name: 'Desayuno', kcal: 300 }] } };
  const client = { foodLog: { [day]: [{ id: 'b', name: 'Cena', kcal: 500 }] } };
  const merged = mergeSync(server, client);
  const names = merged.foodLog[day].map(e => e.name).sort();
  assert.deepEqual(names, ['Cena', 'Desayuno']);
});

test('duplicate ids are not duplicated by the union', () => {
  const entry = { id: 'a', name: 'Pollo', kcal: 250 };
  const merged = mergeSync(
    { foodLog: { [day]: [entry] } },
    { foodLog: { [day]: [entry, { id: 'b', name: 'Arroz', kcal: 200 }] } }
  );
  assert.equal(merged.foodLog[day].length, 2);
});

test('legacy entries without id dedupe by fingerprint', () => {
  const entry = { name: 'Atún', kcal: 116 };
  const merged = mergeSync(
    { foodLog: { [day]: [entry] } },
    { foodLog: { [day]: [{ ...entry }] } }
  );
  assert.equal(merged.foodLog[day].length, 1);
});

test('water deletion syncs when client timestamp is newer', () => {
  const server = { waterLog: { [day]: 2000 }, waterTs: { [day]: 1000 } };
  const client = { waterLog: { [day]: 500 },  waterTs: { [day]: 2000 } };
  const merged = mergeSync(server, client);
  assert.equal(merged.waterLog[day], 500);
});

test('stale client water does not clobber newer server value', () => {
  const server = { waterLog: { [day]: 2000 }, waterTs: { [day]: 5000 } };
  const client = { waterLog: { [day]: 500 },  waterTs: { [day]: 1000 } };
  const merged = mergeSync(server, client);
  assert.equal(merged.waterLog[day], 2000);
});

test('water without timestamps falls back to max (legacy behavior)', () => {
  const merged = mergeSync(
    { waterLog: { [day]: 1500 } },
    { waterLog: { [day]: 750 } }
  );
  assert.equal(merged.waterLog[day], 1500);
});

test('exercise and meal plan also union per day', () => {
  const merged = mergeSync(
    { exerciseLog: { [day]: [{ id: 1, name: 'Correr' }] },
      mealPlan:    { [day]: [{ id: 10, slot: 'lunch', recipeName: 'Bowl' }] } },
    { exerciseLog: { [day]: [{ id: 2, name: 'Pesas' }] },
      mealPlan:    { [day]: [{ id: 11, slot: 'dinner', recipeName: 'Salmón' }] } }
  );
  assert.equal(merged.exerciseLog[day].length, 2);
  assert.equal(merged.mealPlan[day].length, 2);
});

test('lift history unions per exercise across devices', () => {
  const merged = mergeSync(
    { liftLog: { squat: [{ id: 's1', date: '2026-06-01', kg: 100, reps: 5, e1rm: 117 }] } },
    { liftLog: { squat: [{ id: 's2', date: '2026-06-08', kg: 105, reps: 5, e1rm: 122 }],
                 bench: [{ id: 'b1', date: '2026-06-08', kg: 80, reps: 5, e1rm: 93 }] } }
  );
  assert.equal(merged.liftLog.squat.length, 2);
  assert.equal(merged.liftLog.bench.length, 1);
});

test('gym plan uses last-writer-wins per day (newer timestamp)', () => {
  const merged = mergeSync(
    { gymPlan: { mon: [{ id: 's1', name: 'Sentadilla', sets: 4, reps: 8, kg: 100 }] },
      gymPlanTs: { mon: 1000 } },
    { gymPlan: { mon: [{ id: 's2', name: 'Sentadilla', sets: 5, reps: 5, kg: 110 }] },
      gymPlanTs: { mon: 2000 } }
  );
  assert.equal(merged.gymPlan.mon.length, 1);
  assert.equal(merged.gymPlan.mon[0].id, 's2');
});

test('gym plan keeps server day when client edit is stale', () => {
  const merged = mergeSync(
    { gymPlan: { tue: [{ id: 'a', name: 'Press', sets: 3, reps: 10, kg: 60 }] },
      gymPlanTs: { tue: 5000 } },
    { gymPlan: { tue: [{ id: 'b', name: 'Press viejo', sets: 3, reps: 10, kg: 50 }] },
      gymPlanTs: { tue: 1000 } }
  );
  assert.equal(merged.gymPlan.tue[0].id, 'a');
});

test('gym plan does not union — editing a day replaces it, not accumulates', () => {
  const merged = mergeSync(
    { gymPlan: { wed: [{ id: 'x', name: 'A' }, { id: 'y', name: 'B' }] }, gymPlanTs: { wed: 1000 } },
    { gymPlan: { wed: [{ id: 'z', name: 'C' }] }, gymPlanTs: { wed: 2000 } }
  );
  assert.equal(merged.gymPlan.wed.length, 1);
  assert.equal(merged.gymPlan.wed[0].name, 'C');
});

test('pantry items union by id across devices', () => {
  const merged = mergeSync(
    { pantry: [{ id: 1, name: 'Pollo' }] },
    { pantry: [{ id: 1, name: 'Pollo' }, { id: 2, name: 'Arroz' }] }
  );
  assert.equal(merged.pantry.length, 2);
});

test('weight log dedupes by date, client wins', () => {
  const merged = mergeSync(
    { weightLog: [{ date: day, kg: 80 }] },
    { weightLog: [{ date: day, kg: 79.5 }] }
  );
  assert.equal(merged.weightLog.length, 1);
  assert.equal(merged.weightLog[0].kg, 79.5);
});

test('prototype pollution keys are stripped from client data', () => {
  const malicious = JSON.parse('{"settings":{"__proto__":{"polluted":true},"name":"X"}}');
  const merged = mergeSync({}, malicious);
  assert.equal(merged.settings.name, 'X');
  assert.equal({}.polluted, undefined);
});
