/**
 * LifeTrack MCP Server
 *
 * Runs two services simultaneously:
 *   1. MCP over stdio  → Claude Desktop / Claude Code integration
 *   2. REST API on :3746 → Android PWA data sync over local WiFi
 *
 * Start: node server.js
 * All logs go to stderr so stdout stays clean for MCP protocol.
 */

import express      from 'express';
import cors         from 'cors';
import { McpServer }          from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as Data from './data.js';

const PORT = 3746;

// ================================================================
// MCP SERVER — tools Claude can call
// ================================================================
const mcp = new McpServer({ name: 'lifetrack', version: '1.0.0' });

// ── get_daily_summary ─────────────────────────────────────────
mcp.tool(
  'get_daily_summary',
  'Get today\'s (or any date\'s) health summary: calories, macros, water, weight, tasks completed.',
  { date: z.string().optional().describe('YYYY-MM-DD (default: today)') },
  async ({ date }) => {
    const d    = date || Data.today();
    const data = Data.getData();
    const food = data.foodLog[d] || [];
    const kcal = food.reduce((a, f) => a + f.kcal, 0);
    const prot = +food.reduce((a, f) => a + (f.prot  || 0), 0).toFixed(1);
    const carbs= +food.reduce((a, f) => a + (f.carbs || 0), 0).toFixed(1);
    const fat  = +food.reduce((a, f) => a + (f.fat   || 0), 0).toFixed(1);
    const water = data.waterLog[d] || 0;
    const done  = data.completions[d] || {};
    const doneCount = data.tasks.filter(t => done[t.id]).length;
    const lastWeight = data.weightLog.slice(-1)[0] || null;

    return { content: [{ type: 'text', text: JSON.stringify({
      date: d,
      calories:  { consumed: kcal, goal: data.settings.calorieGoal, remaining: data.settings.calorieGoal - kcal },
      macros:    { protein: prot, carbs, fat },
      water:     { consumed_ml: water, goal_ml: data.settings.waterGoal || 2500 },
      tasks:     { completed: doneCount, total: data.tasks.length },
      weight_kg: lastWeight?.kg ?? null,
      meals:     food.map(f => ({ name: f.name, kcal: f.kcal, qty_g: f.qty }))
    }, null, 2) }] };
  }
);

// ── log_meal ──────────────────────────────────────────────────
mcp.tool(
  'log_meal',
  'Add a food item or meal to the daily log. Use this when the user mentions eating something.',
  {
    name:     z.string().describe('Food or meal name'),
    calories: z.number().positive().describe('Total kcal for this portion'),
    grams:    z.number().positive().optional().describe('Portion size in grams'),
    protein:  z.number().min(0).optional(),
    carbs:    z.number().min(0).optional(),
    fat:      z.number().min(0).optional(),
    date:     z.string().optional().describe('YYYY-MM-DD, default today')
  },
  async ({ name, calories, grams, protein, carbs, fat, date }) => {
    const d    = date || Data.today();
    const data = Data.getData();
    if (!data.foodLog[d]) data.foodLog[d] = [];
    const entry = {
      id: `f_${Date.now()}`, name,
      qty: grams || 100, kcal: Math.round(calories),
      prot: protein || 0, carbs: carbs || 0, fat: fat || 0,
      source: 'mcp', ts: new Date().toISOString()
    };
    data.foodLog[d].push(entry);
    Data.saveData(data);
    const total = data.foodLog[d].reduce((a, f) => a + f.kcal, 0);
    return { content: [{ type: 'text', text:
      `✅ "${name}" registrado: ${Math.round(calories)} kcal\n` +
      `Total hoy: ${total} / ${data.settings.calorieGoal} kcal`
    }] };
  }
);

