// ============================================================
// SHARED CORE — insights.js
// calcStreaks, calcPrediction, correlations, weekly insights
// Extracted verbatim from app.js. Loaded as a plain <script> by both the
// PWA (index.html) and the Electron desktop renderer. No exports/build.
// ============================================================

// ================================================================
// STREAKS
// ================================================================
function calcStreaks() {
  const s    = DB.settings();
  const food = DB.foodLog();
  const water= DB.waterLog();
  const done = DB.completions();
  const tasks= DB.tasks();
  const exLog= DB.exerciseLog();

  const checkDay = (dateStr) => {
    const dow = new Date(dateStr + 'T12:00:00').getDay();
    const dayFood  = food[dateStr] || [];
    const dayKcal  = dayFood.reduce((a,f) => a+f.kcal, 0);
    const dayTasks = tasks.filter(t => !t.days?.length || t.days.includes(dow));
    const dayDone  = done[dateStr] || {};
    return {
      water:    (water[dateStr]||0) >= (s.waterGoal||2500),
      calories: dayFood.length > 0 && dayKcal > 0 && dayKcal <= (s.calorieGoal||2000),
      tasks:    dayTasks.length > 0 && dayTasks.every(t => dayDone[t.id]),
      exercise: (exLog[dateStr]||[]).length > 0,
    };
  };

  // Build streaks from today backwards
  const keys = ['water','calories','tasks','exercise'];
  const streaks = Object.fromEntries(keys.map(k => [k, { current:0, todayOk:false }]));
  const broken  = Object.fromEntries(keys.map(k => [k, false]));

  for (let i = 0; i <= 365; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dateStr = fmtDate(d);
    const check = checkDay(dateStr);
    keys.forEach(k => {
      if (broken[k]) return;
      if (i === 0) { streaks[k].todayOk = check[k]; }
      // Only count today if goal is already met; past days always count
      if (i === 0 && !check[k]) { broken[k] = true; return; }
      if (check[k]) streaks[k].current++;
      else { broken[k] = true; }
    });
    if (keys.every(k => broken[k])) break;
  }

  // Update & persist best records
  const bests = DB._g('lt_streak_bests', {water:0,calories:0,tasks:0,exercise:0});
  let bestUpdated = false;
  keys.forEach(k => {
    if (streaks[k].current > (bests[k]||0)) { bests[k] = streaks[k].current; bestUpdated = true; }
    streaks[k].best = bests[k]||0;
  });
  if (bestUpdated) DB._s('lt_streak_bests', bests);

  return streaks;
}

