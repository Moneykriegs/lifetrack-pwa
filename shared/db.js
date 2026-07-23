// ============================================================
// SHARED CORE — db.js
// DB — localStorage wrapper + snapshot() canonical sync payload
// Extracted verbatim from app.js. Loaded as a plain <script> by both the
// PWA (index.html) and the Electron desktop renderer. No exports/build.
// ============================================================

// ================================================================
// STORAGE
// ================================================================
const DB = {
  _g(k, d = null) { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } },
  _s(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); }
    catch(e) {
      console.warn(e);
      // Surface quota errors — silently losing data is worse than a toast
      if (typeof toast === 'function') toast('⚠️ No se pudo guardar — almacenamiento lleno', 'error');
      return;
    }
    // Single seam: every successful data write schedules a debounced cloud
    // push, so no mutation can be forgotten. Skipped during syncFull (its
    // own push already covers the merged saves).
    if (typeof CloudSync !== 'undefined' && CloudSync.userId && !CloudSync._syncingFull) {
      CloudSync.schedulePush();
    }
  },

  tasks()         { return this._g('lt_tasks', []); },
  saveTasks(v)    { this._s('lt_tasks', v); },

  settings()      { return this._g('lt_settings', { name:'Usuario', calorieGoal:2000, waterGoal:2500, weightGoal:null, height:null, age:null, gender:'male', activityLevel:'moderate', mcpUrl:'', mcpToken:'', cuttingStyle:'custom', proteinGoal:null, carbsGoal:null, fatGoal:null, macrosAuto:true, hydrationEnabled:false, hydrationStart:8, hydrationEnd:22, hydrationIntervalMin:120, mealReminderEnabled:false, mealReminderTime:'13:00', cheatMealEnabled:false }); },
  saveSettings(v) { this._s('lt_settings', v); },

  // Active diary date for retro-logging. null = today. The Food view sets this
  // to a past date so all food/water/completion writes land on the right day;
  // App.navigate() resets it to null for every other view (always "today").
  _logDate: null,
  _d()            { return this._logDate || today(); },
  setLogDate(d)   { this._logDate = (d && d !== today()) ? d : null; },

  foodLog()       { return this._g('lt_food', {}); },
  saveFoodLog(v)  { this._s('lt_food', v); },
  todayFood()     { const d=this._d(); return (this.foodLog())[d] || []; },
  addFood(entry)  {
    const d=this._d(), l=this.foodLog(); if(!l[d])l[d]=[];
    // Stable unique id so cross-device merge can union instead of guessing by array length
    if (entry.id == null) entry = { ...entry, id: `fd_${Date.now()}_${Math.random().toString(36).slice(2,8)}` };
    if (!entry.ts) entry = { ...entry, ts: new Date().toISOString() };
    l[d].push(entry); this.saveFoodLog(l);
  },
  // Remove by stable id (not array index — indexes go stale if a background
  // sync re-orders the day's entries between render and click)
  removeFood(id) {
    const d=this._d(), l=this.foodLog();
    if (!l[d]) return null;
    const i = l[d].findIndex(e => String(e.id) === String(id));
    if (i < 0) return null;
    const [entry] = l[d].splice(i, 1);
    this.saveFoodLog(l);
    return entry;
  },

  // One-time migration: stamp ids on legacy entries so id-based removal
  // and the sync union always have a stable key to work with
  migrateEntryIds() {
    let changed = false;
    const stamp = (log) => {
      Object.values(log).forEach(entries => {
        (entries || []).forEach((e, i) => {
          if (e && typeof e === 'object' && e.id == null) {
            e.id = `mig_${Date.now()}_${i}_${Math.random().toString(36).slice(2,8)}`;
            changed = true;
          }
        });
      });
      return log;
    };
    const food = stamp(this.foodLog());
    const ex   = stamp(this.exerciseLog());
    if (changed) { this.saveFoodLog(food); this.saveExerciseLog(ex); }
  },

  waterLog()      { return this._g('lt_water', {}); },
  saveWaterLog(v) { this._s('lt_water', v); },
  // Per-day last-modified timestamps so the merge can honor deletions (newer wins)
  waterTs()       { return this._g('lt_water_ts', {}); },
  saveWaterTs(v)  { this._s('lt_water_ts', v); },
  _touchWaterTs(d){ const t=this.waterTs(); t[d]=Date.now(); this.saveWaterTs(t); },
  todayWater()    { const d=this._d(); return (this.waterLog())[d] || 0; },
  addWater(ml)    { const d=this._d(), l=this.waterLog(); l[d]=(l[d]||0)+ml; this.saveWaterLog(l); this._touchWaterTs(d); return l[d]; },
  removeWater(ml) { const d=this._d(), l=this.waterLog(); l[d]=Math.max(0,(l[d]||0)-ml); this.saveWaterLog(l); this._touchWaterTs(d); return l[d]; },

  weightLog()     { return this._g('lt_weight', []); },
  saveWeightLog(v){ this._s('lt_weight', v); },
  logWeight(kg, note='') {
    const l = this.weightLog().filter(w => w.date !== today());
    l.push({ date:today(), kg, note }); l.sort((a,b)=>a.date.localeCompare(b.date));
    this.saveWeightLog(l);
  },

  completions()   { return this._g('lt_done', {}); },
  saveCompletions(v){ this._s('lt_done', v); },
  todayDone()     { const d=this._d(); return (this.completions())[d] || {}; },
  toggleDone(id)  {
    const d=this._d(), all=this.completions(); if(!all[d])all[d]={};
    all[d][id]=!all[d][id]; this.saveCompletions(all); return all[d][id];
  },

  recipes()          { return this._g('lt_recipes', []); },
  saveRecipes(v)     { this._s('lt_recipes', v); },

  foodPrefs()        { return this._g('lt_food_prefs', null); },
  saveFoodPrefs(v)   { this._s('lt_food_prefs', v); },

  exerciseLog()      { return this._g('lt_exercise', {}); },
  saveExerciseLog(v) { this._s('lt_exercise', v); },
  todayExercise()    { return (this.exerciseLog())[today()] || []; },
  addExercise(entry) {
    const l=this.exerciseLog(); if(!l[today()])l[today()]=[];
    if (entry.id == null) entry = { ...entry, id: `ex_${Date.now()}_${Math.random().toString(36).slice(2,8)}` };
    l[today()].push(entry); this.saveExerciseLog(l);
  },
  removeExercise(id){
    const d=today(), l=this.exerciseLog();
    if (!l[d]) return null;
    const i = l[d].findIndex(e => String(e.id) === String(id));
    if (i < 0) return null;
    const [entry] = l[d].splice(i, 1);
    this.saveExerciseLog(l);
    return entry;
  },

  wellness()             { return this._g('lt_wellness', {}); },
  saveWellness(v)        { this._s('lt_wellness', v); },
  todayWellness()        { return (this.wellness())[today()] || null; },
  logWellness(entry)     { const w=this.wellness(); w[today()]={...entry, ts:new Date().toISOString()}; this.saveWellness(w); },

  mealPlan()               { return this._g('lt_meal_plan', {}); },
  saveMealPlan(v)          { this._s('lt_meal_plan', v); },
  planForDate(date)        { return (this.mealPlan())[date] || []; },
  addPlanEntry(date, entry){ const mp=this.mealPlan(); if(!mp[date])mp[date]=[]; mp[date].push(entry); this.saveMealPlan(mp); },
  removePlanEntry(date, id){ const mp=this.mealPlan(); if(mp[date]){mp[date]=mp[date].filter(e=>String(e.id)!==String(id)); this.saveMealPlan(mp);} },

  // Cycle tracking
  cycleLog()               { return this._g('lt_cycle', []); },
  saveCycleLog(v)          { this._s('lt_cycle', v); },

  // Supplements / medications
  supplements()            { return this._g('lt_supplements', []); },
  saveSupplements(v)       { this._s('lt_supplements', v); },
  lifts()                  { return this._g('lt_lifts', {}); },
  saveLifts(v)             { this._s('lt_lifts', v); },

  // Gym progress history: { liftId: [{ id, date, kg, reps, e1rm, ts }] }.
  // `lts_lifts` (above) still holds the latest entry per lift for the existing
  // strength ranking; this log is the full time series for progression/PRs.
  liftLog()                { return this._g('lt_lift_log', {}); },
  saveLiftLog(v)           { this._s('lt_lift_log', v); },
  liftHistory(liftId)      { return (this.liftLog())[liftId] || []; },
  addLiftEntry(liftId, entry) {
    const log = this.liftLog();
    if (!log[liftId]) log[liftId] = [];
    const e = {
      id: `lf_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      date: entry.date || today(),
      kg: entry.kg, reps: entry.reps, e1rm: entry.e1rm,
      ts: new Date().toISOString(),
    };
    log[liftId].push(e);
    log[liftId].sort((a, b) => a.date.localeCompare(b.date));
    this.saveLiftLog(log);
    // Keep the "latest" cache in sync so the existing ranking UI still works
    const latest = log[liftId][log[liftId].length - 1];
    const lifts = this.lifts();
    lifts[liftId] = { kg: latest.kg, reps: latest.reps, e1rm: latest.e1rm, date: latest.date };
    this.saveLifts(lifts);
    return e;
  },
  // One-time seed: if the history is empty but old single-value lifts exist,
  // create one history entry per lift so progression starts from known data.
  migrateLiftLog() {
    const log = this.liftLog();
    if (Object.keys(log).length) return;
    const lifts = this.lifts();
    let seeded = false;
    Object.entries(lifts).forEach(([id, v]) => {
      if (v && v.e1rm) {
        log[id] = [{ id: `lfmig_${id}`, date: v.date || today(), kg: v.kg, reps: v.reps, e1rm: v.e1rm, ts: new Date().toISOString() }];
        seeded = true;
      }
    });
    if (seeded) this.saveLiftLog(log);
  },

  pantry()                 { return this._g('lt_pantry', []); },
  savePantry(v)            { this._s('lt_pantry', v); },

  // Canonical sync payload — single source of truth for every sync path
  // (CloudSync.push, CloudSync.syncFull, MCPSync.push). Add new synced
  // domains HERE so they can never drift between paths again.
  snapshot() {
    return {
      settings: this.settings(), tasks: this.tasks(),
      completions: this.completions(), foodLog: this.foodLog(),
      waterLog: this.waterLog(), waterTs: this.waterTs(),
      weightLog: this.weightLog(), recipes: this.recipes(),
      exerciseLog: this.exerciseLog(), mealPlan: this.mealPlan(),
      wellness: this.wellness(), lifts: this.lifts(), pantry: this.pantry(),
      liftLog: this.liftLog(),
    };
  },

  supplementLog()          { return this._g('lt_supplement_log', {}); },
  saveSupplementLog(v)     { this._s('lt_supplement_log', v); },
  todaySupplLog()          { return (this.supplementLog())[today()] || {}; },
  toggleSuppl(id)          {
    const l = this.supplementLog();
    if (!l[today()]) l[today()] = {};
    l[today()][id] = !l[today()][id];
    this.saveSupplementLog(l);
    return l[today()][id];
  },
};