// ── update_goals ──────────────────────────────────────────────
mcp.tool(
  'update_goals',
  'Update health goals: calorie target, water goal, weight goal, or user name.',
  {
    calorie_goal:    z.number().positive().optional().describe('Daily kcal target'),
    water_goal_ml:   z.number().positive().optional().describe('Daily water in ml'),
    weight_goal_kg:  z.number().positive().optional().describe('Target body weight kg'),
    name:            z.string().optional()
  },
  async ({ calorie_goal, water_goal_ml, weight_goal_kg, name }) => {
    const data = Data.getData();
    if (calorie_goal)   data.settings.calorieGoal  = calorie_goal;
    if (water_goal_ml)  data.settings.waterGoal     = water_goal_ml;
    if (weight_goal_kg) data.settings.weightGoal    = weight_goal_kg;
    if (name)           data.settings.name           = name;
    Data.saveData(data);
    const lines = [
      calorie_goal   ? `• Calorías: ${calorie_goal} kcal/día` : null,
      water_goal_ml  ? `• Agua: ${water_goal_ml} ml/día`       : null,
      weight_goal_kg ? `• Peso meta: ${weight_goal_kg} kg`     : null,
      name           ? `• Nombre: ${name}`                     : null,
    ].filter(Boolean).join('\n');
    return { content: [{ type: 'text', text: `✅ Metas actualizadas:\n${lines}` }] };
  }
);

// ── log_weight ────────────────────────────────────────────────
mcp.tool(
  'log_weight',
  'Record a body weight measurement.',
  {
    kg:   z.number().positive().describe('Weight in kilograms'),
    date: z.string().optional().describe('YYYY-MM-DD, default today'),
    note: z.string().optional()
  },
  async ({ kg, date, note }) => {
    const d    = date || Data.today();
    const data = Data.getData();
    data.weightLog = data.weightLog.filter(w => w.date !== d);
    data.weightLog.push({ date: d, kg, note: note || null });
    data.weightLog.sort((a, b) => a.date.localeCompare(b.date));
    Data.saveData(data);
    const goal = data.settings.weightGoal;
    const diff = goal ? ` (${(kg - goal > 0 ? '+' : '') + (kg - goal).toFixed(1)} kg de la meta)` : '';
    return { content: [{ type: 'text', text: `✅ Peso registrado: ${kg} kg${diff}` }] };
  }
);

// ── log_water ─────────────────────────────────────────────────
mcp.tool(
  'log_water',
  'Add water intake for today.',
  {
    amount_ml: z.number().positive().describe('ml of water consumed'),
    date:      z.string().optional().describe('YYYY-MM-DD, default today')
  },
  async ({ amount_ml, date }) => {
    const d    = date || Data.today();
    const data = Data.getData();
    if (!data.waterLog[d]) data.waterLog[d] = 0;
    data.waterLog[d] += amount_ml;
    Data.saveData(data);
    const total = data.waterLog[d];
    const goal  = data.settings.waterGoal || 2500;
    return { content: [{ type: 'text', text:
      `💧 +${amount_ml}ml → Total: ${total}ml / ${goal}ml (${Math.round(total/goal*100)}%)`
    }] };
  }
);

// ── predict_weight ────────────────────────────────────────────
mcp.tool(
  'predict_weight',
  'Predict future weight based on recent calorie intake and TDEE. Requires weight log and at least 3 days of food data.',
  { weeks: z.number().int().positive().max(52).default(12) },
  async ({ weeks }) => {
    const data = Data.getData();
    const days14 = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (13 - i));
      return d.toISOString().split('T')[0];
    });
    const daysWithData = days14.filter(d => (data.foodLog[d] || []).length > 0);
    if (daysWithData.length < 3)
      return { content: [{ type: 'text', text: 'Necesitas al menos 3 días de registro de comidas para predecir.' }] };

    const avgKcal = daysWithData.reduce(
      (a, d) => a + (data.foodLog[d] || []).reduce((s, f) => s + f.kcal, 0), 0
    ) / daysWithData.length;

    const currentWeight = data.weightLog.slice(-1)[0]?.kg;
    if (!currentWeight)
      return { content: [{ type: 'text', text: 'Registra tu peso actual primero.' }] };

    const tdee = Data.calcTDEE(data.settings, currentWeight);
    const dailyDeficit = tdee - avgKcal;
    const kgPerWeek   = (dailyDeficit * 7) / 7700;

    const predictions = Array.from({ length: Math.min(weeks, 12) }, (_, i) => ({
      week: i + 1,
      predicted_kg: +(currentWeight - kgPerWeek * (i + 1)).toFixed(1)
    }));

    const goalKg = data.settings.weightGoal;
    let weeksToGoal = null;
    if (goalKg && kgPerWeek > 0) {
      weeksToGoal = Math.ceil((currentWeight - goalKg) / kgPerWeek);
    }

    return { content: [{ type: 'text', text: JSON.stringify({
      current_weight_kg:    currentWeight,
      avg_daily_intake_kcal: Math.round(avgKcal),
      estimated_tdee_kcal:   tdee,
      daily_deficit_kcal:    Math.round(dailyDeficit),
      kg_per_week:           +kgPerWeek.toFixed(2),
      weight_goal_kg:        goalKg || null,
      weeks_to_goal:         weeksToGoal,
      predictions
    }, null, 2) }] };
  }
);