// ================================================================
// WEIGHT PREDICTION — linear regression on weight log
// ================================================================
function calcPrediction() {
  const s       = DB.settings();
  const weights = DB.weightLog();
  if (!weights.length) return null;
  const currentKg = weights[weights.length - 1].kg;

  // ── Linear regression on up to last 30 weight entries ──────
  let kgPerDay = null, r2 = null;
  if (weights.length >= 3) {
    const pts = weights.slice(-30);
    const n   = pts.length;
    const t0  = new Date(pts[0].date + 'T12:00:00').getTime();
    const xs  = pts.map(p => (new Date(p.date + 'T12:00:00').getTime() - t0) / 86400000);
    const ys  = pts.map(p => p.kg);
    const meanX = xs.reduce((a,x)=>a+x,0)/n;
    const meanY = ys.reduce((a,y)=>a+y,0)/n;
    const sxy   = xs.reduce((a,x,i)=>a+(x-meanX)*(ys[i]-meanY),0);
    const sxx   = xs.reduce((a,x)=>a+(x-meanX)**2,0);
    if (sxx > 0.001) {
      kgPerDay     = sxy / sxx;
      const b      = meanY - kgPerDay * meanX;
      const ssRes  = ys.reduce((a,y,i)=>a+(y-(b+kgPerDay*xs[i]))**2,0);
      const ssTot  = ys.reduce((a,y)=>a+(y-meanY)**2,0);
      r2 = ssTot > 0 ? +(1 - ssRes/ssTot).toFixed(2) : null;
    }
  }

  // ── Average caloric intake last 14 days ────────────────────
  const food = DB.foodLog();
  const days14 = Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(13-i));return fmtDate(d);});
  const daysWithData = days14.filter(d=>(food[d]||[]).length>0);
  const avgKcal = daysWithData.length
    ? daysWithData.reduce((a,d)=>a+(food[d]||[]).reduce((s,f)=>s+f.kcal,0),0)/daysWithData.length
    : null;

  // ── TDEE (Mifflin-St Jeor) ─────────────────────────────────
  let tdee = s.calorieGoal || 2000;
  if (s.height && s.age) {
    const bmr = s.gender==='female'
      ? 10*currentKg + 6.25*s.height - 5*s.age - 161
      : 10*currentKg + 6.25*s.height - 5*s.age + 5;
    const mult = {sedentary:1.2,light:1.375,moderate:1.55,active:1.725,very_active:1.9};
    tdee = Math.round(bmr * (mult[s.activityLevel]||1.55));
  }

  const dailyDeficit  = avgKcal != null ? tdee - avgKcal : null;
  const kgPerWeekCaloric = dailyDeficit != null ? (dailyDeficit * 7) / 7700 : null;
  const kgPerWeekReg     = kgPerDay != null ? kgPerDay * 7 : null;
  // Prefer regression-based rate if we have it
  const kgPerWeek = kgPerWeekReg ?? kgPerWeekCaloric;
  const in4weeks  = kgPerDay != null ? +(currentKg + kgPerDay * 28).toFixed(1) : null;

  const goalKg = s.weightGoal;
  let weeksToGoal = null;
  if (goalKg && kgPerWeek && Math.abs(kgPerWeek) > 0.005) {
    weeksToGoal = Math.ceil((currentKg - goalKg) / kgPerWeek);
  }

  return {
    currentKg,
    avgKcal: avgKcal != null ? Math.round(avgKcal) : null,
    tdee,
    dailyDeficit: dailyDeficit != null ? Math.round(dailyDeficit) : null,
    kgPerWeek:    kgPerWeek != null ? +kgPerWeek.toFixed(2) : null,
    goalKg, weeksToGoal, r2, in4weeks,
    method: kgPerWeekReg != null ? 'regression' : 'caloric',
  };
}

// ================================================================
// WELLNESS CORRELATIONS
// ================================================================
function calcWellnessCorrelations() {
  const wellness = DB.wellness();
  const food     = DB.foodLog();
  const water    = DB.waterLog();
  const exercise = DB.exerciseLog();

  // Build a series of paired observations from the past 30 days
  const days = Array.from({length:30},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return fmtDate(d);});
  const pairs = { sleepKcal:[], sleepWater:[], moodSleep:[], energyEx:[], moodKcal:[] };

  days.forEach(date => {
    const w  = wellness[date];
    if (!w) return;
    const kcal = (food[date]||[]).reduce((a,f)=>a+f.kcal,0);
    const ml   = water[date]||0;
    const exKcal = (exercise[date]||[]).reduce((a,e)=>a+e.kcalBurned,0);
    if (w.sleep != null && kcal > 0) pairs.sleepKcal.push([w.sleep, kcal]);
    if (w.sleep != null && ml > 0)   pairs.sleepWater.push([w.sleep, ml]);
    if (w.mood  != null && w.sleep != null) pairs.moodSleep.push([w.mood, w.sleep]);
    if (w.energy != null)             pairs.energyEx.push([w.energy, exKcal]);
    if (w.mood  != null && kcal > 0)  pairs.moodKcal.push([w.mood, kcal]);
  });

  const pearson = (arr) => {
    const n = arr.length; if (n < 4) return null;
    const xs = arr.map(p=>p[0]), ys = arr.map(p=>p[1]);
    const mx = xs.reduce((a,x)=>a+x,0)/n, my = ys.reduce((a,y)=>a+y,0)/n;
    const num = arr.reduce((a,p)=>a+(p[0]-mx)*(p[1]-my),0);
    const dx  = Math.sqrt(xs.reduce((a,x)=>a+(x-mx)**2,0));
    const dy  = Math.sqrt(ys.reduce((a,y)=>a+(y-my)**2,0));
    return (dx*dy) > 0 ? +(num/(dx*dy)).toFixed(2) : null;
  };

  return {
    sleepKcal:  { r: pearson(pairs.sleepKcal),  n: pairs.sleepKcal.length,  label:'Sueño → Calorías',       desc:'¿Dormir más cambia tu ingesta?' },
    sleepWater: { r: pearson(pairs.sleepWater), n: pairs.sleepWater.length, label:'Sueño → Hidratación',    desc:'¿El descanso mejora tu hidratación?' },
    moodSleep:  { r: pearson(pairs.moodSleep),  n: pairs.moodSleep.length,  label:'Ánimo → Horas de sueño', desc:'¿Buen ánimo con más descanso?' },
    energyEx:   { r: pearson(pairs.energyEx),   n: pairs.energyEx.length,   label:'Energía → Ejercicio',    desc:'¿Alta energía = más ejercicio?' },
    moodKcal:   { r: pearson(pairs.moodKcal),   n: pairs.moodKcal.length,   label:'Ánimo → Calorías',       desc:'¿Cómo afecta tu estado de ánimo?' },
  };
}

