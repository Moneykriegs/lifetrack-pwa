// ============================================================
// SHARED CORE — core.js
// esc/normTxt/sanitize, MCPSync, mergeClientServer, CloudSync
// Extracted verbatim from app.js. Loaded as a plain <script> by both the
// PWA (index.html) and the Electron desktop renderer. No exports/build.
// ============================================================

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
// Accent-insensitive lowercase normalization ("Plátano" → "platano")
function normTxt(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }

// Strip prototype-pollution vectors from data received over the network.
const _FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
// Numeric fields that poison reduces/charts with NaN if they arrive as strings/garbage
const _NUMERIC_KEYS = new Set(['kcal', 'prot', 'carbs', 'fat', 'qty', 'ml', 'kg', 'kcalBurned', 'duration']);
function sanitizeUntrusted(value, depth = 0) {
  if (depth > 8 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(v => sanitizeUntrusted(v, depth + 1));
  const clean = {};
  for (const [k, v] of Object.entries(value)) {
    if (_FORBIDDEN_KEYS.has(k)) continue;
    if (_NUMERIC_KEYS.has(k) && v != null && typeof v !== 'number') {
      const n = parseFloat(v);
      clean[k] = Number.isFinite(n) ? n : 0;
      continue;
    }
    clean[k] = sanitizeUntrusted(v, depth + 1);
  }
  return clean;
}

// ================================================================
// MCP SYNC
// ================================================================
const MCPSync = {
  _authHeaders() {
    const token = DB.settings().mcpToken;
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  },
  async push() {
    const url = DB.settings().mcpUrl;
    if (!url) return;
    try {
      const payload = DB.snapshot();
      const res = await fetch(`${url}/api/sync`, {
        method:'POST',
        headers:{'Content-Type':'application/json', ...this._authHeaders()},
        body: JSON.stringify(payload), signal: AbortSignal.timeout(6000)
      });
      if (!res.ok) throw new Error(res.status);
      const { data } = await res.json();
      // Merge back
      if (data.settings)    DB.saveSettings({ ...DB.settings(), ...data.settings });
      if (data.tasks)       DB.saveTasks(data.tasks);
      if (data.completions) DB.saveCompletions(data.completions);
      if (data.foodLog)     DB.saveFoodLog(data.foodLog);
      if (data.waterLog)    DB.saveWaterLog(data.waterLog);
      if (data.waterTs)     DB.saveWaterTs(data.waterTs);
      if (data.weightLog)   DB.saveWeightLog(data.weightLog);
      if (data.recipes)     DB.saveRecipes(data.recipes);
      if (data.exerciseLog) DB.saveExerciseLog(data.exerciseLog);
      if (data.mealPlan)    DB.saveMealPlan(data.mealPlan);
      if (data.wellness)    DB.saveWellness(data.wellness);
      if (data.lifts)       DB.saveLifts(data.lifts);
      if (data.liftLog)     DB.saveLiftLog(data.liftLog);
      if (data.gymPlan)     DB.saveGymPlan(data.gymPlan);
      if (data.gymPlanTs)   DB.saveGymPlanTs(data.gymPlanTs);
      if (data.pantry)      DB.savePantry(data.pantry);
      return true;
    } catch(e) { console.warn('MCP sync error:', e); return false; }
  },

  async test(url) {
    try {
      const res = await fetch(`${url}/api/status`, { signal: AbortSignal.timeout(4000) });
      return res.ok;
    } catch { return false; }
  }
};

// ================================================================
// CLIENT-SIDE MERGE  (mirrors server data.js mergeSync)
// ================================================================

// Union two entry arrays, deduping by stable id (fingerprint fallback for
// legacy entries without one). Prevents the old "longer array wins" merge
// from silently discarding same-day entries made on another device.
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
  Object.entries(clientLog || {}).forEach(([d, entries]) => {
    merged[d] = merged[d] ? unionEntries(merged[d], entries) : entries;
  });
  return merged;
}