// ── get_micronutrient_status ──────────────────────────────────
mcp.tool(
  'get_micronutrient_status',
  'Show vitamin and mineral intake vs RDA for the past N days.',
  { days: z.number().int().positive().max(30).default(7) },
  async ({ days }) => {
    const data = Data.getData();
    const range = Array.from({ length: days }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (days - 1 - i));
      return d.toISOString().split('T')[0];
    });

    const KEYS = ['vitA','vitC','vitD','vitE','vitK','vitB6','vitB12','folate',
                  'iron','calcium','magnesium','zinc','potassium','sodium','fiber'];
    const RDAS = {
      vitA:900*days,vitC:90*days,vitD:20*days,vitE:15*days,vitK:120*days,
      vitB6:1.7*days,vitB12:2.4*days,folate:400*days,
      iron:8*days,calcium:1000*days,magnesium:420*days,zinc:11*days,
      potassium:3400*days,sodium:2300*days,fiber:38*days
    };
    const LABELS = {
      vitA:'Vitamina A',vitC:'Vitamina C',vitD:'Vitamina D',vitE:'Vitamina E',vitK:'Vitamina K',
      vitB6:'B6',vitB12:'B12',folate:'Folato',
      iron:'Hierro',calcium:'Calcio',magnesium:'Magnesio',zinc:'Zinc',
      potassium:'Potasio',sodium:'Sodio',fiber:'Fibra'
    };

    const totals = Object.fromEntries(KEYS.map(k => [k, 0]));
    const hasData = Object.fromEntries(KEYS.map(k => [k, false]));
    let foodCount = 0;

    range.forEach(d => {
      (data.foodLog[d] || []).forEach(f => {
        foodCount++;
        KEYS.forEach(k => {
          if (f[k] != null) { totals[k] += f[k]; hasData[k] = true; }
        });
      });
    });

    const status = KEYS.map(k => {
      const pct = hasData[k] ? Math.round((totals[k] / RDAS[k]) * 100) : null;
      return {
        key: k,
        label: LABELS[k],
        total: +totals[k].toFixed(1),
        rda: RDAS[k],
        pct,
        status: pct === null ? 'no_data'
              : pct >= 80   ? 'adequate'
              : pct >= 40   ? 'low'
              : 'deficient'
      };
    });

    const deficiencies = status.filter(s => s.status === 'deficient').map(s => s.label);
    return { content: [{ type: 'text', text: JSON.stringify({
      period_days: days, foods_analyzed: foodCount, deficiencies, status
    }, null, 2) }] };
  }
);

// ── add_recipe ────────────────────────────────────────────────
mcp.tool(
  'add_recipe',
  'Create a recipe with ingredients. Nutrition is calculated automatically.',
  {
    name:        z.string(),
    servings:    z.number().int().positive(),
    description: z.string().optional(),
    ingredients: z.array(z.object({
      name:            z.string(),
      qty_g:           z.number().positive(),
      kcal_per_100g:   z.number().min(0),
      protein_per_100g: z.number().min(0).optional(),
      carbs_per_100g:  z.number().min(0).optional(),
      fat_per_100g:    z.number().min(0).optional()
    }))
  },
  async ({ name, servings, description, ingredients }) => {
    const data = Data.getData();
    const ings = ingredients.map(i => {
      const f = i.qty_g / 100;
      return {
        name:  i.name, qty: i.qty_g,
        kcal:  Math.round(i.kcal_per_100g  * f),
        prot:  +((i.protein_per_100g || 0) * f).toFixed(1),
        carbs: +((i.carbs_per_100g  || 0) * f).toFixed(1),
        fat:   +((i.fat_per_100g    || 0) * f).toFixed(1)
      };
    });
    const totals = { kcal: ings.reduce((a,i)=>a+i.kcal,0), prot: ings.reduce((a,i)=>a+i.prot,0),
                     carbs: ings.reduce((a,i)=>a+i.carbs,0), fat: ings.reduce((a,i)=>a+i.fat,0) };
    const recipe = {
      id: `r_${Date.now()}`, name, description: description || '', servings,
      ingredients: ings,
      totalKcal: totals.kcal, totalProt: +totals.prot.toFixed(1),
      totalCarbs: +totals.carbs.toFixed(1), totalFat: +totals.fat.toFixed(1),
      perKcal: Math.round(totals.kcal/servings), perProt: +(totals.prot/servings).toFixed(1),
      perCarbs: +(totals.carbs/servings).toFixed(1), perFat: +(totals.fat/servings).toFixed(1),
      createdAt: new Date().toISOString()
    };
    data.recipes.push(recipe);
    Data.saveData(data);
    return { content: [{ type: 'text', text:
      `✅ Receta "${name}" creada!\n${servings} porciones × ${recipe.perKcal} kcal c/u`
    }] };
  }
);

