'use strict';
// NOTE: shared/{constants,db,core,insights}.js load BEFORE this file (see index.html).
// This file keeps UI-facing modules: Notif, Hydration, MealReminder, DarkMode,
// Fasting, FoodAPI, toast helpers, and the App controller.

// ================================================================
// NOTIFICATIONS
// ================================================================
const Notif = {
  timers: {},
  async init() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') await Notification.requestPermission();
    this.scheduleAll();
  },
  scheduleAll() {
    Object.values(this.timers).forEach(clearTimeout); this.timers = {};
    if (Notification.permission !== 'granted') return;
    DB.tasks().filter(t => t.notifEnabled && t.notifTime).forEach(t => this.schedule(t));
  },
  schedule(task) {
    this.cancel(task.id);
    const [h,m] = task.notifTime.split(':').map(Number);
    const now=new Date(), next=new Date();
    next.setHours(h,m,0,0); if(next<=now) next.setDate(next.getDate()+1);
    this.timers[task.id] = setTimeout(async()=>{ await this.show(task); this.schedule(task); }, next-now);
  },
  async show(task) {
    try {
      const opts = { body: task.description||'¡Es hora!', icon:'./icons/icon.svg', tag:`lt-${task.id}`, renotify:true };
      if('serviceWorker' in navigator){ const r=await navigator.serviceWorker.ready; r.showNotification(`⏰ ${task.title}`,opts); }
      else new Notification(`⏰ ${task.title}`, opts);
    } catch(e){ console.warn(e); }
  },
  cancel(id) { if(this.timers[id]){clearTimeout(this.timers[id]);delete this.timers[id];} }
};

// ================================================================
// HYDRATION REMINDERS
// ================================================================
const Hydration = {
  _timer: null,
  _lastFiredAt: 0,
  start() {
    this.stop();
    const s = DB.settings();
    if (!s.hydrationEnabled || Notification.permission !== 'granted') return;
    // Check every 15 min for granularity, throttle inside
    this._timer = setInterval(() => this.tick(), 15 * 60 * 1000);
    setTimeout(() => this.tick(), 5000); // first check shortly after start
  },
  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  },
  async tick() {
    const s = DB.settings();
    if (!s.hydrationEnabled) { this.stop(); return; }
    const now  = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
    if (hour < s.hydrationStart || hour >= s.hydrationEnd) return;

    // Throttle: never fire twice within `intervalMin` minutes
    const minMs = (s.hydrationIntervalMin || 120) * 60 * 1000;
    if (Date.now() - this._lastFiredAt < minMs) return;

    // Pro-rata expected progress for current window position
    const totalH    = Math.max(1, s.hydrationEnd - s.hydrationStart);
    const elapsedH  = Math.min(totalH, hour - s.hydrationStart);
    const expected  = (s.waterGoal || 2500) * (elapsedH / totalH);
    const consumed  = DB.todayWater();
    const deficit   = expected - consumed;

    // Only nudge if deficit > 1 interval-worth of pro-rata water (and ≥ 200ml)
    const intervalShare = (s.waterGoal || 2500) * (((s.hydrationIntervalMin || 120) / 60) / totalH);
    if (deficit < Math.max(200, intervalShare * 0.6)) return;

    this._lastFiredAt = Date.now();
    const remaining = Math.max(0, (s.waterGoal || 2500) - consumed);
    try {
      const opts = {
        body: `Llevas ${consumed} ml hoy. Tu meta son ${s.waterGoal} ml (te faltan ${remaining} ml).`,
        icon: './icons/icon.svg', tag: 'lt-hydration', renotify: true,
      };
      if ('serviceWorker' in navigator) {
        const r = await navigator.serviceWorker.ready;
        r.showNotification('💧 ¡Hora de hidratarte!', opts);
      } else {
        new Notification('💧 ¡Hora de hidratarte!', opts);
      }
    } catch(e) { console.warn(e); }
  },
};

// ================================================================
// MEAL REMINDER — daily push notification with lunch recommendations
// ================================================================
const MealReminder = {
  _timer: null,
  start() {
    this.stop();
    const s = DB.settings();
    if (!s.mealReminderEnabled || Notification.permission !== 'granted') return;
    const [h, m] = (s.mealReminderTime || '13:00').split(':').map(Number);
    const now = new Date(), next = new Date();
    next.setHours(h, m, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    this._timer = setTimeout(async () => { await this.fire(); this.start(); }, next - now);
  },
  stop() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  },
  async fire() {
    if (Notification.permission !== 'granted') return;
    const s = DB.settings();
    const cheat = s.cheatMealEnabled;
    const recs = cheat
      ? App._getCheatRecommendations().slice(0, 3)
      : (App._getRecommendations('lunch')?.recommendations || []).slice(0, 3);
    if (!recs.length) return;
    const names = recs.map(r => `${r.emoji} ${r.name}`).join(', ');
    const title = cheat ? '🍕 ¡Hora de darte un gusto!' : '🍽️ ¿Qué vas a almorzar hoy?';
    const body  = `Te recomendamos: ${names}`;
    try {
      const opts = { body, icon: './icons/icon.svg', tag: 'lt-meal-rec', renotify: true, data: { view: 'food' } };
      if ('serviceWorker' in navigator) {
        const r = await navigator.serviceWorker.ready;
        r.showNotification(title, opts);
      } else {
        new Notification(title, opts);
      }
    } catch(e) { console.warn(e); }
  },
};

// ================================================================
// DARK MODE
// ================================================================
const DarkMode = {
  _key: 'lt_dark_mode',
  init() {
    const stored = localStorage.getItem(this._key);
    let dark;
    if (stored === 'dark')        dark = true;
    else if (stored === 'light')  dark = false;
    else                          dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this._apply(dark);
    // Follow system changes only when user hasn't overridden
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!localStorage.getItem(this._key)) this._apply(e.matches);
    });
  },
  _apply(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
    const icon = document.getElementById('dark-mode-icon');
    if (icon) {
      icon.innerHTML = dark
        ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
        : '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>';
    }
    const toggle = document.getElementById('setting-dark-mode');
    if (toggle) toggle.checked = dark;
  },
  toggle() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const next = !dark;
    localStorage.setItem(this._key, next ? 'dark' : 'light');
    this._apply(next);
    toast(next ? '🌙 Modo oscuro activado' : '☀️ Modo claro activado', 'info');
  },
  isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; },
};

// ================================================================
// FASTING TIMER
// ================================================================
const Fasting = {
  _key:  'lt_fasting',
  _timer: null,
  get()        { return DB._g(this._key, { running: false, start: null, target: 16 }); },
  save(v)      { DB._s(this._key, v); },
  start(h)     {
    const t = h || this.get().target || 16;
    this.save({ running: true, start: Date.now(), target: t });
  },
  stop() {
    const s = this.get();
    this.save({ running: false, start: null, target: s.target,
                lastDur: s.start ? Date.now() - s.start : 0 });
  },
  reset()      { this.save({ running: false, start: null, target: this.get().target }); },
  elapsedSec() {
    const s = this.get();
    return (s.running && s.start) ? Math.floor((Date.now() - s.start) / 1000) : 0;
  },
};

// ================================================================
// FOOD API (Open Food Facts + micronutrients)
// ================================================================
const FoodAPI = {
  cache: {},
  MICRO_FIELDS: MICRO_KEYS.map(k => MICROS[k].apiKey).join(','),

  // How well a normalized name matches a normalized query (higher = better)
  relevance(name, q) {
    if (!q) return 0;
    if (name === q) return 100;
    if (name.startsWith(q)) return 80;
    const words = name.split(/\s+/);
    if (words.some(w => w.startsWith(q))) return 60;
    if (name.includes(q)) return 40;
    // Multi-word query: count word-prefix hits ("pollo asa" → "pollo asado")
    const qWords = q.split(/\s+/).filter(Boolean);
    if (qWords.length > 1) {
      const hits = qWords.filter(qw => words.some(w => w.startsWith(qw))).length;
      return hits === qWords.length ? 55 : hits * 12;
    }
    return 0;
  },

  _lastOffCall: 0,
  OFF_MIN_INTERVAL_MS: 4000, // OFF rate-limits search to ~10/min; stay well under

  async search(q, signal) {
    const cacheKey = normTxt(q);
    if (this.cache[cacheKey]) return this.cache[cacheKey];

    // Client-side throttle: rapid successive queries wait their turn instead
    // of burning the rate limit and getting empty responses back
    const wait = this._lastOffCall + this.OFF_MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    if (signal?.aborted) { const e = new Error('aborted'); e.name = 'AbortError'; throw e; }
    this._lastOffCall = Date.now();

    // lc=es prefers Spanish product names; sort_by=unique_scans_n ranks by
    // real-world popularity instead of OFF's arbitrary default order
    const url = `https://world.openfoodfacts.org/cgi/search.pl?` +
      `search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=30` +
      `&lc=es&sort_by=unique_scans_n&fields=product_name,product_name_es,nutriments,brands`;
    const res  = await fetch(url, { signal });
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    // Service-worker fallback (network failed / rate-limited) — not a real "no results"
    if (data._fallback) throw new Error('OFF unavailable');

    const nq = normTxt(q);
    let list = (data.products || [])
      .filter(p => (p.product_name_es || p.product_name) && (p.nutriments?.['energy-kcal_100g'] ?? -1) >= 0)
      .map(p => {
        const n = p.nutriments || {};
        const name = (p.product_name_es || p.product_name || '').slice(0, 55);
        const item = {
          name,
          brand:  (p.brands||'').split(',')[0].trim(),
          kcal:   Math.round(n['energy-kcal_100g'] || 0),
          prot:   +((n.proteins_100g||0).toFixed(1)),
          carbs:  +((n.carbohydrates_100g||0).toFixed(1)),
          fat:    +((n.fat_100g||0).toFixed(1)),
          _rel:   this.relevance(normTxt(name), nq),
        };
        // Micros per 100g
        MICRO_KEYS.forEach(k => {
          item[k] = n[MICROS[k].apiKey] != null ? n[MICROS[k].apiKey] : null;
        });
        return item;
      });

    // Prefer items whose NAME matches the query; popularity (API order) breaks
    // ties. Only fall back to non-matching items if nothing matches at all.
    const matching = list.filter(i => i._rel > 0 || normTxt(i.brand).includes(nq));
    list = (matching.length ? matching : list)
      .sort((a, b) => b._rel - a._rel)
      .slice(0, 15);

    // Never cache empties: a rate-limited/flaky response shouldn't stick
    if (list.length) this.cache[cacheKey] = list;
    return list;
  },

  // Lookup product by barcode (EAN/UPC) — Open Food Facts v2
  async lookupByBarcode(barcode) {
    const code = String(barcode || '').trim();
    if (!code) return null;
    const cacheKey = `bc:${code}`;
    if (this.cache[cacheKey]) return this.cache[cacheKey];

    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json` +
                `?fields=product_name,brands,nutriments`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;

    const p = data.product;
    const n = p.nutriments || {};
    if ((n['energy-kcal_100g'] ?? -1) < 0) return null; // no nutrition data

    const item = {
      name:    (p.product_name || '').slice(0, 55) || `Código ${code}`,
      brand:   (p.brands || '').split(',')[0].trim(),
      barcode: code,
      kcal:    Math.round(n['energy-kcal_100g'] || 0),
      prot:    +((n.proteins_100g     || 0).toFixed(1)),
      carbs:   +((n.carbohydrates_100g || 0).toFixed(1)),
      fat:     +((n.fat_100g          || 0).toFixed(1)),
    };
    MICRO_KEYS.forEach(k => {
      item[k] = n[MICROS[k].apiKey] != null ? n[MICROS[k].apiKey] : null;
    });
    this.cache[cacheKey] = item;
    return item;
  },

  // Scale item to a given gram quantity
  scale(item, qty) {
    const f = qty / 100;
    const entry = {
      name: item.name, brand: item.brand, qty,
      kcal:  Math.round(item.kcal  * f),
      prot:  +((item.prot  * f).toFixed(1)),
      carbs: +((item.carbs * f).toFixed(1)),
      fat:   +((item.fat   * f).toFixed(1)),
    };
    MICRO_KEYS.forEach(k => { entry[k] = item[k] != null ? +((item[k]*f).toFixed(3)) : null; });
    return entry;
  }
};

// ================================================================
// CHARTS
// ================================================================
const Charts = {
  ring(canvas, value, max, color) {
    const dpr=window.devicePixelRatio||1, S=80;
    canvas.width=S*dpr; canvas.height=S*dpr;
    canvas.style.width=S+'px'; canvas.style.height=S+'px';
    const ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr);
    const cx=S/2,cy=S/2,r=S/2-8,pct=max>0?Math.min(value/max,1):0;
    ctx.clearRect(0,0,S,S);
    ctx.beginPath(); ctx.arc(cx,cy,r,0,2*Math.PI); ctx.strokeStyle='#E2E8F0'; ctx.lineWidth=9; ctx.stroke();
    if(pct>0){ctx.beginPath();ctx.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+2*Math.PI*pct);ctx.strokeStyle=color;ctx.lineWidth=9;ctx.lineCap='round';ctx.stroke();}
  },

  bars(canvas, values, labels, color, goalLine=null) {
    const dpr=window.devicePixelRatio||1;
    const rect=canvas.parentElement.getBoundingClientRect();
    const W=rect.width||300, H=160;
    canvas.width=W*dpr; canvas.height=H*dpr;
    canvas.style.width=W+'px'; canvas.style.height=H+'px';
    const ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr);
    const pad={t:10,r:8,b:24,l:30};
    const cW=W-pad.l-pad.r, cH=H-pad.t-pad.b;
    const max=Math.max(...values,goalLine||0,1);
    const slot=cW/values.length, bw=slot*.55;
    ctx.clearRect(0,0,W,H);
    // Grid lines
    ctx.fillStyle='#CBD5E1'; ctx.font='9px -apple-system,sans-serif'; ctx.textAlign='right';
    [0,.5,1].forEach(p=>{
      const y=pad.t+cH*(1-p);
      ctx.fillText(Math.round(max*p),pad.l-3,y+3);
      ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);
      ctx.strokeStyle='#F1F5F9';ctx.lineWidth=1;ctx.stroke();
    });
    if(goalLine){
      const gy=pad.t+cH*(1-goalLine/max);
      ctx.beginPath();ctx.setLineDash([4,4]);
      ctx.moveTo(pad.l,gy);ctx.lineTo(W-pad.r,gy);
      ctx.strokeStyle='#CBD5E1';ctx.lineWidth=1.5;ctx.stroke();ctx.setLineDash([]);
    }
    values.forEach((v,i)=>{
      const bh=Math.max(cH*v/max,v>0?3:0);
      const x=pad.l+slot*i+(slot-bw)/2, y=pad.t+cH-bh;
      ctx.fillStyle=color+'CC';
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(x,y,bw,bh,[3,3,0,0]); else ctx.rect(x,y,bw,bh);
      ctx.fill();
      ctx.fillStyle='#94A3B8';ctx.font='9px -apple-system,sans-serif';ctx.textAlign='center';
      ctx.fillText(labels[i],pad.l+slot*i+slot/2,H-6);
    });
  },

  line(canvas, entries, color, goalLine=null) {
    // entries: [{date, kg}] - sparse data points over time
    if (!entries.length) return;
    const dpr=window.devicePixelRatio||1;
    const rect=canvas.parentElement.getBoundingClientRect();
    const W=rect.width||300, H=160;
    canvas.width=W*dpr; canvas.height=H*dpr;
    canvas.style.width=W+'px'; canvas.style.height=H+'px';
    const ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr);
    const pad={t:10,r:10,b:24,l:36};
    const cW=W-pad.l-pad.r, cH=H-pad.t-pad.b;

    const vals = entries.map(e=>e.kg);
    const minV = Math.min(...vals, goalLine||Infinity) * .98;
    const maxV = Math.max(...vals, goalLine||0) * 1.02;
    const range = maxV - minV || 1;

    const toX = (i) => pad.l + (i/(entries.length-1||1))*cW;
    const toY = (v) => pad.t + cH - (cH*(v-minV)/range);

    ctx.clearRect(0,0,W,H);

    // Y axis labels
    ctx.fillStyle='#CBD5E1'; ctx.font='9px -apple-system,sans-serif'; ctx.textAlign='right';
    [minV, (minV+maxV)/2, maxV].forEach(v=>{
      const y=toY(v);
      ctx.fillText(v.toFixed(1),pad.l-3,y+3);
      ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);
      ctx.strokeStyle='#F1F5F9';ctx.lineWidth=1;ctx.stroke();
    });

    // Goal line
    if(goalLine && goalLine>minV && goalLine<maxV){
      const gy=toY(goalLine);
      ctx.beginPath();ctx.setLineDash([4,4]);
      ctx.moveTo(pad.l,gy);ctx.lineTo(W-pad.r,gy);
      ctx.strokeStyle=color+'88';ctx.lineWidth=1.5;ctx.stroke();ctx.setLineDash([]);
    }

    // Line
    ctx.beginPath();
    entries.forEach((e,i)=>{ i===0?ctx.moveTo(toX(i),toY(e.kg)):ctx.lineTo(toX(i),toY(e.kg)); });
    ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.stroke();

    // Dots + labels
    entries.forEach((e,i)=>{
      const x=toX(i),y=toY(e.kg);
      ctx.beginPath();ctx.arc(x,y,4,0,2*Math.PI);
      ctx.fillStyle=color;ctx.fill();
      ctx.beginPath();ctx.arc(x,y,2.5,0,2*Math.PI);
      ctx.fillStyle='white';ctx.fill();
      // X label (day/month)
      if(i===0||i===entries.length-1||(entries.length<=10)||i%Math.ceil(entries.length/6)===0){
        const d=new Date(e.date+'T12:00:00');
        ctx.fillStyle='#94A3B8';ctx.font='9px -apple-system,sans-serif';ctx.textAlign='center';
        ctx.fillText(`${d.getDate()}/${d.getMonth()+1}`,x,H-6);
      }
    });
  }
};

// ================================================================
// TOAST
// ================================================================
function toast(msg, type='info') {
  const c=document.getElementById('toast-container');
  const el=document.createElement('div');
  el.className=`toast toast-${type}`; el.textContent=msg;
  c.appendChild(el);
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('visible')));
  setTimeout(()=>{ el.classList.remove('visible'); setTimeout(()=>el.remove(),300); },2800);
}

/** Toast with an "Undo" button. Calls onUndo() if user clicks within 5s. */
function toastUndo(msg, onUndo, type = 'info') {
  const c = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type} toast-undo`;
  const text = document.createElement('span'); text.textContent = msg; el.appendChild(text);
  const btn = document.createElement('button');
  btn.className = 'toast-undo-btn'; btn.textContent = 'Deshacer';
  el.appendChild(btn);
  c.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('visible')));
  let consumed = false;
  const dismiss = () => {
    if (consumed) return;
    consumed = true;
    el.classList.remove('visible');
    setTimeout(() => el.remove(), 300);
  };
  btn.addEventListener('click', () => {
    if (consumed) return;
    consumed = true;
    try { onUndo(); } finally { dismiss(); }
  });
  setTimeout(dismiss, 5000);
}