// ================================================================
// WEEKLY INSIGHTS
// ================================================================
function generateWeeklyInsights() {
  const s        = DB.settings();
  const food     = DB.foodLog();
  const water    = DB.waterLog();
  const exercise = DB.exerciseLog();
  const wellness = DB.wellness();
  const tasks    = DB.tasks();
  const done     = DB.completions();
  const now      = new Date();
  const days     = Array.from({length:7},(_,i)=>{ const d=new Date(now); d.setDate(now.getDate()-(6-i)); return fmtDate(d); });
  const kcalGoal = s.calorieGoal || 2000;
  const waterGoal= s.waterGoal   || 2500;

  const kcals     = days.map(d=>(food[d]||[]).reduce((a,f)=>a+f.kcal,0));
  const waters    = days.map(d=>water[d]||0);
  const exKcals   = days.map(d=>(exercise[d]||[]).reduce((a,e)=>a+e.kcalBurned,0));
  const taskPcts  = days.map(d=>{
    const dow = new Date(d+'T12:00:00').getDay();
    const dt  = tasks.filter(t=>!t.days?.length||t.days.includes(dow));
    if (!dt.length) return null;
    const dd  = done[d]||{};
    return Math.round(dt.filter(t=>dd[t.id]).length/dt.length*100);
  });

  const daysWithKcal = days.filter((_,i)=>kcals[i]>0);
  const avgKcal   = daysWithKcal.length
    ? Math.round(daysWithKcal.map((_,j)=>kcals[days.indexOf(daysWithKcal[j])]).reduce((a,v)=>a+v,0) / daysWithKcal.length)
    : 0;
  const avgKcalAll= Math.round(kcals.reduce((a,v)=>a+v,0)/7);
  const daysGoal  = kcals.filter(v=>v>0&&v<=kcalGoal).length;
  const daysWater = waters.filter(v=>v>=waterGoal).length;
  const exDays    = days.filter((_,i)=>exKcals[i]>0).length;
  const totalExKcal=exKcals.reduce((a,v)=>a+v,0);

  const sleepArr  = days.filter(d=>wellness[d]?.sleep!=null).map(d=>wellness[d].sleep);
  const avgSleep  = sleepArr.length ? (sleepArr.reduce((a,v)=>a+v,0)/sleepArr.length).toFixed(1) : null;
  const moodArr   = days.filter(d=>wellness[d]?.mood!=null).map(d=>wellness[d].mood);
  const avgMood   = moodArr.length ? (moodArr.reduce((a,v)=>a+v,0)/moodArr.length).toFixed(1) : null;
  const taskArr   = taskPcts.filter(v=>v!=null);
  const avgTask   = taskArr.length ? Math.round(taskArr.reduce((a,v)=>a+v,0)/taskArr.length) : null;

  // Best and worst kcal day
  const kcalPairs = days.map((d,i)=>({d,k:kcals[i]})).filter(p=>p.k>0);
  const bestKcalDay  = kcalPairs.length ? kcalPairs.reduce((b,p)=>Math.abs(p.k-kcalGoal)<Math.abs(b.k-kcalGoal)?p:b) : null;

  // Weight change this week
  const wLog = DB.weightLog();
  const weekAgoStr = fmtDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()-7));
  const weekAgo = [...wLog].reverse().find(w=>w.date<=weekAgoStr);
  const current = wLog[wLog.length-1];
  const weightDiff = (current && weekAgo && current.date !== weekAgo.date)
    ? +(current.kg - weekAgo.kg).toFixed(1) : null;

  const insights = [];

  // Calories
  if (avgKcalAll > 0) {
    const kcalDiff = avgKcalAll - kcalGoal;
    const kcalColor = daysGoal >= 5 ? '#10b981' : daysGoal >= 3 ? '#f59e0b' : '#ef4444';
    insights.push({ icon:'🍽', text:`Prom. ${avgKcalAll} kcal/día`,
      sub: `Meta cumplida ${daysGoal}/7 días`, color: kcalColor });
  }

  // Water
  insights.push({ icon:'💧', text:`Agua: ${daysWater}/7 días meta cumplida`,
    sub: daysWater >= 5 ? '¡Excelente hidratación! 💪' : daysWater >= 3 ? 'Puedes mejorar tu hidratación' : 'Recuerda beber más agua',
    color: daysWater >= 5 ? '#10b981' : daysWater >= 3 ? '#f59e0b' : '#ef4444' });

  // Exercise
  if (exDays > 0) {
    insights.push({ icon:'🔥', text:`${exDays} día${exDays>1?'s':''} de ejercicio`,
      sub: `~${totalExKcal} kcal quemadas en total`, color:'#d97706' });
  } else {
    insights.push({ icon:'🏋️', text:'Sin ejercicio esta semana',
      sub:'Intenta al menos 3 sesiones la próxima semana', color:'var(--text-muted)' });
  }

  // Sleep
  if (avgSleep) {
    const sleepColor = parseFloat(avgSleep)>=7?'#10b981':parseFloat(avgSleep)>=6?'#f59e0b':'#ef4444';
    insights.push({ icon:'😴', text:`Sueño promedio: ${avgSleep}h`,
      sub: parseFloat(avgSleep)>=7?'Buen descanso 🌙':parseFloat(avgSleep)>=6?'Intenta dormir un poco más':'El descanso es clave para la salud',
      color: sleepColor });
  }

  // Tasks
  if (avgTask !== null) {
    insights.push({ icon:'✅', text:`Tareas completadas: ${avgTask}%`,
      sub: avgTask>=80?'¡Semana muy productiva!':avgTask>=50?'Buen progreso, sigue así':'Hay espacio para mejorar',
      color: avgTask>=80?'#10b981':avgTask>=50?'#f59e0b':'#ef4444' });
  }

  // Weight
  if (weightDiff !== null) {
    insights.push({ icon:'⚖️', text:`Cambio de peso: ${weightDiff>0?'+':''}${weightDiff} kg esta semana`,
      sub: weightDiff<-0.5?'Tendencia bajista':'Tendencia al alza',
      color: weightDiff<0?'#10b981':'#f59e0b' });
  }

  // Best day highlight
  if (bestKcalDay) {
    const bd = new Date(bestKcalDay.d+'T12:00:00');
    insights.push({ icon:'⭐', text:`Mejor día: ${DAYS_FULL[bd.getDay()]}`,
      sub:`${bestKcalDay.k} kcal — más cerca de tu meta`, color:'#6366f1' });
  }

  return { insights, avgKcal: avgKcalAll, daysGoal, daysWater, exDays, avgSleep, avgTask, weightDiff };
}