// ── get_weekly_report ─────────────────────────────────────────
mcp.tool(
  'get_weekly_report',
  'Get a 7-day summary with averages for calories, water, weight, and task completion.',
  {},
  async () => {
    const data = Data.getData();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });
    const report = days.map(d => {
      const food  = data.foodLog[d] || [];
      const kcal  = food.reduce((a, f) => a + f.kcal, 0);
      const water = data.waterLog[d] || 0;
      const done  = data.completions[d] || {};
      const doneN = data.tasks.filter(t => done[t.id]).length;
      const wt    = data.weightLog.find(w => w.date === d);
      return { date: d, kcal, water_ml: water, tasks_completed: doneN, weight_kg: wt?.kg ?? null };
    });
    const avg = (key) => Math.round(report.reduce((a, r) => a + r[key], 0) / 7);
    return { content: [{ type: 'text', text: JSON.stringify({
      days: report,
      averages: { kcal: avg('kcal'), water_ml: avg('water_ml'), tasks: avg('tasks_completed') }
    }, null, 2) }] };
  }
);

// ================================================================
// REST API (HTTP on :3746 — for PWA sync over local WiFi)
// ================================================================
const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

app.get('/api/status', (_req, res) => res.json({ ok: true, version: '1.0.0' }));

app.get('/api/data', (_req, res) => res.json(Data.getData()));

app.post('/api/sync', (req, res) => {
  const merged = Data.mergeSync(Data.getData(), req.body);
  Data.saveData(merged);
  res.json({ ok: true, data: merged });
});

app.post('/api/meal', (req, res) => {
  const { name, kcal, prot=0, carbs=0, fat=0, qty=100, date } = req.body;
  const d = date || Data.today();
  const data = Data.getData();
  if (!data.foodLog[d]) data.foodLog[d] = [];
  data.foodLog[d].push({ id:`f_${Date.now()}`, name, qty, kcal, prot, carbs, fat });
  Data.saveData(data);
  res.json({ ok: true });
});

app.post('/api/water', (req, res) => {
  const { ml, date } = req.body;
  const d = date || Data.today();
  const data = Data.getData();
  if (!data.waterLog[d]) data.waterLog[d] = 0;
  data.waterLog[d] += ml;
  Data.saveData(data);
  res.json({ ok: true, total_ml: data.waterLog[d] });
});

app.post('/api/weight', (req, res) => {
  const { kg, note, date } = req.body;
  const d = date || Data.today();
  const data = Data.getData();
  data.weightLog = data.weightLog.filter(w => w.date !== d);
  data.weightLog.push({ date: d, kg, note: note || null });
  data.weightLog.sort((a, b) => a.date.localeCompare(b.date));
  Data.saveData(data);
  res.json({ ok: true });
});

app.put('/api/settings', (req, res) => {
  const data = Data.getData();
  data.settings = { ...data.settings, ...req.body };
  Data.saveData(data);
  res.json({ ok: true, settings: data.settings });
});

app.listen(PORT, '0.0.0.0', () => {
  console.error(`\n🚀 LifeTrack REST API  →  http://localhost:${PORT}/api/status`);
  console.error(`📱 Android WiFi sync  →  http://<TU-IP-LOCAL>:${PORT}/api/sync`);
  console.error(`🤖 MCP stdio activo   →  conectado a Claude Desktop / Code\n`);
});

// ================================================================
// MCP STDIO (Claude Desktop / Claude Code)
// ================================================================
const transport = new StdioServerTransport();
await mcp.connect(transport);
