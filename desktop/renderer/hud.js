'use strict';
// LifeTrack HUD renderer. Reuses the shared core (DB, CloudSync, insights) and
// paints a Jarvis-style dashboard. Works both inside Electron (window.desktop
// present → native window controls, notifications, OAuth popup) and in a plain
// browser (graceful fallback), which is how it's visually verified.

const HUD = {
  isDesktop: !!(window.desktop && window.desktop.isDesktop),
  MEAL_TIMES: { breakfast: 8, lunch: 13, snack: 17, dinner: 20 },
  _refreshTimer: null,
  _tickerIdx: 0,
  _tickerTimer: null,

  async init() {
    this.bindControls();
    this.buildReactorTicks();

    // Auth: mirror the PWA's states (online / offline-cached / local).
    const status = (typeof CloudSync !== 'undefined') ? CloudSync.init() : false;
    if (status === 'online') {
      CloudSync.sb.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) await this.onSignIn(session);
        if (event === 'SIGNED_OUT') this.showLogin();
      });
      const session = await CloudSync.getSession();
      if (session) await this.onSignIn(session);
      else if (localStorage.getItem('lt_skip_auth')) this.start();
      else this.showLogin();
    } else {
      this.start(); // local-only
    }
  },

  showLogin() {
    document.getElementById('login-overlay').hidden = false;
  },
  hideLogin() {
    document.getElementById('login-overlay').hidden = true;
  },

  async onSignIn(session) {
    CloudSync.userId = session.user.id;
    const meta = session.user.user_metadata || {};
    CloudSync.user = {
      id: session.user.id, email: session.user.email,
      name: meta.full_name || meta.name || (session.user.email || '').split('@')[0] || 'Usuario',
      avatar: meta.avatar_url || meta.picture || null,
    };
    CloudSync._saveUser(CloudSync.user);
    document.getElementById('tb-user').textContent = (CloudSync.user.name || 'HUD').split(' ')[0].toUpperCase();
    this.hideLogin();
    this.start();
    try { await CloudSync.syncFull(); this.render(); } catch {}
  },

  start() {
    this.hideLogin();
    // Restore cached identity label if present
    const u = (typeof CloudSync !== 'undefined') ? CloudSync._loadCachedUser() : null;
    if (u) document.getElementById('tb-user').textContent = (u.name || 'HUD').split(' ')[0].toUpperCase();
    this.render();
    this.startTicker();
    clearInterval(this._refreshTimer);
    this._refreshTimer = setInterval(() => this.render(), 30000);
    this.pushReminders();
  },

  // ── Controls ──────────────────────────────────────────────────
  bindControls() {
    const d = window.desktop;
    document.getElementById('tb-min').onclick = () => d && d.minimize();
    document.getElementById('tb-close').onclick = () => d ? d.close() : null;
    document.getElementById('tb-mini').onclick = () => { if (d) d.setMiniMode(!document.body.classList.contains('mini')); };
    document.getElementById('tb-sync').onclick = () => this.manualSync();
    if (d) {
      d.onModeChanged(mode => document.body.classList.toggle('mini', mode === 'mini'));
      d.onSystemResumed(() => { this.render(); this.pushReminders(); });
      d.onReminderFired(() => this.render());
    }

    document.querySelectorAll('[data-water]').forEach(b =>
      b.onclick = () => this.addWater(+b.dataset.water));
    document.getElementById('qf-repeat').onclick = () => this.repeatYesterday();
    document.getElementById('qf-open').onclick = () => this.quickFood();

    document.getElementById('ov-local').onclick = () => { localStorage.setItem('lt_skip_auth', '1'); this.start(); };
    document.getElementById('ov-google').onclick = () => this.signInGoogle();
  },

  async signInGoogle() {
    if (!(typeof CloudSync !== 'undefined' && CloudSync.sb)) return;
    const redirectTo = (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.oauthRedirect) || 'http://localhost:8787/';
    if (this.isDesktop) {
      try {
        const { data } = await CloudSync.sb.auth.signInWithOAuth({
          provider: 'google', options: { redirectTo, skipBrowserRedirect: true },
        });
        const tokens = await window.desktop.openOAuth(data.url, redirectTo);
        await CloudSync.sb.auth.setSession(tokens);
      } catch (e) { this.toast('No se pudo conectar con Google'); }
    } else {
      await CloudSync.sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    }
  },

  async manualSync() {
    if (typeof CloudSync === 'undefined' || !CloudSync.userId) { this.toast('Modo local (sin sincronización)'); return; }
    this.toast('Sincronizando…');
    const ok = await CloudSync.syncFull();
    this.render();
    this.toast(ok ? 'Sincronizado ✓' : 'Error al sincronizar');
  },

  // ── Data actions ──────────────────────────────────────────────
  addWater(ml) { DB.addWater(ml); this.render(); this.toast(`+${ml} ml`); },

  repeatYesterday() {
    const y = new Date(); y.setDate(y.getDate() - 1);
    const entries = (DB.foodLog())[fmtDate(y)] || [];
    if (!entries.length) { this.toast('Ayer no registraste comidas'); return; }
    entries.forEach(e => { const c = { ...e }; delete c.id; delete c.ts; DB.addFood(c); });
    this.render();
    this.toast(`✓ ${entries.length} alimentos de ayer`);
  },

  quickFood() {
    const name = window.prompt('Alimento:');
    if (!name) return;
    const kcal = parseInt(window.prompt('Calorías (kcal):', '200'), 10);
    if (!Number.isFinite(kcal)) return;
    DB.addFood({ name: name.trim(), kcal, qty: 1 });
    this.render();
    this.toast(`✓ ${name}`);
  },

  // ── Render ────────────────────────────────────────────────────
  render() {
    const s = DB.settings();
    const food = DB.todayFood();
    const kcal = food.reduce((a, f) => a + (f.kcal || 0), 0);
    const prot = food.reduce((a, f) => a + (f.prot || 0), 0);
    const carbs = food.reduce((a, f) => a + (f.carbs || 0), 0);
    const fat = food.reduce((a, f) => a + (f.fat || 0), 0);
    const burned = DB.todayExercise().reduce((a, e) => a + (e.kcalBurned || 0), 0);
    const goal = (s.calorieGoal || 2000) + burned;
    const rem = goal - kcal;

    // Calorie arc
    const R = 80, C = 2 * Math.PI * R;
    const pct = Math.max(0, Math.min(1, kcal / goal));
    const arc = document.getElementById('cal-arc');
    arc.style.strokeDasharray = C;
    arc.style.strokeDashoffset = C * (1 - pct);
    arc.style.stroke = rem < 0 ? 'var(--red)' : (pct > 0.85 ? 'var(--amber)' : 'var(--cyan)');
    document.getElementById('rc-remaining').textContent = rem < 0 ? `+${Math.abs(rem)}` : rem;
    document.getElementById('rc-remaining').style.color = rem < 0 ? 'var(--red)' : 'var(--ink)';
    document.getElementById('rc-consumed').textContent = kcal;
    document.getElementById('rc-goal').textContent = goal;
    document.getElementById('mm-prot').textContent = Math.round(prot);
    document.getElementById('mm-carbs').textContent = Math.round(carbs);
    document.getElementById('mm-fat').textContent = Math.round(fat);

    // Macro rings — target grams from goals or macro split
    const pGoal = s.proteinGoal || Math.round((s.calorieGoal || 2000) * 0.30 / 4);
    const cGoal = s.carbsGoal || Math.round((s.calorieGoal || 2000) * 0.40 / 4);
    const fGoal = s.fatGoal || Math.round((s.calorieGoal || 2000) * 0.30 / 9);
    this.setRing('ring-prot', 132, prot / pGoal);
    this.setRing('ring-carbs', 118, carbs / cGoal);
    this.setRing('ring-fat', 104, fat / fGoal);

    // Water
    const water = DB.todayWater();
    const wGoal = s.waterGoal || 2500;
    const wpct = Math.max(0, Math.min(1, water / wGoal));
    const tubeTop = 8, tubeH = 184;
    const fillH = tubeH * wpct;
    const fill = document.getElementById('water-fill');
    fill.setAttribute('y', tubeTop + (tubeH - fillH));
    fill.setAttribute('height', fillH);
    document.getElementById('water-ml').textContent = water;
    document.getElementById('water-goal').textContent = `/ ${wGoal} ml`;
    // Pace marker: expected fill by current time within the hydration window
    const hs = s.hydrationStart ?? 8, he = s.hydrationEnd ?? 22;
    const hourNow = new Date().getHours() + new Date().getMinutes() / 60;
    const paceFrac = Math.max(0, Math.min(1, (hourNow - hs) / Math.max(1, he - hs)));
    const paceY = tubeTop + tubeH * (1 - paceFrac);
    document.getElementById('water-pace').setAttribute('y1', paceY);
    document.getElementById('water-pace').setAttribute('y2', paceY);

    // Streak
    const streaks = (typeof calcStreaks === 'function') ? calcStreaks() : { current: 0 };
    const days = streaks.current ?? streaks.food ?? 0;
    document.getElementById('streak-days').textContent = days;
    const flame = document.getElementById('streak-flame');
    flame.style.transform = `scale(${1 + Math.min(days, 30) / 40})`;
    flame.style.opacity = days > 0 ? 1 : 0.35;

    // Weight sparkline
    this.renderSpark();

    // Meal timeline
    this.renderMeals(food);

    // Assistant
    this.updateAssistant({ rem, goal, kcal, water, wGoal, paceFrac, days, pct });
  },

  setRing(id, r, frac) {
    const C = 2 * Math.PI * r;
    const el = document.getElementById(id);
    el.style.strokeDasharray = C;
    el.style.strokeDashoffset = C * (1 - Math.max(0, Math.min(1, frac)));
  },

  buildReactorTicks() {
    const g = document.getElementById('reactor-ticks');
    let html = '';
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const long = i % 5 === 0;
      const r1 = 150, r2 = long ? 140 : 145;
      const x1 = 160 + Math.cos(a) * r1, y1 = 160 + Math.sin(a) * r1;
      const x2 = 160 + Math.cos(a) * r2, y2 = 160 + Math.sin(a) * r2;
      html += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" opacity="${long ? 0.6 : 0.25}"/>`;
    }
    g.innerHTML = html;
  },

  renderSpark() {
    const svg = document.getElementById('weight-spark');
    const log = (DB.weightLog() || []).slice(-30);
    if (log.length < 2) {
      svg.innerHTML = `<text x="110" y="45" text-anchor="middle" class="empty">Sin datos de peso</text>`;
      document.getElementById('weight-latest').textContent = log[0] ? `${log[0].kg} kg` : '';
      return;
    }
    const kgs = log.map(w => w.kg);
    const min = Math.min(...kgs), max = Math.max(...kgs), span = (max - min) || 1;
    const W = 220, H = 90, pad = 10;
    const pts = log.map((w, i) => {
      const x = pad + (i / (log.length - 1)) * (W - 2 * pad);
      const y = pad + (1 - (w.kg - min) / span) * (H - 2 * pad);
      return [x, y];
    });
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${H} L${pts[0][0].toFixed(1)},${H} Z`;
    const last = pts[pts.length - 1];
    svg.innerHTML = `<path class="area" d="${area}"/><path class="line" d="${line}"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3"/>`;
    document.getElementById('weight-latest').textContent = `${kgs[kgs.length - 1]} kg`;
  },

  renderMeals(food) {
    const slots = (typeof MEAL_SLOTS !== 'undefined') ? MEAL_SLOTS
      : [{ id: 'breakfast', label: 'Desayuno', icon: '🌅' }, { id: 'lunch', label: 'Almuerzo', icon: '☀️' },
         { id: 'snack', label: 'Merienda', icon: '🍎' }, { id: 'dinner', label: 'Cena', icon: '🌙' }];
    const hour = new Date().getHours();
    const rail = document.getElementById('meal-rail');
    rail.innerHTML = slots.map(sl => {
      const items = food.filter(f => f.slot === sl.id);
      const filled = items.length > 0;
      const kcal = items.reduce((a, f) => a + (f.kcal || 0), 0);
      const past = hour > (this.MEAL_TIMES[sl.id] ?? 12) + 2;
      const cls = filled ? 'filled' : (past ? 'missed' : '');
      const state = filled ? `${kcal} kcal` : (past ? 'sin registro' : 'pendiente');
      return `<div class="meal-slot ${cls}">
        <div class="meal-ico">${sl.icon}</div>
        <div class="meal-info"><div class="meal-name">${sl.label}</div><div class="meal-state">${state}</div></div>
      </div>`;
    }).join('');
  },

  // ── Assistant: orb state + insight ticker (rule engine) ────────
  buildInsights(m) {
    const out = [];
    // Live rules first (most actionable)
    if (m.rem < 0) out.push({ p: 3, s: 'alert', t: `Vas ${Math.abs(m.rem)} kcal por encima de tu meta hoy.` });
    else if (m.pct > 0.85) out.push({ p: 2, s: 'alert', t: `Te quedan ${m.rem} kcal — cerca del límite.` });
    else out.push({ p: 0, s: 'idle', t: `${m.rem} kcal disponibles de ${m.goal}.` });

    const waterPct = m.water / m.wGoal;
    if (waterPct < m.paceFrac - 0.15) out.push({ p: 2, s: 'alert', t: `Vas atrasado en agua: ${m.water} ml, deberías ir por ~${Math.round(m.wGoal * m.paceFrac)} ml.` });
    else if (waterPct >= 1) out.push({ p: 1, s: 'celebrate', t: `¡Meta de agua cumplida! ${m.water} ml 💧` });

    if (m.days >= 7) out.push({ p: 1, s: 'celebrate', t: `🔥 Racha de ${m.days} días. ¡Sigue así!` });
    else if (m.days > 0) out.push({ p: 0, s: 'idle', t: `Racha activa: ${m.days} día${m.days > 1 ? 's' : ''}.` });

    // Weekly insights from shared core, if available
    if (typeof generateWeeklyInsights === 'function') {
      try {
        const wk = generateWeeklyInsights();
        (Array.isArray(wk) ? wk : []).slice(0, 3).forEach(w => {
          const txt = typeof w === 'string' ? w : (w && (w.text || w.msg || w.message));
          if (txt) out.push({ p: 0, s: 'idle', t: txt });
        });
      } catch {}
    }
    return out;
  },

  updateAssistant(m) {
    this._insights = this.buildInsights(m).sort((a, b) => b.p - a.p);
    // Orb state = highest-priority insight's mood
    const top = this._insights[0] || { s: 'idle' };
    const orb = document.getElementById('orb');
    orb.className = 'orb ' + (top.s === 'idle' ? '' : top.s);
    // Reset ticker to the top insight immediately
    this._tickerIdx = 0;
    this.showTicker();
  },

  startTicker() {
    clearInterval(this._tickerTimer);
    this._tickerTimer = setInterval(() => {
      if (!this._insights || !this._insights.length) return;
      this._tickerIdx = (this._tickerIdx + 1) % this._insights.length;
      this.showTicker();
    }, 5500);
  },

  showTicker() {
    const el = document.getElementById('ticker-msg');
    const ins = (this._insights || [])[this._tickerIdx];
    if (!ins) return;
    el.style.opacity = 0;
    setTimeout(() => { el.textContent = ins.t; el.style.opacity = 1; }, 250);
  },

  // ── Native reminders (Electron) ───────────────────────────────
  pushReminders() {
    if (!this.isDesktop) return;
    const s = DB.settings();
    const list = [];
    const at = (h, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); if (d <= new Date()) d.setDate(d.getDate() + 1); return d.getTime(); };
    if (s.mealReminderEnabled) {
      const [h, m] = (s.mealReminderTime || '13:00').split(':').map(Number);
      list.push({ id: 'meal', title: '🍽️ ¿Qué vas a almorzar?', body: 'Revisa tus recomendaciones en LifeTrack.', at: at(h, m) });
    }
    if (s.hydrationEnabled) {
      list.push({ id: 'water', title: '💧 Hora de hidratarte', body: 'Registra tu próximo vaso de agua.', at: at(new Date().getHours() + 1) });
    }
    window.desktop.scheduleReminders(list);
  },

  toast(msg) {
    document.querySelectorAll('.hud-toast').forEach(t => t.remove());
    const el = document.createElement('div');
    el.className = 'hud-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  },
};

window.addEventListener('DOMContentLoaded', () => HUD.init());