// ================================================================
// POPULATION BENCHMARKS  (LMS method — Cole & Green)
// ----------------------------------------------------------------
// Each distribution is described by 3 parameters per (metric, sex, age-band):
//   L = Box-Cox power (skew), M = median, S = coefficient of variation.
// From these, ANY percentile is analytic and O(1):
//   z = ((X/M)^L − 1) / (L·S)   (L≠0)   |   z = ln(X/M)/S   (L=0)
//   percentile = Φ(z)
// Values are representative adult references derived from NHANES (US) BMI and
// DXA body-fat data (Kelly 2009). Replace `data` with authoritative LMS tables
// — or load from the Supabase `benchmark_distributions` table — without
// touching the engine below. Age bands cover adults 18+.
// ================================================================
const BENCHMARK_LMS = {
  // Healthy reference bands (not the population mean — the *recommended* range).
  healthy: {
    bmi:          { all:    { min: 18.5, max: 24.9 } },              // WHO
    body_fat_pct: { male:   { min: 8,  max: 20 }, female: { min: 21, max: 33 } },
    // FMI = fat mass / h²  (fat half of BMI). Normal-BMI ranges (Schutz 2002).
    fmi:          { male:   { min: 2,  max: 5.5 }, female: { min: 4,  max: 8 } },
    // FFMI = fat-free mass / h²  (muscle half of BMI). Higher is better up to a
    // natural ceiling (~25 ♂ / ~22 ♀); band marks "good muscularity".
    ffmi:         { male:   { min: 18, max: 25 }, female: { min: 15, max: 21 } },
  },
  bands: [ [18,29], [30,39], [40,49], [50,59], [60,69], [70,200] ],
  data: {
    bmi: {
      male: [
        { L:-1.2, M:25.8, S:0.18 }, { L:-1.3, M:27.3, S:0.19 },
        { L:-1.3, M:28.2, S:0.19 }, { L:-1.3, M:28.7, S:0.19 },
        { L:-1.2, M:28.9, S:0.18 }, { L:-1.1, M:27.9, S:0.17 },
      ],
      female: [
        { L:-1.1, M:25.4, S:0.23 }, { L:-1.2, M:27.0, S:0.24 },
        { L:-1.2, M:28.1, S:0.24 }, { L:-1.2, M:29.0, S:0.24 },
        { L:-1.1, M:29.3, S:0.23 }, { L:-1.0, M:28.4, S:0.22 },
      ],
    },
    body_fat_pct: {
      male: [
        { L:1, M:20, S:0.30 }, { L:1, M:23, S:0.27 }, { L:1, M:25, S:0.25 },
        { L:1, M:26, S:0.24 }, { L:1, M:27, S:0.23 }, { L:1, M:27, S:0.23 },
      ],
      female: [
        { L:1, M:30, S:0.22 }, { L:1, M:32, S:0.21 }, { L:1, M:34, S:0.20 },
        { L:1, M:37, S:0.18 }, { L:1, M:38, S:0.18 }, { L:1, M:38, S:0.18 },
      ],
    },
    // Fat-Free Mass Index (muscle). Median ~19.3 ♂ / ~15.4 ♀, mild age decline.
    ffmi: {
      male: [
        { L:1, M:19.2, S:0.11 }, { L:1, M:19.5, S:0.11 }, { L:1, M:19.5, S:0.11 },
        { L:1, M:19.2, S:0.11 }, { L:1, M:18.8, S:0.11 }, { L:1, M:18.2, S:0.11 },
      ],
      female: [
        { L:1, M:15.2, S:0.12 }, { L:1, M:15.5, S:0.12 }, { L:1, M:15.6, S:0.12 },
        { L:1, M:15.5, S:0.12 }, { L:1, M:15.2, S:0.12 }, { L:1, M:14.8, S:0.12 },
      ],
    },
    // Fat Mass Index (fat half of BMI). Right-skewed like BMI.
    fmi: {
      male: [
        { L:-0.5, M:5.5, S:0.40 }, { L:-0.5, M:6.5, S:0.40 }, { L:-0.5, M:7.2, S:0.40 },
        { L:-0.5, M:7.6, S:0.40 }, { L:-0.5, M:7.8, S:0.40 }, { L:-0.5, M:7.4, S:0.40 },
      ],
      female: [
        { L:-0.4, M:8.5, S:0.38 }, { L:-0.4, M:9.5, S:0.38 }, { L:-0.4, M:10.5, S:0.38 },
        { L:-0.4, M:11.5, S:0.38 }, { L:-0.4, M:12.0, S:0.38 }, { L:-0.4, M:11.5, S:0.38 },
      ],
    },
  },
};

