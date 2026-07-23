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
    if (typeof DB.migrateLiftLog === 'function') DB.migrateLiftLog();
    this.applyTheme(localStorage.getItem('lt_hud_theme') || '');
    this.bindControls();
    this.bindSettings();
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
    this._refreshTimer = setInterval(() => this.render(), this.syncIntervalMs());
    // Restore always-on-top preference
    if (window.desktop && localStorage.getItem('lt_hud_ontop')) window.desktop.setAlwaysOnTop(true);
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
      d.onDataChanged(() => this.render()); // quick-log overlay wrote data

    }

    document.querySelectorAll('[data-water]').forEach(b =>
      b.onclick = () => this.addWater(+b.dataset.water));
    document.getElementById('qf-repeat').onclick = () => this.repeatYesterday();
    document.getElementById('qf-open').onclick = () => this.quickFood();

    document.getElementById('ov-local').onclick = () => { localStorage.setItem('lt_skip_auth', '1'); this.start(); };
    document.getElementById('ov-google').onclick = () => this.signInGoogle();

    // View tabs + analytics range
    document.getElementById('tab-hud').onclick = () => this.setView('hud');
    document.getElementById('tab-analytics').onclick = () => this.setView('analytics');
    document.getElementById('tab-gym').onclick = () => this.setView('gym');

    // Gym log form
    const gymForm = document.getElementById('gym-form');
    if (gymForm) {
      gymForm.onsubmit = (e) => { e.preventDefault(); this.logLiftSet(); };
      const upd = () => {
        const kg = parseFloat(document.getElementById('gym-kg').value);
        const reps = parseInt(document.getElementById('gym-reps').value, 10) || 1;
        const e = (kg && reps > 1 && typeof Strength !== 'undefined') ? Strength.e1rm(kg, reps) : null;
        document.getElementById('gym-e1rm-hint').textContent = e ? `1RM estimado: ${e} kg` : '';
      };
      document.getElementById('gym-kg').oninput = upd;
      document.getElementById('gym-reps').oninput = upd;
    }
    document.querySelectorAll('#an-range .an-range-btn').forEach(b =>
      b.onclick = () => {
        this.anRange = +b.dataset.range;
        document.querySelectorAll('#an-range .an-range-btn').forEach(x => x.classList.toggle('on', x === b));
        this.renderAnalytics();
      });
  },

  view: 'hud',
  anRange: 7,

  setView(v) {
    this.view = v;
    ['hud', 'analytics', 'gym'].forEach(id => {
      document.getElementById(id).hidden = id !== v;
      document.getElementById('tab-' + id).classList.toggle('on', id === v);
    });
    document.getElementById('assistant').style.display = v === 'hud' ? '' : 'none';
    if (v === 'analytics') this.renderAnalytics();
    if (v === 'gym') this.renderGym();
  },

  // ── Theme + settings ──────────────────────────────────────────
  applyTheme(theme) {
    document.documentElement.dataset.theme = theme || '';
    localStorage.setItem('lt_hud_theme', theme || '');
  },

  syncIntervalMs() {
    return (parseInt(localStorage.getItem('lt_hud_sync_interval'), 10) || 30) * 1000;
  },

  bindSettings() {
    const pop = document.getElementById('settings-pop');
    const gear = document.getElementById('tb-settings');
    gear.onclick = (e) => { e.stopPropagation(); pop.hidden = !pop.hidden; this._syncSettingsUI(); };
    document.addEventListener('click', (e) => {
      if (!pop.hidden && !pop.contains(e.target) && e.target !== gear) pop.hidden = true;
    });

    document.querySelectorAll('#sp-themes .sp-swatch').forEach(sw =>
      sw.onclick = () => {
        this.applyTheme(sw.dataset.theme);
        document.querySelectorAll('#sp-themes .sp-swatch').forEach(x => x.classList.toggle('on', x === sw));
      });

    document.getElementById('sp-ontop').onchange = (e) => {
      if (window.desktop) window.desktop.setAlwaysOnTop(e.target.checked);
      localStorage.setItem('lt_hud_ontop', e.target.checked ? '1' : '');
    };

    document.getElementById('sp-autostart').onchange = (e) => {
      if (window.desktop) window.desktop.setAutostart(e.target.checked);
    };

    document.getElementById('sp-sync').onchange = (e) => {
      localStorage.setItem('lt_hud_sync_interval', e.target.value);
      this._rearmRefresh();
    };

    // Hide desktop-only rows in a plain browser
    if (!window.desktop) document.getElementById('sp-autostart-row').style.display = 'none';
  },

  async _syncSettingsUI() {
    const theme = localStorage.getItem('lt_hud_theme') || '';
    document.querySelectorAll('#sp-themes .sp-swatch').forEach(x =>
      x.classList.toggle('on', x.dataset.theme === theme));
    document.getElementById('sp-ontop').checked = !!localStorage.getItem('lt_hud_ontop');
    document.getElementById('sp-sync').value = String(parseInt(localStorage.getItem('lt_hud_sync_interval'), 10) || 30);
    if (window.desktop && window.desktop.getAutostart) {
      try { document.getElementById('sp-autostart').checked = await window.desktop.getAutostart(); } catch {}
    }
  },

  _rearmRefresh() {
    clearInterval(this._refreshTimer);
    this._refreshTimer = setInterval(() => this.render(), this.syncIntervalMs());
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

    // Streak — calcStreaks() returns { water, calories, tasks, exercise },
    // each { best, current, todayOk }. Use the best current streak across all.
    const streaks = (typeof calcStreaks === 'function') ? calcStreaks() : {};
    const days = Math.max(0, ...Object.values(streaks).map(v => (v && v.current) || 0));
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

    // Keep analytics live if it's the active view
    if (this.view === 'analytics') this.renderAnalytics();
  },

  // ── Analytics view ────────────────────────────────────────────
  _lastNDays(n) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); out.push(fmtDate(d)); }
    return out;
  },

  renderAnalytics() {
    this.anKcalBars();
    this.anWeightChart();
    this.anHeatStrip();
    this.anCorrelations();
    this.anInsights();
  },

  anKcalBars() {
    const days = this._lastNDays(this.anRange);
    const food = DB.foodLog();
    const goal = DB.settings().calorieGoal || 2000;
    const vals = days.map(d => (food[d] || []).reduce((a, f) => a + (f.kcal || 0), 0));
    const W = 460, H = 150, padB = 18, padT = 8;
    const maxV = Math.max(goal * 1.2, ...vals, 1);
    const bw = (W / days.length);
    const gy = padT + (1 - goal / maxV) * (H - padB - padT);
    let bars = '';
    vals.forEach((v, i) => {
      const bh = (v / maxV) * (H - padB - padT);
      const x = i * bw + bw * 0.15, w = bw * 0.7;
      const y = H - padB - bh;
      const col = v === 0 ? 'rgba(53,226,255,0.12)'
        : v <= goal ? 'var(--green)' : v <= goal * 1.1 ? 'var(--amber)' : 'var(--red)';
      bars += `<rect class="an-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="${col}"/>`;
    });
    // sparse day labels
    let labels = '';
    const step = this.anRange > 7 ? Math.ceil(days.length / 7) : 1;
    days.forEach((d, i) => {
      if (i % step) return;
      labels += `<text class="an-axis" x="${(i * bw + bw / 2).toFixed(1)}" y="${H - 5}" text-anchor="middle">${d.slice(8)}</text>`;
    });
    document.getElementById('an-kcal-bars').innerHTML =
      bars +
      `<line class="an-goal-line" x1="0" y1="${gy.toFixed(1)}" x2="${W}" y2="${gy.toFixed(1)}"/>` +
      `<text class="an-axis" x="2" y="${(gy - 3).toFixed(1)}">meta ${goal}</text>` +
      labels;
  },

  anWeightChart() {
    const svg = document.getElementById('an-weight-chart');
    const cap = document.getElementById('an-weight-cap');
    const log = (DB.weightLog() || []).slice(-this.anRange);
    if (log.length < 2) {
      svg.innerHTML = `<text class="an-empty" x="150" y="75" text-anchor="middle">Registra tu peso para ver tendencia</text>`;
      cap.textContent = '';
      return;
    }
    const pred = (typeof calcPrediction === 'function') ? calcPrediction() : null;
    const W = 300, H = 150, pad = 16;
    const kgs = log.map(w => w.kg);
    let min = Math.min(...kgs), max = Math.max(...kgs);
    if (pred && pred.in4weeks != null) { min = Math.min(min, pred.in4weeks); max = Math.max(max, pred.in4weeks); }
    if (pred && pred.goalKg) { min = Math.min(min, pred.goalKg); max = Math.max(max, pred.goalKg); }
    const span = (max - min) || 1;
    const X = i => pad + (i / (log.length - 1)) * (W - 2 * pad) * 0.72; // leave room for projection
    const Y = kg => pad + (1 - (kg - min) / span) * (H - 2 * pad);
    const pts = log.map((w, i) => [X(i), Y(w.kg)]);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${H - pad} L${pts[0][0].toFixed(1)},${H - pad} Z`;
    let extra = '';
    if (pred && pred.in4weeks != null) {
      const last = pts[pts.length - 1];
      const projX = W - pad, projY = Y(pred.in4weeks);
      extra += `<path class="an-wproj" d="M${last[0].toFixed(1)},${last[1].toFixed(1)} L${projX},${projY.toFixed(1)}"/>`;
      extra += `<circle cx="${projX}" cy="${projY.toFixed(1)}" r="3" fill="var(--amber)"/>`;
    }
    if (pred && pred.goalKg) {
      const gy = Y(pred.goalKg);
      extra += `<line class="an-wgoal" x1="0" y1="${gy.toFixed(1)}" x2="${W}" y2="${gy.toFixed(1)}"/>`;
    }
    svg.innerHTML = `<path class="an-warea" d="${area}"/><path class="an-wline" d="${line}"/>` +
      `<circle cx="${pts[pts.length-1][0].toFixed(1)}" cy="${pts[pts.length-1][1].toFixed(1)}" r="3" fill="var(--cyan)"/>` + extra;
    const lastKg = +kgs[kgs.length - 1].toFixed(1);
    cap.textContent = `${lastKg} kg`;
    if (pred && pred.kgPerWeek != null) {
      const rate = pred.kgPerWeek;
      // Only show "weeks to goal" when it's a positive, sensible ETA
      const wk = (pred.weeksToGoal && pred.weeksToGoal > 0) ? ` · meta en ~${pred.weeksToGoal} sem` : '';
      cap.textContent = `${lastKg} kg · ${rate > 0 ? '+' : ''}${rate}/sem${wk}`;
    }
  },

  anHeatStrip() {
    const days = this._lastNDays(this.anRange);
    const food = DB.foodLog(), water = DB.waterLog(), ex = DB.exerciseLog();
    const s = DB.settings();
    const goal = s.calorieGoal || 2000, wGoal = s.waterGoal || 2500;
    const rows = [
      { label: 'Cal', cls: 'on', test: d => { const k = (food[d] || []).reduce((a, f) => a + (f.kcal || 0), 0); return k > 0 && k <= goal * 1.05; } },
      { label: 'Agua', cls: 'on', test: d => (water[d] || 0) >= wGoal * 0.9 },
      { label: 'Ejer', cls: 'p', test: d => (ex[d] || []).length > 0 },
    ];
    document.getElementById('an-heatstrip').innerHTML = rows.map(r => `
      <div class="an-heat-row">
        <span class="an-heat-label">${r.label}</span>
        <div class="an-heat-cells">
          ${days.map(d => `<span class="an-cell ${r.test(d) ? r.cls : ''}" title="${d}"></span>`).join('')}
        </div>
      </div>`).join('');
  },

  anCorrelations() {
    const el = document.getElementById('an-correlations');
    if (typeof calcWellnessCorrelations !== 'function') { el.innerHTML = ''; return; }
    const c = calcWellnessCorrelations();
    const rows = Object.values(c);
    el.innerHTML = rows.map(row => {
      const has = row.r != null;
      const mag = has ? Math.min(Math.abs(row.r), 1) : 0;
      const rTxt = has ? (row.r > 0 ? '+' : '') + row.r.toFixed(2) : '—';
      return `<div class="an-corr-row ${has ? '' : 'dim'}" title="${row.desc}">
        <span class="an-corr-label">${row.label}</span>
        <span class="an-corr-bar-wrap"><span class="an-corr-bar" style="width:${(mag * 100).toFixed(0)}%;background:${row.r < 0 ? 'var(--amber)' : 'var(--cyan)'}"></span></span>
        <span class="an-corr-r">${rTxt}</span>
      </div>`;
    }).join('');
  },

  anInsights() {
    const el = document.getElementById('an-insights');
    if (typeof generateWeeklyInsights !== 'function') { el.innerHTML = ''; return; }
    const { insights } = generateWeeklyInsights();
    el.innerHTML = (insights || []).map(i => `
      <div class="an-ins-row">
        <span class="an-ins-ico">${i.icon || '•'}</span>
        <div>
          <div class="an-ins-text" style="color:${i.color || 'var(--ink)'}">${i.text}</div>
          ${i.sub ? `<div class="an-ins-sub">${i.sub}</div>` : ''}
        </div>
      </div>`).join('');
  },

  // ── Gym view ──────────────────────────────────────────────────
  gymLift: 'squat',

  _liftDefs() {
    return (typeof LIFT_STANDARDS !== 'undefined' && LIFT_STANDARDS.lifts) || [
      { id: 'squat', label: 'Sentadilla', emoji: '🦵' }, { id: 'bench', label: 'Press banca', emoji: '🏋️' },
      { id: 'deadlift', label: 'Peso muerto', emoji: '🪨' }, { id: 'ohp', label: 'Press militar', emoji: '💪' },
    ];
  },

  renderGym() {
    const defs = this._liftDefs();
    // Lift selector tabs
    const tabsEl = document.getElementById('gym-lift-tabs');
    tabsEl.innerHTML = defs.map(l =>
      `<button class="gym-lift-tab ${l.id === this.gymLift ? 'on' : ''}" data-lift="${l.id}">${l.emoji} ${l.label}</button>`).join('');
    tabsEl.querySelectorAll('[data-lift]').forEach(b =>
      b.onclick = () => { this.gymLift = b.dataset.lift; this.renderGym(); });

    this.gymChart();
    this.gymPRs();
    this.gymTiers();
    this.gymVolume();
  },

  gymChart() {
    const svg = document.getElementById('gym-chart');
    const def = this._liftDefs().find(l => l.id === this.gymLift);
    document.getElementById('gym-lift-name').textContent = def ? def.label : '';
    const hist = (typeof Strength !== 'undefined')
      ? Strength.progress(DB.liftHistory(this.gymLift))
      : DB.liftHistory(this.gymLift);
    if (!hist || hist.length < 1) {
      svg.innerHTML = `<text class="an-empty" x="230" y="80" text-anchor="middle">Aún no registras este ejercicio</text>`;
      return;
    }
    if (hist.length === 1) {
      const e = hist[0];
      svg.innerHTML = `<circle class="gym-cpr" cx="230" cy="80" r="5"/><text class="an-empty" x="230" y="110" text-anchor="middle">${e.e1rm} kg · registra más para ver la curva</text>`;
      return;
    }
    const W = 460, H = 160, pad = 20;
    const es = hist.map(h => h.e1rm || 0);
    const min = Math.min(...es) * 0.95, max = Math.max(...es) * 1.05, span = (max - min) || 1;
    const X = i => pad + (i / (hist.length - 1)) * (W - 2 * pad);
    const Y = e => pad + (1 - (e - min) / span) * (H - 2 * pad);
    const pts = hist.map((h, i) => [X(i), Y(h.e1rm)]);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length-1][0].toFixed(1)},${H-pad} L${pts[0][0].toFixed(1)},${H-pad} Z`;
    const dots = hist.map((h, i) =>
      `<circle class="${h.isPR ? 'gym-cpr' : 'gym-cdot'}" cx="${pts[i][0].toFixed(1)}" cy="${pts[i][1].toFixed(1)}" r="${h.isPR ? 4 : 2.5}"><title>${h.date}: ${h.e1rm} kg${h.isPR ? ' (PR)' : ''}</title></circle>`).join('');
    svg.innerHTML = `<path class="gym-carea" d="${area}"/><path class="gym-cline" d="${line}"/>${dots}`;
  },

  gymPRs() {
    const el = document.getElementById('gym-prs');
    const prs = (typeof Strength !== 'undefined') ? Strength.prs(DB.liftLog()) : {};
    const defs = this._liftDefs();
    el.innerHTML = defs.map(l => {
      const pr = prs[l.id];
      return `<div class="gym-pr-row">
        <span class="gym-pr-emoji">${l.emoji}</span>
        <span class="gym-pr-name">${l.label}</span>
        ${pr ? `<span class="gym-pr-val">${pr.e1rm} kg</span><span class="gym-pr-date">${pr.date.slice(5)}</span>`
              : `<span class="gym-pr-date">— sin datos</span>`}
      </div>`;
    }).join('');
  },

  gymTiers() {
    const el = document.getElementById('gym-tiers');
    if (typeof Strength === 'undefined') { el.innerHTML = ''; return; }
    const s = DB.settings();
    const bodyKg = (DB.weightLog().slice(-1)[0] || {}).kg || s.weightGoal || null;
    const sex = s.gender || 'male';
    const lifts = DB.lifts();
    const overall = Strength.tier(Strength.overall(lifts, bodyKg, sex));
    document.getElementById('gym-overall').textContent = overall ? `${overall.emoji} ${overall.label}` : '';
    el.innerHTML = this._liftDefs().map(l => {
      const entry = lifts[l.id];
      const r = entry ? Strength.rank(l.id, entry.e1rm, bodyKg, sex) : null;
      const tier = r ? Strength.tier(r.idx) : null;
      const pct = r ? Math.min(100, Math.max(6, ((r.idx + 1) / 5) * 100)) : 0;
      return `<div class="gym-tier-row">
        <span class="gym-tier-name">${l.label}</span>
        <span class="gym-tier-bar-wrap"><span class="gym-tier-bar" style="width:${pct}%;background:${tier ? tier.color : 'var(--ink-dim)'}"></span></span>
        <span class="gym-tier-badge">${tier ? tier.emoji : '·'}</span>
      </div>`;
    }).join('');
  },

  gymVolume() {
    const el = document.getElementById('gym-volume');
    const v = (typeof Strength !== 'undefined') ? Strength.volume(DB.liftLog(), 7) : { sets: 0, reps: 0, tonnage: 0, days: 0 };
    const stat = (n, l) => `<div class="gym-vol-stat"><div class="gym-vol-num">${n}</div><div class="gym-vol-lbl">${l}</div></div>`;
    el.innerHTML = stat(v.days, 'DÍAS') + stat(v.sets, 'SERIES') + stat(v.reps, 'REPS') + stat(v.tonnage.toLocaleString(), 'KG TOTAL');
  },

  logLiftSet() {
    const kg = parseFloat(document.getElementById('gym-kg').value);
    const reps = parseInt(document.getElementById('gym-reps').value, 10) || 1;
    if (!kg || kg <= 0) { this.toast('Ingresa el peso'); return; }
    const e1rm = (typeof Strength !== 'undefined') ? Strength.e1rm(kg, reps) : Math.round(kg);
    DB.addLiftEntry(this.gymLift, { kg, reps, e1rm });
    document.getElementById('gym-kg').value = '';
    document.getElementById('gym-e1rm-hint').textContent = '';
    if (window.desktop) window.desktop.dataChanged();
    this.renderGym();
    const def = this._liftDefs().find(l => l.id === this.gymLift);
    this.toast(`✓ ${def ? def.label : ''} ${kg}kg×${reps} · 1RM ${e1rm}`);
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