function mergeClientServer(server, client) {
  const s = server || {}, c = sanitizeUntrusted(client) || {};

  const settings = { ...s.settings, ...c.settings };

  // Entry-level union: same-day adds from two devices are both kept.
  // (Known trade-off: without tombstones, a deletion made on one device can
  // be resurrected by a stale copy on another — acceptable vs. losing data.)
  const foodLog     = unionDayLog(s.foodLog, c.foodLog);
  const exerciseLog = unionDayLog(s.exerciseLog, c.exerciseLog);
  const mealPlan    = unionDayLog(s.mealPlan, c.mealPlan);

  // Water: per-day newer-timestamp wins so deletions sync correctly.
  // Days without a timestamp (legacy data) fall back to max().
  const waterTs  = { ...(s.waterTs || {}) };
  const waterLog = { ...s.waterLog };
  Object.entries(c.waterLog || {}).forEach(([d, ml]) => {
    const cTs = (c.waterTs || {})[d] || 0;
    const sTs = (s.waterTs || {})[d] || 0;
    if (cTs || sTs) {
      if (cTs >= sTs) { waterLog[d] = ml; waterTs[d] = cTs; }
    } else {
      waterLog[d] = Math.max(waterLog[d] || 0, ml);
    }
  });

  const wMap = new Map();
  [...(s.weightLog || []), ...(c.weightLog || [])].forEach(w => wMap.set(w.date, w));
  const weightLog = [...wMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  const tMap = new Map();
  [...(s.tasks || []), ...(c.tasks || [])].forEach(t => tMap.set(t.id, t));
  const tasks = [...tMap.values()];

  const completions = { ...s.completions };
  Object.entries(c.completions || {}).forEach(([d, done]) => {
    completions[d] = { ...(completions[d] || {}), ...done };
  });

  const rMap = new Map();
  (s.recipes || []).forEach(r => rMap.set(r.id, r));
  (c.recipes || []).forEach(r => {
    rMap.set(r.id, rMap.has(r.id) ? { ...rMap.get(r.id), ...r } : r);
  });
  const recipes = [...rMap.values()];

  const wellness = { ...s.wellness };
  Object.entries(c.wellness || {}).forEach(([d, entry]) => {
    const cur = wellness[d];
    if (!cur || (entry.ts && (!cur.ts || entry.ts > cur.ts))) wellness[d] = entry;
  });

  // Lifts: per-exercise, keep the entry with the newer date.
  const lifts = { ...s.lifts };
  Object.entries(c.lifts || {}).forEach(([id, entry]) => {
    const cur = lifts[id];
    if (!cur || (entry.date && (!cur.date || entry.date >= cur.date))) lifts[id] = entry;
  });

  // Lift history: entry-level union per lift (same as day logs) so gym
  // sessions logged on two devices are all kept.
  const liftLog = { ...(s.liftLog || {}) };
  Object.entries(c.liftLog || {}).forEach(([id, entries]) => {
    liftLog[id] = liftLog[id] ? unionEntries(liftLog[id], entries) : entries;
  });

  // Gym weekly plan: last-writer-wins per day. A plan is a deliberate edit
  // (rewrite the whole day's exercise list), not an accumulating log — unioning
  // would resurrect deleted rows and duplicate edited ones on every sync.
  const gymPlanTs = { ...(s.gymPlanTs || {}) };
  const gymPlan   = { ...(s.gymPlan || {}) };
  Object.entries(c.gymPlan || {}).forEach(([day, exercises]) => {
    const cTs = (c.gymPlanTs || {})[day] || 0;
    const sTs = (s.gymPlanTs || {})[day] || 0;
    if (cTs >= sTs) { gymPlan[day] = exercises; gymPlanTs[day] = cTs; }
  });

  // Pantry: union by item id (same resurrect-vs-lose trade-off as day logs)
  const pantry = unionEntries(s.pantry, c.pantry);

  return { settings, tasks, completions, foodLog, waterLog, waterTs, weightLog, recipes, exerciseLog, mealPlan, wellness, lifts, liftLog, gymPlan, gymPlanTs, pantry };
}

// ================================================================
// CLOUD SYNC  (Supabase — replaces MCPSync when configured)
// ================================================================
const CloudSync = {
  sb:       null,   // Supabase client instance
  userId:   null,
  user:     null,   // { id, email, name, avatar }
  _pushTimer: null,
  _serverVersion: 0,  // last version seen from the server (optimistic concurrency)
  _syncingFull: false,

  /** Returns 'online' | 'offline-cached' | false */
  init() {
    const cfg = window.SUPABASE_CONFIG;
    if (!cfg?.url || cfg.url.startsWith('YOUR_')) return false;

    // Supabase CDN not loaded (offline?)
    if (typeof window.supabase === 'undefined') {
      const cached = this._loadCachedUser();
      return cached ? 'offline-cached' : false;
    }

    const { createClient } = window.supabase;
    // Use implicit flow so OAuth works correctly in PWA/mobile contexts where
    // the redirect comes back in a different browser context (no shared sessionStorage)
    this.sb = createClient(cfg.url, cfg.anonKey, {
      auth: { flowType: 'implicit' }
    });
    return 'online';
  },

  _localKey: 'lt_cloud_user',
  _loadCachedUser() {
    try { return JSON.parse(localStorage.getItem(this._localKey)); } catch { return null; }
  },
  _saveUser(u) { localStorage.setItem(this._localKey, JSON.stringify(u)); },
  _clearUser() { localStorage.removeItem(this._localKey); },

  async getSession() {
    if (!this.sb) return null;
    const { data: { session } } = await this.sb.auth.getSession();
    return session;
  },

  async signInWithGoogle() {
    if (!this.sb) return;
    const { error } = await this.sb.auth.signInWithOAuth({
      provider: 'google',
      options:  { redirectTo: window.location.origin + window.location.pathname }
    });
    if (error) throw error;
  },

  async signOut() {
    if (this.sb) await this.sb.auth.signOut();
    this._clearUser();
    this.userId = null;
    this.user   = null;
  },

  /** Push local data to Supabase with optimistic concurrency.
   *  Only writes if the server still has the version we last pulled;
   *  on conflict (another device wrote in between) falls back to a
   *  full pull→merge→push instead of clobbering the other write. */
  async push() {
    if (!this.sb || !this.userId) return false;
    const payload = DB.snapshot();
    const nextV = (this._serverVersion || 0) + 1;

    // Conditional update: matches 0 rows if someone else bumped the version
    const { data, error } = await this.sb
      .from('user_data')
      .update({ data: payload, version: nextV })
      .eq('user_id', this.userId)
      .eq('version', this._serverVersion || 0)
      .select('version');
    if (error) { console.warn('CloudSync push:', error); return false; }
    if (data && data.length) { this._serverVersion = nextV; return true; }

    // No row matched — either first ever push (no row) or version conflict
    const ins = await this.sb
      .from('user_data')
      .insert({ user_id: this.userId, data: payload, version: nextV });
    if (!ins.error) { this._serverVersion = nextV; return true; }

    // Row exists with a different version → another device wrote. Merge.
    if (this._syncingFull) return false; // already inside syncFull, don't recurse
    return this.syncFull();
  },

  /** Pull from Supabase (also records the server version for the next push) */
  async pull() {
    if (!this.sb || !this.userId) return null;
    const { data, error } = await this.sb
      .from('user_data')
      .select('data, version')
      .eq('user_id', this.userId)
      .maybeSingle();
    if (error) { console.warn('CloudSync pull:', error); return null; }
    if (data) this._serverVersion = data.version || 0;
    return data?.data ?? null;
  },

  /** Full bidirectional sync: pull → merge → save local → push merged */
  async syncFull() {
    if (!this.sb || !this.userId) return false;
    if (this._syncingFull) return false; // re-entrancy guard (push falls back here on conflict)
    this._syncingFull = true;
    try {
      const serverData = await this.pull();
      const localData  = DB.snapshot();
      const merged = serverData ? mergeClientServer(serverData, localData) : localData;
      DB.saveSettings(merged.settings);
      DB.saveTasks(merged.tasks);
      DB.saveCompletions(merged.completions);
      DB.saveFoodLog(merged.foodLog);
      DB.saveWaterLog(merged.waterLog);
      if (merged.waterTs) DB.saveWaterTs(merged.waterTs);
      DB.saveWeightLog(merged.weightLog);
      DB.saveRecipes(merged.recipes);
      DB.saveExerciseLog(merged.exerciseLog);
      DB.saveMealPlan(merged.mealPlan);
      DB.saveWellness(merged.wellness);
      if (merged.lifts)     DB.saveLifts(merged.lifts);
      if (merged.liftLog)   DB.saveLiftLog(merged.liftLog);
      if (merged.gymPlan)   DB.saveGymPlan(merged.gymPlan);
      if (merged.gymPlanTs) DB.saveGymPlanTs(merged.gymPlanTs);
      if (merged.pantry)    DB.savePantry(merged.pantry);
      await this.push();
      return true;
    } catch(e) { console.warn('CloudSync.syncFull:', e); return false; }
    finally { this._syncingFull = false; }
  },

  /** Debounced push — call after any data mutation */
  schedulePush() {
    clearTimeout(this._pushTimer);
    this._pushTimer = setTimeout(() => this.push().catch(() => {}), 8000);
    // Register background sync so the push happens even if the tab goes away
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        if (reg.sync) reg.sync.register('lt-data-sync').catch(() => {});
      }).catch(() => {});
    }
  }
};