const Benchmark = {
  bmi(weightKg, heightCm) {
    const h = parseFloat(heightCm) / 100, w = parseFloat(weightKg);
    if (!h || !w) return null;
    return +(w / (h * h)).toFixed(1);
  },

  // Fat-Free Mass Index (muscle half of BMI) = lean mass / height².
  ffmi(weightKg, heightCm, bodyFatPct) {
    const h = parseFloat(heightCm) / 100, w = parseFloat(weightKg), bf = parseFloat(bodyFatPct);
    if (!h || !w || isNaN(bf)) return null;
    return +((w * (1 - bf / 100)) / (h * h)).toFixed(1);
  },

  // Fat Mass Index (fat half of BMI) = fat mass / height².
  fmi(weightKg, heightCm, bodyFatPct) {
    const h = parseFloat(heightCm) / 100, w = parseFloat(weightKg), bf = parseFloat(bodyFatPct);
    if (!h || !w || isNaN(bf)) return null;
    return +((w * (bf / 100)) / (h * h)).toFixed(1);
  },

  // Relative Fat Mass (Woolcock 2018) — body-fat % from height/waist alone.
  // R²=0.84 vs DXA (BMI only 0.36). height & waist in the same unit (cm).
  rfm(heightCm, waistCm, sex) {
    const h = parseFloat(heightCm), waist = parseFloat(waistCm);
    if (!h || !waist) return null;
    return +(64 - 20 * (h / waist) + 12 * (sex === 'female' ? 1 : 0)).toFixed(1);
  },

  _bandIndex(age) {
    const a = parseInt(age);
    if (!a) return 1; // default to 30-39 when age unknown
    const i = BENCHMARK_LMS.bands.findIndex(([lo, hi]) => a >= lo && a <= hi);
    return i < 0 ? BENCHMARK_LMS.bands.length - 1 : i;
  },

  _lookup(metric, sex, age) {
    const s = (sex === 'female') ? 'female' : 'male';
    const table = BENCHMARK_LMS.data[metric]?.[s];
    if (!table) return null;
    return table[this._bandIndex(age)] || null;
  },

  // Standard normal CDF — Abramowitz & Stegun 7.1.26 (|error| < 7.5e-8).
  _phi(z) {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989422804014327 * Math.exp(-z * z / 2);
    let p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 +
            t * (-1.821255978 + t * 1.330274429))));
    return z > 0 ? 1 - p : p;
  },

  // Inverse standard normal CDF (probit) — Acklam's rational approximation.
  _probit(p) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    const a=[-3.969683028665376e+01,2.209460984245205e+02,-2.759285104469687e+02,1.383577518672690e+02,-3.066479806614716e+01,2.506628277459239e+00];
    const b=[-5.447609879822406e+01,1.615858368580409e+02,-1.556989798598866e+02,6.680131188771972e+01,-1.328068155288572e+01];
    const c=[-7.784894002430293e-03,-3.223964580411365e-01,-2.400758277161838e+00,-2.549732539343734e+00,4.374664141464968e+00,2.938163982698783e+00];
    const d=[7.784695709041462e-03,3.224671290700398e-01,2.445134137142996e+00,3.754408661907416e+00];
    const pl=0.02425, ph=1-pl; let q, r;
    if (p < pl) { q=Math.sqrt(-2*Math.log(p)); return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
    if (p > ph) { q=Math.sqrt(-2*Math.log(1-p)); return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
    q=p-0.5; r=q*q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  },

  _zScore(metric, value, sex, age) {
    const p = this._lookup(metric, sex, age);
    if (!p || !value) return null;
    const { L, M, S } = p;
    return Math.abs(L) < 1e-6 ? Math.log(value / M) / S : (Math.pow(value / M, L) - 1) / (L * S);
  },

  // Percentile (0–100) of `value` within the population distribution.
  percentile(metric, value, sex, age) {
    const z = this._zScore(metric, value, sex, age);
    if (z == null || !isFinite(z)) return null;
    return Math.min(99, Math.max(1, Math.round(this._phi(z) * 100)));
  },

  // Inverse: the metric value at percentile `p` (1–99) for this cohort.
  valueAtPercentile(metric, p, sex, age) {
    const lms = this._lookup(metric, sex, age);
    if (!lms) return null;
    const { L, M, S } = lms;
    const z = this._probit(p / 100);
    const v = Math.abs(L) < 1e-6 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);
    return isFinite(v) ? +v.toFixed(1) : null;
  },

  healthyRange(metric, sex) {
    const h = BENCHMARK_LMS.healthy[metric];
    if (!h) return null;
    return h.all || (sex === 'female' ? h.female : h.male);
  },
};