// ================================================================
// APP
// ================================================================
const App = {
  view: 'dashboard',
  searchTimer: null,
  editTaskId: null,
  pendingFood: null,
  pendingFoodUnitSize: null,   // grams per 1 unit; null = gram mode
  pendingFoodUnitMode: false,  // true when showing portion presets
  foodQueue: [],               // items staged for bulk-add
  commonFoodsOpen: false,
  pendingRecipe: null,
  editRecipeId: null,
  deferredInstall: null,
  recipesOpen: false,
  selectedActivity: null,
  planCurrentDate: null,
  planPickerSlot: null,
  wellnessMood: null,
  wellnessEnergy: 3,

  // ── streaks render ────────────────────────────────────────
  renderStreaks() {
    const st = calcStreaks();
    const chips = [
      { key:'water',    chipId:'streak-water',  valId:'streak-water-val',  bestId:'streak-water-best'  },
      { key:'calories', chipId:'streak-cal',    valId:'streak-cal-val',    bestId:'streak-cal-best'    },
      { key:'tasks',    chipId:'streak-tasks',  valId:'streak-tasks-val',  bestId:'streak-tasks-best'  },
      { key:'exercise', chipId:'streak-ex',     valId:'streak-ex-val',     bestId:'streak-ex-best'     },
    ];
    const MILESTONES = [3,7,14,30,60,100];
    chips.forEach(({ key, chipId, valId, bestId }) => {
      const s = st[key];
      const chip = document.getElementById(chipId);
      const valEl = document.getElementById(valId);
      const bestEl = document.getElementById(bestId);
      if (!chip) return;
      valEl.textContent = s.current;
      chip.classList.toggle('on-fire', s.current > 0);
      chip.classList.toggle('today-ok', s.todayOk);
      // Best record label
      bestEl.textContent = s.best > 1 ? `Récord: ${s.best}` : '';
      // Milestone badge — show next goal
      let milestoneEl = chip.querySelector('.streak-milestone');
      const next = MILESTONES.find(m => m > s.current);
      if (next && s.current > 0) {
        if (!milestoneEl) { milestoneEl = document.createElement('div'); milestoneEl.className='streak-milestone'; chip.appendChild(milestoneEl); }
        milestoneEl.textContent = `→ ${next}🔥`;
      } else if (milestoneEl) milestoneEl.remove();
    });

    // Toast en milestones exactos
    const milestoneHit = [3,7,14,30,60,100];
    ['water','calories','tasks','exercise'].forEach(k => {
      const n = st[k].current;
      if (milestoneHit.includes(n) && st[k].todayOk) {
        const labels = {water:'agua 💧',calories:'calorías 🍽️',tasks:'tareas ✅',exercise:'ejercicio 🔥'};
        toast(`¡${n} días seguidos de ${labels[k]}!`, 'success');
      }
    });
  },

  // ── init ──────────────────────────────────────────────────
  async init() {
    this.registerSW();
    DB.migrateEntryIds(); // stamp ids on legacy entries (one-time, no-op after)
    DB.migrateLiftLog();  // seed gym history from legacy single-value lifts (one-time)
    DarkMode.init();
    this.bindNav();
    this.bindInstall();
    this.bindSettings();
    this.bindTaskModal();
    this.bindFoodModal();
    this.bindDiaryDate();
    this.bindLiftModal();
    this.bindRecipeModal();
    this.bindWeightModal();
    this.bindWater();
    this.bindMicroDays();
    this.bindExerciseModal();
    this.bindPlanModal();
    this.bindWellnessModal();
    this.bindPrepModal();
    this.bindFasting();
    this.bindSupplModal();
    this.bindFoodPhoto();
    this.bindCycleModal();

    // Web share
    document.getElementById('btn-share-progress')?.addEventListener('click', () => this.shareProgress());

    await Notif.init();
    Hydration.start();
    MealReminder.start();
    this.bindPantryModal();

    // Overdue task reminders
    this.bindOverdueBanner();
    setTimeout(() => this.checkOverdueTasks(), 1500); // after first render
    setInterval(() => this.checkOverdueTasks(), 60_000); // every minute
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      this.checkOverdueTasks();
      // setTimeout/setInterval freeze while the PWA is backgrounded on mobile;
      // re-arm all notification schedules whenever we come back to foreground
      Notif.scheduleAll();
      Hydration.start();
      MealReminder.start();
    });

    // Sync button (works with both CloudSync and MCPSync)
    document.getElementById('btn-sync').addEventListener('click', async () => {
      toast('Sincronizando...', 'info');
      const ok = CloudSync.userId
        ? await CloudSync.syncFull()
        : await MCPSync.push();
      toast(ok ? 'Sincronizado ✓' : 'Error al sincronizar', ok ? 'success' : 'error');
      if (ok) this.renderView();
    });

    // Auto-push when page goes to background
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') CloudSync.push().catch(() => {});
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', e => {
        if (e.data?.type === 'NAVIGATE')  this.navigate(e.data.view || 'dashboard');
        if (e.data?.type === 'BG_SYNC')   CloudSync.push().catch(() => {});
      });
    }

    // ── Auth flow ──────────────────────────────────────────────
    const authStatus = CloudSync.init();

    if (authStatus === 'online') {
      this._bindLoginScreen();

      // If there's a cached user from a previous session, render the dashboard
      // immediately with local data while the auth check is in progress.
      // This eliminates the blank-screen delay while getSession() is awaited.
      const cachedUser = CloudSync._loadCachedUser();
      if (cachedUser) {
        this.updateHeaderUser(cachedUser);
        document.getElementById('btn-sync').style.display = '';
        this.navigate(location.hash.replace('#', '') || 'dashboard');
      }

      // Listen for OAuth redirect / sign-out events
      CloudSync.sb.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN'  && session) await this.onCloudSignIn(session);
        if (event === 'SIGNED_OUT')             this.onCloudSignOut();
      });
      const session = await CloudSync.getSession();
      if (session) {
        await this.onCloudSignIn(session);
      } else if (localStorage.getItem('lt_skip_auth')) {
        // User previously chose to use the app without an account — respect that
        this.navigate(location.hash.replace('#', '') || 'dashboard');
      } else {
        this.showLoginScreen();
      }
    } else if (authStatus === 'offline-cached') {
      // Previously signed in, now offline — use local data
      const u = CloudSync._loadCachedUser();
      if (u) this.updateHeaderUser(u);
      document.getElementById('btn-sync').style.display = '';
      this.navigate(location.hash.replace('#', '') || 'dashboard');
    } else {
      // No Supabase config — fall back to MCP local server mode
      if (DB.settings().mcpUrl) document.getElementById('btn-sync').style.display = '';
      this.navigate(location.hash.replace('#', '') || 'dashboard');
    }
  },

  // ── Auth helpers ─────────────────────────────────────────────
  _bindLoginScreen() {
    document.getElementById('btn-google-signin').addEventListener('click', async () => {
      document.getElementById('btn-google-signin').textContent = 'Conectando…';
      try { await CloudSync.signInWithGoogle(); }
      catch { toast('Error al conectar con Google', 'error'); }
    });
    document.getElementById('btn-skip-auth').addEventListener('click', () => {
      localStorage.setItem('lt_skip_auth', '1');
      this.hideLoginScreen();
      this.navigate(location.hash.replace('#', '') || 'dashboard');
    });
  },

  async onCloudSignIn(session) {
    // Guard: Supabase can fire both onAuthStateChange(SIGNED_IN) AND the
    // explicit getSession() path for the same session, causing this function
    // to run twice concurrently. Skip the second invocation.
    if (this._signInBusy) return;
    this._signInBusy = true;

    try {
      CloudSync.userId = session.user.id;
      const meta = session.user.user_metadata || {};
      const u = {
        id:     session.user.id,
        email:  session.user.email,
        name:   meta.full_name || meta.name || session.user.email?.split('@')[0] || 'Usuario',
        avatar: meta.avatar_url || meta.picture || null
      };
      CloudSync.user = u;
      CloudSync._saveUser(u);

      // Seed name from Google profile if still default
      const s = DB.settings();
      if (!s.name || s.name === 'Usuario') DB.saveSettings({ ...s, name: u.name });

      this.updateHeaderUser(u);
      this.hideLoginScreen();
      document.getElementById('btn-sync').style.display = '';

      // Show account section in settings
      document.getElementById('settings-account-section').style.display = '';
      document.getElementById('settings-user-name').textContent  = u.name;
      document.getElementById('settings-user-email').textContent = u.email;
      if (u.avatar) {
        document.getElementById('settings-avatar').innerHTML =
          `<img src="${u.avatar}" style="width:36px;height:36px;border-radius:50%;object-fit:cover">`;
      }

      // ── Render immediately with local cached data so the user sees
      //    the dashboard right away, without waiting for the network sync.
      this.navigate(location.hash.replace('#', '') || 'dashboard');

      // ── Sync in the background, then silently refresh the view.
      toast('Sincronizando...', 'info');
      const ok = await CloudSync.syncFull();
      if (ok) {
        this.renderView();          // refresh with fresh cloud data
        toast(`¡Hola, ${u.name}! ✓`, 'success');
      }
    } finally {
      this._signInBusy = false;
    }
  },

  onCloudSignOut() {
    localStorage.removeItem('lt_skip_auth'); // reset so login screen shows after explicit sign-out
    this.updateHeaderUser(null);
    document.getElementById('settings-account-section').style.display = 'none';
    document.getElementById('btn-sync').style.display = 'none';
    // Show the connect section if settings modal is open
    const hasCloud = !!(window.SUPABASE_CONFIG?.url && !window.SUPABASE_CONFIG.url.startsWith('YOUR_'));
    const connectSec = document.getElementById('settings-connect-section');
    if (connectSec) connectSec.style.display = hasCloud ? '' : 'none';
    this.showLoginScreen();
  },

  updateHeaderUser(u) {
    const el = document.getElementById('header-user');
    if (!el) return;
    if (!u) { el.style.display = 'none'; el.innerHTML = ''; return; }
    el.style.display = '';
    el.innerHTML = u.avatar
      ? `<img src="${u.avatar}" class="header-avatar" alt="${esc(u.name)}">`
      : `<div class="header-avatar-init">${esc(u.name.charAt(0).toUpperCase())}</div>`;
    el.onclick = () => this.openSettings();
  },

  showLoginScreen() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
  },

  hideLoginScreen() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
  },

  registerSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./sw.js').then(reg => {
      // When a new SW version is found, notify the user instead of force-reloading
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        if (!newSW) return;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            // Show a non-intrusive update banner instead of force-reloading mid-session
            this._showUpdateBanner(newSW);
          }
        });
      });
      // Check for update on every page load (silent, no auto-reload)
      reg.update().catch(() => {});
    }).catch(() => {});
  },

  _showUpdateBanner(newSW) {
    // Avoid duplicates
    if (document.getElementById('sw-update-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'sw-update-banner';
    banner.innerHTML = `
      <span>🔄 Nueva versión disponible</span>
      <button id="btn-sw-update" style="margin-left:12px;padding:4px 12px;border-radius:20px;border:none;background:white;color:#6366f1;font-weight:700;cursor:pointer;font-size:13px">Actualizar</button>`;
    banner.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#6366f1;color:white;padding:10px 16px;border-radius:24px;font-size:13px;font-weight:600;z-index:9999;display:flex;align-items:center;box-shadow:0 4px 20px rgba(0,0,0,.25);white-space:nowrap';
    document.body.appendChild(banner);
    document.getElementById('btn-sw-update').addEventListener('click', () => {
      newSW.postMessage({ type: 'SKIP_WAITING' });
      // Reload once the new SW takes control
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) { refreshing = true; location.reload(); }
      });
    });
  },

  bindNav() {
    document.querySelectorAll('.nav-item').forEach(btn=>{
      btn.addEventListener('click',()=>this.navigate(btn.dataset.view));
    });
  },

  navigate(viewSpec) {
    // viewSpec can be "tasks" or "tasks?new=1"
    let viewId = viewSpec || 'dashboard';
    let query  = '';
    const qIdx = viewId.indexOf('?');
    if (qIdx >= 0) { query = viewId.slice(qIdx + 1); viewId = viewId.slice(0, qIdx); }

    const valid = ['dashboard','tasks','food','progress','history'];
    if (!valid.includes(viewId)) viewId = 'dashboard';
    this.view = viewId;
    // Retro-logging: the Food diary may target a past date; every other view is "today".
    DB.setLogDate(viewId === 'food' ? this._foodDate : null);
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
    document.getElementById(`view-${viewId}`)?.classList.add('active');
    document.querySelector(`.nav-item[data-view="${viewId}"]`)?.classList.add('active');
    const titles={dashboard:'Inicio',tasks:'Mis Tareas',food:'Comidas',progress:'Progreso',history:'Historial'};
    document.getElementById('view-title').textContent=titles[viewId];
    this.renderView();
    if (query) setTimeout(() => this._dispatchShortcutAction(viewId, new URLSearchParams(query)), 80);
  },

  _dispatchShortcutAction(viewId, params) {
    // Clear hash params so refresh doesn't re-trigger
    history.replaceState(null, '', '#' + viewId);
    if (viewId === 'tasks' && params.get('new') === '1') {
      this.openTaskModal();
    } else if (viewId === 'food' && params.get('scan') === '1') {
      this.openBarcodeScanner();
    } else if (viewId === 'food' && params.get('focus') === '1') {
      document.getElementById('food-search')?.focus();
    } else if (viewId === 'progress' && params.get('weight') === '1') {
      document.getElementById('btn-log-weight')?.click();
    } else if (params.get('add')) {
      // Water shortcut: ?add=250 → log water + redirect to dashboard
      const ml = parseInt(params.get('add'));
      if (ml > 0) {
        DB.addWater(ml);
        toast(`+${ml} ml de agua añadidos`, 'success');
        this.navigate('dashboard');
      }
    }
  },

  renderView() {
    const renders={
      dashboard:()=>this.renderDashboard(),
      tasks:()=>this.renderTasks(),
      food:()=>this.renderFood(),
      progress:()=>this.renderProgress(),
      history:()=>this.renderHistory()
    };
    renders[this.view]?.();
  },

  openModal(id)  { document.getElementById(id).classList.add('open'); },
  closeModal(id) { document.getElementById(id).classList.remove('open'); },

  // ── Install ────────────────────────────────────────────────
  bindInstall() {
    window.addEventListener('beforeinstallprompt',e=>{
      e.preventDefault(); this.deferredInstall=e;
      document.getElementById('install-banner').classList.remove('hidden');
    });
    document.getElementById('btn-install')?.addEventListener('click',async()=>{
      if(!this.deferredInstall) return;
      this.deferredInstall.prompt();
      const {outcome}=await this.deferredInstall.userChoice;
      if(outcome==='accepted') document.getElementById('install-banner').classList.add('hidden');
      this.deferredInstall=null;
    });
    window.addEventListener('appinstalled',()=>document.getElementById('install-banner').classList.add('hidden'));
  },

  // ================================================================
  // SETTINGS
  // ================================================================
  bindSettings() {
    document.getElementById('btn-settings').addEventListener('click',()=>this.openSettings());
    document.getElementById('modal-settings').addEventListener('click',e=>{if(e.target===e.currentTarget)this.closeSettings();});
    document.getElementById('btn-close-settings').addEventListener('click',()=>this.closeSettings());
    document.getElementById('btn-save-settings').addEventListener('click',()=>this.saveSettings());
    document.getElementById('btn-notif-request').addEventListener('click',async()=>{
      await Notification.requestPermission(); this.updateNotifBadge();
    });
    document.getElementById('btn-test-mcp').addEventListener('click',async()=>{
      const url=document.getElementById('setting-mcp-url').value.trim().replace(/\/$/,'');
      if(!url){toast('Ingresa la URL del servidor','error');return;}
      toast('Probando conexión...','info');
      const ok=await MCPSync.test(url);
      toast(ok?'Conexión exitosa ✓':'No se pudo conectar','success');
    });
    document.getElementById('btn-sign-out')?.addEventListener('click', async () => {
      if (!confirm('¿Cerrar sesión de Google?')) return;
      await CloudSync.signOut();
    });
    document.getElementById('btn-connect-google')?.addEventListener('click', () => {
      localStorage.removeItem('lt_skip_auth');
      this.closeSettings();
      this.showLoginScreen();
    });
    // Live TDEE preview when any body-param or cutting style changes
    const _readSettingsForm = () => ({
      age:          parseInt(document.getElementById('setting-age').value)||null,
      height:       parseInt(document.getElementById('setting-height').value)||null,
      gender:       document.getElementById('setting-gender').value,
      activityLevel:document.getElementById('setting-activity').value,
      calorieGoal:  parseInt(document.getElementById('setting-goal').value)||2000,
      cuttingStyle: document.getElementById('setting-cutting-style').value,
      neck:  parseFloat(document.getElementById('setting-neck')?.value)||null,
      waist: parseFloat(document.getElementById('setting-waist')?.value)||null,
      hip:   parseFloat(document.getElementById('setting-hip')?.value)||null,
    });
    ['setting-age','setting-height','setting-gender','setting-activity','setting-cutting-style'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        const tmp = _readSettingsForm();
        this._updateTDEEPreview(tmp);
        this._updateBodyFatPreview('bodyfat-preview-settings', tmp);
        if (tmp.cuttingStyle !== 'custom') {
          const tdee = this._calcTDEE(tmp);
          const computed = this._calcGoalFromStyle(tdee, tmp.cuttingStyle);
          if (computed) document.getElementById('setting-goal').value = computed;
        }
      });
    });
    // Live body fat update from measurement inputs
    ['setting-neck','setting-waist','setting-hip'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () =>
        this._updateBodyFatPreview('bodyfat-preview-settings', _readSettingsForm())
      );
    });
    // Hydration toggle reveals config
    document.getElementById('setting-hydration-enabled')?.addEventListener('change', e => {
      document.getElementById('hydration-config').style.display = e.target.checked ? '' : 'none';
    });
    // Meal reminder toggle reveals time picker
    document.getElementById('setting-meal-reminder-enabled')?.addEventListener('change', e => {
      const cfg = document.getElementById('meal-reminder-config');
      if (cfg) cfg.style.display = e.target.checked ? '' : 'none';
    });

    // Macros: auto toggle + live preview
    const macrosAuto = document.getElementById('setting-macros-auto');
    macrosAuto?.addEventListener('change', e => {
      document.getElementById('macros-manual').style.display = e.target.checked ? 'none' : '';
      const tmp = _readSettingsForm();
      tmp.macrosAuto = e.target.checked;
      tmp.calorieGoal = parseInt(document.getElementById('setting-goal').value) || 2000;
      this._updateMacrosPreview(tmp);
    });
    ['setting-goal','setting-cutting-style','setting-protein-goal','setting-carbs-goal','setting-fat-goal'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => {
        const tmp = _readSettingsForm();
        tmp.macrosAuto = macrosAuto?.checked !== false;
        tmp.calorieGoal = parseInt(document.getElementById('setting-goal').value) || 2000;
        tmp.proteinGoal = parseInt(document.getElementById('setting-protein-goal').value) || null;
        tmp.carbsGoal   = parseInt(document.getElementById('setting-carbs-goal').value)   || null;
        tmp.fatGoal     = parseInt(document.getElementById('setting-fat-goal').value)     || null;
        this._updateMacrosPreview(tmp);
      });
    });
    // Dark mode toggle (header button + settings toggle)
    document.getElementById('btn-dark-mode')?.addEventListener('click', () => DarkMode.toggle());
    document.getElementById('setting-dark-mode')?.addEventListener('change', () => DarkMode.toggle());

    // Export buttons
    document.getElementById('btn-export-json')?.addEventListener('click', () => this.exportJSON());
    document.getElementById('btn-export-csv')?.addEventListener('click',  () => this.exportCSV());

    // Measures section collapse toggle
    document.getElementById('btn-toggle-measures')?.addEventListener('click', () => {
      const sec = document.getElementById('section-measures');
      const btn = document.getElementById('btn-toggle-measures');
      const open = sec.style.display === '';
      sec.style.display = open ? 'none' : '';
      btn.textContent = open ? '▼' : '▲';
      btn.setAttribute('aria-expanded', String(!open));
    });
  },

  openSettings() {
    const s=DB.settings();
    // Refresh account section
    const u = CloudSync.user || CloudSync._loadCachedUser();
    const acctSec    = document.getElementById('settings-account-section');
    const connectSec = document.getElementById('settings-connect-section');
    // Show connect section when not signed in (Supabase available), account section when signed in
    const hasCloud = !!(window.SUPABASE_CONFIG?.url && !window.SUPABASE_CONFIG.url.startsWith('YOUR_'));
    if (connectSec) connectSec.style.display = (!u && hasCloud) ? '' : 'none';
    if (acctSec) acctSec.style.display = u ? '' : 'none';
    if (u && acctSec) {
      document.getElementById('settings-user-name').textContent  = u.name  || '—';
      document.getElementById('settings-user-email').textContent = u.email || '—';
      if (u.avatar) {
        document.getElementById('settings-avatar').innerHTML =
          `<img src="${u.avatar}" style="width:36px;height:36px;border-radius:50%;object-fit:cover">`;
      }
    }
    document.getElementById('setting-name').value=s.name||'';
    document.getElementById('setting-age').value=s.age||'';
    document.getElementById('setting-height').value=s.height||'';
    document.getElementById('setting-gender').value=s.gender||'male';
    document.getElementById('setting-activity').value=s.activityLevel||'moderate';
    document.getElementById('setting-goal').value=s.calorieGoal||2000;
    document.getElementById('setting-water-goal').value=s.waterGoal||2500;
    document.getElementById('setting-weight-goal').value=s.weightGoal||'';
    document.getElementById('setting-mcp-url').value=s.mcpUrl||'';
    const mcpTokenEl=document.getElementById('setting-mcp-token'); if(mcpTokenEl) mcpTokenEl.value=s.mcpToken||'';
    document.getElementById('setting-cutting-style').value=s.cuttingStyle||'custom';
    // Measurements
    const _sv = (id, v) => { const el=document.getElementById(id); if(el) el.value=v||''; };
    _sv('setting-neck', s.neck); _sv('setting-waist', s.waist); _sv('setting-hip', s.hip);
    _sv('setting-chest', s.chest); _sv('setting-arm', s.arm); _sv('setting-thigh', s.thigh); _sv('setting-calf', s.calf);
    // Auto-open measures section if any measurement is already set
    if (s.neck || s.waist || s.hip || s.chest || s.arm || s.thigh || s.calf) {
      document.getElementById('section-measures').style.display = '';
      document.getElementById('btn-toggle-measures').setAttribute('aria-expanded','true');
      document.getElementById('btn-toggle-measures').textContent = '▲';
    }
    this._updateTDEEPreview(s);
    this._updateBodyFatPreview('bodyfat-preview-settings', s);

    // Hydration reminders
    const hyEn = document.getElementById('setting-hydration-enabled');
    if (hyEn) {
      hyEn.checked = !!s.hydrationEnabled;
      document.getElementById('hydration-config').style.display = s.hydrationEnabled ? '' : 'none';
      document.getElementById('setting-hydration-start').value    = s.hydrationStart ?? 8;
      document.getElementById('setting-hydration-end').value      = s.hydrationEnd   ?? 22;
      document.getElementById('setting-hydration-interval').value = s.hydrationIntervalMin || 120;
    }

    // Meal reminder
    const mrEn = document.getElementById('setting-meal-reminder-enabled');
    if (mrEn) {
      mrEn.checked = !!s.mealReminderEnabled;
      const mrCfg = document.getElementById('meal-reminder-config');
      if (mrCfg) mrCfg.style.display = s.mealReminderEnabled ? '' : 'none';
      const mrTime = document.getElementById('setting-meal-reminder-time');
      if (mrTime) mrTime.value = s.mealReminderTime || '13:00';
    }

    // Macros — auto/manual + values
    const autoEl = document.getElementById('setting-macros-auto');
    const manualEl = document.getElementById('macros-manual');
    const previewEl = document.getElementById('macros-preview');
    if (autoEl) {
      const isAuto = s.macrosAuto !== false;
      autoEl.checked = isAuto;
      manualEl.style.display = isAuto ? 'none' : '';
      _sv('setting-protein-goal', s.proteinGoal);
      _sv('setting-carbs-goal', s.carbsGoal);
      _sv('setting-fat-goal', s.fatGoal);
      this._updateMacrosPreview(s);
    }

    // Dark mode
    const dmToggle = document.getElementById('setting-dark-mode');
    if (dmToggle) dmToggle.checked = DarkMode.isDark();

    this.updateNotifBadge();
    this.openModal('modal-settings');
  },

  _updateMacrosPreview(s) {
    const el = document.getElementById('macros-preview');
    if (!el) return;
    const kcal = s.calorieGoal || 2000;
    const auto = s.macrosAuto !== false;
    const t = auto ? this._calcMacroTargets(s, kcal) : { prot: s.proteinGoal, carbs: s.carbsGoal, fat: s.fatGoal };
    el.style.display = '';
    if (!t.prot || !t.carbs || !t.fat) {
      el.textContent = auto
        ? 'Registra tu peso para calcular metas automáticas'
        : 'Define gramos de cada macro';
      return;
    }
    const kcalSum = t.prot*4 + t.carbs*4 + t.fat*9;
    el.innerHTML = `🎯 <strong>P:${t.prot}g</strong> · <strong>C:${t.carbs}g</strong> · <strong>G:${t.fat}g</strong> ≈ ${kcalSum} kcal`;
  },

  closeSettings() { this.closeModal('modal-settings'); },

  // ── helpers TDEE / cutting ────────────────────────────────
  _calcTDEE(s) {
    if (!s.height || !s.age) return null;
    const w = DB.weightLog(); const kg = w.length ? w[w.length-1].kg : 70;
    const bmr = s.gender==='female'
      ? 10*kg + 6.25*s.height - 5*s.age - 161
      : 10*kg + 6.25*s.height - 5*s.age + 5;
    const mult = {sedentary:1.2,light:1.375,moderate:1.55,active:1.725,very_active:1.9};
    return Math.round(bmr * (mult[s.activityLevel||'moderate']||1.55));
  },
  _calcGoalFromStyle(tdee, style) {
    const cs = CUTTING_STYLES.find(c=>c.id===style);
    if (!cs || cs.factor===null || !tdee) return null;
    return Math.round(tdee * (1 + cs.factor));
  },

  /** Compute auto macro targets in grams. Returns {prot, carbs, fat} or nulls. */
  _calcMacroTargets(s, kcalGoal) {
    const wLog = DB.weightLog();
    const weight = wLog.length ? wLog[wLog.length - 1].kg : null;
    if (!weight || !kcalGoal) return { prot: null, carbs: null, fat: null };

    const style = s?.cuttingStyle || 'custom';
    // Protein/fat g per kg of bodyweight depending on phase
    let protPerKg, fatPerKg;
    if (style === 'aggressive_cut') { protPerKg = 2.4; fatPerKg = 0.8; }
    else if (style === 'moderate_cut') { protPerKg = 2.2; fatPerKg = 0.9; }
    else if (style === 'lean_bulk' || style === 'bulk') { protPerKg = 1.8; fatPerKg = 1.0; }
    else { protPerKg = 2.0; fatPerKg = 0.9; } // maintenance / custom

    const prot = Math.round(weight * protPerKg);
    const fat  = Math.round(weight * fatPerKg);
    const remainingKcal = kcalGoal - (prot * 4) - (fat * 9);
    const carbs = Math.max(50, Math.round(remainingKcal / 4));
    return { prot, carbs, fat };
  },
  _updateTDEEPreview(s) {
    const el = document.getElementById('tdee-preview');
    if (!el) return;
    const tdee = this._calcTDEE(s);
    const style = s.cuttingStyle || 'custom';
    if (!tdee) { el.textContent = 'Añade edad y altura para calcular el TDEE'; el.style.color='var(--text-muted)'; return; }
    const cs = CUTTING_STYLES.find(c=>c.id===style);
    const target = style==='custom' ? (s.calorieGoal||2000) : this._calcGoalFromStyle(tdee, style);
    el.innerHTML = `TDEE: <strong>${tdee}</strong> kcal → <strong style="color:var(--primary)">${target}</strong> kcal${cs&&cs.factor!==null?' ('+cs.desc+')':''}`;
    el.style.color='var(--text-muted)';
  },

  // ── Body fat (US Navy Method) ─────────────────────────────
  _calcBodyFat(s) {
    const h = parseFloat(s.height), neck = parseFloat(s.neck), waist = parseFloat(s.waist);
    if (!h || !neck || !waist || waist <= neck) return null;
    let bf;
    if (s.gender === 'female') {
      const hip = parseFloat(s.hip);
      if (!hip) return null;
      const denom = waist + hip - neck;
      if (denom <= 0) return null;
      bf = 495 / (1.29579 - 0.35004 * Math.log10(denom) + 0.22100 * Math.log10(h)) - 450;
    } else {
      bf = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(h)) - 450;
    }
    return isNaN(bf) ? null : Math.max(2, Math.min(60, Math.round(bf * 10) / 10));
  },

  _bodyFatCategory(bf, gender) {
    if (bf == null) return null;
    const cats = gender === 'female'
      ? [ [14,'Atlética','#6366f1'], [21,'En forma','#10b981'], [25,'Aceptable','#f59e0b'], [32,'Alta','#f97316'], [Infinity,'Muy alta','#ef4444'] ]
      : [ [6,'Esencial','#6366f1'], [14,'Atlético','#10b981'], [18,'En forma','#10b981'], [25,'Aceptable','#f59e0b'], [32,'Alta','#f97316'], [Infinity,'Muy alta','#ef4444'] ];
    const cat = cats.find(([limit]) => bf < limit);
    return cat ? { label: cat[1], color: cat[2] } : null;
  },

  _updateBodyFatPreview(elId, s) {
    const el = document.getElementById(elId);
    if (!el) return;
    const bf  = this._calcBodyFat(s);
    if (bf == null) {
      const need = s.gender === 'female' ? 'cuello, cintura y cadera' : 'cuello y cintura';
      el.innerHTML = `<span style="color:var(--text-muted);font-size:13px">Añade ${need} para estimar tu % grasa (Método Navy)</span>`;
      return;
    }
    const cat  = this._bodyFatCategory(bf, s.gender);
    const lastW = DB.weightLog().slice(-1)[0];
    const kg = lastW?.kg || parseFloat(s.weight) || null;
    const fatKg  = kg ? +(kg * bf / 100).toFixed(1) : null;
    const leanKg = kg && fatKg ? +(kg - fatKg).toFixed(1) : null;
    el.innerHTML = `
      <div class="bodyfat-result">
        <span class="bodyfat-pct">${bf}%</span>
        <span class="bodyfat-cat" style="background:${cat?.color}20;color:${cat?.color};border-color:${cat?.color}40">${cat?.label || ''}</span>
      </div>
      ${fatKg != null ? `<div class="bodyfat-detail">Masa grasa: <strong>${fatKg} kg</strong> · Masa magra: <strong>${leanKg} kg</strong></div>` : ''}
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Fórmula US Navy · estimación</div>`;
  },

  saveSettings() {
    const style = document.getElementById('setting-cutting-style').value;
    const _f = id => parseFloat(document.getElementById(id)?.value) || null;
    const rawS = {
      name: document.getElementById('setting-name').value.trim()||'Usuario',
      age:  parseInt(document.getElementById('setting-age').value)||null,
      height: parseInt(document.getElementById('setting-height').value)||null,
      gender: document.getElementById('setting-gender').value,
      activityLevel: document.getElementById('setting-activity').value,
      calorieGoal: parseInt(document.getElementById('setting-goal').value)||2000,
      waterGoal: parseInt(document.getElementById('setting-water-goal').value)||2500,
      weightGoal: parseFloat(document.getElementById('setting-weight-goal').value)||null,
      mcpUrl: document.getElementById('setting-mcp-url').value.trim().replace(/\/$/,''),
      mcpToken: (document.getElementById('setting-mcp-token')?.value || '').trim(),
      cuttingStyle: style,
      // Body measurements
      neck: _f('setting-neck'), waist: _f('setting-waist'), hip: _f('setting-hip'),
      chest: _f('setting-chest'), arm: _f('setting-arm'), thigh: _f('setting-thigh'), calf: _f('setting-calf'),
      // Macro goals
      macrosAuto: document.getElementById('setting-macros-auto')?.checked !== false,
      proteinGoal: parseInt(document.getElementById('setting-protein-goal')?.value) || null,
      carbsGoal:   parseInt(document.getElementById('setting-carbs-goal')?.value)   || null,
      fatGoal:     parseInt(document.getElementById('setting-fat-goal')?.value)     || null,
      // Hydration
      hydrationEnabled:     !!document.getElementById('setting-hydration-enabled')?.checked,
      hydrationStart:       parseInt(document.getElementById('setting-hydration-start')?.value) || 8,
      hydrationEnd:         parseInt(document.getElementById('setting-hydration-end')?.value)   || 22,
      hydrationIntervalMin: parseInt(document.getElementById('setting-hydration-interval')?.value) || 120,
      mealReminderEnabled:  !!document.getElementById('setting-meal-reminder-enabled')?.checked,
      mealReminderTime:     document.getElementById('setting-meal-reminder-time')?.value || '13:00',
    };
    // Auto-compute calorieGoal when style != custom
    if (style !== 'custom') {
      const tdee = this._calcTDEE(rawS);
      const computed = this._calcGoalFromStyle(tdee, style);
      if (computed) rawS.calorieGoal = computed;
    }
    const s = rawS;
    DB.saveSettings(s);
    document.getElementById('btn-sync').style.display = s.mcpUrl ? '' : 'none';
    this.closeSettings();
    Notif.scheduleAll();
    Hydration.start();
    MealReminder.start();
    toast('Ajustes guardados','success');
    this.renderView();
  },

  updateNotifBadge() {
    const perm=('Notification' in window)?Notification.permission:'unsupported';
    const badge=document.getElementById('notif-status');
    const btn=document.getElementById('btn-notif-request');
    const map={granted:['granted','Activas ✓'],denied:['denied','Bloqueadas'],default:['default','Pendiente'],unsupported:['denied','No soportado']};
    const [cls,label]=map[perm]||map.default;
    badge.className=`notif-badge ${cls}`; badge.textContent=label;
    btn.style.display=perm==='granted'?'none':'';
  },

  // ================================================================
  // DASHBOARD
  // ================================================================
  renderDashboard() {
    const s=DB.settings(), now=new Date(), h=now.getHours();
    const greet=h<12?'Buenos días':h<19?'Buenas tardes':'Buenas noches';
    document.getElementById('dash-greeting').textContent=`${greet}, ${s.name}`;
    document.getElementById('dash-date').textContent=`${DAYS_FULL[now.getDay()]}, ${now.getDate()} de ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

    // Calories
    const food=DB.todayFood(), kcal=food.reduce((a,f)=>a+f.kcal,0);
    const burned=DB.todayExercise().reduce((a,e)=>a+e.kcalBurned,0);
    const netGoal=s.calorieGoal+burned;
    Charts.ring(document.getElementById('ring-kcal'),kcal,netGoal,'#f59e0b');
    document.getElementById('ring-kcal-val').textContent=kcal;
    document.getElementById('ring-kcal-sub').textContent=`/${netGoal}`;
    const rem=netGoal-kcal;
    document.getElementById('dash-kcal-detail').textContent=rem>0?`${rem} restantes`:'Meta alcanzada 🎉';

    // Exercise mini-card en dashboard
    const exCard=document.getElementById('dash-exercise-card');
    if(burned>0){
      exCard.style.display='';
      document.getElementById('dash-exercise-label').textContent=`🔥 +${burned} kcal`;
      const sessions=DB.todayExercise();
      document.getElementById('dash-exercise-sessions').textContent=sessions.map(e=>`${e.icon} ${e.name} ${e.duration}min`).join(' · ');
    } else {
      exCard.style.display='none';
    }

    // Tasks
    const tasks=DB.tasks(), done=DB.todayDone();
    const todayTasks=tasks.filter(t=>!t.days?.length||t.days.includes(now.getDay()));
    const doneCount=todayTasks.filter(t=>done[t.id]).length;
    Charts.ring(document.getElementById('ring-tasks'),doneCount,todayTasks.length||1,'#6366f1');
    document.getElementById('ring-tasks-val').textContent=doneCount;
    document.getElementById('ring-tasks-sub').textContent=`/${todayTasks.length}`;
    document.getElementById('dash-tasks-detail').textContent=todayTasks.length?`${todayTasks.length-doneCount} pendientes`:'Sin tareas hoy';

    // Water
    const water=DB.todayWater(), wGoal=s.waterGoal||2500;
    document.getElementById('dash-water-label').textContent=`${water} / ${wGoal} ml`;
    document.getElementById('dash-water-fill').style.width=Math.min(water/wGoal*100,100)+'%';

    // Weight
    const weights=DB.weightLog(), lastW=weights[weights.length-1];
    const prevW=weights[weights.length-2];
    document.getElementById('dash-weight-val').textContent=lastW?lastW.kg.toFixed(1):'—';
    if(lastW&&prevW){
      const diff=+(lastW.kg-prevW.kg).toFixed(1);
      const el=document.getElementById('dash-weight-trend');
      el.textContent=diff>0?`▲ +${diff}kg`:diff<0?`▼ ${diff}kg`:'→ Sin cambio';
      el.style.color=diff>0?'var(--warning)':diff<0?'var(--success)':'var(--text-muted)';
    }
    const goalKg=s.weightGoal;
    document.getElementById('dash-goal-kg').textContent=goalKg?goalKg.toFixed(1)+'kg':'—';
    if(goalKg&&lastW){
      const pred=calcPrediction();
      document.getElementById('dash-goal-eta').textContent=pred?.weeksToGoal>0?`~${pred.weeksToGoal} semanas`:'';
    }

    // Next task
    const upcomingTasks=todayTasks.filter(t=>!done[t.id]&&t.notifTime)
      .map(t=>{const[hh,mm]=t.notifTime.split(':').map(Number);const d=new Date();d.setHours(hh,mm,0,0);return{task:t,time:d};})
      .filter(t=>t.time>now).sort((a,b)=>a.time-b.time);
    const card=document.getElementById('next-task-card');
    if(upcomingTasks.length){
      card.classList.remove('hidden');
      document.getElementById('next-task-time').textContent=upcomingTasks[0].task.notifTime;
      document.getElementById('next-task-name').textContent=upcomingTasks[0].task.title;
    } else card.classList.add('hidden');

    // Dashboard water quick buttons
    document.querySelectorAll('#dash-water-card .water-quick-btn').forEach(btn=>{
      btn.onclick=()=>{
        const ml=parseInt(btn.dataset.ml); DB.addWater(ml);
        toastUndo(`+${ml}ml agua 💧`, () => { DB.removeWater(ml); this.renderDashboard(); }, 'info');
        this.renderDashboard();
      };
    });
    document.getElementById('btn-dash-water-custom')?.addEventListener('click',()=>this.navigate('progress'));

    this.renderStreaks();
    this.renderWellnessDash();
    this._renderSetupCard();
    this.checkOnboarding();
    this._renderComparison();
    this._renderFasting();
  },

  /** Today vs 7-day average comparison chips */
  _renderComparison() {
    const food  = DB.foodLog();
    const water = DB.waterLog();
    const past7 = Array.from({length:7}, (_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(i+1)); return fmtDate(d); });

    // Calorie average (days with data only)
    const kcalDays = past7.filter(d=>(food[d]||[]).length>0);
    const avgKcal  = kcalDays.length
      ? Math.round(kcalDays.reduce((a,d)=>a+(food[d]||[]).reduce((s,f)=>s+f.kcal,0),0)/kcalDays.length)
      : null;
    const todayKcal = (food[today()]||[]).reduce((a,f)=>a+f.kcal,0);

    // Water average
    const waterDays = past7.filter(d=>(water[d]||0)>0);
    const avgWater  = waterDays.length
      ? Math.round(waterDays.reduce((a,d)=>a+(water[d]||0),0)/waterDays.length)
      : null;
    const todayWater = water[today()]||0;

    const _setChip = (todayId, avgId, deltaId, todayVal, avgVal, unit, lowerIsBetter=false) => {
      document.getElementById(todayId).textContent = todayVal + unit;
      document.getElementById(avgId).textContent   = avgVal != null ? `Prom. 7d: ${avgVal}${unit}` : 'Sin datos anteriores';
      const delta = document.getElementById(deltaId);
      if (avgVal == null || todayVal === 0) { delta.textContent=''; return; }
      const diff = todayVal - avgVal;
      const pct  = Math.round(Math.abs(diff) / Math.max(1, avgVal) * 100);
      if (Math.abs(diff) < 0.05 * avgVal) { delta.textContent='→ igual'; delta.className='comparison-chip-delta even'; return; }
      const positive = lowerIsBetter ? diff < 0 : diff > 0;
      delta.className = `comparison-chip-delta ${positive?'up':'down'}`;
      delta.textContent = (diff>0?'▲ +':'▼ ') + pct + '%';
    };

    _setChip('cmp-kcal-today','cmp-kcal-avg','cmp-kcal-delta', todayKcal, avgKcal, ' kcal', false);
    _setChip('cmp-water-today','cmp-water-avg','cmp-water-delta', todayWater, avgWater, ' ml', false);
  },

  /** Fasting timer card render + 1-second ticker */
  _renderFasting() {
    const s = Fasting.get();
    const timerEl  = document.getElementById('fasting-timer');
    const subEl    = document.getElementById('fasting-timer-sub');
    const barEl    = document.getElementById('fasting-bar');
    const startBtn = document.getElementById('btn-fasting-start');
    const resetBtn = document.getElementById('btn-fasting-reset');
    if (!timerEl) return;

    // Stop any previous ticker from this view render
    if (this._fastingTickId) clearInterval(this._fastingTickId);

    const targetSec = (s.target || 16) * 3600;

    const _update = () => {
      const elapsed = Fasting.elapsedSec();
      const h = Math.floor(elapsed/3600), m = Math.floor((elapsed%3600)/60), sec = elapsed%60;
      timerEl.textContent = [h,m,sec].map(n=>String(n).padStart(2,'0')).join(':');
      const pct = Math.min(elapsed/targetSec*100,100);
      barEl.style.width = pct+'%';
      if (Fasting.get().running) {
        const remaining = Math.max(0, targetSec - elapsed);
        if (remaining === 0) {
          subEl.textContent = `✅ ¡Meta ${s.target}h alcanzada!`;
        } else {
          const rh = Math.floor(remaining/3600), rm = Math.floor((remaining%3600)/60);
          subEl.textContent = `Faltan ${rh}h ${rm}m de ${s.target}h`;
        }
      } else if (s.lastDur) {
        const dh = Math.floor(s.lastDur/3600000), dm = Math.floor((s.lastDur%3600000)/60000);
        subEl.textContent = `Último ayuno: ${dh}h ${dm}m`;
      }
    };

    _update();

    if (s.running) {
      startBtn.textContent = '⏹ Detener ayuno';
      startBtn.className   = 'fasting-btn fasting-btn-stop';
      resetBtn.style.display = '';
      this._fastingTickId = setInterval(_update, 1000);
    } else {
      startBtn.textContent = '▶ Iniciar ayuno';
      startBtn.className   = 'fasting-btn fasting-btn-start';
      resetBtn.style.display = s.lastDur ? '' : 'none';
      if (!s.running && !s.start) subEl.textContent = `Inicia el temporizador (${s.target}h)`;
    }

    // Update preset active state
    document.querySelectorAll('.fasting-preset-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.h) === (s.target||16));
    });
  },

  // ================================================================
  // TASKS
  // ================================================================
  bindTaskModal() {
    document.getElementById('btn-add-task').addEventListener('click',()=>this.openTaskModal());
    document.getElementById('modal-task').addEventListener('click',e=>{if(e.target===e.currentTarget)this.closeTaskModal();});
    document.getElementById('btn-close-task').addEventListener('click',()=>this.closeTaskModal());
    document.getElementById('btn-save-task').addEventListener('click',()=>this.saveTask());
    document.querySelectorAll('.day-btn').forEach(btn=>btn.addEventListener('click',()=>btn.classList.toggle('selected')));
    document.getElementById('task-notif-toggle').addEventListener('change',e=>{
      document.getElementById('task-notif-time-wrap').style.display=e.target.checked?'':'none';
    });
  },

  renderTasks() {
    const tasks=DB.tasks(), done=DB.todayDone();
    const warn=document.getElementById('notif-warn');
    if(warn) warn.style.display=Notification.permission!=='granted'?'':'none';
    const list=document.getElementById('task-list');
    if(!tasks.length){
      list.innerHTML=`<div class="empty-state"><svg width="56" height="56" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg><p>No tienes tareas aún</p><p style="font-size:12px">Toca <strong>+</strong> para agregar</p></div>`;
      return;
    }
    const nowTime = new Date();
    const todayDow = nowTime.getDay();
    list.innerHTML=tasks.map(task=>{
      const isDone=!!done[task.id];
      const dayL=task.days?.length?task.days.map(d=>DAYS_SHORT[d]).join(' · '):'Cada día';
      // Overdue = has a time, not done, valid day, time already passed
      const validDay = !task.days?.length || task.days.includes(todayDow);
      const isOverdue = !isDone && task.notifTime && validDay && (() => {
        const [h,m]=task.notifTime.split(':').map(Number);
        const t=new Date(); t.setHours(h,m,0,0);
        return nowTime >= t;
      })();
      return `<div class="task-item ${isDone?'done':''} ${isOverdue?'task-overdue':''}" data-id="${task.id}">
        <button class="task-check ${isDone?'checked':''}" data-toggle="${task.id}">${isDone?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>':''}</button>
        <div class="task-info">
          <div class="task-name">${esc(task.title)}</div>
          <div class="task-meta">
            ${task.notifTime?`<span class="task-time" style="${isOverdue?'color:#dc2626;font-weight:700':''}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${isOverdue?'#dc2626':'currentColor'}" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${task.notifTime}</span>`:''}
            ${isOverdue?'<span class="task-overdue-badge">⏰ Atrasada</span>':''}
            <span class="task-days">${dayL}</span>
            ${task.notifEnabled&&task.notifTime&&!isOverdue?'<span class="task-notif">🔔</span>':''}
          </div>
        </div>
        <div class="task-actions">
          <button class="btn-task-action" data-edit="${task.id}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn-task-action delete" data-delete="${task.id}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
        </div>
      </div>`;
    }).join('');
    list.querySelectorAll('[data-toggle]').forEach(b=>b.addEventListener('click',()=>this.toggleTask(b.dataset.toggle)));
    list.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>this.openTaskModal(b.dataset.edit)));
    list.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>this.deleteTask(b.dataset.delete)));
  },

  toggleTask(id) {
    const done=DB.toggleDone(id);
    if(done) toast('Tarea completada ✓','success');
    this.renderTasks();
    if(this.view==='dashboard') this.renderDashboard();
    this.checkOverdueTasks();
  },

  deleteTask(id) {
    const tasks = DB.tasks();
    const task  = tasks.find(t => t.id === id);
    const index = tasks.findIndex(t => t.id === id);
    if (!task) return;
    if (!confirm('¿Eliminar esta tarea?')) return;
    DB.saveTasks(tasks.filter(t => t.id !== id));
    Notif.cancel(id);
    this.renderTasks();
    toastUndo(`Tarea eliminada: ${task.title}`, () => {
      const cur = DB.tasks();
      cur.splice(Math.min(index, cur.length), 0, task);
      DB.saveTasks(cur);
      if (task.notifEnabled) Notif.schedule(task);
      this.renderTasks();
      toast('Restaurada ✓', 'success');
    });
  },

  openTaskModal(id=null) {
    this.editTaskId=id;
    document.getElementById('modal-task-title').textContent=id?'Editar Tarea':'Nueva Tarea';
    document.getElementById('btn-save-task').textContent=id?'Guardar cambios':'Añadir tarea';
    document.getElementById('task-title').value='';
    document.getElementById('task-description').value='';
    document.getElementById('task-notif-time').value='';
    document.getElementById('task-notif-toggle').checked=false;
    document.getElementById('task-notif-time-wrap').style.display='none';
    document.querySelectorAll('.day-btn').forEach(b=>b.classList.remove('selected'));
    if(id){
      const task=DB.tasks().find(t=>t.id===id); if(!task) return;
      document.getElementById('task-title').value=task.title;
      document.getElementById('task-description').value=task.description||'';
      document.getElementById('task-notif-toggle').checked=!!task.notifEnabled;
      document.getElementById('task-notif-time-wrap').style.display=task.notifEnabled?'':'none';
      document.getElementById('task-notif-time').value=task.notifTime||'';
      (task.days||[]).forEach(d=>document.querySelector(`.day-btn[data-day="${d}"]`)?.classList.add('selected'));
    }
    this.openModal('modal-task');
    document.getElementById('task-title').focus();
  },

  closeTaskModal() { this.closeModal('modal-task'); this.editTaskId=null; },

  // ── OVERDUE TASKS REMINDER ────────────────────────────────

  /** Returns tasks with a past notifTime today that are still pending */
  _getOverdueTasks() {
    const done    = DB.todayDone();
    const now     = new Date();
    const todayDow = now.getDay();
    return DB.tasks().filter(task => {
      if (!task.notifTime) return false;
      if (done[task.id])   return false;
      if (task.days && task.days.length > 0 && !task.days.includes(todayDow)) return false;
      const [h, m] = task.notifTime.split(':').map(Number);
      const t = new Date(); t.setHours(h, m, 0, 0);
      return now >= t;
    }).sort((a, b) => a.notifTime.localeCompare(b.notifTime));
  },

  checkOverdueTasks() {
    const overdue = this._getOverdueTasks();
    const banner  = document.getElementById('overdue-banner');
    if (!banner) return;

    if (!overdue.length) { banner.style.display = 'none'; return; }

    // Suppress if user dismissed this exact set within 15 min
    const ids = overdue.map(t => t.id).sort().join(',');
    const d   = this._overdueLastDismiss;
    if (d && d.ids === ids && Date.now() - d.ts < 15 * 60 * 1000) return;

    // Populate list
    const listEl = document.getElementById('overdue-task-list');
    listEl.innerHTML = overdue.slice(0, 3).map(task => `
      <div class="overdue-task-row">
        <span class="overdue-task-time">${task.notifTime}</span>
        <span class="overdue-task-name">${esc(task.title)}</span>
        <button class="overdue-check-btn" data-overdue-done="${task.id}" title="Marcar completada">✓</button>
      </div>`).join('') +
      (overdue.length > 3
        ? `<p style="font-size:11px;color:var(--text-muted);text-align:center;padding:4px 0 2px">+${overdue.length - 3} más</p>`
        : '');

    listEl.querySelectorAll('[data-overdue-done]').forEach(btn => {
      btn.addEventListener('click', () => {
        DB.toggleDone(btn.dataset.overdueDone);
        toast('Tarea completada ✓', 'success');
        this.renderTasks();
        if (this.view === 'dashboard') this.renderDashboard();
        this.checkOverdueTasks();
      });
    });

    document.getElementById('overdue-count').textContent = overdue.length;
    banner.style.display = '';

    // Fire a native push notification once per session for missed tasks
    if (!this._missedNotifFired) {
      this._missedNotifFired = true;
      this._fireOverduePushNotif(overdue);
    }
  },

  async _fireOverduePushNotif(overdue) {
    if (Notification.permission !== 'granted') return;
    try {
      const count = overdue.length;
      const body  = count === 1
        ? `${overdue[0].title} — programada a las ${overdue[0].notifTime}`
        : overdue.slice(0, 2).map(t => `${t.notifTime} ${t.title}`).join(', ') +
          (count > 2 ? ` y ${count - 2} más` : '');
      const opts = { body, icon: './icons/icon.svg', tag: 'lt-overdue', renotify: true };
      if ('serviceWorker' in navigator) {
        const r = await navigator.serviceWorker.ready;
        r.showNotification(`⏰ ${count} tarea${count > 1 ? 's' : ''} atrasada${count > 1 ? 's' : ''}`, opts);
      } else {
        new Notification(`⏰ ${count} tarea${count > 1 ? 's' : ''} atrasada${count > 1 ? 's' : ''}`, opts);
      }
    } catch(e) { console.warn(e); }
  },

  bindOverdueBanner() {
    document.getElementById('btn-close-overdue')?.addEventListener('click', () => {
      const ids = this._getOverdueTasks().map(t => t.id).sort().join(',');
      this._overdueLastDismiss = { ids, ts: Date.now() };
      document.getElementById('overdue-banner').style.display = 'none';
    });
    document.getElementById('btn-overdue-go-tasks')?.addEventListener('click', () => {
      document.getElementById('overdue-banner').style.display = 'none';
      this.navigate('tasks');
    });
  },

  saveTask() {
    const title=document.getElementById('task-title').value.trim();
    if(!title){toast('El nombre es obligatorio','error');return;}
    const notifEnabled=document.getElementById('task-notif-toggle').checked;
    const notifTime=document.getElementById('task-notif-time').value;
    const days=[...document.querySelectorAll('.day-btn.selected')].map(b=>parseInt(b.dataset.day));
    const task={ id:this.editTaskId||`t_${Date.now()}`, title,
      description:document.getElementById('task-description').value.trim(),
      notifTime:notifTime||null, notifEnabled:notifEnabled&&!!notifTime, days };
    const tasks=DB.tasks();
    if(this.editTaskId){ const i=tasks.findIndex(t=>t.id===this.editTaskId); if(i!==-1) tasks[i]=task; }
    else tasks.push(task);
    DB.saveTasks(tasks);
    Notif.cancel(task.id); if(task.notifEnabled) Notif.schedule(task);
    toast(this.editTaskId?'Tarea actualizada':'Tarea añadida ✓','success');
    this.closeTaskModal(); this.renderTasks();
  },

  // ================================================================
  // ONBOARDING WALKTHROUGH
  // ================================================================
  _setupStatus() {
    const s = DB.settings();
    const prefs = DB.foodPrefs();
    return {
      name:    !!(s.name && s.name !== 'Usuario'),
      profile: !!(s.height && s.age),
      weight:  DB.weightLog().length > 0,
      goal:    s.cuttingStyle !== 'custom',
      prefs:   !!(prefs?.liked?.length >= 3),
    };
  },

  checkOnboarding() {
    if (!localStorage.getItem('lt_onboarding_seen') && !this._obShown) {
      this._obShown = true;
      setTimeout(() => this.startOnboarding(), 350);
    }
  },

  startOnboarding() {
    const s = DB.settings();
    const prefs = DB.foodPrefs();
    const lastW = DB.weightLog().slice(-1)[0];
    this._obStep = 1;
    this._obData = {
      name:             s.name !== 'Usuario' ? s.name : '',
      weight:           lastW ? lastW.kg : '',
      height:           s.height || '',
      age:              s.age || '',
      gender:           s.gender || 'male',
      activityLevel:    s.activityLevel || 'moderate',
      cuttingStyle:     s.cuttingStyle !== 'custom' ? s.cuttingStyle : 'maintenance',
      calorieGoal:      s.calorieGoal || 2000,
      likedIngredients: prefs?.liked ? [...prefs.liked] : [],
      // body measurements
      neck:  s.neck  || '', waist: s.waist || '', hip:   s.hip   || '',
      chest: s.chest || '', arm:   s.arm   || '', thigh: s.thigh || '', calf: s.calf || '',
    };
    this._renderObStep();
    document.getElementById('modal-onboarding').classList.add('open');
  },

  _renderObStep() {
    const TOTAL = 4;
    const pct   = Math.round((this._obStep / TOTAL) * 100);
    document.getElementById('ob-progress-bar').style.width = pct + '%';
    const body = document.getElementById('ob-body');
    body.classList.remove('ob-slide-in');
    body.innerHTML = this._obStepHTML(this._obStep);
    void body.offsetWidth; // reflow
    body.classList.add('ob-slide-in');
    this._bindObStep(this._obStep);
  },

  _obStepHTML(step) {
    const d   = this._obData;
    const esc2 = t => String(t).replace(/</g,'&lt;').replace(/>/g,'&gt;');

    if (step === 1) {
      return `
        <div class="ob-icon-wrap"><span class="ob-icon">👋</span></div>
        <h2 class="ob-title">¡Bienvenido a LifeTrack!</h2>
        <p class="ob-subtitle">Tu asistente personal de salud y nutrición.<br>Configúrate en menos de 2 minutos.</p>
        <div class="form-group" style="margin-top:20px">
          <label class="form-label">¿Cómo te llamamos?</label>
          <input class="form-input" id="ob-name" type="text" placeholder="Tu nombre"
            maxlength="30" value="${esc2(d.name)}" autocomplete="given-name">
        </div>
        <button class="btn btn-primary ob-btn-next" id="ob-next">Comenzar →</button>
        <button class="ob-skip-btn" id="ob-skip">Saltar configuración</button>`;
    }

    if (step === 2) {
      const acts = [
        { id:'sedentary',   label:'Sedentario', icon:'🪑' },
        { id:'light',       label:'Ligero',     icon:'🚶' },
        { id:'moderate',    label:'Moderado',   icon:'🏃' },
        { id:'active',      label:'Activo',     icon:'⚡' },
        { id:'very_active', label:'Intenso',    icon:'🔥' },
      ];
      return `
        <div class="ob-icon-wrap"><span class="ob-icon">💪</span></div>
        <h2 class="ob-title">Tu perfil físico</h2>
        <p class="ob-subtitle">Calculamos tu TDEE real con estos datos.</p>
        <div class="ob-row2">
          <div class="form-group">
            <label class="form-label">Peso (kg)</label>
            <input class="form-input" id="ob-weight" type="number" placeholder="70" min="30" max="300" step="0.1" value="${esc2(d.weight)}">
          </div>
          <div class="form-group">
            <label class="form-label">Altura (cm)</label>
            <input class="form-input" id="ob-height" type="number" placeholder="170" min="100" max="250" value="${esc2(d.height)}">
          </div>
        </div>
        <div class="ob-row2">
          <div class="form-group">
            <label class="form-label">Edad</label>
            <input class="form-input" id="ob-age" type="number" placeholder="25" min="10" max="120" value="${esc2(d.age)}">
          </div>
          <div class="form-group">
            <label class="form-label">Género</label>
            <select class="form-input" id="ob-gender">
              <option value="male"   ${d.gender==='male'  ?'selected':''}>Hombre</option>
              <option value="female" ${d.gender==='female'?'selected':''}>Mujer</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Nivel de actividad</label>
          <div class="ob-activity-row">
            ${acts.map(a=>`<button class="ob-activity-btn${d.activityLevel===a.id?' selected':''}" data-activity="${a.id}">
              <span>${a.icon}</span><span>${a.label}</span>
            </button>`).join('')}
          </div>
        </div>

        <!-- Advanced measurements -->
        <button class="ob-advanced-toggle" id="ob-adv-toggle">
          📏 Medidas corporales <span id="ob-adv-arrow">▼</span>
        </button>
        <div id="ob-advanced" style="display:none">
          <div id="ob-bodyfat-preview" class="bodyfat-preview-box" style="margin-bottom:10px">
            Añade cuello y cintura para estimar tu % grasa
          </div>
          <p class="measures-hint">Para mujeres también se necesita la cadera.</p>
          <div class="ob-row2">
            <div class="form-group"><label class="form-label">Cuello (cm)</label>
              <input class="form-input" id="ob-neck"  type="number" placeholder="37"  min="20" max="70"  step="0.5" value="${d.neck||''}"></div>
            <div class="form-group"><label class="form-label">Cintura (cm)</label>
              <input class="form-input" id="ob-waist" type="number" placeholder="82"  min="40" max="200" step="0.5" value="${d.waist||''}"></div>
          </div>
          <div class="ob-row2">
            <div class="form-group"><label class="form-label">Cadera (cm)</label>
              <input class="form-input" id="ob-hip"   type="number" placeholder="95"  min="40" max="200" step="0.5" value="${d.hip||''}"></div>
            <div class="form-group"><label class="form-label">Pecho (cm)</label>
              <input class="form-input" id="ob-chest" type="number" placeholder="95"  min="40" max="200" step="0.5" value="${d.chest||''}"></div>
          </div>
          <div class="ob-row2">
            <div class="form-group"><label class="form-label">Brazo (cm)</label>
              <input class="form-input" id="ob-arm"   type="number" placeholder="35"  min="15" max="80"  step="0.5" value="${d.arm||''}"></div>
            <div class="form-group"><label class="form-label">Muslo (cm)</label>
              <input class="form-input" id="ob-thigh" type="number" placeholder="55"  min="20" max="120" step="0.5" value="${d.thigh||''}"></div>
          </div>
          <div class="ob-row2">
            <div class="form-group"><label class="form-label">Pantorrilla (cm)</label>
              <input class="form-input" id="ob-calf"  type="number" placeholder="38"  min="15" max="80"  step="0.5" value="${d.calf||''}"></div>
            <div></div>
          </div>
        </div>

        <div class="ob-nav-row">
          <button class="btn ob-btn-back" id="ob-back">← Atrás</button>
          <button class="btn btn-primary ob-btn-next" id="ob-next">Siguiente →</button>
        </div>`;
    }

    if (step === 3) {
      const styles = CUTTING_STYLES.filter(c => c.id !== 'custom');
      const tdee   = this._calcTDEE({ height:d.height, age:d.age, gender:d.gender, activityLevel:d.activityLevel });
      const goal   = tdee ? (this._calcGoalFromStyle(tdee, d.cuttingStyle) || d.calorieGoal) : d.calorieGoal;
      return `
        <div class="ob-icon-wrap"><span class="ob-icon">🎯</span></div>
        <h2 class="ob-title">¿Cuál es tu objetivo?</h2>
        <p class="ob-subtitle">${tdee
          ? `Tu TDEE estimado: <strong>${tdee} kcal/día</strong>`
          : 'Elige tu meta calórica.'}</p>
        <div class="ob-style-grid">
          ${styles.map(c=>`<button class="ob-style-btn${d.cuttingStyle===c.id?' selected':''}" data-style="${c.id}">
            <span class="ob-style-emoji">${c.emoji}</span>
            <span class="ob-style-label">${c.label}</span>
            <span class="ob-style-desc">${c.desc}</span>
          </button>`).join('')}
        </div>
        <div class="ob-goal-display">Meta: <strong id="ob-goal-val">${goal}</strong> kcal/día</div>
        <div class="ob-nav-row">
          <button class="btn ob-btn-back" id="ob-back">← Atrás</button>
          <button class="btn btn-primary ob-btn-next" id="ob-next">Siguiente →</button>
        </div>`;
    }

    if (step === 4) {
      const liked = new Set(d.likedIngredients);
      const count = liked.size;
      const CAT_EMOJI = { 'Proteínas':'🥩','Verduras':'🥦','Carbohidratos':'🍚','Grasas':'🥑','Lácteos':'🥛','Legumbres':'🫘' };
      const cats = [...new Set(INGREDIENTS.map(i=>i.cat))];
      return `
        <div class="ob-icon-wrap"><span class="ob-icon">🥗</span></div>
        <h2 class="ob-title">Ingredientes favoritos</h2>
        <p class="ob-subtitle">Selecciona ≥ 3 para recibir recomendaciones de recetas.</p>
        <div id="ob-prefs-count" class="ob-prefs-count${count>=3?' ok':''}">
          ${count} seleccionados${count<3?' · (mínimo 3)':''}
        </div>
        <div class="ob-prefs-scroll">
          ${cats.map(cat=>`
            <div class="pref-cat-header">${CAT_EMOJI[cat]||''} ${cat}</div>
            <div class="pref-chip-row">
              ${INGREDIENTS.filter(i=>i.cat===cat).map(i=>
                `<button class="pref-chip${liked.has(i.id)?' selected':''}" data-pref-id="${i.id}">${i.emoji} ${i.label}</button>`
              ).join('')}
            </div>`).join('')}
        </div>
        <div class="ob-nav-row">
          <button class="btn ob-btn-back" id="ob-back">← Atrás</button>
          <button class="btn btn-primary ob-btn-next${count<3?' ob-disabled':''}" id="ob-next" ${count<3?'disabled':''}>Finalizar ✓</button>
        </div>`;
    }
    return '';
  },

  _bindObStep(step) {
    const d = this._obData;
    document.getElementById('ob-next')?.addEventListener('click',  () => this._obNext(step));
    document.getElementById('ob-back')?.addEventListener('click',  () => this._obBack());
    document.getElementById('ob-skip')?.addEventListener('click',  () => this._obFinish(true));

    if (step === 2) {
      document.querySelectorAll('.ob-activity-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.ob-activity-btn').forEach(b=>b.classList.remove('selected'));
          btn.classList.add('selected');
          d.activityLevel = btn.dataset.activity;
        });
      });
      // Advanced section toggle
      document.getElementById('ob-adv-toggle')?.addEventListener('click', () => {
        const sec  = document.getElementById('ob-advanced');
        const arr  = document.getElementById('ob-adv-arrow');
        const open = sec.style.display === '';
        sec.style.display = open ? 'none' : '';
        if (arr) arr.textContent = open ? '▼' : '▲';
      });
      // Live body fat preview from measure inputs
      const _obMeasureSnap = () => ({
        gender: document.getElementById('ob-gender')?.value || d.gender,
        height: parseFloat(document.getElementById('ob-height')?.value) || d.height,
        neck:   parseFloat(document.getElementById('ob-neck')?.value)  || null,
        waist:  parseFloat(document.getElementById('ob-waist')?.value) || null,
        hip:    parseFloat(document.getElementById('ob-hip')?.value)   || null,
        weight: parseFloat(document.getElementById('ob-weight')?.value) || null,
      });
      ['ob-neck','ob-waist','ob-hip','ob-height','ob-gender'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
          const snap = _obMeasureSnap();
          this._updateBodyFatPreview('ob-bodyfat-preview', snap);
        });
        document.getElementById(id)?.addEventListener('change', () => {
          const snap = _obMeasureSnap();
          this._updateBodyFatPreview('ob-bodyfat-preview', snap);
        });
      });
    }

    if (step === 3) {
      document.querySelectorAll('.ob-style-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.ob-style-btn').forEach(b=>b.classList.remove('selected'));
          btn.classList.add('selected');
          d.cuttingStyle = btn.dataset.style;
          const tdee = this._calcTDEE(d);
          const goal = tdee ? (this._calcGoalFromStyle(tdee, d.cuttingStyle) || d.calorieGoal) : d.calorieGoal;
          if (goal) { d.calorieGoal = goal; const el=document.getElementById('ob-goal-val'); if(el) el.textContent=goal; }
        });
      });
    }

    if (step === 4) {
      document.querySelectorAll('#ob-body .pref-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          btn.classList.toggle('selected');
          const id = btn.dataset.prefId;
          if (btn.classList.contains('selected')) {
            if (!d.likedIngredients.includes(id)) d.likedIngredients.push(id);
          } else {
            d.likedIngredients = d.likedIngredients.filter(x=>x!==id);
          }
          const count = d.likedIngredients.length;
          const countEl = document.getElementById('ob-prefs-count');
          if (countEl) {
            countEl.textContent = `${count} seleccionados${count<3?' · (mínimo 3)':''}`;
            countEl.classList.toggle('ok', count >= 3);
          }
          const nextBtn = document.getElementById('ob-next');
          if (nextBtn) { nextBtn.disabled = count<3; nextBtn.classList.toggle('ob-disabled', count<3); }
        });
      });
    }
  },

  _obNext(step) {
    const d = this._obData;
    if (step === 1) {
      const name = document.getElementById('ob-name')?.value.trim();
      if (!name) { toast('Ingresa tu nombre', 'error'); return; }
      d.name = name;
    }
    if (step === 2) {
      d.weight = parseFloat(document.getElementById('ob-weight')?.value) || null;
      d.height = parseInt(document.getElementById('ob-height')?.value)   || null;
      d.age    = parseInt(document.getElementById('ob-age')?.value)      || null;
      d.gender = document.getElementById('ob-gender')?.value || 'male';
      if (!d.height || !d.age) { toast('Completa la altura y edad', 'error'); return; }
      // Capture measurements (optional)
      const _mf = id => parseFloat(document.getElementById(id)?.value) || null;
      d.neck  = _mf('ob-neck');  d.waist = _mf('ob-waist'); d.hip   = _mf('ob-hip');
      d.chest = _mf('ob-chest'); d.arm   = _mf('ob-arm');   d.thigh = _mf('ob-thigh'); d.calf = _mf('ob-calf');
      // Recalculate goal when moving to step 3
      const tdee = this._calcTDEE(d);
      if (tdee) d.calorieGoal = this._calcGoalFromStyle(tdee, d.cuttingStyle) || d.calorieGoal;
    }
    if (step === 4) { this._obFinish(false); return; }
    this._obStep++;
    this._renderObStep();
  },

  _obBack() {
    if (this._obStep > 1) { this._obStep--; this._renderObStep(); }
  },

  _obFinish(skipped) {
    if (!skipped) {
      const d   = this._obData;
      const cur = DB.settings();
      DB.saveSettings({
        ...cur,
        name:         d.name || cur.name,
        height:       d.height || cur.height,
        age:          d.age    || cur.age,
        gender:       d.gender,
        activityLevel:d.activityLevel,
        cuttingStyle: d.cuttingStyle,
        calorieGoal:  d.calorieGoal,
        // measurements (only overwrite if user entered something)
        neck:  d.neck  || cur.neck  || null,
        waist: d.waist || cur.waist || null,
        hip:   d.hip   || cur.hip   || null,
        chest: d.chest || cur.chest || null,
        arm:   d.arm   || cur.arm   || null,
        thigh: d.thigh || cur.thigh || null,
        calf:  d.calf  || cur.calf  || null,
      });
      if (d.weight) DB.logWeight(d.weight);
      if (d.likedIngredients.length >= 3) DB.saveFoodPrefs({ liked: d.likedIngredients });
      this.updateHeaderUser({ name: d.name });
      CloudSync.schedulePush?.();
    }
    localStorage.setItem('lt_onboarding_seen', '1');
    document.getElementById('modal-onboarding').classList.remove('open');
    this.renderView();
    if (!skipped) toast('¡Perfil configurado! 🎉', 'success');
  },

  // ── Dashboard setup nudge card ────────────────────────────
  _renderSetupCard() {
    const el = document.getElementById('dash-setup-card');
    if (!el) return;
    const st = this._setupStatus();
    const steps = [
      { key:'profile', label:'Perfil físico',          done: st.profile, action: 'settings' },
      { key:'goal',    label:'Objetivo calórico',       done: st.goal,    action: 'settings' },
      { key:'prefs',   label:'Ingredientes favoritos',  done: st.prefs,   action: 'prefs'    },
    ];
    const doneCount = steps.filter(s=>s.done).length;
    if (doneCount === steps.length) { el.style.display='none'; return; }
    el.style.display = '';
    el.innerHTML = `
      <div class="setup-card">
        <div class="setup-card-header">
          <div>
            <div class="setup-card-title">⚙️ Completa tu perfil</div>
            <div class="setup-card-sub">${doneCount} de ${steps.length} pasos listos</div>
          </div>
          <button class="setup-card-ob-btn" id="btn-setup-ob">Completar →</button>
        </div>
        <div class="setup-checklist">
          ${steps.map(s=>`
            <div class="setup-check-row${s.done?' done':''}">
              <span class="setup-check-icon">${s.done?'✅':'⭕'}</span>
              <span class="setup-check-label">${s.label}</span>
              ${!s.done?`<button class="setup-check-action" data-action="${s.action}">Ir →</button>`:''}
            </div>`).join('')}
        </div>
      </div>`;
    document.getElementById('btn-setup-ob')?.addEventListener('click', ()=>this.startOnboarding());
    el.querySelectorAll('[data-action]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        if (btn.dataset.action==='prefs') this.openIngredientPrefs();
        else this.openSettings();
      });
    });
  },

  // ================================================================
  // FOOD + RECIPES
  // ================================================================
  bindFoodModal() {
    document.getElementById('food-search').addEventListener('input',e=>{
      clearTimeout(this.searchTimer);
      const q=e.target.value.trim();
      if(q.length<2){
        document.getElementById('food-results').innerHTML='';
        this._searchToken = (this._searchToken || 0) + 1; // invalidate in-flight
        if (this._searchAbort) this._searchAbort.abort();
        return;
      }
      // Local results appear on every keystroke; network waits for a pause
      this._renderSearchResults(this._searchLocalFoods(q), null, q);
      this.searchTimer=setTimeout(()=>this.searchFood(q),450);
    });
    document.getElementById('modal-food-detail').addEventListener('click',e=>{if(e.target===e.currentTarget)this.closeFoodModal();});
    document.getElementById('btn-close-food').addEventListener('click',()=>this.closeFoodModal());
    // Barcode scanner bindings
    document.getElementById('btn-scan-barcode')?.addEventListener('click', () => this.openBarcodeScanner());
    document.getElementById('btn-close-scanner')?.addEventListener('click', () => this.closeBarcodeScanner());
    document.getElementById('btn-manual-barcode')?.addEventListener('click', () => {
      this.closeBarcodeScanner();
      setTimeout(() => this._promptManualBarcode(), 200);
    });
    document.getElementById('btn-add-food').addEventListener('click', () => this.addFood());
    document.getElementById('btn-add-to-tray').addEventListener('click', () => this.addFoodFromModal());

    // Gram presets
    document.querySelectorAll('.qty-preset').forEach(btn => btn.addEventListener('click', () => {
      document.querySelectorAll('.qty-preset').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('food-qty').value = btn.dataset.qty;
      this.updateFoodPreview();
    }));
    // Portion presets
    document.querySelectorAll('.qty-preset-u').forEach(btn => btn.addEventListener('click', () => {
      document.querySelectorAll('.qty-preset-u').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('food-qty').value = btn.dataset.units;
      this.updateFoodPreview();
    }));
    document.getElementById('food-qty').addEventListener('input', () => {
      document.querySelectorAll('.qty-preset, .qty-preset-u').forEach(b => b.classList.remove('selected'));
      this.updateFoodPreview();
    });
    // Unit mode toggle buttons
    document.getElementById('btn-unit-mode-portions')?.addEventListener('click', () => this._setUnitMode(true));
    document.getElementById('btn-unit-mode-grams')?.addEventListener('click', () => this._setUnitMode(false));

    // Common foods toggle
    document.getElementById('btn-toggle-common-foods')?.addEventListener('click', () => {
      this.commonFoodsOpen = !this.commonFoodsOpen;
      this.renderCommonFoods();
    });

    // Food tray commit / clear
    document.getElementById('btn-commit-tray')?.addEventListener('click', () => this.commitFoodQueue());
    document.getElementById('btn-clear-tray')?.addEventListener('click', () => {
      this.foodQueue = [];
      this.renderFoodQueue();
    });
    // Recipes toggle
    document.getElementById('btn-toggle-recipes').addEventListener('click',()=>{
      this.recipesOpen=!this.recipesOpen;
      const sec=document.getElementById('recipes-section');
      const chev=document.getElementById('recipes-chevron');
      sec.style.display=this.recipesOpen?'block':'none';
      chev.style.transform=this.recipesOpen?'rotate(180deg)':'';
      if(this.recipesOpen){
        // Show recommendations panel by default when opening
        const panel = document.getElementById('rec-panel');
        if (panel) panel.style.display = 'block';
        this.renderRecipes();
      }
    });
    document.getElementById('btn-add-recipe').addEventListener('click',()=>this.openRecipeModal());
    document.getElementById('btn-toggle-rec-ai').addEventListener('click',()=>{
      const panel = document.getElementById('rec-panel');
      const sec   = document.getElementById('recipes-section');
      const chev  = document.getElementById('recipes-chevron');
      // Open the recipes section first if it's closed
      if (!this.recipesOpen) {
        this.recipesOpen = true;
        sec.style.display = 'block';
        chev.style.transform = 'rotate(180deg)';
        this.renderRecipes();
      }
      // Toggle the panel (treat '' and 'none' both as hidden)
      const isHidden = panel.style.display !== 'block';
      panel.style.display = isHidden ? 'block' : 'none';
      if (isHidden) this.renderRecommendations();
    });
    // Ingredient preferences modal
    document.getElementById('modal-food-prefs').addEventListener('click', e => { if(e.target===e.currentTarget) this.closeIngredientPrefs(); });
    document.getElementById('btn-close-prefs').addEventListener('click', () => this.closeIngredientPrefs());
    document.getElementById('btn-save-prefs').addEventListener('click',  () => this.saveIngredientPrefs());
    // Recipe detail modal
    document.getElementById('modal-recipe-detail').addEventListener('click', e => { if(e.target===e.currentTarget) this.closeModal('modal-recipe-detail'); });
    document.getElementById('btn-close-recipe-detail').addEventListener('click', () => this.closeModal('modal-recipe-detail'));
    // Repeat yesterday
    document.getElementById('btn-repeat-yesterday')?.addEventListener('click', () => this._repeatYesterdayAll());
  },

  renderFood() {
    DB.setLogDate(this._foodDate || null);
    this._renderDiaryDate();
    this.renderFoodLog();
    this.updateFoodBar();
    this.renderYesterdayFoods();
    this.renderFavoriteFoods();
    this.renderCommonFoods();
    this.renderFoodQueue();
    if(this.recipesOpen) this.renderRecipes();
    this.updatePlanBadge();
  },

  // ── "Ayer comiste" — the lowest-friction repeat path ─────────────
  _yesterdayKey() {
    const cur = this._foodDate || today();
    const d = new Date(cur + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    return fmtDate(d);
  },

  renderYesterdayFoods() {
    const section = document.getElementById('food-yesterday');
    if (!section) return;
    const yEntries = (DB.foodLog())[this._yesterdayKey()] || [];
    if (!yEntries.length) { section.style.display = 'none'; return; }

    section.style.display = '';
    const totalKcal = yEntries.reduce((a, e) => a + (e.kcal || 0), 0);
    const btnAll = document.getElementById('btn-repeat-yesterday');
    if (btnAll) btnAll.textContent = `+ Añadir todo (${totalKcal} kcal)`;

    const listEl = document.getElementById('food-yesterday-list');
    listEl.innerHTML = yEntries.slice(0, 12).map((e, i) => `
      <button class="fav-chip" data-yday-idx="${i}" title="Añadir ${esc(e.name)}">
        <span class="fav-name">${esc(e.name)}</span>
        <span class="fav-kcal">${e.kcal} kcal</span>
      </button>`).join('');
    listEl.querySelectorAll('[data-yday-idx]').forEach((btn, i) => {
      btn.addEventListener('click', () => this._instantAddFood(yEntries[i]));
    });
  },

  _repeatYesterdayAll() {
    const yEntries = (DB.foodLog())[this._yesterdayKey()] || [];
    if (!yEntries.length) return;
    const before = DB.todayFood().length;
    yEntries.forEach(e => {
      const clean = { ...e };
      delete clean.id; delete clean.ts;
      DB.addFood(clean);
    });
    const totalKcal = yEntries.reduce((a, e) => a + (e.kcal || 0), 0);
    this.renderFoodLog(); this.updateFoodBar();
    if (this.view === 'dashboard') this.renderDashboard();
    toastUndo(`✓ ${yEntries.length} alimentos añadidos · ${totalKcal} kcal`, () => {
      // Remove exactly the entries we just appended
      const d = DB._d(), log = DB.foodLog();
      if (log[d]) { log[d] = log[d].slice(0, before); DB.saveFoodLog(log); }
      this.renderFoodLog(); this.updateFoodBar();
      if (this.view === 'dashboard') this.renderDashboard();
    });
  },

  // ── DIARY DATE NAVIGATOR (retro-logging) ──────────────────────
  _foodDate: null,   // null = today; otherwise 'YYYY-MM-DD' in the past

  _renderDiaryDate() {
    const nav = document.getElementById('diary-date-nav');
    if (!nav) return;
    const cur     = this._foodDate || today();
    const isToday = cur === today();
    nav.classList.toggle('past', !isToday);

    const label = document.getElementById('diary-date-label');
    const input = document.getElementById('diary-date-input');
    const next  = document.getElementById('diary-next');
    if (input) { input.value = cur; input.max = today(); }
    if (next)  next.disabled = isToday;
    if (label) {
      if (isToday) {
        label.textContent = '📅 Hoy';
      } else {
        const d = new Date(cur + 'T12:00:00');
        const y = new Date(); y.setDate(y.getDate() - 1);
        label.textContent = (cur === fmtDate(y))
          ? `✏️ Ayer · ${d.toLocaleDateString('es',{day:'numeric',month:'short'})}`
          : `✏️ ${d.toLocaleDateString('es',{weekday:'short',day:'numeric',month:'short'})}`;
      }
    }
  },

  setFoodDate(d) {
    const t = today();
    if (!d || d > t) d = t;              // never log into the future
    this._foodDate = (d === t) ? null : d;
    DB.setLogDate(this._foodDate);
    this.renderFood();
  },

  bindDiaryDate() {
    const shift = (delta) => {
      const base = new Date((this._foodDate || today()) + 'T12:00:00');
      base.setDate(base.getDate() + delta);
      this.setFoodDate(fmtDate(base));
    };
    document.getElementById('diary-prev')?.addEventListener('click', () => shift(-1));
    document.getElementById('diary-next')?.addEventListener('click', () => shift(1));
    const input = document.getElementById('diary-date-input');
    document.getElementById('diary-date-label')?.addEventListener('click', () => {
      if (input?.showPicker) { try { input.showPicker(); return; } catch(e){} }
      input?.click();
    });
    input?.addEventListener('change', e => { if (e.target.value) this.setFoodDate(e.target.value); });
  },

  // ── FAVORITES / QUICK-ADD ────────────────────────────────
  _currentMealSlot() {
    const h = new Date().getHours();
    return h < 10 ? 'breakfast' : h < 14 ? 'lunch' : h < 18 ? 'snack' : 'dinner';
  },

  _getFavoriteFoods() {
    const log = DB.foodLog();
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = fmtDate(cutoff);
    const buckets = {};

    Object.entries(log).forEach(([date, entries]) => {
      if (date < cutoffStr) return;
      const dDate  = new Date(date + 'T12:00:00');
      const daysAgo = Math.max(0, Math.floor((Date.now() - dDate.getTime()) / 86400000));
      const w = 1 / Math.sqrt(1 + daysAgo); // recency weight
      entries.forEach(e => {
        if (e.isRecipe || e.isRecipeDb || e.source === 'recipe_db' || e.fromPlan) return;
        if (!e.qty || e.qty <= 0 || !e.name) return;
        const key = `${e.name.trim().toLowerCase()}|${(e.brand||'').trim().toLowerCase()}`;
        if (!buckets[key]) buckets[key] = { name: e.name, brand: e.brand, score: 0, count: 0, last: e, lastDate: date };
        buckets[key].score += w;
        buckets[key].count++;
        if (date > buckets[key].lastDate) {
          buckets[key].last = e;
          buckets[key].lastDate = date;
        }
      });
    });

    return Object.values(buckets)
      .filter(b => b.count >= 2)
      .sort((a,b) => b.score - a.score)
      .slice(0, 8);
  },

  // One-tap add: log the entry immediately with its last-used portion.
  // Undo toast covers the mis-tap case — cheaper than a confirm modal.
  _instantAddFood(entry) {
    const clean = { ...entry };
    delete clean.id; delete clean.ts; // DB.addFood stamps fresh ones
    DB.addFood(clean);
    const added = DB.todayFood().slice(-1)[0];
    this.renderFoodLog(); this.updateFoodBar();
    if (this.view === 'dashboard') this.renderDashboard();
    toastUndo(`✓ ${clean.name} · ${clean.kcal} kcal`, () => {
      if (added) DB.removeFood(added.id);
      this.renderFoodLog(); this.updateFoodBar();
      if (this.view === 'dashboard') this.renderDashboard();
    });
  },

  renderFavoriteFoods() {
    const favs    = this._getFavoriteFoods();
    const section = document.getElementById('food-favorites');
    if (!section) return;
    if (!favs.length) { section.style.display = 'none'; return; }

    section.style.display = '';
    const listEl = document.getElementById('food-favorites-list');
    listEl.innerHTML = favs.map((f, i) => `
      <button class="fav-chip" data-fav-idx="${i}" title="Añadir ${esc(f.name)} (${f.last.qty}g)">
        <span class="fav-name">${esc(f.name)}</span>
        <span class="fav-meta">
          <span class="fav-qty">${f.last.qty}g</span>
          <span class="fav-kcal">${f.last.kcal} kcal</span>
        </span>
        <span class="fav-edit" data-fav-edit="${i}" title="Ajustar cantidad">✎</span>
      </button>`).join('');
    listEl.querySelectorAll('[data-fav-idx]').forEach((btn, i) => {
      btn.addEventListener('click', () => this._instantAddFood(favs[i].last));
    });
    listEl.querySelectorAll('[data-fav-edit]').forEach((el, i) => {
      el.addEventListener('click', e => { e.stopPropagation(); this._editFavoriteFood(favs[i]); });
    });
  },

  _editFavoriteFood(fav) {
    const e = fav.last;
    const qty = e.qty || 100;
    const factor = 100 / qty;
    const item = {
      name:  e.name,
      brand: e.brand,
      kcal:  Math.round(e.kcal  * factor),
      prot:  +(((e.prot  || 0) * factor).toFixed(1)),
      carbs: +(((e.carbs || 0) * factor).toFixed(1)),
      fat:   +(((e.fat   || 0) * factor).toFixed(1)),
    };
    MICRO_KEYS.forEach(k => {
      item[k] = e[k] != null ? +((e[k] * factor).toFixed(3)) : null;
    });
    this.openFoodModal(item);
    // Pre-fill with last used quantity
    setTimeout(() => {
      const qtyInput = document.getElementById('food-qty');
      if (qtyInput) { qtyInput.value = qty; this.updateFoodPreview(); }
      document.querySelectorAll('.qty-preset').forEach(b => {
        b.classList.toggle('selected', +b.dataset.qty === qty);
      });
    }, 50);
  },

  // Convert a PREP_FOODS entry (macros per-portion) to a per-100g food object for the modal
  _prepFoodToModal(pf) {
    const f = 100 / pf.qty;
    return {
      name:  pf.name,
      brand: 'Alimento común',
      kcal:  +(pf.kcal  * f).toFixed(1),
      prot:  +(pf.prot  * f).toFixed(1),
      carbs: +(pf.carbs * f).toFixed(1),
      fat:   +(pf.fat   * f).toFixed(1),
      _unitSize: pf.qty, // grams per 1 portion
    };
  },

  renderCommonFoods() {
    const listEl = document.getElementById('common-foods-list');
    const chev   = document.getElementById('common-foods-chevron');
    if (!listEl) return;
    listEl.style.display = this.commonFoodsOpen ? '' : 'none';
    if (chev) chev.style.transform = this.commonFoodsOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
    if (!this.commonFoodsOpen) return;

    const grouped = {};
    PREP_FOODS.forEach(f => {
      if (!grouped[f.cat]) grouped[f.cat] = [];
      grouped[f.cat].push(f);
    });

    listEl.innerHTML = Object.entries(grouped).map(([cat, foods]) => `
      <div style="margin-bottom:10px">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px">${esc(cat)}</div>
        <div class="fav-row">
          ${foods.map(f => `
            <button class="fav-chip" data-common-food="${esc(f.id)}" title="Añadir ${esc(f.name)} (${f.qty}g)">
              <span class="fav-name">${esc(f.name)}</span>
              <span class="fav-kcal">${f.kcal} kcal</span>
              <span class="fav-edit" data-common-edit="${esc(f.id)}" title="Ajustar cantidad">✎</span>
            </button>`).join('')}
        </div>
      </div>`).join('');

    // Tap = instant add of the standard portion; ✎ = open modal to adjust grams
    listEl.querySelectorAll('[data-common-food]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pf = PREP_FOODS.find(f => f.id === btn.dataset.commonFood);
        if (!pf) return;
        this._instantAddFood({
          name: pf.name, brand: 'Alimento común', qty: pf.qty,
          kcal: pf.kcal, prot: pf.prot, carbs: pf.carbs, fat: pf.fat,
        });
      });
    });
    listEl.querySelectorAll('[data-common-edit]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const pf = PREP_FOODS.find(f => f.id === el.dataset.commonEdit);
        if (pf) this.openFoodModal(this._prepFoodToModal(pf));
      });
    });
  },

  // ── Food queue (bandeja) ──────────────────────────────────────────
  addFoodToQueue(entry) {
    entry.id = `fq_${Date.now()}_${this.foodQueue.length}`;
    this.foodQueue.push(entry);
    this.renderFoodQueue();
    toast(`${entry.name.split(' ').slice(0,3).join(' ')} → bandeja`, 'success');
  },

  renderFoodQueue() {
    const tray = document.getElementById('food-tray');
    if (!tray) return;
    if (!this.foodQueue.length) { tray.style.display = 'none'; return; }
    tray.style.display = '';
    const totalKcal = this.foodQueue.reduce((s, e) => s + e.kcal, 0);
    document.getElementById('food-tray-total').textContent = `${totalKcal} kcal`;
    const itemsEl = document.getElementById('food-tray-items');
    itemsEl.innerHTML = this.foodQueue.map((e, i) => `
      <span style="display:inline-flex;align-items:center;gap:4px;background:var(--bg);border-radius:20px;padding:3px 10px;font-size:12px;font-weight:500">
        ${esc(e.name.split(' ').slice(0,2).join(' '))}
        <span style="color:var(--text-muted);font-size:11px">${e.kcal}kcal</span>
        <button data-tray-remove="${i}" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:13px;padding:0 0 0 2px;line-height:1">✕</button>
      </span>`).join('');
    itemsEl.querySelectorAll('[data-tray-remove]').forEach(btn => {
      btn.addEventListener('click', () => this.removeFromQueue(+btn.dataset.trayRemove));
    });
  },

  removeFromQueue(idx) {
    this.foodQueue.splice(idx, 1);
    this.renderFoodQueue();
  },

  commitFoodQueue() {
    if (!this.foodQueue.length) return;
    const n = this.foodQueue.length;
    this.foodQueue.forEach(e => DB.addFood(e));
    this.foodQueue = [];
    this.renderFoodQueue();
    toast(`${n} alimento${n>1?'s':''} añadido${n>1?'s':''} ✓`, 'success');
    this.renderFoodLog(); this.updateFoodBar();
    if (this.view === 'dashboard') this.renderDashboard();
  },

  // Search the user's own data first: past log entries + common foods.
  // Instant (no network), accent-insensitive, portion already known → one tap.
  _searchLocalFoods(q) {
    const nq = normTxt(q);
    const out = [], seen = new Set();
    // History: newest first, unique by normalized name
    const log = DB.foodLog();
    Object.keys(log).sort().reverse().slice(0, 120).forEach(date => {
      (log[date] || []).forEach(e => {
        if (!e.name) return;
        const key = normTxt(e.name);
        if (seen.has(key)) return;
        const rel = FoodAPI.relevance(key, nq);
        if (rel <= 0) return;
        seen.add(key);
        out.push({ src: 'history', score: rel + 10, entry: e });
      });
    });
    // Common foods (standard portions)
    PREP_FOODS.forEach(pf => {
      const key = normTxt(pf.name);
      if (seen.has(key)) return;
      const rel = FoodAPI.relevance(key, nq);
      if (rel <= 0) return;
      out.push({ src: 'common', score: rel + 5, entry: pf });
    });
    return out.sort((a, b) => b.score - a.score).slice(0, 6);
  },

  _renderSearchResults(local, offItems, q, failed = false) {
    const results = document.getElementById('food-results');
    let html = '';

    if (local.length) {
      html += `<div class="search-section-hd">📒 Tus alimentos</div>`;
      html += local.map((l, i) => {
        const e = l.entry;
        const isCommon = l.src === 'common';
        const qtyLabel = isCommon ? `${e.qty}g · porción` : `${e.qty || 100}g · última vez`;
        return `
        <div class="food-result-item local-result" data-local-idx="${i}" title="Añadir al instante">
          <div class="food-kcal-badge"><span class="food-kcal-value">${e.kcal}</span><span class="food-kcal-unit">kcal</span></div>
          <div style="flex:1;min-width:0">
            <div class="food-name">${esc(e.name)}</div>
            <div class="food-brand">${qtyLabel}</div>
            <div class="food-macros"><span>P:${e.prot||0}g</span><span>C:${e.carbs||0}g</span><span>G:${e.fat||0}g</span></div>
          </div>
          <button class="food-add-btn instant" title="Añadir ya">⚡</button>
        </div>`;
      }).join('');
    }

    if (offItems === null) {
      html += `<div class="search-section-hd">🌐 Open Food Facts <span class="search-loading-dot">buscando…</span></div>`;
    } else if (failed) {
      html += `<p class="text-muted text-center" style="padding:10px;font-size:12px">⏳ Búsqueda online no disponible (servicio ocupado o sin conexión). ${local.length ? 'Mostrando tus alimentos.' : 'Intenta de nuevo en unos segundos.'}</p>`;
    } else if (offItems.length) {
      html += `<div class="search-section-hd">🌐 Open Food Facts</div>`;
      html += offItems.map((item, i) => `
        <div class="food-result-item" data-off-idx="${i}">
          <div class="food-kcal-badge"><span class="food-kcal-value">${item.kcal}</span><span class="food-kcal-unit">kcal</span></div>
          <div style="flex:1;min-width:0">
            <div class="food-name">${esc(item.name)}</div>
            ${item.brand?`<div class="food-brand">${esc(item.brand)}</div>`:''}
            <div class="food-macros"><span>P:${item.prot}g</span><span>C:${item.carbs}g</span><span>G:${item.fat}g</span></div>
          </div>
          <button class="food-add-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
        </div>`).join('');
    } else if (!local.length) {
      html = `<p class="text-muted text-center" style="padding:16px">Sin resultados para "${esc(q)}"</p>`;
    }

    results.innerHTML = html;

    results.querySelectorAll('[data-local-idx]').forEach(el => {
      el.addEventListener('click', () => {
        const l = local[+el.dataset.localIdx];
        if (l.src === 'common') {
          const pf = l.entry;
          this._instantAddFood({ name: pf.name, brand: 'Alimento común', qty: pf.qty, kcal: pf.kcal, prot: pf.prot, carbs: pf.carbs, fat: pf.fat });
        } else {
          this._instantAddFood(l.entry);
        }
      });
    });
    results.querySelectorAll('[data-off-idx]').forEach(el => {
      el.addEventListener('click', () => this.openFoodModal(offItems[+el.dataset.offIdx]));
    });
  },

  async searchFood(q) {
    const spinner = document.getElementById('search-spinner');
    const token = this._searchToken = (this._searchToken || 0) + 1;

    // 1) Local results render instantly
    const local = this._searchLocalFoods(q);
    this._renderSearchResults(local, null, q);

    // 2) Network search — cancel the previous in-flight request so a slow
    //    stale response can never overwrite newer results
    if (this._searchAbort) this._searchAbort.abort();
    this._searchAbort = new AbortController();
    spinner.classList.add('visible');
    try {
      const items = await FoodAPI.search(q, this._searchAbort.signal);
      if (token !== this._searchToken) return; // superseded by a newer search
      this._renderSearchResults(local, items, q);
    } catch (e) {
      if (e.name === 'AbortError' || token !== this._searchToken) return;
      this._renderSearchResults(local, [], q, true);
    } finally {
      if (token === this._searchToken) spinner.classList.remove('visible');
    }
  },

  // ── BARCODE SCANNER ────────────────────────────────────────
  async openBarcodeScanner() {
    // No camera API → fallback to manual entry
    if (!navigator.mediaDevices?.getUserMedia) {
      this._promptManualBarcode();
      return;
    }
    // No BarcodeDetector → still useful: open camera + show manual button prominently
    const hasDetector = 'BarcodeDetector' in window;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
        audio: false,
      });
      this._scannerStream = stream;
      const video = document.getElementById('scanner-video');
      video.srcObject = stream;
      await video.play().catch(() => {});

      document.getElementById('modal-scanner').classList.add('open');
      document.getElementById('scanner-hint').textContent = hasDetector
        ? 'Centra el código en el recuadro'
        : 'Escaneo no soportado — usa "Ingresar manual"';

      if (hasDetector) {
        try {
          this._barcodeDetector = new BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39']
          });
        } catch {
          this._barcodeDetector = new BarcodeDetector();
        }
        this._scannerActive = true;
        this._scanLoop();
      }
    } catch (e) {
      console.warn('Camera error:', e);
      toast('No se pudo acceder a la cámara. Usa entrada manual.', 'error');
      this._promptManualBarcode();
    }
  },

  async _scanLoop() {
    if (!this._scannerActive) return;
    const video = document.getElementById('scanner-video');
    if (!video || video.readyState < 2) {
      requestAnimationFrame(() => this._scanLoop());
      return;
    }
    try {
      const codes = await this._barcodeDetector.detect(video);
      if (codes && codes.length > 0) {
        const code = codes[0].rawValue;
        if (code && code !== this._lastScannedCode) {
          this._lastScannedCode = code;
          if (navigator.vibrate) navigator.vibrate(80);
          this.closeBarcodeScanner();
          await this.lookupBarcode(code);
          // allow re-scan of same code after 3s
          setTimeout(() => { this._lastScannedCode = null; }, 3000);
          return;
        }
      }
    } catch (e) { /* ignore frame detection errors */ }
    // Throttle to ~10 fps to save battery
    setTimeout(() => this._scanLoop(), 100);
  },

  closeBarcodeScanner() {
    this._scannerActive = false;
    if (this._scannerStream) {
      this._scannerStream.getTracks().forEach(t => t.stop());
      this._scannerStream = null;
    }
    const video = document.getElementById('scanner-video');
    if (video) video.srcObject = null;
    document.getElementById('modal-scanner').classList.remove('open');
  },

  _promptManualBarcode() {
    const code = prompt('Ingresa el código de barras del producto:');
    if (code && code.trim()) this.lookupBarcode(code.trim());
  },

  async lookupBarcode(code) {
    toast(`Buscando ${code}…`, 'info');
    try {
      const item = await FoodAPI.lookupByBarcode(code);
      if (!item) {
        toast('Producto no encontrado en Open Food Facts', 'error');
        return;
      }
      this.openFoodModal(item);
    } catch (e) {
      console.error(e);
      toast('Error al buscar el producto', 'error');
    }
  },

  openFoodModal(food) {
    this.pendingFood = food;
    const unitSize = food._unitSize || null;
    this.pendingFoodUnitSize = unitSize;
    this.pendingFoodUnitMode = !!unitSize;

    document.getElementById('food-modal-name').textContent = food.name;
    document.getElementById('food-modal-brand').textContent = food.brand || '';
    document.getElementById('food-modal-per100').textContent =
      `${food.kcal} kcal · P:${food.prot}g · C:${food.carbs}g · G:${food.fat}g por 100g`;

    const toggleRow = document.getElementById('food-unit-toggle-row');
    if (unitSize) {
      toggleRow.style.display = 'flex';
      document.getElementById('food-unit-label').textContent = `1 porción = ${unitSize}g`;
      this._setUnitMode(true);
    } else {
      toggleRow.style.display = 'none';
      this._setUnitMode(false);
    }

    this.updateFoodPreview();
    this.openModal('modal-food-detail');
  },

  _setUnitMode(portions) {
    this.pendingFoodUnitMode = portions;
    document.getElementById('qty-presets-grams').style.display = portions ? 'none' : '';
    document.getElementById('qty-presets-portions').style.display = portions ? '' : 'none';
    document.getElementById('food-qty-label').textContent = portions ? 'Porciones' : 'Cantidad en gramos';
    document.getElementById('food-qty').step = portions ? '0.5' : '1';
    document.getElementById('food-qty').min  = portions ? '0.5' : '1';

    const btnPortions = document.getElementById('btn-unit-mode-portions');
    const btnGrams    = document.getElementById('btn-unit-mode-grams');
    if (portions) {
      btnPortions.style.cssText += ';background:var(--primary);color:#fff;border-color:var(--primary)';
      btnGrams.style.cssText    += ';background:none;color:var(--text-muted);border-color:var(--border)';
      document.getElementById('food-qty').value = '1';
      document.querySelectorAll('.qty-preset-u').forEach(b => b.classList.toggle('selected', b.dataset.units === '1'));
    } else {
      btnGrams.style.cssText    += ';background:var(--primary);color:#fff;border-color:var(--primary)';
      btnPortions.style.cssText += ';background:none;color:var(--text-muted);border-color:var(--border)';
      document.getElementById('food-qty').value = '100';
      document.querySelectorAll('.qty-preset').forEach(b => b.classList.toggle('selected', b.dataset.qty === '100'));
    }
    this.updateFoodPreview();
  },

  _resolveGrams() {
    const raw = parseFloat(document.getElementById('food-qty').value) || (this.pendingFoodUnitMode ? 1 : 100);
    return this.pendingFoodUnitMode && this.pendingFoodUnitSize
      ? raw * this.pendingFoodUnitSize
      : raw;
  },

  closeFoodModal() { this.closeModal('modal-food-detail'); this.pendingFood = null; },

  updateFoodPreview() {
    const food = this.pendingFood; if (!food) return;
    const grams = this._resolveGrams();
    const e = FoodAPI.scale(food, grams);
    document.getElementById('food-modal-preview').textContent =
      `${e.kcal} kcal · Prot:${e.prot}g · Carbs:${e.carbs}g · Grasa:${e.fat}g`;
  },

  _buildFoodEntry() {
    const food = this.pendingFood; if (!food) return null;
    const grams = this._resolveGrams();
    const entry = FoodAPI.scale(food, grams);
    entry.id = `f_${Date.now()}`;
    return entry;
  },

  addFood() {
    const entry = this._buildFoodEntry(); if (!entry) return;
    DB.addFood(entry);
    toast(`${entry.name.split(' ').slice(0,3).join(' ')} añadido ✓`, 'success');
    this.closeFoodModal();
    this.renderFoodLog(); this.updateFoodBar();
    if (this.view === 'dashboard') this.renderDashboard();
  },

  addFoodFromModal() {
    const entry = this._buildFoodEntry(); if (!entry) return;
    this.addFoodToQueue(entry);
    this.closeFoodModal();
  },

  updateFoodBar() {
    const food   = DB.todayFood();
    const kcal   = food.reduce((a,f) => a+f.kcal, 0);
    const prot   = food.reduce((a,f) => a+(f.prot||0), 0);
    const carbs  = food.reduce((a,f) => a+(f.carbs||0), 0);
    const fat    = food.reduce((a,f) => a+(f.fat||0), 0);
    const burned = DB.todayExercise().reduce((a,e) => a+(e.kcalBurned||0), 0);
    const goal   = DB.settings().calorieGoal;
    const netGoal= goal + burned;          // ejercicio amplía el presupuesto
    const rem    = netGoal - kcal;
    const pct    = Math.min((kcal / netGoal) * 100, 100);

    // Remaining big display
    const remEl = document.getElementById('food-kcal-remaining');
    if (remEl) {
      if (rem <= 0) {
        remEl.textContent = Math.abs(rem) > 0 ? `+${Math.abs(rem)} excedidas` : '0';
        remEl.style.color = 'var(--danger)';
      } else {
        remEl.textContent = rem;
        remEl.style.color = rem < 200 ? 'var(--warning)' : 'var(--primary)';
      }
    }
    // Sub-labels
    document.getElementById('food-kcal-consumed').textContent = kcal;
    const goalLabel = document.getElementById('food-kcal-goal');
    if (goalLabel) goalLabel.textContent = burned
      ? `meta ${goal} + ${burned} 🔥 = ${netGoal} kcal`
      : `de ${goal} kcal`;
    const statusEl = document.getElementById('food-kcal-status');
    if (statusEl) statusEl.textContent = rem <= 0 ? '¡Meta alcanzada! 🎉' : `${kcal} consumidas · ${rem} restantes`;

    const fill = document.getElementById('food-progress-fill');
    fill.style.width = pct + '%';
    fill.style.background = kcal > netGoal ? 'var(--danger)' : pct > 85 ? 'var(--warning)' : 'var(--success)';

    // Macro progress bars
    const s = DB.settings();
    const auto = s.macrosAuto !== false; // default true
    let macroGoals;
    if (auto || !s.proteinGoal) {
      macroGoals = this._calcMacroTargets(s, netGoal);
    } else {
      macroGoals = { prot: s.proteinGoal, carbs: s.carbsGoal, fat: s.fatGoal };
    }
    const renderMacro = (id, val, goal, color) => {
      const elVal = document.getElementById(`macro-${id}`);
      const elBar = document.getElementById(`macro-${id}-bar`);
      const elGoal = document.getElementById(`macro-${id}-goal`);
      if (!elVal) return;
      const v = Math.round(val * 10) / 10;
      if (goal) {
        const p = Math.min((val / goal) * 100, 100);
        elVal.textContent = `${v.toFixed(0)}`;
        if (elGoal) elGoal.textContent = `/ ${goal}g`;
        if (elBar) { elBar.style.width = p + '%'; elBar.style.background = color; }
      } else {
        elVal.textContent = `${v.toFixed(1)}g`;
        if (elGoal) elGoal.textContent = '';
        if (elBar) elBar.style.width = '0%';
      }
    };
    renderMacro('prot',  prot,  macroGoals.prot,  '#6366f1');
    renderMacro('carbs', carbs, macroGoals.carbs, '#f59e0b');
    renderMacro('fat',   fat,   macroGoals.fat,   '#10b981');
  },

  renderFoodLog() {
    const food=DB.todayFood(), list=document.getElementById('food-log-list');
    if(!food.length){
      list.innerHTML=`<div class="empty-state"><svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg><p>Busca y añade alimentos</p></div>`;
      return;
    }
    list.innerHTML=food.map((f,i)=>`
      <div class="log-item">
        <div class="log-item-info">
          <div class="log-item-name">${esc(f.name)}</div>
          <div class="log-item-detail">${f.source==='recipe_db' ? `×${f.qty} porción` : `${f.qty}g`} · P:${f.prot||0}g C:${f.carbs||0}g G:${f.fat||0}g${(f.isRecipe||f.isRecipeDb)?' 📖':''}</div>
        </div>
        <span class="log-item-kcal">${f.kcal}</span>
        <button class="btn-remove" data-remove="${esc(String(f.id ?? i))}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>`).join('');
    list.querySelectorAll('[data-remove]').forEach(btn=>btn.addEventListener('click',()=>{
      const day = DB._d(); // respect retro-logging date, not always today
      const entry = DB.removeFood(btn.dataset.remove);
      this.renderFoodLog(); this.updateFoodBar();
      if(this.view==='dashboard') this.renderDashboard();
      if (entry) toastUndo(`Eliminado: ${entry.name}`, () => {
        const cur = DB.foodLog(); if (!cur[day]) cur[day] = [];
        cur[day].push(entry);
        DB.saveFoodLog(cur);
        this.renderFoodLog(); this.updateFoodBar();
        if (this.view === 'dashboard') this.renderDashboard();
        toast('Restaurado ✓', 'success');
      });
    }));
  },

  // ── RECIPES ───────────────────────────────────────────────
  bindRecipeModal() {
    document.getElementById('modal-recipe').addEventListener('click',e=>{if(e.target===e.currentTarget)this.closeRecipeModal();});
    document.getElementById('btn-close-recipe').addEventListener('click',()=>this.closeRecipeModal());
    document.getElementById('btn-save-recipe').addEventListener('click',()=>this.saveRecipe());
    document.getElementById('btn-add-ingredient').addEventListener('click',()=>this.addIngredientRow());
    document.getElementById('modal-recipe-add').addEventListener('click',e=>{if(e.target===e.currentTarget)this.closeRecipeAddModal();});
    document.getElementById('btn-close-recipe-add').addEventListener('click',()=>this.closeRecipeAddModal());
    document.getElementById('btn-confirm-recipe-add').addEventListener('click',()=>this.confirmRecipeAdd());
    document.querySelectorAll('[data-srv]').forEach(btn=>btn.addEventListener('click',()=>{
      document.querySelectorAll('[data-srv]').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('recipe-add-servings').value=btn.dataset.srv;
      this.updateRecipeAddPreview();
    }));
    document.getElementById('recipe-add-servings').addEventListener('input',()=>{
      document.querySelectorAll('[data-srv]').forEach(b=>b.classList.remove('selected'));
      this.updateRecipeAddPreview();
    });
  },

  renderRecipes() {
    // Also refresh AI recommendations panel
    this.renderRecommendations();

    const recipes=DB.recipes(), list=document.getElementById('recipe-list');
    if(!recipes.length){
      list.innerHTML=`<p class="text-muted text-center" style="padding:16px">Sin recetas propias aún. Toca + para crear una.</p>`;
      return;
    }
    list.innerHTML=recipes.map(r=>`
      <div class="recipe-item">
        <div class="recipe-icon">📖</div>
        <div class="recipe-info">
          <div class="recipe-name">${esc(r.name)}</div>
          <div class="recipe-detail">${r.servings} porción${r.servings>1?'es':''} · ${r.perKcal} kcal c/u · P:${r.perProt}g C:${r.perCarbs}g G:${r.perFat}g</div>
        </div>
        <div class="recipe-actions">
          <button class="food-add-btn" data-add="${r.id}" title="Añadir al registro"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
          <button class="btn-task-action delete" data-del-recipe="${r.id}" title="Eliminar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg></button>
        </div>
      </div>`).join('');
    list.querySelectorAll('[data-add]').forEach(btn=>btn.addEventListener('click',()=>this.openRecipeAddModal(btn.dataset.add)));
    list.querySelectorAll('[data-del-recipe]').forEach(btn=>btn.addEventListener('click',()=>{
      if(!confirm('¿Eliminar esta receta?')) return;
      DB.saveRecipes(DB.recipes().filter(r=>r.id!==btn.dataset.delRecipe));
      this.renderRecipes(); toast('Receta eliminada','info');
    }));
  },

  // ── RECIPE AI RECOMMENDATIONS ────────────────────────────
  _getMealTypeByHour() {
    const h = new Date().getHours();
    if (h < 10) return 'breakfast';
    if (h < 14) return 'lunch';
    if (h < 19) return 'dinner';
    return 'snack';
  },

  // Returns the serving multiplier (0.5–3×) that best fits targetKcal
  _bestServing(recipeKcal, targetKcal) {
    const opts = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];
    let best = 1.0, bestDiff = Infinity;
    opts.forEach(m => {
      const diff = Math.abs(recipeKcal * m - targetKcal);
      if (diff < bestDiff) { bestDiff = diff; best = m; }
    });
    return best;
  },

  // targetKcal: ideal kcal for this specific meal slot (goal × SLOT_FRACTIONS)
  // remaining:  kcal still available today (to avoid going over budget)
  _scoreRecipe(recipe, likedSet, targetKcal, remaining, cuttingStyle, todayMicros) {
    const matches = recipe.ingredients.filter(i => likedSet.has(i)).length;
    if (matches === 0) return -1;
    // Find best serving multiplier to match the slot target
    const mult = this._bestServing(recipe.kcal, targetKcal);
    const scaledKcal = Math.round(recipe.kcal * mult);
    // Hard filter: scaled portion can't exceed remaining budget by >15%
    if (remaining > 0 && scaledKcal > remaining * 1.15) return -1;
    let score = 0;

    // 1. Ingredient overlap (max 50)
    score += Math.min(matches * 12, 50);

    // 2. Calorie fit with best serving size (max 25)
    const effectiveTarget = remaining > 0 ? Math.min(targetKcal, remaining) : targetKcal;
    const diff = Math.abs(scaledKcal - effectiveTarget);
    score += Math.max(0, 25 - Math.round(diff / 20));

    // 3. Protein quality (max 25): higher weight during cut/maintenance
    const protRatio = (recipe.prot * 4) / recipe.kcal;
    const protWeight = (cuttingStyle?.includes('cut') || cuttingStyle === 'maintenance') ? 25 : 15;
    score += Math.round(protRatio * protWeight);

    // 4. Micronutrient gap bonus (max 20): reward recipes covering deficient nutrients
    if (todayMicros) {
      const recipeMicros = calcRecipeMicros(recipe);
      let bonus = 0; let counted = 0;
      Object.entries(recipeMicros).forEach(([k, v]) => {
        const m = MICROS[k];
        if (!m) return;
        const covered = todayMicros[k] || 0;
        if (covered / m.rda < 0.6) {
          bonus += Math.min(v / m.rda, 0.5);
          counted++;
        }
      });
      if (counted > 0) score += Math.min(Math.round((bonus / counted) * 40), 20);
    }

    return score;
  },

  _getTodayMicros() {
    const totals = Object.fromEntries(MICRO_KEYS.map(k => [k, 0]));
    DB.todayFood().forEach(f => MICRO_KEYS.forEach(k => { if (f[k] != null) totals[k] += f[k]; }));
    return totals;
  },

  _getRecommendations(mealType) {
    const prefs = DB.foodPrefs();
    if (!prefs || !prefs.liked || prefs.liked.length < 3) return null;
    const likedSet  = new Set(prefs.liked);
    const consumed  = DB.todayFood().reduce((a, f) => a + f.kcal, 0);
    const burned    = DB.todayExercise().reduce((a, e) => a + (e.kcalBurned || 0), 0);
    const goal      = DB.settings().calorieGoal;
    const style     = DB.settings().cuttingStyle;
    const remaining = Math.max((goal + burned) - consumed, 0);
    const todayMicros = this._getTodayMicros();
    // Target for this meal = fixed fraction of daily goal (not a fraction of remaining)
    const slotTarget  = Math.round(goal * (SLOT_FRACTIONS[mealType] || 0.25));
    const candidates = RECIPE_DB
      .filter(r => r.mealType === mealType || (remaining < slotTarget * 0.6 && r.mealType === 'snack'))
      .map(r => {
        const score = this._scoreRecipe(r, likedSet, slotTarget, remaining, style, todayMicros);
        const mult  = this._bestServing(r.kcal, slotTarget);
        return {
          ...r, score, mult,
          scaledKcal:  Math.round(r.kcal  * mult),
          scaledProt:  +(r.prot  * mult).toFixed(1),
          scaledCarbs: +(r.carbs * mult).toFixed(1),
          scaledFat:   +(r.fat   * mult).toFixed(1),
        };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    return { recommendations: candidates, remaining, mealType, slotTarget };
  },

  // Returns top recipes ignoring calorie constraints — scored by ingredient preference and pantry match only
  _getCheatRecommendations() {
    const prefs = DB.foodPrefs();
    const likedSet = new Set(prefs?.liked || []);
    const pantrySet = new Set(DB.pantry().map(i => i.ingredientId).filter(Boolean));
    return RECIPE_DB
      .map(r => {
        const prefMatches   = r.ingredients.filter(i => likedSet.has(i)).length;
        const pantryMatches = r.ingredients.filter(i => pantrySet.has(i)).length;
        const score = prefMatches * 10 + pantryMatches * 5;
        return { ...r, score, mult: 1, scaledKcal: r.kcal, scaledProt: r.prot, scaledCarbs: r.carbs, scaledFat: r.fat };
      })
      .filter(r => r.score > 0 || r.ingredients.length > 0)
      .sort((a, b) => b.score - a.score);
  },

  // Pantry CRUD ──────────────────────────────────────────────────
  bindPantryModal() {
    document.getElementById('btn-open-pantry')?.addEventListener('click', () => this.openPantry());
    document.getElementById('btn-close-pantry')?.addEventListener('click', () => this.closePantry());
    document.getElementById('modal-pantry')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) this.closePantry();
    });
    document.getElementById('btn-save-pantry-item')?.addEventListener('click', () => this.savePantryItem());
    document.getElementById('pantry-item-name')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.savePantryItem();
    });
    document.getElementById('btn-toggle-cheat-meal')?.addEventListener('click', () => this.toggleCheatMeal());
  },

  openPantry() {
    this.renderPantry();
    document.getElementById('modal-pantry').classList.add('open');
  },

  closePantry() {
    document.getElementById('modal-pantry').classList.remove('open');
  },

  savePantryItem() {
    const nameEl = document.getElementById('pantry-item-name');
    const qtyEl  = document.getElementById('pantry-item-qty');
    const unitEl = document.getElementById('pantry-item-unit');
    const ingEl  = document.getElementById('pantry-item-ingredient');
    const name = nameEl.value.trim();
    if (!name) { toast('Escribe un nombre', 'error'); return; }
    const item = {
      id:           Date.now(),
      name,
      qty:          parseFloat(qtyEl.value) || 1,
      unit:         unitEl.value || 'ud.',
      ingredientId: ingEl.value || null,
      addedAt:      new Date().toISOString(),
    };
    DB.savePantry([...DB.pantry(), item]);
    nameEl.value = '';
    qtyEl.value  = '1';
    ingEl.value  = '';
    CloudSync.schedulePush?.();
    this.renderPantry();
    toast(`${name} añadido a la despensa ✓`, 'success');
  },

  removePantryItem(id) {
    DB.savePantry(DB.pantry().filter(i => i.id !== id));
    CloudSync.schedulePush?.();
    this.renderPantry();
  },

  renderPantry() {
    const items = DB.pantry();
    const list  = document.getElementById('pantry-list');
    if (!list) return;
    if (!items.length) {
      list.innerHTML = '<p style="color:var(--text-muted);font-size:14px;text-align:center;padding:16px 0">Tu despensa está vacía. Añade ingredientes para recibir recomendaciones personalizadas.</p>';
      return;
    }
    list.innerHTML = items.map(item => `
      <div class="pantry-item" data-id="${item.id}">
        <div class="pantry-item-info">
          <span class="pantry-item-name">${item.name}</span>
          <span class="pantry-item-qty">${item.qty} ${item.unit}</span>
        </div>
        <button class="btn-icon pantry-remove-btn" data-id="${item.id}" aria-label="Eliminar">✕</button>
      </div>
    `).join('');
    list.querySelectorAll('.pantry-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => this.removePantryItem(Number(btn.dataset.id)));
    });
    // Update cheat meal badge in food view
    this._updatePantryBadge();
  },

  _updatePantryBadge() {
    const badge = document.getElementById('pantry-count-badge');
    if (badge) {
      const n = DB.pantry().length;
      badge.textContent = n;
      badge.style.display = n ? '' : 'none';
    }
    const cheatBtn = document.getElementById('btn-toggle-cheat-meal');
    if (cheatBtn) {
      const active = DB.settings().cheatMealEnabled;
      cheatBtn.classList.toggle('cheat-active', !!active);
      cheatBtn.title = active ? 'Modo cheat meal ACTIVO — click para desactivar' : 'Activar modo cheat meal';
    }
  },

  toggleCheatMeal() {
    const s = DB.settings();
    const next = !s.cheatMealEnabled;
    DB.saveSettings({ ...s, cheatMealEnabled: next });
    this._updatePantryBadge();
    toast(next ? '🍕 Modo cheat meal activado' : '🥗 Modo normal restaurado', 'success');
    this.renderRecommendations();
  },

  renderRecommendations() {
    const panel = document.getElementById('rec-panel');
    if (!panel || panel.style.display === 'none') return;
    const prefs   = DB.foodPrefs();
    const hasPrefs = prefs && prefs.liked && prefs.liked.length >= 3;
    const MEAL_LABELS = { breakfast:'Desayuno', lunch:'Almuerzo', dinner:'Cena', snack:'Snack' };

    if (!hasPrefs) {
      panel.innerHTML = `
        <div class="rec-setup-banner">
          <div class="rec-setup-icon">🥗</div>
          <div class="rec-setup-text">
            <div style="font-weight:700;font-size:14px;margin-bottom:3px">Personaliza tus recomendaciones</div>
            <div style="font-size:12px;color:var(--text-muted);line-height:1.4">Indica qué ingredientes te gustan y el sistema sugerirá recetas ideales para tu meta y momento del día.</div>
          </div>
        </div>
        <button class="btn btn-primary" id="btn-open-prefs-banner" style="width:100%">🥗 Configurar preferencias</button>`;
      document.getElementById('btn-open-prefs-banner')?.addEventListener('click', () => this.openIngredientPrefs());
      return;
    }

    const cheat = DB.settings().cheatMealEnabled;
    const mealType = this._getMealTypeByHour();
    const pantrySet = new Set(DB.pantry().map(i => i.ingredientId).filter(Boolean));
    let displayList, remText, headerLabel;

    if (cheat) {
      displayList = this._getCheatRecommendations().slice(0, 5);
      remText = '🍕 Modo cheat meal';
      headerLabel = 'Antojo del día';
    } else {
      const rec = this._getRecommendations(mealType);
      if (!rec || !rec.recommendations.length) {
        panel.innerHTML = `<p class="text-muted text-center" style="padding:16px 0;font-size:13px">¡Meta del día casi cubierta! 🎉<br>No quedan muchas calorías disponibles.</p>`;
        return;
      }
      displayList = rec.recommendations;
      remText = rec.remaining > 0 ? `${rec.remaining} kcal disponibles` : '¡Meta alcanzada!';
      headerLabel = MEAL_LABELS[rec.mealType];
    }

    if (!displayList.length) {
      panel.innerHTML = `<p class="text-muted text-center" style="padding:16px 0;font-size:13px">Sin recomendaciones disponibles.</p>`;
      return;
    }

    const likedSet = new Set(prefs.liked);
    const maxScore = Math.max(...displayList.map(r => r.score), 1);

    panel.innerHTML = `
      <div class="rec-header">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="rec-meal-badge${cheat ? ' cheat-badge' : ''}">${headerLabel}</span>
          <span style="font-size:11px;color:var(--text-muted)">${remText}</span>
        </div>
        <button class="btn-text-sm" id="btn-edit-prefs">✏️ Prefs</button>
      </div>
      <div class="rec-list">
        ${displayList.map(r => {
          const matchCount = r.ingredients.filter(i => likedSet.has(i)).length;
          const pantryMatch = pantrySet.size > 0 && r.ingredients.filter(i => pantrySet.has(i)).length;
          const fitPct = Math.round((r.score / maxScore) * 100);
          const multLabel = r.mult !== 1
            ? `<span class="rec-serving-badge">${r.mult}× porción</span>`
            : '';
          // Top 3 micronutrients (scaled by serving multiplier)
          const rMicros = calcRecipeMicros(r);
          const microHighlights = Object.entries(rMicros)
            .filter(([k]) => MICROS[k])
            .map(([k, v]) => ({ label:MICROS[k].label, pct: Math.round((v * r.mult / MICROS[k].rda)*100) }))
            .filter(m => m.pct >= 10)
            .sort((a,b) => b.pct - a.pct)
            .slice(0, 3);
          return `<div class="rec-card" data-rec-detail="${r.id}" data-rec-mult="${r.mult}" style="cursor:pointer">
            <div class="rec-card-header">
              <span class="rec-card-emoji">${r.emoji}</span>
              <div class="rec-card-info">
                <div class="rec-card-name">${r.name} ${multLabel}</div>
                <div class="rec-card-meta">⏱ ${r.prepTime} min · ${r.servingDesc}</div>
              </div>
              <button class="rec-add-btn" data-rec-add="${r.id}" data-rec-mult="${r.mult}" title="Añadir al registro">+</button>
            </div>
            <div class="rec-macros">
              <span class="rec-macro-chip kcal">${r.scaledKcal} kcal</span>
              <span class="rec-macro-chip prot">P ${r.scaledProt}g</span>
              <span class="rec-macro-chip carbs">C ${r.scaledCarbs}g</span>
              <span class="rec-macro-chip fat">G ${r.scaledFat}g</span>
            </div>
            ${microHighlights.length ? `<div class="rec-micro-row">${microHighlights.map(m =>
              `<span class="rec-micro-chip">🧬 ${m.label} ${m.pct}% IDR</span>`
            ).join('')}</div>` : ''}
            <div class="rec-match-row">
              <div class="rec-match-bar-wrap"><div class="rec-match-bar-fill" style="width:${fitPct}%"></div></div>
              <span class="rec-match-label">${matchCount} ingredientes favoritos${pantryMatch ? ` · 🧺 ${pantryMatch} en despensa` : ''}</span>
            </div>
          </div>`;
        }).join('')}
      </div>`;
    panel.querySelectorAll('[data-rec-add]').forEach(btn =>
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this.addRecipeDbEntry(btn.dataset.recAdd, parseFloat(btn.dataset.recMult) || 1);
      })
    );
    panel.querySelectorAll('[data-rec-detail]').forEach(card =>
      card.addEventListener('click', () =>
        this.openRecipeDetail(card.dataset.recDetail, parseFloat(card.dataset.recMult) || 1)
      )
    );
    document.getElementById('btn-edit-prefs')?.addEventListener('click', () => this.openIngredientPrefs());
    this._updatePantryBadge();
  },

  addRecipeDbEntry(recipeId, mult = 1) {
    const r = RECIPE_DB.find(x => x.id === recipeId);
    if (!r) return;
    const name = mult !== 1 ? `${r.name} (×${mult})` : r.name;
    DB.addFood({
      id: `fd_${Date.now()}`,
      name, qty: mult,
      kcal:  Math.round(r.kcal  * mult),
      prot:  +(r.prot  * mult).toFixed(1),
      carbs: +(r.carbs * mult).toFixed(1),
      fat:   +(r.fat   * mult).toFixed(1),
      source: 'recipe_db', recipeDbId: r.id,
    });
    this.renderFoodLog();
    this.updateFoodBar();
    toast(`${r.emoji} ${name} añadida al registro`, 'success');
  },

  // ── RECIPE DETAIL MODAL ───────────────────────────────────
  openRecipeDetail(recipeId, mult = 1) {
    const r = RECIPE_DB.find(x => x.id === recipeId);
    if (!r) return;

    document.getElementById('rd-emoji').textContent = r.emoji;
    document.getElementById('rd-name').textContent  = mult !== 1 ? `${r.name} (×${mult})` : r.name;
    document.getElementById('rd-meta').textContent  = `⏱ ${r.prepTime} min · ${r.servingDesc}`;

    const scaledKcal  = Math.round(r.kcal  * mult);
    const scaledProt  = +(r.prot  * mult).toFixed(1);
    const scaledCarbs = +(r.carbs * mult).toFixed(1);
    const scaledFat   = +(r.fat   * mult).toFixed(1);

    document.getElementById('rd-macros').innerHTML = `
      <span class="rec-macro-chip kcal">${scaledKcal} kcal</span>
      <span class="rec-macro-chip prot">P ${scaledProt}g</span>
      <span class="rec-macro-chip carbs">C ${scaledCarbs}g</span>
      <span class="rec-macro-chip fat">G ${scaledFat}g</span>`;

    const amounts = RECIPE_AMOUNTS[recipeId] || [];
    document.getElementById('rd-ingredients').innerHTML = amounts.length
      ? amounts.map(item => {
          let qtyText;
          if (item.qty === 0) {
            qtyText = item.unit; // "al gusto"
          } else {
            const scaled = item.qty * mult;
            const display = scaled % 1 === 0 ? scaled.toFixed(0) : scaled.toFixed(1);
            qtyText = `${display} ${item.unit}`;
          }
          return `<div class="rd-ing-row">
            <span class="rd-ing-name">${item.label}</span>
            <span class="rd-ing-qty">${qtyText}</span>
          </div>`;
        }).join('')
      : '<p style="color:var(--text-muted);font-size:13px;text-align:center">Sin datos de cantidades</p>';

    // Steps
    const steps = RECIPE_STEPS[recipeId] || [];
    document.getElementById('rd-steps').innerHTML = steps.length
      ? `<ol class="rd-step-list">${steps.map(s => `<li class="rd-step-item">${s}</li>`).join('')}</ol>`
      : '<p style="color:var(--text-muted);font-size:13px">Sin instrucciones disponibles</p>';

    document.getElementById('rd-add-btn').onclick = () => {
      this.addRecipeDbEntry(recipeId, mult);
      this.closeModal('modal-recipe-detail');
    };

    this.openModal('modal-recipe-detail');
  },

  // ── INGREDIENT PREFERENCES MODAL ─────────────────────────
  openIngredientPrefs() {
    this.renderIngredientPrefs();
    this.openModal('modal-food-prefs');
  },

  closeIngredientPrefs() { this.closeModal('modal-food-prefs'); },

  renderIngredientPrefs() {
    const liked = new Set(DB.foodPrefs()?.liked || []);
    const CAT_EMOJI = { 'Proteínas':'🥩','Verduras':'🥦','Carbohidratos':'🍚','Grasas':'🥑','Lácteos':'🥛','Legumbres':'🫘' };
    const cats = [...new Set(INGREDIENTS.map(i => i.cat))];
    document.getElementById('pref-ingredient-grid').innerHTML = cats.map(cat => `
      <div class="pref-cat-header">${CAT_EMOJI[cat] || ''} ${cat}</div>
      <div class="pref-chip-row">
        ${INGREDIENTS.filter(i => i.cat === cat).map(i =>
          `<button class="pref-chip ${liked.has(i.id) ? 'selected' : ''}" data-pref-id="${i.id}">${i.emoji} ${i.label}</button>`
        ).join('')}
      </div>`).join('');
    document.querySelectorAll('.pref-chip').forEach(btn =>
      btn.addEventListener('click', () => { btn.classList.toggle('selected'); this._updatePrefCount(); })
    );
    this._updatePrefCount();
  },

  _updatePrefCount() {
    const count = document.querySelectorAll('.pref-chip.selected').length;
    const el = document.getElementById('pref-count-label');
    if (el) el.textContent = count
      ? `${count} ingrediente${count > 1 ? 's' : ''} seleccionado${count > 1 ? 's' : ''}`
      : 'Selecciona al menos 3 ingredientes';
    const btn = document.getElementById('btn-save-prefs');
    if (btn) btn.disabled = count < 3;
  },

  saveIngredientPrefs() {
    const liked = [...document.querySelectorAll('.pref-chip.selected')].map(b => b.dataset.prefId);
    DB.saveFoodPrefs({ liked, updatedAt: new Date().toISOString() });
    this.closeIngredientPrefs();
    this.renderRecommendations();
    toast(`✓ Preferencias guardadas · ${liked.length} ingredientes`, 'success');
  },

  openRecipeModal(id=null) {
    this.editRecipeId=id;
    document.getElementById('modal-recipe-title').textContent=id?'Editar Receta':'Nueva Receta';
    document.getElementById('recipe-name').value='';
    document.getElementById('recipe-servings').value='1';
    document.getElementById('recipe-description').value='';
    document.getElementById('ingredient-list').innerHTML='';
    document.getElementById('recipe-total-preview').style.display='none';
    if(!id) this.addIngredientRow();
    // TODO: populate for edit
    this.openModal('modal-recipe');
    document.getElementById('recipe-name').focus();
  },

  closeRecipeModal() { this.closeModal('modal-recipe'); this.editRecipeId=null; },

  addIngredientRow() {
    const list=document.getElementById('ingredient-list');
    // Header on first row
    if(!list.children.length){
      const hdr=document.createElement('div');
      hdr.className='ingredient-header';
      hdr.innerHTML='<span>Ingrediente</span><span>g</span><span>kcal/100g</span><span>P/100g</span><span>C/100g</span><span></span>';
      list.appendChild(hdr);
    }
    const row=document.createElement('div');
    row.className='ingredient-row';
    row.innerHTML=`
      <input type="text"   placeholder="Nombre..." class="ing-name">
      <input type="number" placeholder="100" min="1" class="ing-qty" style="text-align:center">
      <input type="number" placeholder="0" min="0" class="ing-kcal" style="text-align:center">
      <input type="number" placeholder="0" min="0" class="ing-prot" style="text-align:center">
      <input type="number" placeholder="0" min="0" class="ing-carbs" style="text-align:center">
      <button class="btn-remove-ing" type="button"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
    row.querySelector('.btn-remove-ing').addEventListener('click',()=>{row.remove();this.updateRecipeTotals();});
    row.querySelectorAll('input').forEach(i=>i.addEventListener('input',()=>this.updateRecipeTotals()));
    list.appendChild(row);
  },

  updateRecipeTotals() {
    const rows=[...document.querySelectorAll('.ingredient-row')];
    if(!rows.length){document.getElementById('recipe-total-preview').style.display='none';return;}
    let totalKcal=0,totalProt=0,totalCarbs=0;
    rows.forEach(row=>{
      const qty=parseFloat(row.querySelector('.ing-qty')?.value)||0;
      const k=parseFloat(row.querySelector('.ing-kcal')?.value)||0;
      const p=parseFloat(row.querySelector('.ing-prot')?.value)||0;
      const c=parseFloat(row.querySelector('.ing-carbs')?.value)||0;
      const f=qty/100;
      totalKcal+=Math.round(k*f); totalProt+=+(p*f).toFixed(1); totalCarbs+=+(c*f).toFixed(1);
    });
    const srv=parseInt(document.getElementById('recipe-servings')?.value)||1;
    document.getElementById('recipe-total-preview').style.display='block';
    document.getElementById('recipe-total-text').textContent=
      `Total: ${totalKcal} kcal · Por porción: ${Math.round(totalKcal/srv)} kcal · P:${(totalProt/srv).toFixed(1)}g C:${(totalCarbs/srv).toFixed(1)}g`;
  },

  saveRecipe() {
    const name=document.getElementById('recipe-name').value.trim();
    if(!name){toast('El nombre es obligatorio','error');return;}
    const servings=parseInt(document.getElementById('recipe-servings').value)||1;
    const rows=[...document.querySelectorAll('.ingredient-row')];
    if(!rows.length){toast('Añade al menos un ingrediente','error');return;}

    const ingredients=rows.map(row=>({
      name: row.querySelector('.ing-name')?.value.trim()||'Ingrediente',
      qty:  parseFloat(row.querySelector('.ing-qty')?.value)||100,
      kcal100: parseFloat(row.querySelector('.ing-kcal')?.value)||0,
      prot100: parseFloat(row.querySelector('.ing-prot')?.value)||0,
      carbs100: parseFloat(row.querySelector('.ing-carbs')?.value)||0,
    })).map(i=>{
      const f=i.qty/100;
      return { name:i.name, qty:i.qty,
               kcal:Math.round(i.kcal100*f), prot:+(i.prot100*f).toFixed(1),
               carbs:+(i.carbs100*f).toFixed(1), fat:0 };
    });

    const totKcal=ingredients.reduce((a,i)=>a+i.kcal,0);
    const totProt=ingredients.reduce((a,i)=>a+i.prot,0);
    const totCarbs=ingredients.reduce((a,i)=>a+i.carbs,0);

    const recipe={
      id: this.editRecipeId||`r_${Date.now()}`,
      name, servings,
      description: document.getElementById('recipe-description').value.trim(),
      ingredients,
      totalKcal:totKcal, totalProt:+totProt.toFixed(1), totalCarbs:+totCarbs.toFixed(1), totalFat:0,
      perKcal:Math.round(totKcal/servings), perProt:+(totProt/servings).toFixed(1),
      perCarbs:+(totCarbs/servings).toFixed(1), perFat:0,
      createdAt:new Date().toISOString()
    };

    const recipes=DB.recipes();
    if(this.editRecipeId){ const i=recipes.findIndex(r=>r.id===this.editRecipeId); if(i!==-1)recipes[i]=recipe; }
    else recipes.push(recipe);
    DB.saveRecipes(recipes);
    toast(`Receta "${name}" guardada ✓`,'success');
    this.closeRecipeModal(); this.renderRecipes();
  },

  openRecipeAddModal(recipeId) {
    const recipe=DB.recipes().find(r=>r.id===recipeId); if(!recipe) return;
    this.pendingRecipe=recipe;
    document.getElementById('recipe-add-name').textContent=recipe.name;
    document.getElementById('recipe-add-info').textContent=`${recipe.perKcal} kcal · P:${recipe.perProt}g C:${recipe.perCarbs}g G:${recipe.perFat}g por porción`;
    document.getElementById('recipe-add-servings').value='1';
    document.querySelectorAll('[data-srv]').forEach(b=>b.classList.remove('selected'));
    document.querySelector('[data-srv="1"]')?.classList.add('selected');
    this.updateRecipeAddPreview();
    this.openModal('modal-recipe-add');
  },

  closeRecipeAddModal() { this.closeModal('modal-recipe-add'); this.pendingRecipe=null; },

  updateRecipeAddPreview() {
    const r=this.pendingRecipe; if(!r) return;
    const srv=parseFloat(document.getElementById('recipe-add-servings').value)||1;
    document.getElementById('recipe-add-preview').textContent=
      `${Math.round(r.perKcal*srv)} kcal · P:${(r.perProt*srv).toFixed(1)}g C:${(r.perCarbs*srv).toFixed(1)}g G:${(r.perFat*srv).toFixed(1)}g`;
  },

  confirmRecipeAdd() {
    const r=this.pendingRecipe; if(!r) return;
    const srv=parseFloat(document.getElementById('recipe-add-servings').value)||1;
    const entry={
      id:`f_${Date.now()}`, name:`${r.name} (×${srv})`,
      qty:Math.round(srv*100), kcal:Math.round(r.perKcal*srv),
      prot:+(r.perProt*srv).toFixed(1), carbs:+(r.perCarbs*srv).toFixed(1),
      fat:+(r.perFat*srv).toFixed(1), isRecipe:true, recipeId:r.id
    };
    // Pasar micronutrientes de la receta al registro (escalado por porciones)
    const MICRO_MAP = {
      vitA:'perVitA', vitC:'perVitC', vitD:'perVitD', vitE:'perVitE',
      vitK:'perVitK', vitB6:'perVitB6', vitB12:'perVitB12', folate:'perFolate',
      iron:'perIron', calcium:'perCalcium', magnesium:'perMagnesium',
      zinc:'perZinc', potassium:'perPotassium', sodium:'perSodium', fiber:'perFiber'
    };
    Object.entries(MICRO_MAP).forEach(([logKey, recipeKey]) => {
      if (r[recipeKey] != null) entry[logKey] = +((r[recipeKey] * srv).toFixed(3));
    });
    DB.addFood(entry);
    toast(`${r.name} añadido ✓`,'success');
    this.closeRecipeAddModal();
    this.renderFoodLog(); this.updateFoodBar();
    if(this.view==='dashboard') this.renderDashboard();
  },

  // ================================================================
  // PROGRESS — Water / Weight / Micros
  // ================================================================
  bindWater() {
    // Progress view buttons
    document.querySelectorAll('#view-progress .water-quick-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const ml=parseInt(btn.dataset.ml);
        DB.addWater(ml);
        toastUndo(`+${ml}ml 💧`, () => {
          DB.removeWater(ml);
          this.renderWater();
          if(this.view==='dashboard') this.renderDashboard();
        }, 'info');
        this.renderWater();
        if(this.view==='dashboard') this.renderDashboard();
      });
    });
    document.getElementById('btn-water-custom').addEventListener('click',()=>{
      const wrap=document.getElementById('water-custom-wrap');
      wrap.style.display=wrap.style.display==='none'?'block':'none';
    });
    const applyCustomWater = (sign) => {
      const inp = document.getElementById('water-custom-input');
      const ml  = parseInt(inp.value) || 0;
      if(ml<10||ml>3000){toast('Cantidad inválida','error');return;}
      if (sign < 0) { const total = DB.removeWater(ml); toast(`−${ml}ml 💧 (total ${total}ml)`,'info'); }
      else          { DB.addWater(ml); toast(`+${ml}ml 💧`,'info'); }
      inp.value='';
      document.getElementById('water-custom-wrap').style.display='none';
      this.renderWater();
      if(this.view==='dashboard') this.renderDashboard();
    };
    document.getElementById('btn-water-add-custom').addEventListener('click',()=>applyCustomWater(1));
    document.getElementById('btn-water-remove-custom')?.addEventListener('click',()=>applyCustomWater(-1));
  },

  bindWeightModal() {
    document.getElementById('btn-log-weight').addEventListener('click',()=>this.openWeightModal());
    document.getElementById('dash-weight-card').addEventListener('click',()=>{ this.navigate('progress'); });
    document.getElementById('modal-weight').addEventListener('click',e=>{if(e.target===e.currentTarget)this.closeWeightModal();});
    document.getElementById('btn-close-weight').addEventListener('click',()=>this.closeWeightModal());
    document.getElementById('btn-save-weight').addEventListener('click',()=>this.saveWeight());
  },

  openWeightModal() {
    document.getElementById('weight-input').value='';
    document.getElementById('weight-note').value='';
    this.openModal('modal-weight');
    document.getElementById('weight-input').focus();
  },

  closeWeightModal() { this.closeModal('modal-weight'); },

  saveWeight() {
    const kg=parseFloat(document.getElementById('weight-input').value);
    if(!kg||kg<20||kg>300){toast('Ingresa un peso válido (20-300 kg)','error');return;}
    const note=document.getElementById('weight-note').value.trim();
    DB.logWeight(kg,note);
    toast(`Peso ${kg} kg registrado ✓`,'success');
    this.closeWeightModal(); this.renderProgress();
    if(this.view==='dashboard') this.renderDashboard();
  },

  bindMicroDays() {
    document.getElementById('micro-days')?.addEventListener('change',()=>this.renderMicros());
  },

  // ================================================================
  // FASTING TIMER BINDINGS
  // ================================================================
  bindFasting() {
    document.getElementById('btn-fasting-start')?.addEventListener('click', () => {
      const s = Fasting.get();
      if (s.running) { Fasting.stop(); } else { Fasting.start(); }
      this._renderFasting();
    });
    document.getElementById('btn-fasting-reset')?.addEventListener('click', () => {
      Fasting.reset(); this._renderFasting();
    });
    document.querySelectorAll('.fasting-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const h = parseInt(btn.dataset.h);
        const s = Fasting.get();
        Fasting.save({...s, target: h});
        this._renderFasting();
      });
    });
  },

  // ================================================================
  // EXPORT DATA
  // ================================================================
  exportJSON() {
    const data = {
      exported: new Date().toISOString(),
      settings:    DB.settings(),
      tasks:       DB.tasks(),
      foodLog:     DB.foodLog(),
      waterLog:    DB.waterLog(),
      weightLog:   DB.weightLog(),
      recipes:     DB.recipes(),
      exerciseLog: DB.exerciseLog(),
      wellness:    DB.wellness(),
      mealPlan:    DB.mealPlan(),
      lifts:       DB.lifts(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `lifetrack-backup-${today()}.json`;
    a.click(); URL.revokeObjectURL(url);
    toast('Backup exportado ✓', 'success');
  },

  exportCSV() {
    const food = DB.foodLog();
    const rows = [['Fecha','Nombre','Marca','Kcal','Proteína(g)','Carbos(g)','Grasa(g)','Cantidad(g)','Slot']];
    Object.entries(food).sort().forEach(([date, entries]) => {
      (entries || []).forEach(e => {
        rows.push([date, e.name||'', e.brand||'', e.kcal||0,
                   e.prot||0, e.carbs||0, e.fat||0, e.qty||'', e.slot||'']);
      });
    });
    const csv  = rows.map(r => r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `lifetrack-food-${today()}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast('CSV exportado ✓', 'success');
  },

  renderProgress() {
    this.renderWellnessCard();
    this.renderExercise();
    this.renderWater();
    this.renderWeight();
    this.renderBenchmark();
    this.renderStrength();
    this.renderCycle();
    this.renderSupplements();
    this.renderMicros();
  },

  // ================================================================
  // POPULATION BENCHMARK — percentile vs healthy distribution
  // ================================================================
  renderBenchmark() {
    const body = document.getElementById('benchmark-body');
    const sub  = document.getElementById('benchmark-sub');
    if (!body) return;

    const s       = DB.settings();
    const weights = DB.weightLog();
    const kg      = weights.length ? weights[weights.length - 1].kg : null;
    const sex     = s.gender === 'female' ? 'female' : 'male';

    const bmi = Benchmark.bmi(kg, s.height);
    const bf  = this._calcBodyFat(s);                       // Navy method (needs neck/waist)
    const ffmi = Benchmark.ffmi(kg, s.height, bf);          // muscle half of BMI
    const rfm  = Benchmark.rfm(s.height, s.waist, sex);     // body-fat % cross-check
    const bfHealthy = Benchmark.healthyRange('body_fat_pct', sex);

    // Build the metrics we can compute, splitting BMI into its fat & muscle parts.
    const metrics = [];
    if (bmi) {
      // BMI ↔ body-composition discordance flag (the "adjustment" insight).
      let note = null;
      if (bf != null && bfHealthy) {
        if (bmi >= 25 && bf <= bfHealthy.max)
          note = { text:'⚠️ El IMC te sobreestima: tu masa magra es alta, no exceso de grasa.', color:'#10b981' };
        else if (bmi < 25 && bf > bfHealthy.max)
          note = { text:'⚠️ Peso normal pero grasa elevada (tipo «skinny-fat»): vigila tu composición.', color:'#f59e0b' };
        else
          note = { text:'✓ IMC y composición corporal concuerdan.', color:'var(--text-muted)' };
      } else {
        note = { text:'Añade medidas (cuello/cintura) en Ajustes para afinar con composición corporal.', color:'var(--text-muted)' };
      }
      metrics.push({ key:'bmi', label:'IMC', value:bmi, fmt:v=>v.toFixed(1), note });
    }
    if (bf != null) {
      const note = rfm != null
        ? { text:`Estimación cruzada (RFM por cintura/altura): ${rfm}%`, color:'var(--text-muted)' }
        : null;
      metrics.push({ key:'body_fat_pct', label:'Grasa corporal', value:bf, fmt:v=>v+'%', note });
    }
    if (ffmi != null) {
      metrics.push({ key:'ffmi', label:'Músculo (FFMI)', value:ffmi, fmt:v=>v.toFixed(1), higherBetter:true });
    }

    if (!metrics.length) {
      sub.textContent = 'Faltan datos';
      body.innerHTML = `<p style="font-size:13px;color:var(--text-muted);padding:8px 0">
        Añade tu <strong>altura</strong> y registra tu <strong>peso</strong> para ver tu percentil.
        (Grasa y músculo requieren medidas de cuello/cintura en Ajustes.)</p>`;
      return;
    }

    const ageTxt = s.age ? `${s.age} años` : 'edad sin definir';
    sub.textContent = `${sex === 'female' ? 'Mujeres' : 'Hombres'} · ${ageTxt}`;

    body.innerHTML = metrics.map(m => {
      const pct     = Benchmark.percentile(m.key, m.value, sex, s.age);
      const healthy = Benchmark.healthyRange(m.key, sex);
      const hMinPct = healthy ? Benchmark.percentile(m.key, healthy.min, sex, s.age) : null;
      const hMaxPct = healthy ? Benchmark.percentile(m.key, healthy.max, sex, s.age) : null;
      const inHealthy = healthy && m.value >= healthy.min && m.value <= healthy.max;

      // For "higher is better" metrics (muscle), being above the band is good.
      let status;
      if (inHealthy)                          status = { text:'Dentro del rango saludable', color:'#10b981' };
      else if (m.higherBetter)                status = (healthy && m.value > healthy.max)
        ? { text:'Musculatura excelente', color:'#10b981' }
        : { text:'Masa muscular baja — gana músculo', color:'#f59e0b' };
      else if (healthy && m.value > healthy.max) status = { text:'Por encima del rango saludable', color:'#f59e0b' };
      else                                    status = { text:'Por debajo del rango saludable', color:'#3b82f6' };

      const bandLeft  = Math.min(hMinPct ?? 0, hMaxPct ?? 100);
      const bandWidth = Math.abs((hMaxPct ?? 100) - (hMinPct ?? 0));

      return `
        <div style="padding:10px 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px">
            <span style="font-size:14px;font-weight:600;color:var(--text)">${m.label}: <strong>${m.fmt(m.value)}</strong></span>
            <span style="font-size:13px;font-weight:800;color:var(--primary)">Percentil ${pct}</span>
          </div>
          <div style="font-size:11px;color:${status.color};font-weight:600;margin-bottom:6px">${status.text}</div>
          <div style="position:relative;height:10px;background:var(--border);border-radius:5px;margin:6px 0 4px">
            <div style="position:absolute;top:0;bottom:0;left:${bandLeft}%;width:${bandWidth}%;background:#10b98144;border-left:1px solid #10b981;border-right:1px solid #10b981"></div>
            <div style="position:absolute;top:50%;left:${pct}%;transform:translate(-50%,-50%);width:14px;height:14px;border-radius:50%;background:var(--primary);border:2px solid var(--surface);box-shadow:0 1px 3px rgba(0,0,0,.3)"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted)">
            <span>P1</span><span style="color:#10b981">zona sana</span><span>P99</span>
          </div>
          ${m.note ? `<div style="font-size:10.5px;color:${m.note.color};margin-top:6px;line-height:1.35">${m.note.text}</div>` : ''}
        </div>`;
    }).join('') + `
      <p style="font-size:10.5px;color:var(--text-muted);margin-top:8px;line-height:1.4">
        El IMC se descompone en grasa (FMI) y músculo (FFMI): por eso un IMC alto puede ser
        músculo, no grasa. Percentiles vs población (NHANES); la banda verde es el rango recomendado.</p>`;
  },

  // ================================================================
  // STRENGTH RANKING — classic lifts, bronze→diamond
  // ================================================================
  _liftPick: 'squat',

  // Tiny e1RM progression sparkline for a lift (empty string if <2 sessions).
  _liftSparkline(liftId) {
    const hist = Strength.progress(DB.liftHistory(liftId));
    if (hist.length < 2) return '';
    const W = 120, H = 26, pad = 3;
    const es = hist.map(h => h.e1rm || 0);
    const min = Math.min(...es), max = Math.max(...es), span = (max - min) || 1;
    const pts = hist.map((h, i) => {
      const x = pad + (i / (hist.length - 1)) * (W - 2 * pad);
      const y = pad + (1 - (h.e1rm - min) / span) * (H - 2 * pad);
      return [x, y];
    });
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const last = pts[pts.length - 1];
    const gain = es[es.length - 1] - es[0];
    return `<div class="lift-spark-wrap">
      <svg viewBox="0 0 ${W} ${H}" class="lift-spark" preserveAspectRatio="none">
        <path d="${line}" fill="none" stroke="var(--primary)" stroke-width="1.5"/>
        <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.5" fill="var(--primary)"/>
      </svg>
      <span class="lift-spark-gain" style="color:${gain >= 0 ? 'var(--success)' : 'var(--danger,#ef4444)'}">${gain >= 0 ? '+' : ''}${gain} kg</span>
    </div>`;
  },

  renderStrength() {
    const body = document.getElementById('strength-body');
    const sub  = document.getElementById('strength-sub');
    if (!body) return;

    const s       = DB.settings();
    const sex     = s.gender === 'female' ? 'female' : 'male';
    const weights = DB.weightLog();
    const bodyKg  = weights.length ? weights[weights.length - 1].kg : null;
    const lifts   = DB.lifts();

    if (!bodyKg) {
      sub.textContent = 'Falta tu peso';
      body.innerHTML = `<p style="font-size:13px;color:var(--text-muted);padding:8px 0">
        Registra tu <strong>peso</strong> para calcular tu ranking (se normaliza por peso corporal).</p>`;
      return;
    }
    sub.textContent = `${sex === 'female' ? 'Mujeres' : 'Hombres'} · ${bodyKg} kg`;

    const overallTier = Strength.tier(Strength.overall(lifts, bodyKg, sex));
    const overallHtml = overallTier ? `
      <div class="strength-overall">
        <span class="strength-overall-emoji">${overallTier.emoji}</span>
        <div>
          <div style="font-size:12px;color:var(--text-muted)">Rango general</div>
          <div style="font-size:18px;font-weight:800;color:${overallTier.color}">${overallTier.label}</div>
        </div>
      </div>` : '';

    const rows = LIFT_STANDARDS.lifts.map(l => {
      const entry = lifts[l.id];
      const r     = entry ? Strength.rank(l.id, entry.e1rm, bodyKg, sex) : null;
      const tier  = r ? Strength.tier(r.idx) : null;

      let detail = 'Sin registro — toca + para añadir', barHtml = '', badge = '';
      if (entry && r) {
        const m       = r.thresholds;
        const curBase = r.idx >= 0 ? m[r.idx] : 0;
        const nextThr = r.idx < m.length - 1 ? m[r.idx + 1] : null;
        const pct     = nextThr ? Math.min(100, Math.round((r.ratio - curBase) / (nextThr - curBase) * 100)) : 100;
        const color   = tier?.color || 'var(--text-muted)';
        detail = `${entry.e1rm} kg · ${r.ratio}× peso${entry.reps > 1 ? ' (1RM est.)' : ''}`;
        barHtml = `<div class="tier-bar"><div style="width:${pct}%;background:${color}"></div></div>` +
          (nextThr
            ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px">Siguiente: ${LIFT_TIERS[r.idx + 1].label} a ${Math.round(nextThr * bodyKg)} kg</div>`
            : `<div style="font-size:10px;color:${color};margin-top:2px">Rango máximo 🔝</div>`);
        badge = tier
          ? `<span class="tier-badge" style="color:${tier.color}">${tier.emoji} ${tier.label}</span>`
          : `<span class="tier-badge" style="color:var(--text-muted)">Principiante</span>`;
      }
      return `
        <div class="strength-row">
          <span class="strength-row-emoji">${l.emoji}</span>
          <div class="strength-row-main">
            <div class="strength-row-name">${l.label}</div>
            <div class="strength-row-detail">${detail}</div>
            ${barHtml}
            ${this._liftSparkline(l.id)}
          </div>
          ${badge}
        </div>`;
    }).join('');

    body.innerHTML = overallHtml + rows;
  },

  _updateLiftHint() {
    const kg   = parseFloat(document.getElementById('lift-kg')?.value);
    const reps = parseInt(document.getElementById('lift-reps')?.value) || 1;
    const hint = document.getElementById('lift-e1rm-hint');
    if (!hint) return;
    hint.textContent = (kg && reps > 1) ? `1RM estimado: ${Strength.e1rm(kg, reps)} kg.` : '';
  },

  openLiftModal() {
    const picker = document.getElementById('lift-picker');
    const fill = () => {
      const c = DB.lifts()[this._liftPick];
      document.getElementById('lift-kg').value   = c?.kg   || '';
      document.getElementById('lift-reps').value = c?.reps || 1;
      this._updateLiftHint();
    };
    if (picker) {
      picker.innerHTML = LIFT_STANDARDS.lifts.map(l =>
        `<button class="lift-picker-btn${l.id === this._liftPick ? ' selected' : ''}" data-lift="${l.id}">${l.emoji} ${l.label}</button>`).join('');
      picker.querySelectorAll('.lift-picker-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this._liftPick = btn.dataset.lift;
          picker.querySelectorAll('.lift-picker-btn').forEach(b => b.classList.toggle('selected', b === btn));
          fill();
        });
      });
    }
    fill();
    this.openModal('modal-lift');
  },

  saveLift() {
    const kg   = parseFloat(document.getElementById('lift-kg').value);
    const reps = parseInt(document.getElementById('lift-reps').value) || 1;
    if (!kg || kg <= 0) { toast('Ingresa el peso levantado', 'error'); return; }
    const e1rm  = Strength.e1rm(kg, reps);
    // Append to the gym history (also updates the lt_lifts latest cache).
    const prevBest = (Strength.prs(DB.liftLog())[this._liftPick] || {}).e1rm || 0;
    DB.addLiftEntry(this._liftPick, { kg, reps, e1rm });
    const isPR = e1rm > prevBest;
    this.closeModal('modal-lift');

    const meta    = LIFT_STANDARDS.lifts.find(l => l.id === this._liftPick);
    const s       = DB.settings();
    const weights = DB.weightLog();
    const bodyKg  = weights.length ? weights[weights.length - 1].kg : null;
    const r       = bodyKg ? Strength.rank(this._liftPick, e1rm, bodyKg, s.gender) : null;
    const tier    = r ? Strength.tier(r.idx) : null;
    const prTag   = isPR ? '🏆 ¡PR! ' : '';
    toast(`${prTag}${meta?.emoji || ''} ${meta?.label}: ${e1rm} kg${tier ? ` · ${tier.emoji} ${tier.label}` : ''}`, 'success');
    if (this.view === 'progress') this.renderStrength();
    CloudSync.schedulePush();
  },

  bindLiftModal() {
    document.getElementById('btn-log-lift')?.addEventListener('click', () => this.openLiftModal());
    document.getElementById('btn-close-lift')?.addEventListener('click', () => this.closeModal('modal-lift'));
    document.getElementById('modal-lift')?.addEventListener('click', e => { if (e.target === e.currentTarget) this.closeModal('modal-lift'); });
    document.getElementById('lift-kg')?.addEventListener('input', () => this._updateLiftHint());
    document.getElementById('lift-reps')?.addEventListener('input', () => this._updateLiftHint());
    document.getElementById('btn-save-lift')?.addEventListener('click', () => this.saveLift());
  },

  renderWater() {
    const water=DB.todayWater(), goal=DB.settings().waterGoal||2500;
    const pct=Math.min(water/goal*100,100);
    document.getElementById('water-total').textContent=water;
    document.getElementById('water-goal-label').textContent=`/ ${goal} ml`;
    document.getElementById('water-pct-label').textContent=`${Math.round(pct)}% de la meta`;
    document.getElementById('water-fill').style.width=pct+'%';

    // Glasses visual (each glass = goal/8)
    const glasses=document.getElementById('water-glasses');
    const glassSize=Math.round(goal/8);
    const numFull=Math.floor(water/glassSize);
    const partial=(water%glassSize)/glassSize;
    glasses.innerHTML=Array.from({length:8},(_,i)=>{
      const cls=i<numFull?'water-glass full':i===numFull&&partial>0?'water-glass filled':'water-glass';
      return `<div class="${cls}" title="${(i+1)*glassSize}ml"></div>`;
    }).join('');
  },

  renderWeight() {
    const weights=DB.weightLog(), goal=DB.settings().weightGoal;
    document.getElementById('weight-current-val').textContent=weights.length?weights[weights.length-1].kg.toFixed(1)+'':'—';
    document.getElementById('weight-goal-val').textContent=goal?goal.toFixed(1)+'':'—';

    // Trend label
    if(weights.length>=2){
      const diff=+(weights[weights.length-1].kg-weights[weights.length-2].kg).toFixed(1);
      const el=document.getElementById('weight-trend-label');
      el.textContent=diff>0?`▲ +${diff}kg esta semana`:diff<0?`▼ ${diff}kg esta semana`:'Sin cambio';
      el.style.color=diff>0?'var(--warning)':diff<0?'var(--success)':'var(--text-muted)';
    }

    // Chart
    const cv=document.getElementById('chart-weight');
    if(weights.length>=2){
      requestAnimationFrame(()=>Charts.line(cv,weights,'#6366f1',goal));
    } else {
      const ctx=cv.getContext('2d'); ctx.clearRect(0,0,cv.width,cv.height);
    }

    // Prediction (enhanced with regression)
    const pred=calcPrediction();
    const predDiv=document.getElementById('weight-prediction');
    const predText=document.getElementById('weight-pred-text');
    if(pred && pred.kgPerWeek != null){
      predDiv.style.display='block';
      const method = pred.method === 'regression'
        ? `<span style="font-size:10px;background:var(--primary-light);color:var(--primary);padding:1px 6px;border-radius:4px;margin-left:6px">Regresión${pred.r2!=null?' R²='+pred.r2:''}</span>`
        : '';
      const kgW = Math.abs(pred.kgPerWeek);
      const trend = pred.kgPerWeek < -0.01 ? `▼ ${kgW} kg/semana` : pred.kgPerWeek > 0.01 ? `▲ +${kgW} kg/semana` : '→ Peso estable';
      predText.innerHTML = `<span style="font-size:15px;font-weight:700">${trend}</span>${method}` +
        (pred.in4weeks != null ? `<br><span style="font-size:13px;color:var(--text-muted)">En 4 semanas: ~<strong>${pred.in4weeks} kg</strong></span>` : '') +
        (pred.weeksToGoal != null && pred.weeksToGoal > 0 && pred.weeksToGoal < 200
          ? `<br><span style="font-size:13px;color:var(--success)">Meta ${pred.goalKg} kg en ~<strong>${pred.weeksToGoal} sem.</strong></span>` : '');
    } else predDiv.style.display='none';
  },

  // ================================================================
  // WEEKLY INSIGHTS
  // ================================================================
  renderWeeklyInsights() {
    const el = document.getElementById('weekly-insights-body');
    if (!el) return;
    const { insights } = generateWeeklyInsights();
    if (!insights.length) {
      el.innerHTML = '<p style="font-size:13px;color:var(--text-muted);text-align:center;padding:8px 0">Registra datos durante la semana para ver insights</p>';
      return;
    }
    el.innerHTML = insights.map(ins => `
      <div class="insight-item">
        <span class="insight-icon">${ins.icon}</span>
        <div>
          <div class="insight-text">${esc(ins.text)}</div>
          <div class="insight-sub" style="color:${ins.color||'var(--text-muted)'}">${esc(ins.sub)}</div>
        </div>
      </div>`).join('');
  },

  // ================================================================
  // FOOD PHOTO ESTIMATION
  // ================================================================
  bindFoodPhoto() {
    document.getElementById('btn-photo-food')?.addEventListener('click', () => this.openModal('modal-food-photo'));
    document.getElementById('btn-close-food-photo')?.addEventListener('click', () => this.closeModal('modal-food-photo'));
    document.getElementById('modal-food-photo')?.addEventListener('click', e => { if(e.target===e.currentTarget) this.closeModal('modal-food-photo'); });

    const handleFile = async (file) => {
      if (!file) return;
      // Show analyzing state
      document.getElementById('food-photo-state-capture').style.display   = 'none';
      document.getElementById('food-photo-state-analyzing').style.display = '';
      document.getElementById('food-photo-state-results').style.display   = 'none';

      // Show preview image
      const reader = new FileReader();
      reader.onload = (e) => {
        const prev = document.getElementById('food-photo-preview');
        if (prev) prev.innerHTML = `<img src="${e.target.result}" style="width:100%;max-height:200px;object-fit:cover;border-radius:10px">`;
      };
      reader.readAsDataURL(file);

      // Simulate analysis + generate smart suggestions
      await new Promise(r => setTimeout(r, 1800));

      // Build suggestions from favorites + time-of-day typical foods
      const hour = new Date().getHours();
      const slot = hour < 11 ? 'breakfast' : hour < 15 ? 'lunch' : hour < 18 ? 'snack' : 'dinner';
      const favs = this._getFavoriteFoods().slice(0, 3);
      const recipeForSlot = RECIPE_DB.filter(r=>r.mealType===slot).slice(0,2);

      document.getElementById('food-photo-state-analyzing').style.display = 'none';
      document.getElementById('food-photo-state-results').style.display   = '';

      const sugg = document.getElementById('food-photo-suggestions');
      if (!sugg) return;

      const favHtml = favs.map((f, idx) => {
        const entry = f.last;
        return `<div class="photo-suggestion-item" data-type="food" data-fav-idx="${idx}">
          <span style="font-size:20px">🍽</span>
          <div>
            <div class="photo-suggestion-name">${esc(f.name)}${f.brand?` <span style="font-size:11px;color:var(--text-muted)">${esc(f.brand)}</span>`:''}</div>
            <div class="photo-suggestion-kcal">${entry.qty||100}g · ${entry.kcal} kcal</div>
          </div>
        </div>`;
      }).join('');

      const recHtml = recipeForSlot.map(r => `
        <div class="photo-suggestion-item" data-type="recipe" data-id="${r.id}">
          <span style="font-size:20px">${r.emoji}</span>
          <div>
            <div class="photo-suggestion-name">${esc(r.name)}</div>
            <div class="photo-suggestion-kcal">${r.kcal} kcal · ${r.prot}g prot</div>
          </div>
        </div>`).join('');

      sugg.innerHTML = `<p style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:8px">🌟 Tus favoritos / ${slot==='breakfast'?'Desayuno':slot==='lunch'?'Almuerzo':slot==='snack'?'Merienda':'Cena'}</p>`
        + (favHtml || '') + recHtml;

      sugg.querySelectorAll('.photo-suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
          const type = item.dataset.type;
          if (type === 'food') {
            const fav = favs[parseInt(item.dataset.favIdx)];
            const entry = fav?.last;
            if (!entry) return;
            const slot2 = this._currentMealSlot();
            DB.addFood({...entry, qty: entry.qty||100, slot: slot2, ts: new Date().toISOString()});
            toast(`${entry.name} añadido ✓`, 'success');
            CloudSync.schedulePush();
            this.closeModal('modal-food-photo');
            if (this.view==='food') this.renderFood();
          } else if (type === 'recipe') {
            this.closeModal('modal-food-photo');
            this.openRecipeDetail(item.dataset.id);
          }
        });
      });
    };

    document.getElementById('food-photo-input')?.addEventListener('change', e => handleFile(e.target.files[0]));
    document.getElementById('food-gallery-input')?.addEventListener('change', e => handleFile(e.target.files[0]));
    document.getElementById('btn-photo-manual')?.addEventListener('click', () => {
      this.closeModal('modal-food-photo');
      document.getElementById('food-search')?.focus();
    });

    // Reset state when modal opens
    document.getElementById('btn-photo-food')?.addEventListener('click', () => {
      document.getElementById('food-photo-state-capture').style.display   = '';
      document.getElementById('food-photo-state-analyzing').style.display = 'none';
      document.getElementById('food-photo-state-results').style.display   = 'none';
      const prev = document.getElementById('food-photo-preview');
      if (prev) prev.innerHTML = '';
    });
  },

  // ================================================================
  // CYCLE TRACKER
  // ================================================================
  bindCycleModal() {
    document.getElementById('btn-log-cycle')?.addEventListener('click', () => {
      document.getElementById('cycle-start-date').value = today();
      this.openModal('modal-cycle');
    });
    document.getElementById('btn-close-cycle')?.addEventListener('click', () => this.closeModal('modal-cycle'));
    document.getElementById('modal-cycle')?.addEventListener('click', e => { if(e.target===e.currentTarget) this.closeModal('modal-cycle'); });

    // Period duration presets
    document.querySelectorAll('#modal-cycle .qty-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#modal-cycle .qty-preset').forEach(b=>b.classList.remove('selected'));
        btn.classList.add('selected');
        document.getElementById('cycle-period-days').value = btn.dataset.days;
      });
    });

    // Symptom toggle
    document.querySelectorAll('.symptom-btn').forEach(btn => {
      btn.addEventListener('click', () => btn.classList.toggle('selected'));
    });

    document.getElementById('btn-save-cycle')?.addEventListener('click', () => {
      const start = document.getElementById('cycle-start-date').value;
      if (!start) { toast('Elige la fecha de inicio', 'error'); return; }
      const days = parseInt(document.getElementById('cycle-period-days').value) || 5;
      const symptoms = [...document.querySelectorAll('.symptom-btn.selected')].map(b=>b.dataset.sym);
      const note = document.getElementById('cycle-note').value.trim();
      const entry = { id: `cycle_${Date.now()}`, start, days, symptoms, note, ts: new Date().toISOString() };
      DB.saveCycleLog([...DB.cycleLog(), entry]);
      this.closeModal('modal-cycle');
      // Reset
      document.querySelectorAll('.symptom-btn').forEach(b=>b.classList.remove('selected'));
      document.getElementById('cycle-note').value = '';
      toast('Ciclo registrado 🌸', 'success');
      CloudSync.schedulePush();
      if (this.view === 'progress') this.renderCycle();
    });
  },

  renderCycle() {
    const card = document.getElementById('cycle-card');
    if (!card) return;
    const s = DB.settings();
    // Only show for female users
    if (s.gender !== 'female') { card.style.display = 'none'; return; }
    card.style.display = '';

    const log = DB.cycleLog().sort((a,b)=>a.start.localeCompare(b.start));
    const body = document.getElementById('cycle-body');
    const sub  = document.getElementById('cycle-sub');
    if (!body) return;

    if (!log.length) {
      body.innerHTML = '<p style="font-size:13px;color:var(--text-muted);padding:8px 0">Toca + para registrar tu primer ciclo</p>';
      sub.textContent = 'Sin registro';
      return;
    }

    // Estimate average cycle length from last 3 entries
    const avgCycleLen = log.length >= 2
      ? Math.round(log.slice(-3).reduce((acc, e, i, arr) => {
          if (i === 0) return acc;
          const prev = arr[i-1];
          const d1 = new Date(prev.start+'T12:00:00'), d2 = new Date(e.start+'T12:00:00');
          return acc + Math.round((d2-d1)/86400000);
        }, 0) / (Math.min(log.length,3)-1))
      : 28;

    // Predict next period
    const last = log[log.length-1];
    const lastStart = new Date(last.start+'T12:00:00');
    const nextStart = new Date(lastStart); nextStart.setDate(nextStart.getDate() + avgCycleLen);
    const ovulation = new Date(lastStart); ovulation.setDate(ovulation.getDate() + avgCycleLen - 14);
    const daysUntilNext = Math.round((nextStart - new Date()) / 86400000);

    sub.textContent = `Próximo ~${nextStart.toLocaleDateString('es',{day:'numeric',month:'short'})}`;

    // Build 35-day mini calendar
    const startCal = new Date(); startCal.setDate(startCal.getDate()-7);
    const days35 = Array.from({length:35},(_,i)=>{
      const d=new Date(startCal); d.setDate(startCal.getDate()+i); return d;
    });

    const isPeriod = (d) => log.some(e=>{
      const s=new Date(e.start+'T12:00:00'), end=new Date(s); end.setDate(end.getDate()+e.days-1);
      return d>=s && d<=end;
    });
    const isFertile = (d) => {
      const ferStart = new Date(ovulation); ferStart.setDate(ferStart.getDate()-5);
      return d>=ferStart && d<=ovulation;
    };

    body.innerHTML = `
      <div class="cycle-timeline">${days35.map(d=>{
        const cls = isPeriod(d)?'period':d.toDateString()===ovulation.toDateString()?'ovulation':isFertile(d)?'fertile':'other';
        return `<div class="cycle-day-dot ${cls}" title="${d.toLocaleDateString('es')}"></div>`;
      }).join('')}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin:8px 0;font-size:11px">
        <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#db2777;margin-right:3px"></span>Período</span>
        <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#6366f1;margin-right:3px"></span>Ovulación</span>
        <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#10b981;margin-right:3px"></span>Fértil</span>
      </div>
      <div style="font-size:13px;color:var(--text-muted);margin-top:6px">
        Ciclo promedio: <strong>${avgCycleLen} días</strong> ·
        Próximo período en: <strong style="color:#db2777">${daysUntilNext} día${daysUntilNext!==1?'s':''}</strong>
      </div>
      ${last.symptoms?.length?`<div style="font-size:12px;color:var(--text-muted);margin-top:6px">Síntomas: ${last.symptoms.join(', ')}</div>`:''}`;
  },

  // ================================================================
  // SUPPLEMENTS
  // ================================================================
  renderSupplements() {
    const suppls   = DB.supplements();
    const todayLog = DB.todaySupplLog();
    const listEl   = document.getElementById('suppl-list');
    const subEl    = document.getElementById('suppl-sub');
    if (!listEl) return;

    if (!suppls.length) {
      listEl.innerHTML = `<p style="font-size:13px;color:var(--text-muted);text-align:center;padding:12px 0">Toca <strong>+</strong> para añadir suplementos</p>`;
      subEl.textContent = 'Sin suplementos';
      return;
    }
    const doneCount = suppls.filter(s => todayLog[s.id]).length;
    subEl.textContent = `${doneCount}/${suppls.length} tomados hoy`;
    listEl.innerHTML = suppls.map(s => `
      <div class="suppl-item" data-id="${s.id}" style="display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid var(--border)">
        <button class="suppl-check" data-id="${s.id}" style="width:28px;height:28px;border-radius:50%;border:2px solid ${todayLog[s.id]?'#10b981':'var(--border)'};background:${todayLog[s.id]?'#10b981':'transparent'};color:${todayLog[s.id]?'#fff':'var(--border)'};font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer">
          ${todayLog[s.id]?'✓':''}
        </button>
        <span style="font-size:18px;flex-shrink:0">${esc(s.emoji||'💊')}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:600;color:var(--text)">${esc(s.name)}</div>
          ${s.dose||s.time?`<div style="font-size:11px;color:var(--text-muted)">${esc(s.dose||'')}${s.dose&&s.time?' · ':''}${esc(s.time||'')}</div>`:''}
        </div>
        <button class="suppl-delete" data-id="${s.id}" style="color:var(--text-muted);font-size:18px;padding:4px;background:none;border:none;cursor:pointer">×</button>
      </div>`).join('');

    listEl.querySelectorAll('.suppl-check').forEach(btn => {
      btn.addEventListener('click', () => {
        DB.toggleSuppl(btn.dataset.id);
        this.renderSupplements();
        CloudSync.schedulePush();
      });
    });
    listEl.querySelectorAll('.suppl-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const name = suppls.find(s=>s.id===id)?.name || 'suplemento';
        toastUndo(`"${name}" eliminado`, () => {
          DB.saveSupplements([...DB.supplements(), suppls.find(s=>s.id===id)].filter(Boolean));
          this.renderSupplements();
        }, 'info');
        DB.saveSupplements(DB.supplements().filter(s=>s.id!==id));
        this.renderSupplements();
      });
    });
  },

  bindSupplModal() {
    document.getElementById('btn-add-suppl')?.addEventListener('click', () => this.openModal('modal-suppl'));
    document.getElementById('btn-close-suppl')?.addEventListener('click', () => this.closeModal('modal-suppl'));
    document.getElementById('modal-suppl')?.addEventListener('click', e => { if(e.target===e.currentTarget) this.closeModal('modal-suppl'); });
    // Emoji picker grid
    const grid = document.getElementById('suppl-emoji-grid');
    if (grid) {
      grid.addEventListener('click', e => {
        const text = e.target.textContent?.trim();
        if (text) document.getElementById('suppl-emoji').value = text;
      });
    }
    document.getElementById('btn-save-suppl')?.addEventListener('click', () => {
      const name = document.getElementById('suppl-name').value.trim();
      if (!name) { toast('Escribe el nombre del suplemento', 'error'); return; }
      const s = {
        id:    `suppl_${Date.now()}`,
        name,
        dose:  document.getElementById('suppl-dose').value.trim(),
        time:  document.getElementById('suppl-time').value.trim(),
        emoji: document.getElementById('suppl-emoji').value.trim() || '💊',
      };
      DB.saveSupplements([...DB.supplements(), s]);
      this.closeModal('modal-suppl');
      // Reset form
      ['suppl-name','suppl-dose','suppl-time'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
      document.getElementById('suppl-emoji').value = '💊';
      toast(`${s.emoji} "${s.name}" añadido`, 'success');
      if (this.view === 'progress') this.renderSupplements();
      CloudSync.schedulePush();
    });
  },

  // ================================================================
  // WELLNESS CORRELATIONS
  // ================================================================
  renderCorrelations() {
    const corr  = calcWellnessCorrelations();
    const grid  = document.getElementById('correlations-grid');
    const empty = document.getElementById('correlations-empty');
    if (!grid) return;

    const entries = Object.values(corr).filter(c => c.r !== null && c.n >= 4);
    if (!entries.length) {
      grid.innerHTML = '';
      empty?.style && (empty.style.display = '');
      return;
    }
    empty?.style && (empty.style.display = 'none');

    const label = r => {
      const a = Math.abs(r);
      if (a >= 0.7) return 'fuerte';
      if (a >= 0.4) return 'moderada';
      return 'débil';
    };
    const color = r => {
      if (r >=  0.4) return '#10b981';
      if (r <= -0.4) return '#ef4444';
      return 'var(--text-muted)';
    };
    const bar = r => {
      const pct = Math.round(Math.abs(r)*100);
      const c   = color(r);
      return `<div style="height:4px;background:var(--border);border-radius:2px;margin-top:4px"><div style="height:100%;width:${pct}%;background:${c};border-radius:2px;transition:width .4s"></div></div>`;
    };

    grid.innerHTML = entries.map(c => `
      <div style="padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:13px;font-weight:600;color:var(--text)">${esc(c.label)}</span>
          <span style="font-size:13px;font-weight:800;color:${color(c.r)}">${c.r > 0 ? '+' : ''}${c.r}</span>
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:1px">${esc(c.desc)} · correlación ${label(c.r)} (n=${c.n})</div>
        ${bar(c.r)}
      </div>`).join('');
  },

  // ================================================================
  // WEB SHARE
  // ================================================================
  async shareProgress() {
    const s      = DB.settings();
    const food   = DB.todayFood();
    const kcal   = food.reduce((a,f)=>a+f.kcal,0);
    const water  = DB.todayWater();
    const tasks  = DB.tasks(), done = DB.todayDone();
    const todayT = tasks.filter(t=>!t.days?.length||t.days.includes(new Date().getDay()));
    const doneN  = todayT.filter(t=>done[t.id]).length;
    const weights = DB.weightLog();
    const kg     = weights.length ? weights[weights.length-1].kg : null;
    const goal   = s.calorieGoal || 2000;

    const text = `📊 Mi progreso en LifeTrack — ${new Date().toLocaleDateString('es')}
🍽 Calorías: ${kcal}/${goal} kcal
💧 Agua: ${water}/${s.waterGoal||2500} ml
✅ Tareas: ${doneN}/${todayT.length}${kg ? `\n⚖️ Peso: ${kg} kg` : ''}
#LifeTrack #Salud #Nutrición`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Mi progreso LifeTrack', text });
        toast('¡Compartido! 🎉', 'success');
      } catch(e) {
        if (e.name !== 'AbortError') {
          await navigator.clipboard.writeText(text).catch(()=>{});
          toast('Copiado al portapapeles', 'info');
        }
      }
    } else {
      await navigator.clipboard.writeText(text).catch(()=>{});
      toast('Copiado al portapapeles 📋', 'info');
    }
  },

  renderMicros() {
    const days  = parseInt(document.getElementById('micro-days')?.value || 7);
    const isToday = days === 1;
    const food  = DB.foodLog();
    const range = Array.from({length:days}, (_,i) => {
      const d = new Date(); d.setDate(d.getDate() - (days-1-i)); return fmtDate(d);
    });

    // Update subtitle
    const sub = document.getElementById('micro-subtitle');
    if (sub) sub.textContent = isToday ? 'Progreso de hoy vs IDR diaria' : `Últimos ${days} días vs IDR`;

    // Accumulate totals
    const totals  = Object.fromEntries(MICRO_KEYS.map(k => [k, 0]));
    const hasData = Object.fromEntries(MICRO_KEYS.map(k => [k, false]));
    let count = 0;
    range.forEach(d => {
      (food[d] || []).forEach(f => {
        count++;
        MICRO_KEYS.forEach(k => { if (f[k] != null) { totals[k] += f[k]; hasData[k] = true; } });
      });
    });

    const grid  = document.getElementById('micro-grid');
    const empty = document.getElementById('micro-empty');

    if (count === 0) {
      grid.innerHTML = ''; empty.style.display = '';
      return;
    }
    empty.style.display = 'none';

    if (isToday) {
      // ── TODAY MODE: rich cards with amounts + remaining ────────
      // Group by category
      const GROUPS = [
        { label: '💊 Vitaminas', keys: ['vitA','vitC','vitD','vitE','vitK','vitB6','vitB12','folate'] },
        { label: '⚗️ Minerales', keys: ['iron','calcium','magnesium','zinc','potassium','sodium','fiber'] },
      ];
      grid.innerHTML = GROUPS.map(g => {
        const rows = g.keys.map(k => {
          const m   = MICROS[k];
          const val = totals[k];
          const rda = m.rda;
          const pct = hasData[k] ? Math.min(Math.round((val/rda)*100), 150) : 0;
          const cls = !hasData[k] ? 'no-data'
            : m.limit ? (pct > 100 ? 'limit' : pct > 70 ? 'adequate' : 'low')
            : pct >= 80 ? 'adequate' : pct >= 40 ? 'low' : 'deficient';
          const remaining = Math.max(+(rda - val).toFixed(1), 0);
          const valFmt = val >= 10 ? val.toFixed(0) : val.toFixed(1);
          const remLabel = !hasData[k] ? `IDR: ${rda}${m.unit}`
            : pct >= 100 ? '✓ Cubierto'
            : `${remaining}${m.unit} restantes`;
          return `<div class="micro-today-row ${cls}">
            <div class="micro-today-left">
              <div class="micro-today-name">${m.label}</div>
              <div class="micro-today-rem">${remLabel}</div>
            </div>
            <div class="micro-today-bar-wrap">
              <div class="micro-today-bar-fill" style="width:${Math.min(pct,100)}%"></div>
            </div>
            <div class="micro-today-right">
              <div class="micro-today-val">${hasData[k] ? valFmt : '—'}</div>
              <div class="micro-today-unit">${m.unit}</div>
              <div class="micro-today-pct">${hasData[k] ? pct+'%' : ''}</div>
            </div>
          </div>`;
        }).join('');
        return `<div class="micro-group-header">${g.label}</div>${rows}`;
      }).join('');
    } else {
      // ── MULTI-DAY MODE: compact grid (original) ───────────────
      const legend = `<div class="micro-legend">
        <div class="micro-legend-item"><div class="micro-legend-dot" style="background:var(--success)"></div>≥80% IDR</div>
        <div class="micro-legend-item"><div class="micro-legend-dot" style="background:var(--warning)"></div>40-79%</div>
        <div class="micro-legend-item"><div class="micro-legend-dot" style="background:var(--danger)"></div>&lt;40%</div>
        <div class="micro-legend-item"><div class="micro-legend-dot" style="background:var(--border)"></div>Sin datos</div>
      </div>`;
      grid.innerHTML = legend + MICRO_KEYS.map(k => {
        const m = MICROS[k], total = totals[k], rda = m.rda * days;
        if (!hasData[k]) return `<div class="micro-item no-data">
          <div class="micro-name">${m.label}</div>
          <div class="micro-bar-wrap"><div class="micro-bar-fill" style="width:0%"></div></div>
          <div class="micro-pct">—</div>
          <div class="micro-status-dot"></div>
        </div>`;
        const pct = Math.min(Math.round((total/rda)*100), 150);
        const cls = m.limit ? (pct>100?'limit':pct>70?'adequate':'low') : pct>=80?'adequate':pct>=40?'low':'deficient';
        return `<div class="micro-item ${cls}" title="${m.label}: ${total.toFixed(1)}${m.unit} / ${rda}${m.unit}">
          <div class="micro-name">${m.label}</div>
          <div class="micro-bar-wrap"><div class="micro-bar-fill" style="width:${Math.min(pct,100)}%"></div></div>
          <div class="micro-pct">${pct}%</div>
          <div class="micro-status-dot"></div>
        </div>`;
      }).join('');
    }
  },

  // ================================================================
  // HISTORY
  // ================================================================
  // ================================================================
  // EXERCISE
  // ================================================================
  calcExerciseKcal(met, durationMin) {
    const kg = DB.weightLog().slice(-1)[0]?.kg || 80;
    return Math.round(met * kg * (durationMin / 60));
  },

  bindExerciseModal() {
    // Build activity grid
    const grid = document.getElementById('activity-grid');
    ACTIVITIES.forEach((act, i) => {
      const btn = document.createElement('button');
      btn.className = 'activity-btn';
      btn.type = 'button';
      btn.dataset.idx = i;
      btn.innerHTML = `<span class="activity-icon">${act.icon}</span><span class="activity-name">${act.name}</span>`;
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.activity-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedActivity = act;
        document.getElementById('exercise-custom-wrap').style.display = act.name === 'Otro' ? '' : 'none';
        this.updateExercisePreview();
      });
      grid.appendChild(btn);
    });

    document.getElementById('btn-add-exercise').addEventListener('click', () => this.openExerciseModal());
    document.getElementById('modal-exercise').addEventListener('click', e => { if(e.target===e.currentTarget) this.closeExerciseModal(); });
    document.getElementById('btn-close-exercise').addEventListener('click', () => this.closeExerciseModal());
    document.getElementById('btn-save-exercise').addEventListener('click', () => this.saveExercise());

    // Duration presets
    document.querySelectorAll('[data-min]').forEach(btn => btn.addEventListener('click', () => {
      document.querySelectorAll('[data-min]').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('exercise-duration').value = btn.dataset.min;
      this.updateExercisePreview();
    }));
    document.getElementById('exercise-duration').addEventListener('input', () => {
      document.querySelectorAll('[data-min]').forEach(b => b.classList.remove('selected'));
      this.updateExercisePreview();
    });

    // Manual kcal toggle
    document.getElementById('exercise-manual-toggle').addEventListener('change', e => {
      document.getElementById('exercise-manual-wrap').style.display = e.target.checked ? '' : 'none';
      this.updateExercisePreview();
    });
    document.getElementById('exercise-kcal-manual').addEventListener('input', () => this.updateExercisePreview());
  },

  updateExercisePreview() {
    const act = this.selectedActivity; if (!act) return;
    const dur = parseInt(document.getElementById('exercise-duration').value) || 30;
    const manual = document.getElementById('exercise-manual-toggle').checked;
    const manualKcal = parseInt(document.getElementById('exercise-kcal-manual').value);
    const kcal = (manual && manualKcal) ? manualKcal : this.calcExerciseKcal(act.met, dur);
    document.getElementById('exercise-kcal-preview').textContent = `${kcal} kcal`;
  },

  openExerciseModal() {
    // Reset form
    document.getElementById('exercise-duration').value = '30';
    document.getElementById('exercise-note').value = '';
    document.getElementById('exercise-manual-toggle').checked = false;
    document.getElementById('exercise-manual-wrap').style.display = 'none';
    document.getElementById('exercise-custom-wrap').style.display = 'none';
    document.getElementById('exercise-kcal-manual').value = '';
    document.querySelectorAll('[data-min]').forEach(b => b.classList.remove('selected'));
    document.querySelector('[data-min="30"]')?.classList.add('selected');
    // Select first activity
    const grid = document.getElementById('activity-grid');
    grid.querySelectorAll('.activity-btn').forEach(b => b.classList.remove('selected'));
    grid.querySelector('.activity-btn')?.classList.add('selected');
    this.selectedActivity = ACTIVITIES[0];
    this.updateExercisePreview();
    this.openModal('modal-exercise');
  },

  closeExerciseModal() { this.closeModal('modal-exercise'); },

  saveExercise() {
    const act = this.selectedActivity;
    if (!act) { toast('Selecciona una actividad', 'error'); return; }
    const dur = parseInt(document.getElementById('exercise-duration').value);
    if (!dur || dur < 1) { toast('Ingresa la duración', 'error'); return; }
    const manual = document.getElementById('exercise-manual-toggle').checked;
    const manualKcal = parseInt(document.getElementById('exercise-kcal-manual').value);
    const kcalBurned = (manual && manualKcal) ? manualKcal : this.calcExerciseKcal(act.met, dur);
    const name = act.name === 'Otro'
      ? (document.getElementById('exercise-custom-name').value.trim() || 'Ejercicio')
      : act.name;
    DB.addExercise({
      id: `e_${Date.now()}`, name, icon: act.icon, met: act.met,
      duration: dur, kcalBurned,
      note: document.getElementById('exercise-note').value.trim(),
      ts: new Date().toISOString()
    });
    toast(`${act.icon} ${name} — ${kcalBurned} kcal quemadas`, 'success');
    this.closeExerciseModal();
    this.renderExercise();
    this.renderDashboard();
  },

  renderExercise() {
    const list = DB.todayExercise();
    const totalBurned = list.reduce((a, e) => a + e.kcalBurned, 0);
    document.getElementById('exercise-total-kcal').textContent = totalBurned;
    document.getElementById('exercise-total-label').textContent =
      totalBurned > 0 ? `${list.length} sesión${list.length>1?'es':''} · ${totalBurned} kcal quemadas` : 'Sin actividad hoy';
    const logEl = document.getElementById('exercise-log');
    if (!list.length) {
      logEl.innerHTML = `<p class="text-muted text-center" style="padding:8px 0">Toca + para registrar tu actividad</p>`;
      return;
    }
    logEl.innerHTML = list.map((e, i) => `
      <div class="exercise-item">
        <div class="exercise-item-icon">${e.icon}</div>
        <div class="exercise-item-info">
          <div class="exercise-item-name">${esc(e.name)}</div>
          <div class="exercise-item-detail">${e.duration} min · ${e.kcalBurned} kcal${e.note ? ' · '+esc(e.note) : ''}</div>
        </div>
        <button class="btn-remove" data-ex-remove="${esc(String(e.id ?? i))}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`).join('');
    logEl.querySelectorAll('[data-ex-remove]').forEach(btn => btn.addEventListener('click', () => {
      const day = today();
      const entry = DB.removeExercise(btn.dataset.exRemove);
      this.renderExercise(); this.renderDashboard();
      if (entry) toastUndo(`Eliminado: ${entry.activity || 'Ejercicio'}`, () => {
        const lat = DB.exerciseLog(); if (!lat[day]) lat[day] = [];
        lat[day].push(entry);
        DB.saveExerciseLog(lat);
        this.renderExercise(); this.renderDashboard();
        toast('Restaurado ✓', 'success');
      });
    }));
  },

  // ================================================================
  // PLAN SEMANAL
  // ================================================================
  bindPlanModal() {
    document.getElementById('btn-open-plan').addEventListener('click', () => this.openWeekPlan());
    document.getElementById('modal-week-plan').addEventListener('click', e => {
      if (e.target === e.currentTarget) this.closeWeekPlan();
    });
    document.getElementById('btn-close-plan').addEventListener('click', () => this.closeWeekPlan());
    document.getElementById('btn-back-from-picker').addEventListener('click', () => this.closeRecipePicker());
    document.getElementById('btn-log-today-plan').addEventListener('click', () => this.logTodayPlan());
    document.getElementById('picker-search').addEventListener('input', e => this.renderPickerList(e.target.value));
  },

  openWeekPlan() {
    this.planCurrentDate = today();
    this.buildPlanDayTabs();
    this.renderWeekPlan();
    this.openModal('modal-week-plan');
  },

  closeWeekPlan() {
    this.closeModal('modal-week-plan');
    this.closeRecipePicker(true);
  },

  buildPlanDayTabs() {
    const tabsEl = document.getElementById('plan-day-tabs');
    const mp = DB.mealPlan();
    const now = new Date();
    tabsEl.innerHTML = '';
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const dateStr = fmtDate(d);
      const isToday  = dateStr === today();
      const isActive = dateStr === this.planCurrentDate;
      const hasItems = (mp[dateStr]||[]).length > 0;
      const btn = document.createElement('button');
      btn.className = `plan-day-tab${isActive ? ' active' : ''}${hasItems ? ' has-plan' : ''}`;
      btn.innerHTML = `<span class="tab-num">${d.getDate()}</span><span class="tab-name">${isToday ? 'Hoy' : DAYS_SHORT[d.getDay()]}</span>`;
      btn.addEventListener('click', () => {
        this.planCurrentDate = dateStr;
        this.buildPlanDayTabs();
        this.renderWeekPlan();
      });
      tabsEl.appendChild(btn);
    }
  },

  renderWeekPlan() {
    const date    = this.planCurrentDate;
    const isToday = date === today();
    const entries = DB.planForDate(date);
    const totalKcal = entries.reduce((a, e) => a + e.kcal, 0);

    // Total bar
    const totalBar = document.getElementById('plan-total-bar');
    if (totalKcal > 0) {
      totalBar.style.display = 'flex';
      document.getElementById('plan-total-kcal').textContent = `${totalKcal} kcal`;
    } else {
      totalBar.style.display = 'none';
    }

    // Meal slots
    const slotsEl = document.getElementById('plan-slots');
    slotsEl.innerHTML = MEAL_SLOTS.map(slot => {
      const slotEntries = entries.filter(e => e.slot === slot.id);
      const slotKcal    = slotEntries.reduce((a, e) => a + e.kcal, 0);
      const itemsHtml   = slotEntries.map(e => {
        const recMult = e.recipeDbId
          ? (e.qty > 0 ? e.qty : parseFloat((e.recipeName || '').match(/×([\d.]+)/)?.[1] || '1'))
          : 1;
        return `
        <div class="plan-item${e.recipeDbId ? ' plan-item-tappable' : ''}"
          ${e.recipeDbId ? `data-recipe-id="${e.recipeDbId}" data-recipe-mult="${recMult}"` : ''}>
          <div class="plan-item-name">${esc(e.recipeName)}</div>
          <div class="plan-item-kcal">${e.kcal} kcal</div>
          <button class="btn-remove" data-plan-remove="${e.id}" style="margin-left:4px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>`;
      }).join('');
      return `<div class="plan-slot">
        <div class="plan-slot-header">
          <div class="plan-slot-title">${slot.icon} ${slot.label}</div>
          ${slotKcal ? `<span class="plan-slot-kcal">${slotKcal} kcal</span>` : ''}
        </div>
        ${itemsHtml}
        <button class="plan-add-btn" data-add-slot="${slot.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Añadir receta
        </button>
      </div>`;
    }).join('');

    // Log today button
    const logBtn = document.getElementById('btn-log-today-plan');
    logBtn.style.display = (isToday && entries.length) ? '' : 'none';

    // Bind events
    slotsEl.querySelectorAll('[data-add-slot]').forEach(btn => {
      btn.addEventListener('click', () => this.openRecipePicker(btn.dataset.addSlot));
    });
    slotsEl.querySelectorAll('[data-plan-remove]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        DB.removePlanEntry(date, btn.dataset.planRemove);
        this.buildPlanDayTabs();
        this.renderWeekPlan();
        this.updatePlanBadge();
      });
    });
    slotsEl.querySelectorAll('.plan-item-tappable').forEach(item => {
      item.addEventListener('click', () => {
        this.openRecipeDetail(item.dataset.recipeId, parseFloat(item.dataset.recipeMult) || 1);
      });
    });
  },

  openRecipePicker(slot) {
    this.planPickerSlot = slot;
    const slotMeta = MEAL_SLOTS.find(s => s.id === slot);
    document.getElementById('picker-slot-label').textContent =
      slotMeta ? `${slotMeta.icon} ${slotMeta.label}` : '';
    document.getElementById('picker-search').value = '';
    this.renderPickerList('');
    document.getElementById('plan-view').style.display        = 'none';
    document.getElementById('plan-picker-view').style.display = '';
    document.getElementById('plan-day-tabs').style.display    = 'none';
    document.getElementById('picker-search').focus();
  },

  closeRecipePicker(silent = false) {
    document.getElementById('plan-picker-view').style.display = 'none';
    document.getElementById('plan-view').style.display        = '';
    document.getElementById('plan-day-tabs').style.display    = '';
    this.planPickerSlot = null;
  },

  renderPickerList(q) {
    const recipes  = DB.recipes();
    const filtered = q
      ? recipes.filter(r => r.name.toLowerCase().includes(q.toLowerCase()))
      : recipes;
    const list = document.getElementById('picker-list');
    if (!filtered.length) {
      list.innerHTML = `<p class="text-muted text-center" style="padding:20px 0">${
        recipes.length ? 'Sin coincidencias' : 'No tienes recetas guardadas aún'
      }</p>`;
      return;
    }
    list.innerHTML = filtered.map(r => `
      <div class="picker-recipe-item" data-pick-id="${r.id}">
        <div style="min-width:0;flex:1">
          <div class="picker-recipe-name">${esc(r.name)}</div>
          <div class="picker-recipe-info">${r.perKcal} kcal · P:${r.perProt}g · C:${r.perCarbs}g · G:${r.perFat}g</div>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-left:8px">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </div>`).join('');
    list.querySelectorAll('[data-pick-id]').forEach(el => {
      el.addEventListener('click', () => this.addRecipeToPlan(el.dataset.pickId));
    });
  },

  addRecipeToPlan(recipeId) {
    const recipe = DB.recipes().find(r => r.id === recipeId);
    if (!recipe || !this.planPickerSlot) return;
    const entry = {
      id:         `p_${Date.now()}`,
      slot:       this.planPickerSlot,
      recipeId:   recipe.id,
      recipeName: recipe.name,
      kcal:       recipe.perKcal,
      prot:       recipe.perProt,
      carbs:      recipe.perCarbs,
      fat:        recipe.perFat,
    };
    // Carry micro data for later food-log registration
    const MICRO_MAP = {
      vitA:'perVitA', vitC:'perVitC', vitD:'perVitD', vitE:'perVitE',
      vitK:'perVitK', vitB6:'perVitB6', vitB12:'perVitB12', folate:'perFolate',
      iron:'perIron', calcium:'perCalcium', magnesium:'perMagnesium',
      zinc:'perZinc', potassium:'perPotassium', sodium:'perSodium', fiber:'perFiber'
    };
    Object.entries(MICRO_MAP).forEach(([k, rk]) => { if (recipe[rk] != null) entry[k] = recipe[rk]; });

    DB.addPlanEntry(this.planCurrentDate, entry);
    const slotMeta = MEAL_SLOTS.find(s => s.id === this.planPickerSlot);
    toast(`${slotMeta?.icon || ''} ${recipe.name} añadida al plan`, 'success');
    this.closeRecipePicker();
    this.buildPlanDayTabs();
    this.renderWeekPlan();
    this.updatePlanBadge();
  },

  logTodayPlan() {
    const entries = DB.planForDate(today());
    if (!entries.length) { toast('No hay recetas planificadas para hoy', 'error'); return; }
    const now = Date.now();
    entries.forEach((e, idx) => {
      const entry = {
        id:        `fp_${now}_${idx}`,
        name:      e.recipeName,
        qty:       100,
        kcal:      e.kcal,
        prot:      e.prot  || 0,
        carbs:     e.carbs || 0,
        fat:       e.fat   || 0,
        isRecipe:  true,
        fromPlan:  true,
      };
      MICRO_KEYS.forEach(k => { if (e[k] != null) entry[k] = e[k]; });
      DB.addFood(entry);
    });
    const n = entries.length;
    toast(`${n} comida${n > 1 ? 's' : ''} registrada${n > 1 ? 's' : ''} en el diario ✓`, 'success');
    this.closeWeekPlan();
    this.navigate('food');
  },

  // Badge on "Plan semanal" button showing tomorrow's planned kcal
  updatePlanBadge() {
    const badge = document.getElementById('plan-tomorrow-badge');
    if (!badge) return;
    const tomorrow = fmtDate(new Date(new Date().setDate(new Date().getDate() + 1)));
    const entries  = DB.planForDate(tomorrow);
    if (entries.length) {
      const kcal = entries.reduce((a, e) => a + e.kcal, 0);
      badge.textContent = `mañana ${kcal} kcal`;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  },

  renderHistory() {
    const food=DB.foodLog(), done=DB.completions(), tasks=DB.tasks(), water=DB.waterLog();
    const goal=DB.settings().calorieGoal;
    const now=new Date();
    const days=Array.from({length:7},(_,i)=>{const d=new Date(now);d.setDate(now.getDate()-(6-i));return fmtDate(d);});
    const labels=days.map(d=>DAYS_SHORT[new Date(d+'T12:00:00').getDay()]);

    const exercise=DB.exerciseLog();
    const kcalData=days.map(d=>(food[d]||[]).reduce((a,f)=>a+f.kcal,0));
    const exData=days.map(d=>(exercise[d]||[]).reduce((a,e)=>a+e.kcalBurned,0));
    const waterData=days.map(d=>water[d]||0);
    const taskData=days.map(d=>{
      const dow=new Date(d+'T12:00:00').getDay();
      const dayTasks=tasks.filter(t=>!t.days?.length||t.days.includes(dow));
      if(!dayTasks.length) return 0;
      const dayDone=done[d]||{};
      return Math.round((dayTasks.filter(t=>dayDone[t.id]).length/dayTasks.length)*100);
    });

    requestAnimationFrame(()=>{
      Charts.bars(document.getElementById('chart-kcal'),kcalData,labels,'#f59e0b',goal);
      Charts.bars(document.getElementById('chart-exercise'),exData,labels,'#d97706');
      Charts.bars(document.getElementById('chart-water'),waterData,labels,'#3b82f6',DB.settings().waterGoal||2500);
      Charts.bars(document.getElementById('chart-tasks'),taskData,labels,'#6366f1');
    });

    const avgKcal=Math.round(kcalData.reduce((a,v)=>a+v,0)/7);
    const avgWater=Math.round(waterData.reduce((a,v)=>a+v,0)/7);
    const avgTask=Math.round(taskData.reduce((a,v)=>a+v,0)/7);
    const daysGoal=kcalData.filter(v=>v>0&&v<=goal).length;

    document.getElementById('hist-avg-kcal').textContent=avgKcal;
    document.getElementById('hist-task-pct').textContent=avgTask+'%';
    document.getElementById('hist-avg-water').textContent=Math.round(avgWater/100)/10+'L';
    document.getElementById('hist-goal-hit').textContent=daysGoal+'/7';

    // Breakdown
    const breakdown=document.getElementById('food-breakdown');
    breakdown.innerHTML=days.slice().reverse().map(d=>{
      const dayFood=food[d]||[], kcal=dayFood.reduce((a,f)=>a+f.kcal,0);
      const date=new Date(d+'T12:00:00');
      const label=d===today()?'Hoy':d===fmtDate(new Date(now.getTime()-86400000))?'Ayer':
        date.toLocaleDateString('es',{weekday:'short',day:'numeric',month:'short'});
      return `<div class="log-item" ${!dayFood.length?'style="opacity:.5"':''}>
        <div class="log-item-info">
          <div class="log-item-name">${label}</div>
          <div class="log-item-detail">${dayFood.length?`${dayFood.length} alimentos · ${water[d]||0}ml agua`:'Sin registro'}</div>
        </div>
        <span class="log-item-kcal">${kcal||'—'}</span>
      </div>`;
    }).join('');

    // Wellness history
    this.renderWellnessHistory(days, labels);
    // Correlations
    this.renderCorrelations();
    // Weekly insights
    this.renderWeeklyInsights();
  },

  // ================================================================
  // DIARIO DE BIENESTAR
  // ================================================================
  bindWellnessModal() {
    // Open from Progreso btn
    document.getElementById('btn-log-wellness').addEventListener('click', () => this.openWellnessModal());
    // Open from dashboard chip
    document.getElementById('dash-wellness').addEventListener('click', () => this.openWellnessModal());
    // Close
    document.getElementById('modal-wellness').addEventListener('click', e => {
      if (e.target === e.currentTarget) this.closeWellnessModal();
    });
    document.getElementById('btn-close-wellness').addEventListener('click', () => this.closeWellnessModal());
    // Save
    document.getElementById('btn-save-wellness').addEventListener('click', () => this.saveWellnessEntry());

    // Mood picker
    document.querySelectorAll('.mood-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.wellnessMood = parseInt(btn.dataset.score);
      });
    });

    // Energy stars
    document.querySelectorAll('.star-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.dataset.star);
        this.wellnessEnergy = val;
        this.updateEnergyStars(val);
      });
    });
  },

  updateEnergyStars(val) {
    document.querySelectorAll('.star-btn').forEach(btn => {
      btn.classList.toggle('filled', parseInt(btn.dataset.star) <= val);
    });
  },

  openWellnessModal() {
    // Pre-fill with today's entry if exists
    const entry = DB.todayWellness();
    this.wellnessMood   = entry?.mood ?? null;
    this.wellnessEnergy = entry?.energy ?? 3;

    // Reset mood buttons
    document.querySelectorAll('.mood-btn').forEach(btn => {
      btn.classList.toggle('selected', parseInt(btn.dataset.score) === this.wellnessMood);
    });
    // Set energy
    this.updateEnergyStars(this.wellnessEnergy);
    // Sleep + note
    document.getElementById('wellness-sleep').value = entry?.sleep ?? '';
    document.getElementById('wellness-note').value  = entry?.note  ?? '';

    this.openModal('modal-wellness');
  },

  closeWellnessModal() { this.closeModal('modal-wellness'); },

  saveWellnessEntry() {
    if (!this.wellnessMood) { toast('Selecciona cómo te sientes', 'error'); return; }
    const sleep = parseFloat(document.getElementById('wellness-sleep').value) || null;
    const note  = document.getElementById('wellness-note').value.trim();
    DB.logWellness({ mood: this.wellnessMood, energy: this.wellnessEnergy, sleep, note });
    const moodMeta = MOODS.find(m => m.score === this.wellnessMood);
    toast(`${moodMeta.emoji} Bienestar registrado ✓`, 'success');
    this.closeWellnessModal();
    this.renderWellnessDash();
    if (this.view === 'progress')  this.renderWellnessCard();
    if (this.view === 'history')   this.renderHistory();
  },

  // Small chip on dashboard
  renderWellnessDash() {
    const entry    = DB.todayWellness();
    const emojiEl  = document.getElementById('dash-wellness-emoji');
    const moodEl   = document.getElementById('dash-wellness-mood');
    const subEl    = document.getElementById('dash-wellness-sub');
    if (!emojiEl) return;
    if (entry) {
      const m = MOODS.find(x => x.score === entry.mood) || MOODS[2];
      emojiEl.textContent = m.emoji;
      moodEl.textContent  = `${m.label}  ${'⚡'.repeat(entry.energy)}`;
      subEl.textContent   = [
        entry.sleep ? `💤 ${entry.sleep}h sueño` : '',
        entry.note  ? `"${entry.note.slice(0, 40)}"` : ''
      ].filter(Boolean).join(' · ') || 'Toca para editar';
    } else {
      emojiEl.textContent = '📝';
      moodEl.textContent  = '¿Cómo estás hoy?';
      subEl.textContent   = 'Toca para registrar tu bienestar';
    }
  },

  // Full card in Progreso view
  renderWellnessCard() {
    const entry   = DB.todayWellness();
    const subEl   = document.getElementById('wellness-card-sub');
    const bodyEl  = document.getElementById('wellness-card-body');
    const addBtn  = document.getElementById('btn-log-wellness');
    if (!subEl) return;
    if (!entry) {
      subEl.textContent = 'Sin registro hoy';
      bodyEl.innerHTML  = `<p class="text-muted" style="padding:8px 0 4px">Toca <strong>+</strong> para registrar cómo te sientes</p>`;
      addBtn.innerHTML  = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
      return;
    }
    const m = MOODS.find(x => x.score === entry.mood) || MOODS[2];
    subEl.textContent = `${m.emoji} ${m.label}  ·  ⚡ ${entry.energy}/5`;
    addBtn.innerHTML  = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

    const energyPips = Array.from({length:5},(_,i)=>
      `<div class="e-pip${i < entry.energy ? ' on':''}"></div>`).join('');

    bodyEl.innerHTML = `
      <div class="wellness-today-grid">
        <div class="wellness-today-stat">
          <div class="wellness-today-stat-label">Estado</div>
          <div class="wellness-today-stat-val">${m.emoji}</div>
        </div>
        <div class="wellness-today-stat">
          <div class="wellness-today-stat-label">Energía</div>
          <div style="display:flex;gap:3px;margin-top:4px">${energyPips}</div>
        </div>
        ${entry.sleep ? `<div class="wellness-today-stat">
          <div class="wellness-today-stat-label">Sueño</div>
          <div class="wellness-today-stat-val">${entry.sleep}<span style="font-size:13px;font-weight:500">h</span></div>
        </div>` : ''}
      </div>
      ${entry.note ? `<div class="wellness-today-note">"${esc(entry.note)}"</div>` : ''}`;
  },

  // ================================================================
  // MEAL PREP SEMANAL
  // ================================================================

  // Rellena toda la semana con recomendaciones IA por tipo de comida + micros
  autoFillWeekWithAI() {
    const prefs = DB.foodPrefs();
    if (!prefs || !prefs.liked || prefs.liked.length < 3) {
      toast('Primero configura tus ingredientes favoritos', 'error');
      this.openIngredientPrefs();
      return;
    }
    const likedSet = new Set(prefs.liked);
    const goal  = DB.settings().calorieGoal;
    const style = DB.settings().cuttingStyle;
    const days7 = Array.from({length:7}, (_,i) => {
      const d = new Date(); d.setDate(d.getDate()+i); return fmtDate(d);
    });

    let totalAdded = 0;
    days7.forEach(date => {
      const existing = DB.planForDate(date);
      const usedIds  = new Set(existing.map(e => e.recipeDbId).filter(Boolean));
      let dayKcal = existing.reduce((a,e) => a+e.kcal, 0);
      // Simulate cumulative micros for the day
      const dayMicros = Object.fromEntries(MICRO_KEYS.map(k => [k,0]));
      existing.forEach(e => MICRO_KEYS.forEach(k => { if (e[k] != null) dayMicros[k] += e[k]; }));

      MEAL_SLOTS.forEach(slot => {
        if (existing.some(e => e.slot === slot.id)) return; // already has entries
        const remainingKcal = Math.max(goal - dayKcal, 0);
        if (remainingKcal < 50) return; // day already at goal

        // Target = fixed fraction of the daily goal per slot type
        const slotTarget = Math.round(goal * (SLOT_FRACTIONS[slot.id] || 0.25));

        const candidates = RECIPE_DB
          .filter(r => r.mealType === slot.id && !usedIds.has(r.id))
          .map(r => ({ ...r, score: this._scoreRecipe(r, likedSet, slotTarget, remainingKcal, style, dayMicros) }))
          .filter(r => r.score > 0)
          .sort((a,b) => b.score - a.score);

        if (!candidates.length) return;
        // Pick from top 3 with slight randomness to vary the week
        const pool = candidates.slice(0, Math.min(3, candidates.length));
        const pick = pool[Math.floor(Math.random() * pool.length)];

        // Scale serving to match slot target
        const mult = this._bestServing(pick.kcal, slotTarget);
        const scaledKcal  = Math.round(pick.kcal  * mult);
        const scaledProt  = +(pick.prot  * mult).toFixed(1);
        const scaledCarbs = +(pick.carbs * mult).toFixed(1);
        const scaledFat   = +(pick.fat   * mult).toFixed(1);
        const displayName = mult !== 1 ? `${pick.name} (×${mult})` : pick.name;

        DB.addPlanEntry(date, {
          id: Date.now() + Math.random(),
          slot: slot.id,
          recipeName: displayName,
          kcal: scaledKcal, prot: scaledProt, carbs: scaledCarbs, fat: scaledFat,
          qty: mult, recipeDbId: pick.id, isRecipeDb: true,
        });

        // Update simulation state for next slot in same day
        usedIds.add(pick.id);
        dayKcal += scaledKcal;
        const rm = calcRecipeMicros(pick);
        Object.entries(rm).forEach(([k,v]) => { if (dayMicros[k] !== undefined) dayMicros[k] += v * mult; });
        totalAdded++;
      });
    });

    CloudSync.schedulePush();
    this.renderPrepOverview();
    this.renderPrepDaySlots();
    this.updatePlanBadge();
    toast(`✨ ${totalAdded} comidas añadidas a la semana`, 'success');
  },

  bindPrepModal() {
    document.getElementById('btn-open-prep')?.addEventListener('click', () => this.openMealPrep());
    document.getElementById('btn-close-prep')?.addEventListener('click', () => this.closeMealPrep());
    document.getElementById('modal-meal-prep')?.addEventListener('click', e => { if (e.target === e.currentTarget) this.closeMealPrep(); });
    document.getElementById('btn-auto-fill-prep')?.addEventListener('click', () => this.autoFillWeekWithAI());
    document.getElementById('btn-close-prep-picker')?.addEventListener('click', () => this.closePrepPicker());
    document.getElementById('prep-search')?.addEventListener('input', e => this.renderPrepFoodList(e.target.value));
    document.getElementById('prep-apply-all-days')?.addEventListener('change', () => {
      const lbl = document.getElementById('prep-apply-label');
      if (lbl) lbl.textContent = document.getElementById('prep-apply-all-days').checked ? 'Todos los días' : 'Solo este día';
    });
    // Tab switching
    document.querySelectorAll('.prep-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.prep-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderPrepFoodList(document.getElementById('prep-search')?.value || '');
      });
    });
  },

  openMealPrep() {
    this.prepCurrentDate = today();
    this.prepPickerSlot  = null;
    this.renderPrepOverview();
    this.renderPrepDaySlots();
    this.openModal('modal-meal-prep');
  },
  closeMealPrep() { this.closePrepPicker(); this.closeModal('modal-meal-prep'); },

  // 7-day overview cards
  renderPrepOverview() {
    const el = document.getElementById('prep-week-overview');
    if (!el) return;
    const mp = DB.mealPlan();
    el.innerHTML = Array.from({length:7}, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() + i);
      const ds = fmtDate(d);
      const entries = mp[ds] || [];
      const kcal  = entries.reduce((a,e) => a+e.kcal, 0);
      const dots  = MEAL_SLOTS.map(s => {
        const has = entries.some(e => e.slot === s.id);
        return `<span class="prep-dot${has?' filled':''}" title="${s.label}"></span>`;
      }).join('');
      const isActive = ds === this.prepCurrentDate;
      const isToday  = ds === today();
      return `<button class="prep-day-card${isActive?' active':''}" data-prep-date="${ds}">
        <div class="prep-day-name">${isToday ? 'Hoy' : DAYS_SHORT[d.getDay()]}</div>
        <div class="prep-day-num">${d.getDate()}</div>
        <div class="prep-day-dots">${dots}</div>
        ${kcal ? `<div class="prep-day-kcal">${kcal}</div>` : '<div class="prep-day-kcal">—</div>'}
      </button>`;
    }).join('');
    el.querySelectorAll('[data-prep-date]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.prepCurrentDate = btn.dataset.prepDate;
        this.renderPrepOverview();
        this.renderPrepDaySlots();
      });
    });
  },

  // Slots for selected day
  renderPrepDaySlots() {
    const date    = this.prepCurrentDate;
    const entries = DB.planForDate(date);
    const d       = new Date(date + 'T12:00:00');
    const isToday = date === today();

    const titleEl = document.getElementById('prep-day-title');
    if (titleEl) titleEl.textContent = `${DAYS_FULL[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;

    const slotsEl = document.getElementById('prep-day-slots');
    if (!slotsEl) return;
    const totalKcal = entries.reduce((a,e) => a+e.kcal, 0);

    slotsEl.innerHTML = MEAL_SLOTS.map(slot => {
      const slotEntries = entries.filter(e => e.slot === slot.id);
      const slotKcal    = slotEntries.reduce((a,e) => a+e.kcal, 0);
      const items = slotEntries.map(e => {
        const recMult = e.recipeDbId
          ? (e.qty > 0 ? e.qty : parseFloat((e.recipeName || '').match(/×([\d.]+)/)?.[1] || '1'))
          : 1;
        return `
        <div class="prep-entry${e.recipeDbId ? ' prep-entry-tappable' : ''}"
          ${e.recipeDbId ? `data-recipe-id="${e.recipeDbId}" data-recipe-mult="${recMult}"` : ''}>
          <span class="prep-entry-name">${esc(e.recipeName)}</span>
          <span class="prep-entry-kcal">${e.kcal}</span>
          <button class="btn-remove" data-prep-del="${e.id}" data-prep-date="${date}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>`;
      }).join('');
      return `<div class="prep-slot-row">
        <div class="prep-slot-hd">
          <span class="prep-slot-label">${slot.icon} ${slot.label}</span>
          ${slotKcal ? `<span class="prep-slot-kcal">${slotKcal} kcal</span>` : ''}
          <button class="prep-add-slot-btn" data-slot="${slot.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button class="prep-apply-week-btn" data-apply-slot="${slot.id}" title="Aplicar slot a toda la semana">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </button>
        </div>
        ${items}
      </div>`;
    }).join('');

    // Day total + copy button
    const actionsEl = document.getElementById('prep-day-actions');
    if (actionsEl) {
      actionsEl.innerHTML = `
        <span style="font-size:13px;color:var(--text-muted)">${totalKcal ? totalKcal+' kcal total' : 'Sin comidas'}</span>
        <button class="btn btn-sm" id="btn-prep-copy-week" style="font-size:12px;padding:5px 10px">📋 Copiar a toda la semana</button>
        ${isToday && entries.length ? `<button class="btn btn-sm btn-primary" id="btn-prep-log-today" style="font-size:12px;padding:5px 10px">✅ Registrar hoy</button>` : ''}
      `;
      document.getElementById('btn-prep-copy-week')?.addEventListener('click', () => this.copyPrepToWeek());
      document.getElementById('btn-prep-log-today')?.addEventListener('click', () => { this.logTodayPlan(); this.closeMealPrep(); });
    }

    // Bind add buttons
    slotsEl.querySelectorAll('[data-slot]').forEach(btn => {
      btn.addEventListener('click', () => this.openPrepPicker(btn.dataset.slot));
    });
    // Bind apply-to-week per slot
    slotsEl.querySelectorAll('[data-apply-slot]').forEach(btn => {
      btn.addEventListener('click', () => this.applySlotToWeek(btn.dataset.applySlot));
    });
    // Bind remove
    slotsEl.querySelectorAll('[data-prep-del]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        DB.removePlanEntry(btn.dataset.prepDate, btn.dataset.prepDel);
        CloudSync.schedulePush();
        this.renderPrepOverview();
        this.renderPrepDaySlots();
        this.updatePlanBadge();
      });
    });
    // Bind recipe detail tap
    slotsEl.querySelectorAll('.prep-entry-tappable').forEach(item => {
      item.addEventListener('click', () => {
        this.openRecipeDetail(item.dataset.recipeId, parseFloat(item.dataset.recipeMult) || 1);
      });
    });
  },

  // Open quick-fill picker
  openPrepPicker(slot) {
    this.prepPickerSlot = slot;
    const slotMeta = MEAL_SLOTS.find(s => s.id === slot);
    const titleEl  = document.getElementById('prep-picker-slot-title');
    if (titleEl) titleEl.textContent = `${slotMeta?.icon || ''} ${slotMeta?.label || slot}`;
    const allDaysEl = document.getElementById('prep-apply-all-days');
    if (allDaysEl) allDaysEl.checked = false;
    const lbl = document.getElementById('prep-apply-label');
    if (lbl) lbl.textContent = 'Solo este día';
    document.getElementById('prep-search').value = '';
    // Activate first tab
    document.querySelectorAll('.prep-tab-btn').forEach((b,i) => b.classList.toggle('active', i===0));
    this.renderPrepFoodList('');
    document.getElementById('prep-picker').style.display = '';
  },
  closePrepPicker() {
    const p = document.getElementById('prep-picker');
    if (p) p.style.display = 'none';
    this.prepPickerSlot = null;
  },

  renderPrepFoodList(q) {
    const listEl   = document.getElementById('prep-food-list');
    const searchEl = document.getElementById('prep-search');
    if (!listEl) return;
    const activeTab = document.querySelector('.prep-tab-btn.active')?.dataset.tab || 'prep';
    q = (q || '').toLowerCase().trim();

    // Hide search bar on AI tab (not useful there)
    if (searchEl) searchEl.style.display = activeTab === 'ai' ? 'none' : '';

    if (activeTab === 'prep') {
      // Group PREP_FOODS by category
      const grouped = {};
      PREP_FOODS.forEach(f => {
        if (q && !f.name.toLowerCase().includes(q)) return;
        if (!grouped[f.cat]) grouped[f.cat] = [];
        grouped[f.cat].push(f);
      });
      const cats = Object.keys(grouped);
      if (!cats.length) { listEl.innerHTML = '<div class="empty-state" style="padding:20px">Sin resultados</div>'; return; }
      listEl.innerHTML = cats.map(cat => `
        <div class="prep-cat-header">${cat}</div>
        ${grouped[cat].map(f => `
          <button class="prep-food-item" data-prep-food="${f.id}">
            <div class="prep-food-info">
              <div class="prep-food-name">${esc(f.name)}</div>
              <div class="prep-food-macros">P:${f.prot}g C:${f.carbs}g G:${f.fat}g · ${f.qty}g</div>
            </div>
            <span class="prep-food-kcal">${f.kcal}</span>
          </button>`).join('')}
      `).join('');
      listEl.querySelectorAll('[data-prep-food]').forEach(btn => {
        btn.addEventListener('click', () => {
          const food = PREP_FOODS.find(f => f.id === btn.dataset.prepFood);
          if (food) this.addPrepEntry({ name: food.name, kcal: food.kcal, prot: food.prot, carbs: food.carbs, fat: food.fat, qty: food.qty });
        });
      });

    } else if (activeTab === 'recipes') {
      // My Recipes tab
      const recipes = DB.recipes().filter(r => !q || r.name.toLowerCase().includes(q));
      if (!recipes.length) { listEl.innerHTML = '<div class="empty-state" style="padding:20px">Sin recetas</div>'; return; }
      listEl.innerHTML = recipes.map(r => `
        <button class="prep-food-item" data-prep-recipe="${r.id}">
          <div class="prep-food-info">
            <div class="prep-food-name">${esc(r.name)}</div>
            <div class="prep-food-macros">P:${r.prot||0}g C:${r.carbs||0}g G:${r.fat||0}g</div>
          </div>
          <span class="prep-food-kcal">${r.kcal}</span>
        </button>`).join('');
      listEl.querySelectorAll('[data-prep-recipe]').forEach(btn => {
        btn.addEventListener('click', () => {
          const r = DB.recipes().find(r => r.id == btn.dataset.prepRecipe);
          if (r) this.addPrepEntry({ name: r.name, kcal: r.kcal, prot: r.prot||0, carbs: r.carbs||0, fat: r.fat||0, qty: r.servingSize||100, isRecipe: true });
        });
      });

    } else {
      // ── ✨ IA tab — preference-based RECIPE_DB recommendations ──
      const prefs = DB.foodPrefs();
      if (!prefs || !prefs.liked || prefs.liked.length < 3) {
        listEl.innerHTML = `
          <div class="empty-state" style="padding:20px;text-align:center">
            <p style="margin-bottom:10px">Configura tus ingredientes favoritos primero</p>
            <button class="btn btn-primary" id="btn-prefs-from-picker"
              style="padding:8px 16px;font-size:13px">Configurar preferencias</button>
          </div>`;
        document.getElementById('btn-prefs-from-picker')?.addEventListener('click', () => this.openIngredientPrefs());
        return;
      }
      const slot       = this.prepPickerSlot;
      const likedSet   = new Set(prefs.liked);
      const goal       = DB.settings().calorieGoal;
      const style      = DB.settings().cuttingStyle;
      const slotTarget = Math.round(goal * (SLOT_FRACTIONS[slot] || 0.25));
      const todayMicros = this._getTodayMicros();

      const candidates = RECIPE_DB
        .filter(r => r.mealType === slot)
        .map(r => {
          const score = this._scoreRecipe(r, likedSet, slotTarget, 999999, style, todayMicros);
          const mult  = this._bestServing(r.kcal, slotTarget);
          return {
            ...r, score, mult,
            scaledKcal:  Math.round(r.kcal  * mult),
            scaledProt:  +(r.prot  * mult).toFixed(1),
            scaledCarbs: +(r.carbs * mult).toFixed(1),
            scaledFat:   +(r.fat   * mult).toFixed(1),
          };
        })
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);

      if (!candidates.length) {
        listEl.innerHTML = '<div class="empty-state" style="padding:20px">Sin recomendaciones para tus preferencias</div>';
        return;
      }

      listEl.innerHTML = candidates.map(r => {
        const multBadge = r.mult !== 1
          ? ` <span class="rec-serving-badge" style="font-size:10px;padding:1px 6px">${r.mult}×</span>` : '';
        return `<button class="prep-food-item" data-prep-ai="${r.id}" data-prep-ai-mult="${r.mult}">
          <div class="prep-food-info">
            <div class="prep-food-name">${r.emoji} ${esc(r.name)}${multBadge}</div>
            <div class="prep-food-macros">P:${r.scaledProt}g C:${r.scaledCarbs}g G:${r.scaledFat}g · ⏱ ${r.prepTime} min</div>
          </div>
          <span class="prep-food-kcal">${r.scaledKcal}</span>
        </button>`;
      }).join('');

      listEl.querySelectorAll('[data-prep-ai]').forEach(btn => {
        btn.addEventListener('click', () => {
          const r    = RECIPE_DB.find(x => x.id === btn.dataset.prepAi);
          const mult = parseFloat(btn.dataset.prepAiMult) || 1;
          if (!r) return;
          this.addPrepEntry({
            name:  mult !== 1 ? `${r.name} (×${mult})` : r.name,
            qty:   mult,
            kcal:  Math.round(r.kcal  * mult),
            prot:  +(r.prot  * mult).toFixed(1),
            carbs: +(r.carbs * mult).toFixed(1),
            fat:   +(r.fat   * mult).toFixed(1),
            recipeDbId: r.id, isRecipeDb: true,
          });
        });
      });
    }
  },

  addPrepEntry(food) {
    const slot  = this.prepPickerSlot;
    const allDays = document.getElementById('prep-apply-all-days')?.checked;
    const dates = allDays
      ? Array.from({length:7}, (_,i) => { const d=new Date(); d.setDate(d.getDate()+i); return fmtDate(d); })
      : [this.prepCurrentDate];

    dates.forEach(date => {
      DB.addPlanEntry(date, {
        id: Date.now() + Math.random(), slot,
        recipeName: food.name,
        kcal: food.kcal, prot: food.prot, carbs: food.carbs, fat: food.fat,
        qty: food.qty,
        isRecipe: food.isRecipe || false,
        ...(food.recipeDbId ? { recipeDbId: food.recipeDbId, isRecipeDb: true } : {}),
      });
    });
    CloudSync.schedulePush();
    const slotMeta = MEAL_SLOTS.find(s => s.id === slot);
    toast(`${slotMeta?.icon||''} ${food.name} añadido${allDays?' a toda la semana':''}`, 'success');
    this.closePrepPicker();
    this.renderPrepOverview();
    this.renderPrepDaySlots();
    this.updatePlanBadge();
  },

  // Copy all slots of current day to the rest of the week
  copyPrepToWeek() {
    const entries = DB.planForDate(this.prepCurrentDate);
    if (!entries.length) { toast('Este día no tiene comidas', 'error'); return; }
    let count = 0;
    Array.from({length:7}, (_,i) => { const d=new Date(); d.setDate(d.getDate()+i); return fmtDate(d); })
      .filter(ds => ds !== this.prepCurrentDate)
      .forEach(ds => {
        const mp = DB.mealPlan();
        mp[ds] = entries.map(e => ({...e, id: Date.now()+Math.random()}));
        DB.saveMealPlan(mp);
        count++;
      });
    CloudSync.schedulePush();
    toast(`Plan copiado a ${count} días ✓`, 'success');
    this.renderPrepOverview();
    this.renderPrepDaySlots();
    this.updatePlanBadge();
  },

  // Copy a specific slot from current day to all other days this week
  applySlotToWeek(slotId) {
    const entries = DB.planForDate(this.prepCurrentDate).filter(e => e.slot === slotId);
    if (!entries.length) { toast('El slot está vacío', 'error'); return; }
    const slotMeta = MEAL_SLOTS.find(s => s.id === slotId);
    let count = 0;
    Array.from({length:7}, (_,i) => { const d=new Date(); d.setDate(d.getDate()+i); return fmtDate(d); })
      .filter(ds => ds !== this.prepCurrentDate)
      .forEach(ds => {
        const mp = DB.mealPlan();
        if (!mp[ds]) mp[ds] = [];
        // Remove existing entries for this slot, then add new ones
        mp[ds] = mp[ds].filter(e => e.slot !== slotId);
        entries.forEach(e => mp[ds].push({...e, id: Date.now()+Math.random()}));
        DB.saveMealPlan(mp);
        count++;
      });
    CloudSync.schedulePush();
    toast(`${slotMeta?.icon||''} ${slotMeta?.label||slotId} copiado a ${count} días ✓`, 'success');
    this.renderPrepOverview();
    this.renderPrepDaySlots();
    this.updatePlanBadge();
  },

  // 7-day wellness history in Historial tab
  renderWellnessHistory(days, labels) {
    const wLog = DB.wellness();
    const listEl = document.getElementById('wellness-history-list');
    if (!listEl) return;
    listEl.innerHTML = days.slice().reverse().map((d, i) => {
      const dayIdx  = days.length - 1 - i;
      const label   = labels[dayIdx];
      const entry   = wLog[d];
      if (!entry) {
        return `<div class="wellness-hist-row">
          <span class="wellness-hist-date">${label}</span>
          <div class="wellness-hist-dot w-dot-0">—</div>
          <div class="wellness-hist-energy">${Array.from({length:5},()=>'<div class="e-pip"></div>').join('')}</div>
          <span class="wellness-hist-sleep">—</span>
          <span class="wellness-hist-note" style="color:var(--border)">Sin registro</span>
        </div>`;
      }
      const m = MOODS.find(x => x.score === entry.mood) || MOODS[2];
      const pips = Array.from({length:5},(_,idx)=>
        `<div class="e-pip${idx < entry.energy ? ' on':''}"></div>`).join('');
      return `<div class="wellness-hist-row">
        <span class="wellness-hist-date">${label}</span>
        <div class="wellness-hist-dot ${m.dotClass}">${m.emoji}</div>
        <div class="wellness-hist-energy">${pips}</div>
        <span class="wellness-hist-sleep">${entry.sleep ? entry.sleep+'h' : '—'}</span>
        <span class="wellness-hist-note">${entry.note ? esc(entry.note) : ''}</span>
      </div>`;
    }).join('');
  },
};

// ================================================================
// START
// ================================================================
document.addEventListener('DOMContentLoaded', () => App.init());