// ================================================================
// STRENGTH STANDARDS  (classic-lift ranking, bronze→diamond)
// ----------------------------------------------------------------
// Tier thresholds are bodyweight multiples per (lift, sex), approximating
// widely-used strength standards (StrengthLevel / ExRx). Ratio = e1RM / BW.
// Like Epic 2 this is a "ghost" benchmark vs population norms, not a
// real-user leaderboard. Swap `mult` for authoritative tables freely.
// ================================================================
const LIFT_TIERS = [
  { id:'bronze',   label:'Bronce',   color:'#cd7f32', emoji:'🥉' },
  { id:'silver',   label:'Plata',    color:'#9ca3af', emoji:'🥈' },
  { id:'gold',     label:'Oro',      color:'#f5b301', emoji:'🥇' },
  { id:'platinum', label:'Platino',  color:'#22d3ee', emoji:'💎' },
  { id:'diamond',  label:'Diamante', color:'#818cf8', emoji:'🔷' },
];

const LIFT_STANDARDS = {
  lifts: [
    { id:'squat',    label:'Sentadilla',   emoji:'🦵' },
    { id:'bench',    label:'Press banca',  emoji:'🏋️' },
    { id:'deadlift', label:'Peso muerto',  emoji:'🪨' },
    { id:'ohp',      label:'Press militar',emoji:'💪' },
  ],
  // Bodyweight multiples per tier: [Bronce, Plata, Oro, Platino, Diamante]
  mult: {
    male: {
      squat:[0.75,1.25,1.50,2.00,2.50], bench:[0.50,0.75,1.00,1.50,2.00],
      deadlift:[1.00,1.50,2.00,2.50,3.00], ohp:[0.35,0.55,0.80,1.10,1.40],
    },
    female: {
      squat:[0.50,0.75,1.10,1.50,2.00], bench:[0.25,0.40,0.60,0.90,1.20],
      deadlift:[0.50,1.00,1.25,1.75,2.25], ohp:[0.20,0.35,0.50,0.75,1.00],
    },
  },
};

const Strength = {
  // Epley estimated 1RM from a working set.
  e1rm(kg, reps) {
    const w = parseFloat(kg), r = parseInt(reps) || 1;
    if (!w) return null;
    return r > 1 ? Math.round(w * (1 + r / 30)) : Math.round(w);
  },

  // Returns { idx, ratio, thresholds } where idx is -1 (below Bronce) … 4 (Diamante).
  rank(liftId, e1rm, bodyKg, sex) {
    const m = LIFT_STANDARDS.mult[sex === 'female' ? 'female' : 'male']?.[liftId];
    if (!m || !bodyKg || !e1rm) return null;
    const ratio = e1rm / bodyKg;
    let idx = -1;
    for (let i = 0; i < m.length; i++) if (ratio >= m[i]) idx = i;
    return { idx, ratio: +ratio.toFixed(2), thresholds: m };
  },

  tier(idx) { return idx >= 0 ? LIFT_TIERS[idx] : null; },

  // Composite tier index across logged lifts (rounded average), or null.
  overall(lifts, bodyKg, sex) {
    const idxs = LIFT_STANDARDS.lifts
      .map(l => this.rank(l.id, lifts[l.id]?.e1rm, bodyKg, sex)?.idx)
      .filter(v => v != null && v >= 0);
    if (!idxs.length) return null;
    return Math.round(idxs.reduce((a, b) => a + b, 0) / idxs.length);
  },

  // ── 3D athlete physique (continuous score + per-muscle-group mix) ──

  // Continuous 0..1 strength score for one lift: piecewise-linear interpolation
  // across the same 5-tier ladder the segmented UI meter shows (ratio 0 → 0,
  // each successive threshold → k/5, Diamante threshold → 1). Continuous and
  // strictly monotonic in ratio — unlike bucketing by tier index, there's no
  // discontinuity right at a threshold crossing.
  score01(liftId, e1rm, bodyKg, sex) {
    const m = LIFT_STANDARDS.mult[sex === 'female' ? 'female' : 'male']?.[liftId];
    if (!m || !bodyKg || !e1rm) return 0;
    const ratio = e1rm / bodyKg;
    if (ratio <= 0) return 0;
    const ratios = [0, ...m];               // 6 points: 0, Bronce..Diamante
    const fracs  = m.map((_, i) => (i + 1) / m.length);
    fracs.unshift(0);
    if (ratio >= ratios[ratios.length - 1]) return 1;
    let i = 0;
    while (i < ratios.length - 1 && ratio > ratios[i + 1]) i++;
    const span = ratios[i + 1] - ratios[i];
    const within = span > 0 ? (ratio - ratios[i]) / span : 0;
    return Math.max(0, Math.min(1, fracs[i] + within * (fracs[i + 1] - fracs[i])));
  },

  // Per-muscle-group scores (0..1 each) from a weighted mix of the 4 lifts.
  // Weights are an anatomically-defensible approximation, not exact EMG data:
  // squat/deadlift drive legs, deadlift/OHP drive back, bench is pure chest,
  // OHP/bench drive shoulders, bench/OHP drive arms. Missing lifts contribute
  // 0 to their weighted slots (an untrained lift pulls that group down,
  // which is the point — it's meant to expose imbalance).
  muscleScores(lifts, bodyKg, sex) {
    const s = id => this.score01(id, lifts[id]?.e1rm, bodyKg, sex);
    const squat = s('squat'), bench = s('bench'), deadlift = s('deadlift'), ohp = s('ohp');
    return {
      legs:      +(squat * 0.75 + deadlift * 0.25).toFixed(3),
      back:      +(deadlift * 0.85 + ohp * 0.15).toFixed(3),
      chest:     +(bench * 1.0).toFixed(3),
      shoulders: +(ohp * 0.70 + bench * 0.30).toFixed(3),
      arms:      +(bench * 0.5 + ohp * 0.5).toFixed(3),
    };
  },

  // Standard IWF plate set (kg) with color, heaviest first — used both for
  // the greedy per-side breakdown and for coloring the 3D discs.
  PLATES: [
    { kg: 25,   color: '#e0342a' }, { kg: 20,   color: '#2a6fe0' },
    { kg: 15,   color: '#f0c419' }, { kg: 10,   color: '#3aa15c' },
    { kg: 5,    color: '#f4f4f4' }, { kg: 2.5,  color: '#2b2b2b' },
    { kg: 1.25, color: '#c9c9c9' },
  ],

  // Real barbell load: standard 20kg bar (15kg women's/training bar), greedy
  // per-side plate breakdown from the IWF set. `achievable` is false when the
  // requested total can't be hit exactly with this plate set (rounds down to
  // the nearest loadable weight rather than over-representing the lift).
  plateLoad(totalKg, sex) {
    const barKg = sex === 'female' ? 15 : 20;
    const perSideTarget = Math.max(0, (totalKg - barKg) / 2);
    const perSide = [];
    let remaining = perSideTarget;
    const eps = 1e-6;
    for (const p of this.PLATES) {
      while (remaining + eps >= p.kg) { perSide.push(p.kg); remaining -= p.kg; }
    }
    const loadedPerSide = perSide.reduce((a, b) => a + b, 0);
    const achievable = Math.abs(loadedPerSide - perSideTarget) < 0.01;
    return { barKg, perSide, totalKg: +(barKg + loadedPerSide * 2).toFixed(2), achievable };
  },

  // ── Progression / PRs / volume (operate on DB.liftLog()) ────────
  // Sorted history for one lift, each entry flagged isPR (new all-time e1rm).
  progress(history) {
    const rows = [...(history || [])].sort((a, b) => a.date.localeCompare(b.date));
    let best = 0;
    return rows.map(r => {
      const isPR = (r.e1rm || 0) > best;
      if (isPR) best = r.e1rm;
      return { ...r, isPR };
    });
  },

  // Best e1rm per lift: { liftId: { e1rm, kg, reps, date } }.
  prs(log) {
    const out = {};
    Object.entries(log || {}).forEach(([id, hist]) => {
      let best = null;
      (hist || []).forEach(e => { if (!best || (e.e1rm || 0) > best.e1rm) best = e; });
      if (best) out[id] = { e1rm: best.e1rm, kg: best.kg, reps: best.reps, date: best.date };
    });
    return out;
  },

  // Weekly training volume over the last `days`: sessions, sets, total reps,
  // tonnage (Σ kg×reps), and distinct training days.
  volume(log, days = 7) {
    const cut = new Date(); cut.setDate(cut.getDate() - days + 1);
    const cutStr = fmtDate(cut);
    let sets = 0, reps = 0, tonnage = 0;
    const trainDays = new Set();
    Object.values(log || {}).forEach(hist => (hist || []).forEach(e => {
      if (e.date >= cutStr) {
        sets++; reps += (e.reps || 0); tonnage += (e.kg || 0) * (e.reps || 0);
        trainDays.add(e.date);
      }
    }));
    return { sets, reps, tonnage: Math.round(tonnage), days: trainDays.size };
  },
};

