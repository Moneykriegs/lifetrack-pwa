// ============================================================
// SHARED CORE — constants.js
// MICROS, RECIPE_DB, PREP_FOODS, INGREDIENTS, date helpers
// Extracted verbatim from app.js. Loaded as a plain <script> by both the
// PWA (index.html) and the Electron desktop renderer. No exports/build.
// ============================================================

'use strict';

// ================================================================
// CONSTANTS
// ================================================================
const DAYS_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const DAYS_FULL  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const MONTHS     = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

const MICROS = {
  vitA:  { label:'Vit A',     unit:'μg', rda:900,  apiKey:'vitamin-a_100g',      limit:false },
  vitC:  { label:'Vit C',     unit:'mg', rda:90,   apiKey:'vitamin-c_100g',      limit:false },
  vitD:  { label:'Vit D',     unit:'μg', rda:20,   apiKey:'vitamin-d_100g',      limit:false },
  vitE:  { label:'Vit E',     unit:'mg', rda:15,   apiKey:'vitamin-e_100g',      limit:false },
  vitK:  { label:'Vit K',     unit:'μg', rda:120,  apiKey:'vitamin-k_100g',      limit:false },
  vitB6: { label:'B6',        unit:'mg', rda:1.7,  apiKey:'vitamin-b6_100g',     limit:false },
  vitB12:{ label:'B12',       unit:'μg', rda:2.4,  apiKey:'vitamin-b12_100g',    limit:false },
  folate:{ label:'Folato',    unit:'μg', rda:400,  apiKey:'folate_100g',         limit:false },
  iron:  { label:'Hierro',    unit:'mg', rda:8,    apiKey:'iron_100g',           limit:false },
  calcium:{ label:'Calcio',   unit:'mg', rda:1000, apiKey:'calcium_100g',        limit:false },
  magnesium:{ label:'Magnesio',unit:'mg',rda:420,  apiKey:'magnesium_100g',      limit:false },
  zinc:  { label:'Zinc',      unit:'mg', rda:11,   apiKey:'zinc_100g',           limit:false },
  potassium:{ label:'Potasio',unit:'mg', rda:3400, apiKey:'potassium_100g',      limit:false },
  sodium:{ label:'Sodio',     unit:'mg', rda:2300, apiKey:'sodium_100g',         limit:true  },
  fiber: { label:'Fibra',     unit:'g',  rda:38,   apiKey:'fiber_100g',          limit:false },
};
const MICRO_KEYS = Object.keys(MICROS);

const MOODS = [
  { score:5, emoji:'😄', label:'Genial',  color:'#d1fae5', dotClass:'w-dot-5' },
  { score:4, emoji:'😊', label:'Bien',    color:'#dcfce7', dotClass:'w-dot-4' },
  { score:3, emoji:'😐', label:'Regular', color:'#fef9c3', dotClass:'w-dot-3' },
  { score:2, emoji:'😞', label:'Bajo',    color:'#ffedd5', dotClass:'w-dot-2' },
  { score:1, emoji:'😩', label:'Agotado', color:'#fee2e2', dotClass:'w-dot-1' },
];

const MEAL_SLOTS = [
  { id:'breakfast', label:'Desayuno',  icon:'🌅' },
  { id:'lunch',     label:'Almuerzo',  icon:'☀️'  },
  { id:'snack',     label:'Merienda',  icon:'🍎'  },
  { id:'dinner',    label:'Cena',      icon:'🌙'  },
];

// Proporción del objetivo diario asignada a cada slot
// (breakfast 25% + lunch 33% + snack 12% + dinner 30% = 100%)
const SLOT_FRACTIONS = {
  breakfast: 0.25,
  lunch:     0.33,
  snack:     0.12,
  dinner:    0.30,
};

const CUTTING_STYLES = [
  { id:'aggressive_cut', label:'Corte agresivo',  desc:'-25% TDEE',  factor:-0.25, emoji:'🔥' },
  { id:'moderate_cut',   label:'Corte moderado',  desc:'-15% TDEE',  factor:-0.15, emoji:'✂️'  },
  { id:'maintenance',    label:'Mantenimiento',   desc:'= TDEE',     factor:0,     emoji:'⚖️'  },
  { id:'lean_bulk',      label:'Volumen limpio',  desc:'+10% TDEE',  factor:0.10,  emoji:'💪'  },
  { id:'bulk',           label:'Volumen',         desc:'+20% TDEE',  factor:0.20,  emoji:'📈'  },
  { id:'custom',         label:'Meta manual',     desc:'personalizada', factor:null, emoji:'⚙️' },
];

// Prep foods por categoría (macros por porción estándar)
const PREP_FOODS = [
  // Proteínas
  { id:'pf_chicken', cat:'🍗 Proteínas', name:'Pechuga de pollo',    kcal:248, prot:46, carbs:0,  fat:5.4, qty:150 },
  { id:'pf_tuna',    cat:'🍗 Proteínas', name:'Atún en lata',        kcal:116, prot:26, carbs:0,  fat:1,   qty:100 },
  { id:'pf_eggs2',   cat:'🍗 Proteínas', name:'Huevos (2 piezas)',   kcal:180, prot:12, carbs:2,  fat:14,  qty:120 },
  { id:'pf_beef',    cat:'🍗 Proteínas', name:'Carne molida magra',  kcal:265, prot:30, carbs:0,  fat:15,  qty:150 },
  { id:'pf_salmon',  cat:'🍗 Proteínas', name:'Salmón al horno',     kcal:312, prot:30, carbs:0,  fat:20,  qty:150 },
  { id:'pf_turkey',  cat:'🍗 Proteínas', name:'Pechuga de pavo',     kcal:203, prot:45, carbs:3,  fat:1,   qty:150 },
  { id:'pf_tofu',    cat:'🍗 Proteínas', name:'Tofu salteado',       kcal:144, prot:15, carbs:4,  fat:8,   qty:100 },
  { id:'pf_whey',    cat:'🍗 Proteínas', name:'Shake de proteína',   kcal:130, prot:25, carbs:3,  fat:2,   qty:300 },
  // Carbohidratos
  { id:'pf_rice',    cat:'🍚 Carbos',    name:'Arroz blanco cocido', kcal:195, prot:4,  carbs:42, fat:0.4, qty:150 },
  { id:'pf_swetp',   cat:'🍚 Carbos',    name:'Camote / batata',     kcal:155, prot:3.5,carbs:36, fat:0.2, qty:180 },
  { id:'pf_oats',    cat:'🍚 Carbos',    name:'Avena con leche',     kcal:220, prot:8,  carbs:35, fat:5,   qty:300 },
  { id:'pf_pasta',   cat:'🍚 Carbos',    name:'Pasta integral',      kcal:237, prot:9,  carbs:45, fat:2,   qty:150 },
  { id:'pf_quinoa',  cat:'🍚 Carbos',    name:'Quinoa cocida',       kcal:180, prot:6.6,carbs:32, fat:2.9, qty:150 },
  { id:'pf_banana',  cat:'🍚 Carbos',    name:'Plátano mediano',     kcal:105, prot:1.3,carbs:27, fat:0.4, qty:120 },
  { id:'pf_bread',   cat:'🍚 Carbos',    name:'Pan integral (2)',    kcal:160, prot:6,  carbs:30, fat:2,   qty:80  },
  // Verduras
  { id:'pf_broc',    cat:'🥦 Verduras',  name:'Brócoli al vapor',   kcal:55,  prot:3.7,carbs:11, fat:0.6, qty:150 },
  { id:'pf_spin',    cat:'🥦 Verduras',  name:'Espinaca salteada',  kcal:41,  prot:5.3,carbs:6.8,fat:0.5, qty:150 },
  { id:'pf_carrot',  cat:'🥦 Verduras',  name:'Zanahoria cocida',   kcal:52,  prot:1.2,carbs:12, fat:0.3, qty:130 },
  { id:'pf_salad',   cat:'🥦 Verduras',  name:'Ensalada mixta',     kcal:35,  prot:2,  carbs:7,  fat:0.5, qty:150 },
  { id:'pf_pepper',  cat:'🥦 Verduras',  name:'Pimiento salteado',  kcal:46,  prot:1.4,carbs:9.3,fat:0.5, qty:150 },
  // Otros
  { id:'pf_avo',     cat:'🥑 Otros',     name:'Aguacate (½)',        kcal:120, prot:1.5,carbs:6,  fat:11,  qty:75  },
  { id:'pf_yogurt',  cat:'🥑 Otros',     name:'Yogur griego',        kcal:97,  prot:9,  carbs:3.6,fat:5,   qty:100 },
  { id:'pf_almonds', cat:'🥑 Otros',     name:'Almendras (30 g)',    kcal:173, prot:6,  carbs:6,  fat:15,  qty:30  },
  { id:'pf_cottage', cat:'🥑 Otros',     name:'Requesón / cottage',  kcal:98,  prot:11, carbs:3.4,fat:4.3, qty:100 },
];

// ================================================================
// INGREDIENT PREFERENCES — base para recomendaciones IA
// ================================================================
const INGREDIENTS = [
  // Proteínas
  { id:'chicken',      label:'Pollo',              emoji:'🍗', cat:'Proteínas' },
  { id:'beef',         label:'Carne de res',        emoji:'🥩', cat:'Proteínas' },
  { id:'pork',         label:'Cerdo',               emoji:'🥓', cat:'Proteínas' },
  { id:'salmon',       label:'Salmón',              emoji:'🐟', cat:'Proteínas' },
  { id:'tuna',         label:'Atún',                emoji:'🐠', cat:'Proteínas' },
  { id:'shrimp',       label:'Camarón',             emoji:'🦐', cat:'Proteínas' },
  { id:'turkey',       label:'Pavo',                emoji:'🦃', cat:'Proteínas' },
  { id:'eggs',         label:'Huevos',              emoji:'🥚', cat:'Proteínas' },
  { id:'tofu',         label:'Tofu',                emoji:'🟨', cat:'Proteínas' },
  // Verduras
  { id:'broccoli',     label:'Brócoli',             emoji:'🥦', cat:'Verduras'  },
  { id:'spinach',      label:'Espinaca',            emoji:'🌿', cat:'Verduras'  },
  { id:'tomato',       label:'Tomate',              emoji:'🍅', cat:'Verduras'  },
  { id:'onion',        label:'Cebolla',             emoji:'🧅', cat:'Verduras'  },
  { id:'garlic',       label:'Ajo',                 emoji:'🧄', cat:'Verduras'  },
  { id:'peppers',      label:'Pimientos',           emoji:'🫑', cat:'Verduras'  },
  { id:'zucchini',     label:'Calabacita',          emoji:'🥒', cat:'Verduras'  },
  { id:'mushrooms',    label:'Champiñones',         emoji:'🍄', cat:'Verduras'  },
  { id:'carrot',       label:'Zanahoria',           emoji:'🥕', cat:'Verduras'  },
  { id:'lettuce',      label:'Lechuga',             emoji:'🥬', cat:'Verduras'  },
  { id:'cucumber',     label:'Pepino',              emoji:'🥒', cat:'Verduras'  },
  // Carbohidratos
  { id:'rice',         label:'Arroz',               emoji:'🍚', cat:'Carbohidratos' },
  { id:'pasta',        label:'Pasta',               emoji:'🍝', cat:'Carbohidratos' },
  { id:'bread',        label:'Pan integral',        emoji:'🍞', cat:'Carbohidratos' },
  { id:'oats',         label:'Avena',               emoji:'🌾', cat:'Carbohidratos' },
  { id:'potato',       label:'Papa',                emoji:'🥔', cat:'Carbohidratos' },
  { id:'sweet_potato', label:'Camote / batata',     emoji:'🍠', cat:'Carbohidratos' },
  { id:'quinoa',       label:'Quinoa',              emoji:'🌱', cat:'Carbohidratos' },
  { id:'tortilla',     label:'Tortilla',            emoji:'🫓', cat:'Carbohidratos' },
  { id:'banana',       label:'Plátano',             emoji:'🍌', cat:'Carbohidratos' },
  // Grasas
  { id:'avocado',      label:'Aguacate',            emoji:'🥑', cat:'Grasas'    },
  { id:'olive_oil',    label:'Aceite de oliva',     emoji:'🫒', cat:'Grasas'    },
  { id:'almonds',      label:'Almendras',           emoji:'🌰', cat:'Grasas'    },
  { id:'nuts',         label:'Nueces',              emoji:'🌰', cat:'Grasas'    },
  // Lácteos
  { id:'milk',         label:'Leche',               emoji:'🥛', cat:'Lácteos'   },
  { id:'yogurt',       label:'Yogur griego',        emoji:'🥛', cat:'Lácteos'   },
  { id:'cheese',       label:'Queso',               emoji:'🧀', cat:'Lácteos'   },
  { id:'cottage',      label:'Cottage / requesón',  emoji:'🧀', cat:'Lácteos'   },
  // Legumbres
  { id:'beans',        label:'Frijoles',            emoji:'🫘', cat:'Legumbres' },
  { id:'lentils',      label:'Lentejas',            emoji:'🫘', cat:'Legumbres' },
  { id:'chickpeas',    label:'Garbanzos',           emoji:'🫘', cat:'Legumbres' },
];

// ================================================================
// RECIPE DATABASE — recetas inteligentes etiquetadas por ingrediente
// ================================================================
const RECIPE_DB = [
  // ── DESAYUNOS ──────────────────────────────────────────────
  { id:'rdb_omelet',        name:'Omelette de espinaca y queso',          emoji:'🍳', mealType:'breakfast', prepTime:10, servingDesc:'1 omelette',
    ingredients:['eggs','spinach','cheese','onion'],                       kcal:280, prot:22, carbs:4,  fat:19 },
  { id:'rdb_oats_banana',   name:'Avena con plátano y almendras',          emoji:'🌾', mealType:'breakfast', prepTime:5,  servingDesc:'1 tazón',
    ingredients:['oats','banana','almonds','milk'],                        kcal:380, prot:14, carbs:58, fat:12 },
  { id:'rdb_eggs_tomato',   name:'Huevos revueltos con tomate y cebolla', emoji:'🥚', mealType:'breakfast', prepTime:8,  servingDesc:'2 huevos + acompañamiento',
    ingredients:['eggs','tomato','onion','olive_oil'],                     kcal:230, prot:16, carbs:8,  fat:15 },
  { id:'rdb_avo_toast',     name:'Tostada de aguacate con huevo',          emoji:'🥑', mealType:'breakfast', prepTime:7,  servingDesc:'2 tostadas',
    ingredients:['bread','avocado','eggs'],                                kcal:350, prot:14, carbs:32, fat:20 },
  { id:'rdb_yogurt_banana', name:'Yogur griego con plátano y nueces',      emoji:'🥛', mealType:'breakfast', prepTime:2,  servingDesc:'1 bowl',
    ingredients:['yogurt','banana','nuts'],                                kcal:290, prot:16, carbs:35, fat:10 },
  { id:'rdb_burrito_egg',   name:'Burrito de huevo y pavo',                emoji:'🌯', mealType:'breakfast', prepTime:10, servingDesc:'1 burrito',
    ingredients:['tortilla','eggs','turkey','spinach','cheese'],           kcal:420, prot:32, carbs:38, fat:14 },
  { id:'rdb_cottage_fruit', name:'Cottage con plátano y almendras',        emoji:'🧀', mealType:'breakfast', prepTime:2,  servingDesc:'1 bowl',
    ingredients:['cottage','banana','almonds'],                            kcal:260, prot:20, carbs:28, fat:8  },
  { id:'rdb_oats_eggs',     name:'Avena proteica con huevo y canela',      emoji:'🌾', mealType:'breakfast', prepTime:8,  servingDesc:'1 tazón',
    ingredients:['oats','eggs','milk','banana'],                           kcal:330, prot:22, carbs:42, fat:9  },
  // ── ALMUERZOS ──────────────────────────────────────────────
  { id:'rdb_chicken_rice',  name:'Bowl de pollo y arroz con brócoli',      emoji:'🍗', mealType:'lunch', prepTime:20, servingDesc:'1 bowl grande',
    ingredients:['chicken','rice','broccoli','olive_oil','garlic'],        kcal:520, prot:48, carbs:52, fat:12 },
  { id:'rdb_tuna_salad',    name:'Ensalada de atún con aguacate',          emoji:'🐟', mealType:'lunch', prepTime:10, servingDesc:'1 ensalada',
    ingredients:['tuna','lettuce','tomato','onion','avocado','cucumber'],  kcal:340, prot:28, carbs:14, fat:20 },
  { id:'rdb_pasta_meat',    name:'Pasta con carne y salsa de tomate',      emoji:'🍝', mealType:'lunch', prepTime:25, servingDesc:'1 plato',
    ingredients:['pasta','beef','tomato','onion','garlic'],                kcal:560, prot:38, carbs:62, fat:16 },
  { id:'rdb_turkey_wrap',   name:'Wrap de pavo, aguacate y lechuga',       emoji:'🌯', mealType:'lunch', prepTime:8,  servingDesc:'1 wrap',
    ingredients:['tortilla','turkey','avocado','lettuce','tomato'],        kcal:430, prot:34, carbs:36, fat:16 },
  { id:'rdb_salmon_quinoa', name:'Bowl de salmón con quinoa y espinaca',   emoji:'🐟', mealType:'lunch', prepTime:20, servingDesc:'1 bowl',
    ingredients:['salmon','quinoa','spinach','avocado'],                   kcal:510, prot:38, carbs:38, fat:22 },
  { id:'rdb_rice_beans',    name:'Arroz con frijoles y carne',             emoji:'🍚', mealType:'lunch', prepTime:30, servingDesc:'1 plato',
    ingredients:['rice','beans','beef','onion','garlic','tomato'],         kcal:580, prot:34, carbs:72, fat:14 },
  { id:'rdb_grill_salad',   name:'Ensalada de pollo a la parrilla',        emoji:'🥗', mealType:'lunch', prepTime:20, servingDesc:'1 ensalada grande',
    ingredients:['chicken','lettuce','tomato','cucumber','avocado','olive_oil'], kcal:380, prot:42, carbs:12, fat:18 },
  { id:'rdb_lentil_soup',   name:'Sopa de lentejas con zanahoria',         emoji:'🍲', mealType:'lunch', prepTime:35, servingDesc:'1 tazón grande',
    ingredients:['lentils','carrot','onion','garlic','tomato','spinach'],  kcal:320, prot:20, carbs:54, fat:4  },
  { id:'rdb_shrimp_tacos',  name:'Tacos de camarón con aguacate',          emoji:'🦐', mealType:'lunch', prepTime:15, servingDesc:'3 tacos',
    ingredients:['tortilla','shrimp','avocado','tomato','onion'],          kcal:420, prot:30, carbs:40, fat:14 },
  { id:'rdb_poke',          name:'Poke bowl de salmón',                    emoji:'🍱', mealType:'lunch', prepTime:15, servingDesc:'1 bowl',
    ingredients:['rice','salmon','avocado','cucumber','onion'],            kcal:490, prot:32, carbs:54, fat:16 },
  { id:'rdb_mushroom_pasta',name:'Pasta con champiñones y ajo',            emoji:'🍄', mealType:'lunch', prepTime:20, servingDesc:'1 plato',
    ingredients:['pasta','mushrooms','garlic','olive_oil','spinach','cheese'], kcal:440, prot:16, carbs:64, fat:14 },
  { id:'rdb_chickpea_curry',name:'Curry de garbanzos con espinaca',        emoji:'🫘', mealType:'lunch', prepTime:25, servingDesc:'1 tazón + arroz',
    ingredients:['chickpeas','spinach','tomato','onion','garlic','rice'],  kcal:420, prot:16, carbs:72, fat:8  },
  // ── CENAS ──────────────────────────────────────────────────
  { id:'rdb_salmon_swetp',  name:'Salmón al horno con camote y brócoli',  emoji:'🐟', mealType:'dinner', prepTime:25, servingDesc:'1 plato',
    ingredients:['salmon','sweet_potato','broccoli','olive_oil'],          kcal:480, prot:36, carbs:40, fat:18 },
  { id:'rdb_chicken_grill', name:'Pollo a la plancha con ensalada',        emoji:'🍗', mealType:'dinner', prepTime:20, servingDesc:'1 plato',
    ingredients:['chicken','lettuce','tomato','cucumber','olive_oil'],     kcal:340, prot:44, carbs:10, fat:14 },
  { id:'rdb_beef_potato',   name:'Filete de res con papa y pimientos',     emoji:'🥩', mealType:'dinner', prepTime:25, servingDesc:'1 plato',
    ingredients:['beef','potato','peppers','onion','garlic'],              kcal:520, prot:40, carbs:42, fat:20 },
  { id:'rdb_turkey_veggies',name:'Pechuga de pavo al horno con verduras',  emoji:'🦃', mealType:'dinner', prepTime:30, servingDesc:'1 plato',
    ingredients:['turkey','zucchini','peppers','carrot','olive_oil'],      kcal:380, prot:46, carbs:16, fat:12 },
  { id:'rdb_tofu_rice',     name:'Tofu salteado con arroz y verduras',     emoji:'🟨', mealType:'dinner', prepTime:20, servingDesc:'1 bowl',
    ingredients:['tofu','rice','broccoli','peppers','onion','garlic'],     kcal:390, prot:20, carbs:54, fat:10 },
  { id:'rdb_shrimp_garlic', name:'Camarones al ajo con arroz y espinaca', emoji:'🦐', mealType:'dinner', prepTime:15, servingDesc:'1 plato',
    ingredients:['shrimp','rice','garlic','onion','spinach','olive_oil'],  kcal:380, prot:32, carbs:46, fat:8  },
  { id:'rdb_chicken_pasta', name:'Pasta con pollo, espinaca y queso',      emoji:'🍝', mealType:'dinner', prepTime:25, servingDesc:'1 plato',
    ingredients:['pasta','chicken','spinach','garlic','cheese'],           kcal:540, prot:46, carbs:58, fat:14 },
  { id:'rdb_beef_swetp',    name:'Bowl de res con camote y espinaca',      emoji:'🥩', mealType:'dinner', prepTime:25, servingDesc:'1 bowl',
    ingredients:['beef','sweet_potato','spinach','onion','garlic'],        kcal:480, prot:38, carbs:44, fat:16 },
  { id:'rdb_mushroom_quin', name:'Quinoa con champiñones y espinaca',      emoji:'🍄', mealType:'dinner', prepTime:20, servingDesc:'1 bowl',
    ingredients:['quinoa','mushrooms','spinach','garlic','olive_oil','cheese'], kcal:360, prot:16, carbs:48, fat:12 },
  { id:'rdb_pork_stir',     name:'Cerdo salteado con brócoli y arroz',    emoji:'🥓', mealType:'dinner', prepTime:20, servingDesc:'1 plato',
    ingredients:['pork','broccoli','rice','onion','garlic'],               kcal:480, prot:36, carbs:50, fat:14 },
  // ── SNACKS ─────────────────────────────────────────────────
  { id:'rdb_egg_avo',       name:'Huevo duro con aguacate',                emoji:'🥚', mealType:'snack', prepTime:10, servingDesc:'2 huevos + ½ aguacate',
    ingredients:['eggs','avocado'],                                        kcal:270, prot:14, carbs:6,  fat:22 },
  { id:'rdb_alm_yogurt',    name:'Almendras con yogur griego',             emoji:'🌰', mealType:'snack', prepTime:1,  servingDesc:'1 snack',
    ingredients:['almonds','yogurt'],                                      kcal:220, prot:14, carbs:12, fat:13 },
  { id:'rdb_cottage_cuke',  name:'Cottage con pepino y tomate',            emoji:'🧀', mealType:'snack', prepTime:3,  servingDesc:'1 snack',
    ingredients:['cottage','cucumber','tomato'],                           kcal:150, prot:14, carbs:8,  fat:5  },
  { id:'rdb_tuna_roll',     name:'Rollitos de lechuga con atún',           emoji:'🥬', mealType:'snack', prepTime:5,  servingDesc:'3-4 rollitos',
    ingredients:['lettuce','tuna','avocado'],                              kcal:200, prot:22, carbs:4,  fat:10 },
  { id:'rdb_cheese_nuts',   name:'Queso con nueces',                       emoji:'🧀', mealType:'snack', prepTime:1,  servingDesc:'1 snack',
    ingredients:['cheese','nuts'],                                         kcal:240, prot:12, carbs:4,  fat:20 },
  { id:'rdb_roasted_chick', name:'Garbanzos tostados al horno',            emoji:'🫘', mealType:'snack', prepTime:20, servingDesc:'1 porción',
    ingredients:['chickpeas','olive_oil'],                                 kcal:180, prot:8,  carbs:28, fat:5  },
  { id:'rdb_banana_alm',    name:'Plátano con crema de almendras',         emoji:'🍌', mealType:'snack', prepTime:1,  servingDesc:'1 plátano + 1 cdta',
    ingredients:['banana','almonds'],                                      kcal:200, prot:5,  carbs:34, fat:7  },
];

// ================================================================
// INGREDIENT → MICRONUTRIENT CONTRIBUTIONS
// Keys match MICROS object (vitA,vitC,vitD,vitE,vitK,vitB6,vitB12,
// folate,iron,calcium,magnesium,zinc,potassium,fiber)
// Values are approximate per typical serving used in RECIPE_DB
// ================================================================
const INGREDIENT_MICROS = {
  // 🥩 Proteínas
  chicken:      { vitB6:0.6,  vitB12:0.3,  iron:1.1, zinc:2.1, potassium:340 },
  beef:         { vitB12:2.1, vitB6:0.4,   iron:2.8, zinc:4.5, potassium:300 },
  pork:         { vitB12:0.7, vitB6:0.5,   iron:0.9, zinc:2.5, potassium:280 },
  salmon:       { vitD:11,    vitB12:3.2,  vitB6:0.8, vitE:1.3, iron:0.4, potassium:380 },
  tuna:         { vitD:4.0,   vitB12:2.5,  vitB6:0.9, iron:1.0, potassium:280 },
  shrimp:       { vitB12:1.1, zinc:1.1,    iron:0.5,  potassium:220 },
  turkey:       { vitB6:0.7,  vitB12:0.3,  iron:1.4,  zinc:2.3, potassium:290 },
  eggs:         { vitD:2.0,   vitA:80,     vitB12:0.9, vitE:1.0, iron:1.8, folate:47 },
  tofu:         { calcium:350, iron:2.7,   magnesium:30, zinc:1.0 },
  // 🥦 Verduras
  broccoli:     { vitC:90,  vitK:101, vitA:31,  folate:57, iron:0.7, fiber:2.6, magnesium:21 },
  spinach:      { vitK:400, vitA:280, vitC:28,  folate:58, iron:2.7, magnesium:79, calcium:99 },
  tomato:       { vitC:23,  vitA:42,  vitK:7,   potassium:237, folate:15 },
  onion:        { vitC:7,   vitB6:0.1, folate:19, fiber:1.7, potassium:146 },
  garlic:       { vitC:3,   vitB6:0.1, magnesium:7, calcium:18 },
  peppers:      { vitC:180, vitA:157, vitB6:0.3, folate:46, vitK:8 },
  zucchini:     { vitC:17,  vitK:4,   folate:24, potassium:261, magnesium:18 },
  mushrooms:    { vitD:0.4, vitB12:0.04, zinc:0.9, iron:0.5, potassium:318, fiber:1.0 },
  carrot:       { vitA:835, vitK:13,  vitC:6,   potassium:320, fiber:2.8, magnesium:12 },
  lettuce:      { vitK:102, vitA:36,  folate:38, vitC:9,  iron:0.5, calcium:36 },
  cucumber:     { vitK:16,  vitC:3,   potassium:147, magnesium:13 },
  // 🍚 Carbohidratos
  rice:         { magnesium:12, potassium:35,  iron:0.4, fiber:0.4 },
  pasta:        { iron:1.3,  magnesium:18, folate:7,  fiber:1.8 },
  bread:        { iron:2.3,  calcium:77,   magnesium:24, fiber:6.0, folate:40 },
  oats:         { magnesium:56, iron:2.1,  zinc:1.9, fiber:4.0, vitB6:0.1, folate:14 },
  potato:       { vitC:19,  vitB6:0.4, potassium:544, magnesium:30, fiber:2.2, iron:0.8 },
  sweet_potato: { vitA:961, vitC:22,   potassium:475, magnesium:27, fiber:3.0, vitB6:0.3 },
  quinoa:       { magnesium:64, iron:1.5, zinc:1.1, fiber:2.8, folate:42, potassium:318, calcium:17 },
  tortilla:     { calcium:46, iron:1.2, fiber:2.0, magnesium:16 },
  banana:       { vitB6:0.4, vitC:10,  potassium:422, magnesium:32, fiber:3.1, folate:20 },
  // 🥑 Grasas
  avocado:      { vitK:21,  vitE:2.1, folate:81, potassium:485, fiber:6.7, magnesium:29 },
  olive_oil:    { vitE:1.9, vitK:8 },
  almonds:      { vitE:7.4, magnesium:77, calcium:76, fiber:3.5, zinc:0.9, iron:1.0 },
  nuts:         { vitE:1.0, magnesium:45, potassium:125, fiber:1.9, zinc:0.8 },
  // 🥛 Lácteos
  milk:         { calcium:300, vitD:2.9, vitB12:1.2, potassium:380, vitA:50 },
  yogurt:       { calcium:200, vitB12:0.8, potassium:240, zinc:1.5, vitD:0.5 },
  cheese:       { calcium:700, vitB12:0.8, zinc:3.1, vitA:75, vitK:3 },
  cottage:      { calcium:83,  vitB12:0.4, potassium:137, zinc:0.6, vitD:0.2 },
  // 🫘 Legumbres
  beans:        { iron:3.7, folate:130, potassium:600, magnesium:60, fiber:10, zinc:1.8, calcium:50 },
  lentils:      { iron:3.3, folate:179, potassium:369, magnesium:36, fiber:8.0, zinc:2.5, vitB6:0.2 },
  chickpeas:    { iron:2.9, folate:172, potassium:477, magnesium:79, fiber:7.6, zinc:2.5, calcium:80 },
};

// Compute total micronutrients for a RECIPE_DB recipe from its ingredient tags
function calcRecipeMicros(recipe) {
  const totals = {};
  recipe.ingredients.forEach(ingId => {
    const m = INGREDIENT_MICROS[ingId];
    if (!m) return;
    Object.entries(m).forEach(([k, v]) => { totals[k] = (totals[k] || 0) + v; });
  });
  return totals;
}

// Ingredient quantities per recipe (for the detail modal)
// qty=0 means "al gusto". Multiply by serving multiplier for scaled amounts.
const RECIPE_AMOUNTS = {
  // ── Desayunos ──────────────────────────────────────────────
  rdb_omelet:        [{ label:'Huevos',             qty:3,   unit:'unidades'        },
                      { label:'Espinaca',            qty:60,  unit:'g'               },
                      { label:'Queso rallado',       qty:30,  unit:'g'               },
                      { label:'Cebolla',             qty:30,  unit:'g'               },
                      { label:'Sal y pimienta',      qty:0,   unit:'al gusto'        }],
  rdb_oats_banana:   [{ label:'Avena',               qty:80,  unit:'g'               },
                      { label:'Leche',               qty:200, unit:'ml'              },
                      { label:'Plátano',             qty:1,   unit:'pieza (120 g)'   },
                      { label:'Almendras',           qty:20,  unit:'g'               }],
  rdb_eggs_tomato:   [{ label:'Huevos',             qty:2,   unit:'unidades'        },
                      { label:'Tomate',              qty:1,   unit:'pieza (150 g)'   },
                      { label:'Cebolla',             qty:50,  unit:'g'               },
                      { label:'Aceite de oliva',     qty:8,   unit:'ml'              }],
  rdb_avo_toast:     [{ label:'Pan integral',        qty:2,   unit:'rebanadas (80 g)'},
                      { label:'Aguacate',            qty:75,  unit:'g (½ pieza)'     },
                      { label:'Huevo',               qty:1,   unit:'unidad'          },
                      { label:'Sal y limón',         qty:0,   unit:'al gusto'        }],
  rdb_yogurt_banana: [{ label:'Yogur griego',        qty:200, unit:'g'               },
                      { label:'Plátano',             qty:1,   unit:'pieza (120 g)'   },
                      { label:'Nueces',              qty:20,  unit:'g'               }],
  rdb_burrito_egg:   [{ label:'Tortilla de trigo',   qty:1,   unit:'pieza grande (60 g)'},
                      { label:'Huevos',             qty:2,   unit:'unidades'        },
                      { label:'Pechuga de pavo',    qty:60,  unit:'g'               },
                      { label:'Espinaca',            qty:30,  unit:'g'               },
                      { label:'Queso rallado',       qty:20,  unit:'g'               }],
  rdb_cottage_fruit: [{ label:'Cottage / requesón',  qty:150, unit:'g'               },
                      { label:'Plátano',             qty:1,   unit:'pieza (120 g)'   },
                      { label:'Almendras',           qty:15,  unit:'g'               }],
  rdb_oats_eggs:     [{ label:'Avena',               qty:80,  unit:'g'               },
                      { label:'Leche',               qty:200, unit:'ml'              },
                      { label:'Huevo',               qty:1,   unit:'unidad'          },
                      { label:'Plátano',             qty:60,  unit:'g (½ pieza)'     }],
  // ── Almuerzos ──────────────────────────────────────────────
  rdb_chicken_rice:  [{ label:'Pechuga de pollo',   qty:150, unit:'g'               },
                      { label:'Arroz cocido',        qty:150, unit:'g'               },
                      { label:'Brócoli',             qty:100, unit:'g'               },
                      { label:'Aceite de oliva',     qty:10,  unit:'ml'              },
                      { label:'Ajo',                 qty:2,   unit:'dientes'         }],
  rdb_tuna_salad:    [{ label:'Atún en agua',        qty:140, unit:'g (1 lata)'      },
                      { label:'Lechuga mixta',       qty:100, unit:'g'               },
                      { label:'Tomate',              qty:1,   unit:'pieza (150 g)'   },
                      { label:'Cebolla',             qty:30,  unit:'g'               },
                      { label:'Aguacate',            qty:75,  unit:'g (½ pieza)'     },
                      { label:'Pepino',              qty:80,  unit:'g'               }],
  rdb_pasta_meat:    [{ label:'Pasta cocida',        qty:150, unit:'g'               },
                      { label:'Carne molida de res', qty:120, unit:'g'               },
                      { label:'Tomate triturado',    qty:200, unit:'g'               },
                      { label:'Cebolla',             qty:60,  unit:'g'               },
                      { label:'Ajo',                 qty:2,   unit:'dientes'         }],
  rdb_turkey_wrap:   [{ label:'Tortilla de trigo',   qty:1,   unit:'pieza (60 g)'    },
                      { label:'Pechuga de pavo',    qty:120, unit:'g'               },
                      { label:'Aguacate',            qty:75,  unit:'g (½ pieza)'     },
                      { label:'Lechuga',             qty:50,  unit:'g'               },
                      { label:'Tomate',              qty:75,  unit:'g (½ pieza)'     }],
  rdb_salmon_quinoa: [{ label:'Salmón al horno',     qty:150, unit:'g'               },
                      { label:'Quinoa cocida',       qty:120, unit:'g'               },
                      { label:'Espinaca',            qty:80,  unit:'g'               },
                      { label:'Aguacate',            qty:75,  unit:'g (½ pieza)'     }],
  rdb_rice_beans:    [{ label:'Arroz cocido',        qty:150, unit:'g'               },
                      { label:'Frijoles cocidos',    qty:120, unit:'g'               },
                      { label:'Carne molida',        qty:100, unit:'g'               },
                      { label:'Cebolla',             qty:60,  unit:'g'               },
                      { label:'Ajo',                 qty:2,   unit:'dientes'         },
                      { label:'Tomate',              qty:100, unit:'g'               }],
  rdb_grill_salad:   [{ label:'Pechuga de pollo',   qty:150, unit:'g'               },
                      { label:'Lechuga mixta',       qty:100, unit:'g'               },
                      { label:'Tomate',              qty:1,   unit:'pieza (150 g)'   },
                      { label:'Pepino',              qty:80,  unit:'g'               },
                      { label:'Aguacate',            qty:75,  unit:'g (½ pieza)'     },
                      { label:'Aceite de oliva',     qty:10,  unit:'ml'              }],
  rdb_lentil_soup:   [{ label:'Lentejas secas',      qty:100, unit:'g'               },
                      { label:'Zanahoria',           qty:100, unit:'g'               },
                      { label:'Cebolla',             qty:80,  unit:'g'               },
                      { label:'Ajo',                 qty:2,   unit:'dientes'         },
                      { label:'Tomate',              qty:100, unit:'g'               },
                      { label:'Espinaca',            qty:50,  unit:'g'               }],
  rdb_shrimp_tacos:  [{ label:'Camarón',             qty:150, unit:'g'               },
                      { label:'Tortilla de maíz',    qty:3,   unit:'piezas'          },
                      { label:'Aguacate',            qty:75,  unit:'g (½ pieza)'     },
                      { label:'Tomate',              qty:100, unit:'g'               },
                      { label:'Cebolla',             qty:40,  unit:'g'               }],
  rdb_poke:          [{ label:'Arroz cocido',        qty:150, unit:'g'               },
                      { label:'Salmón fresco',       qty:120, unit:'g'               },
                      { label:'Aguacate',            qty:75,  unit:'g (½ pieza)'     },
                      { label:'Pepino',              qty:80,  unit:'g'               },
                      { label:'Cebolla morada',      qty:30,  unit:'g'               }],
  rdb_mushroom_pasta:[{ label:'Pasta cocida',        qty:150, unit:'g'               },
                      { label:'Champiñones',         qty:150, unit:'g'               },
                      { label:'Ajo',                 qty:3,   unit:'dientes'         },
                      { label:'Aceite de oliva',     qty:15,  unit:'ml'              },
                      { label:'Espinaca',            qty:60,  unit:'g'               },
                      { label:'Queso parmesano',     qty:20,  unit:'g'               }],
  rdb_chickpea_curry:[{ label:'Garbanzos cocidos',   qty:150, unit:'g'               },
                      { label:'Espinaca',            qty:80,  unit:'g'               },
                      { label:'Tomate triturado',    qty:200, unit:'g'               },
                      { label:'Cebolla',             qty:80,  unit:'g'               },
                      { label:'Ajo',                 qty:2,   unit:'dientes'         },
                      { label:'Arroz cocido',        qty:100, unit:'g'               }],
  // ── Cenas ──────────────────────────────────────────────────
  rdb_salmon_swetp:  [{ label:'Salmón',              qty:150, unit:'g'               },
                      { label:'Camote / batata',     qty:180, unit:'g'               },
                      { label:'Brócoli',             qty:100, unit:'g'               },
                      { label:'Aceite de oliva',     qty:10,  unit:'ml'              }],
  rdb_chicken_grill: [{ label:'Pechuga de pollo',   qty:160, unit:'g'               },
                      { label:'Lechuga',             qty:100, unit:'g'               },
                      { label:'Tomate',              qty:1,   unit:'pieza (150 g)'   },
                      { label:'Pepino',              qty:80,  unit:'g'               },
                      { label:'Aceite de oliva',     qty:10,  unit:'ml'              }],
  rdb_beef_potato:   [{ label:'Filete de res',       qty:150, unit:'g'               },
                      { label:'Papa',                qty:200, unit:'g'               },
                      { label:'Pimiento',            qty:100, unit:'g'               },
                      { label:'Cebolla',             qty:60,  unit:'g'               },
                      { label:'Ajo',                 qty:2,   unit:'dientes'         }],
  rdb_turkey_veggies:[{ label:'Pechuga de pavo',    qty:150, unit:'g'               },
                      { label:'Calabacita',          qty:150, unit:'g'               },
                      { label:'Pimiento',            qty:100, unit:'g'               },
                      { label:'Zanahoria',           qty:80,  unit:'g'               },
                      { label:'Aceite de oliva',     qty:10,  unit:'ml'              }],
  rdb_tofu_rice:     [{ label:'Tofu firme',          qty:150, unit:'g'               },
                      { label:'Arroz cocido',        qty:150, unit:'g'               },
                      { label:'Brócoli',             qty:100, unit:'g'               },
                      { label:'Pimiento',            qty:80,  unit:'g'               },
                      { label:'Cebolla',             qty:50,  unit:'g'               },
                      { label:'Ajo',                 qty:2,   unit:'dientes'         }],
  rdb_shrimp_garlic: [{ label:'Camarón',             qty:150, unit:'g'               },
                      { label:'Arroz cocido',        qty:150, unit:'g'               },
                      { label:'Ajo',                 qty:4,   unit:'dientes'         },
                      { label:'Cebolla',             qty:50,  unit:'g'               },
                      { label:'Espinaca',            qty:80,  unit:'g'               },
                      { label:'Aceite de oliva',     qty:10,  unit:'ml'              }],
  rdb_chicken_pasta: [{ label:'Pasta integral cocida',qty:150,unit:'g'               },
                      { label:'Pechuga de pollo',   qty:120, unit:'g'               },
                      { label:'Espinaca',            qty:80,  unit:'g'               },
                      { label:'Ajo',                 qty:2,   unit:'dientes'         },
                      { label:'Queso parmesano',     qty:25,  unit:'g'               }],
  rdb_beef_swetp:    [{ label:'Carne molida de res', qty:150, unit:'g'               },
                      { label:'Camote / batata',     qty:180, unit:'g'               },
                      { label:'Espinaca',            qty:80,  unit:'g'               },
                      { label:'Cebolla',             qty:60,  unit:'g'               },
                      { label:'Ajo',                 qty:2,   unit:'dientes'         }],
  rdb_mushroom_quin: [{ label:'Quinoa cocida',       qty:150, unit:'g'               },
                      { label:'Champiñones',         qty:150, unit:'g'               },
                      { label:'Espinaca',            qty:80,  unit:'g'               },
                      { label:'Ajo',                 qty:3,   unit:'dientes'         },
                      { label:'Aceite de oliva',     qty:10,  unit:'ml'              },
                      { label:'Queso parmesano',     qty:20,  unit:'g'               }],
  rdb_pork_stir:     [{ label:'Cerdo en tiras',      qty:150, unit:'g'               },
                      { label:'Brócoli',             qty:150, unit:'g'               },
                      { label:'Arroz cocido',        qty:150, unit:'g'               },
                      { label:'Cebolla',             qty:60,  unit:'g'               },
                      { label:'Ajo',                 qty:2,   unit:'dientes'         }],
  // ── Snacks ─────────────────────────────────────────────────
  rdb_egg_avo:       [{ label:'Huevos duros',        qty:2,   unit:'unidades'        },
                      { label:'Aguacate',            qty:75,  unit:'g (½ pieza)'     },
                      { label:'Sal y pimienta',      qty:0,   unit:'al gusto'        }],
  rdb_alm_yogurt:    [{ label:'Almendras',           qty:30,  unit:'g'               },
                      { label:'Yogur griego',        qty:150, unit:'g'               }],
  rdb_cottage_cuke:  [{ label:'Cottage / requesón',  qty:150, unit:'g'               },
                      { label:'Pepino',              qty:100, unit:'g'               },
                      { label:'Tomate',              qty:75,  unit:'g (½ pieza)'     }],
  rdb_tuna_roll:     [{ label:'Hojas de lechuga',    qty:4,   unit:'hojas grandes'   },
                      { label:'Atún en agua',        qty:100, unit:'g'               },
                      { label:'Aguacate',            qty:75,  unit:'g (½ pieza)'     }],
  rdb_cheese_nuts:   [{ label:'Queso',               qty:40,  unit:'g'               },
                      { label:'Nueces',              qty:30,  unit:'g'               }],
  rdb_roasted_chick: [{ label:'Garbanzos cocidos',   qty:200, unit:'g'               },
                      { label:'Aceite de oliva',     qty:5,   unit:'ml'              },
                      { label:'Sal y especias',      qty:0,   unit:'al gusto'        }],
  rdb_banana_alm:    [{ label:'Plátano',             qty:1,   unit:'pieza (120 g)'   },
                      { label:'Almendras o crema',   qty:20,  unit:'g'               }],
};

// ── Step-by-step cooking instructions ────────────────────────
const RECIPE_STEPS = {
  // ── Desayunos ──────────────────────────────────────────────
  rdb_omelet: [
    'Bate los huevos con sal, pimienta y una cucharada de agua hasta que estén espumosos.',
    'Calienta una sartén antiadherente a fuego medio con un chorrito de aceite o mantequilla.',
    'Vierte los huevos y, cuando el borde empiece a cuajar, distribuye la espinaca y el queso rallado sobre la mitad.',
    'Dobla el omelette a la mitad, baja el fuego y deja 1 min más hasta que el queso se derrita.',
    'Sirve inmediatamente con sal y pimienta al gusto.',
  ],
  rdb_oats_banana: [
    'Mezcla la avena con la leche en un tazón o cacerola.',
    'Cocina a fuego medio-bajo removiendo constantemente durante 5 min hasta que espese.',
    'Retira del fuego y deja reposar 1 min.',
    'Añade el plátano en rodajas y las almendras laminadas por encima.',
    'Opcional: endulza con miel o canela al gusto.',
  ],
  rdb_eggs_tomato: [
    'Pica el tomate y la cebolla en cubos pequeños.',
    'Calienta aceite en una sartén y sofríe la cebolla 2 min a fuego medio.',
    'Añade el tomate y cocina 3 min hasta que suelte su jugo.',
    'Bate los huevos con sal, vierte sobre la sartén y revuelve suavemente a fuego bajo.',
    'Retira antes de que cuajen del todo; el calor residual termina la cocción.',
  ],
  rdb_avo_toast: [
    'Tuesta el pan integral hasta que esté dorado y crujiente.',
    'Aplasta el aguacate con un tenedor, añade sal, pimienta y jugo de limón.',
    'Unta el aguacate sobre el pan.',
    'Fríe o pocha el huevo a tu gusto (3-4 min) y colócalo encima.',
    'Finaliza con una pizca de sal en escamas o chile en hojuelas si deseas.',
  ],
  rdb_yogurt_banana: [
    'Vierte el yogur griego en un tazón.',
    'Corta el plátano en rodajas y dispón sobre el yogur.',
    'Agrega las nueces picadas por encima.',
    'Opcional: añade una cucharadita de miel y canela.',
    'Consume de inmediato o refrigera hasta 2 h.',
  ],
  rdb_burrito_egg: [
    'Calienta la tortilla 30 s en sartén seca por cada lado.',
    'Bate los huevos con sal; cocínalos revueltos en sartén con aceite a fuego medio.',
    'Calienta las lonchas de pavo en la misma sartén 1 min.',
    'Coloca en la tortilla: espinaca fresca, pavo, huevos revueltos y queso rallado.',
    'Enrolla firmemente, dobla los extremos y sirve.',
  ],
  rdb_cottage_fruit: [
    'Vierte el cottage en un tazón.',
    'Corta el plátano en rodajas y coloca encima.',
    'Añade las almendras o la crema de almendras.',
    'Opcional: agrega canela, miel o bayas.',
    'Sirve frío, recién preparado.',
  ],

  // ── Almuerzos ─────────────────────────────────────────────
  rdb_chicken_rice: [
    'Sazona la pechuga con sal, pimienta, ajo en polvo y orégano.',
    'Cocina el arroz según las instrucciones del paquete.',
    'En sartén con aceite a fuego medio-alto, sella la pechuga 5 min por lado hasta que el interior esté blanco.',
    'Corta el brócoli en floretes y cuece al vapor 5-7 min (o en microondas 3 min).',
    'Sirve el pollo laminado sobre el arroz con el brócoli al lado.',
  ],
  rdb_turkey_sweet: [
    'Pela el camote, córtalo en cubos y cocina al vapor o microondas 8-10 min.',
    'Sazona el pavo molido con sal, pimienta y comino.',
    'Saltea el pavo en sartén con aceite a fuego medio hasta dorar (6-8 min).',
    'Añade la espinaca al pavo, remueve hasta que se marchite (1-2 min).',
    'Sirve el pavo con la espinaca sobre el camote.',
  ],
  rdb_salmon_quinoa: [
    'Enjuaga la quinoa; cocina con doble cantidad de agua 15 min a fuego bajo, tapa.',
    'Sazona el salmón con sal, pimienta, limón y aceite de oliva.',
    'Cocina el salmón en sartén caliente 3-4 min por lado o al horno 12 min a 200°C.',
    'Rebana el aguacate y exprime limón sobre él para evitar que oxide.',
    'Sirve el salmón sobre la quinoa con el aguacate al lado.',
  ],
  rdb_beef_veggies: [
    'Corta la carne en tiras delgadas y sazona con sal, pimienta y salsa de soya.',
    'Cocina el arroz con 2 partes de agua, 15-18 min.',
    'En wok o sartén muy caliente con aceite, saltea la carne 2-3 min hasta dorar.',
    'Agrega las verduras (zanahoria, pimiento, cebolla) y saltea 4 min más.',
    'Sirve el salteado de carne sobre el arroz.',
  ],
  rdb_tuna_pasta: [
    'Cuece la pasta en agua con sal según las instrucciones del paquete.',
    'Escurre el atún y reserva.',
    'Pica el tomate en cubos y la cebolla finamente.',
    'Mezcla la pasta escurrida con el atún, tomate, cebolla, aceite de oliva, sal y pimienta.',
    'Sirve tibio o frío como ensalada de pasta.',
  ],
  rdb_chicken_salad: [
    'Hierve o cocina la pechuga a la plancha con sal y ajo; deja enfriar y desmenuza.',
    'Rebana el aguacate y exprime limón para preservar el color.',
    'Pica la lechuga, el tomate y el pepino.',
    'Mezcla todo en un tazón grande.',
    'Aliña con aceite de oliva, limón, sal, pimienta y orégano.',
  ],
  rdb_lentil_stew: [
    'Enjuaga las lentejas y ponlas a remojar 30 min (opcional).',
    'Sofríe cebolla, ajo y zanahoria picados en aceite 4 min.',
    'Añade las lentejas, tomate triturado, comino, pimentón y 400 ml de agua o caldo.',
    'Cocina a fuego medio 25-30 min hasta que las lentejas estén tiernas.',
    'Ajusta sal y pimienta; sirve con pan integral si deseas.',
  ],
  rdb_egg_rice: [
    'Cocina el arroz con sal.',
    'Pica las verduras (zanahoria, pimiento, guisantes) en cubos pequeños.',
    'Saltea las verduras en wok con aceite 3 min a fuego alto.',
    'Empuja las verduras a un lado, rompe los huevos en el centro y revuelve.',
    'Mezcla todo, añade salsa de soya, sal y pimienta; sirve caliente.',
  ],
  rdb_tilapia_rice: [
    'Sazona la tilapia con sal, pimienta, ajo y jugo de limón.',
    'Cocina el arroz con sal.',
    'Calienta aceite en sartén y cocina la tilapia 3 min por lado a fuego medio-alto.',
    'Cuece las verduras al vapor 5 min.',
    'Sirve la tilapia sobre el arroz con las verduras y gajos de limón.',
  ],

  // ── Meriendas ─────────────────────────────────────────────
  rdb_apple_pb: [
    'Lava y corta la manzana en gajos.',
    'Pon la mantequilla de maní en un tazón pequeño.',
    'Moja cada gajo de manzana en la mantequilla de maní.',
    'Consume de inmediato o guarda en recipiente hermético.',
  ],
  rdb_nuts_fruit: [
    'Mide las porciones de nueces, almendras y maní.',
    'Mezcla con los trozos de fruta seca (dátiles, arándanos, pasas) si lo deseas.',
    'Distribuye en un tazón o bolsita snack.',
    'Consume como está; no requiere preparación.',
  ],
  rdb_hummus_veggies: [
    'Pela y corta la zanahoria en bastones.',
    'Corta el pimiento y el apio en tiras si los usas.',
    'Sirve el hummus en un tazón pequeño.',
    'Dispón los bastones alrededor para mojar.',
    'Opcional: añade un chorrito de aceite de oliva y paprika sobre el hummus.',
  ],
  rdb_protein_smoothie: [
    'Pela el plátano (puede estar congelado para textura más cremosa).',
    'Coloca en la licuadora: plátano, leche, proteína en polvo y hielo al gusto.',
    'Licúa 30-45 s hasta obtener una mezcla homogénea.',
    'Sirve inmediatamente en un vaso alto.',
  ],
  rdb_cheese_crackers: [
    'Selecciona un queso bajo en grasas (gouda, mozzarella o cottage).',
    'Corta el queso en cubos o lonchas.',
    'Dispón las galletas integrales en un plato.',
    'Coloca el queso sobre las galletas o a un lado para mojar.',
    'Opcional: añade unas rodajas de tomate o pepino.',
  ],
  rdb_cottage_cuke: [
    'Lava el pepino y el tomate.',
    'Corta en rodajas o cubos.',
    'Vierte el cottage en un tazón.',
    'Añade las verduras encima.',
    'Aliña con sal, pimienta y un chorrito de aceite de oliva.',
  ],
  rdb_yogurt_nuts: [
    'Vierte el yogur griego en un tazón.',
    'Pica las nueces groseramente si son muy grandes.',
    'Añade las nueces sobre el yogur.',
    'Opcional: agrega una cucharadita de miel o semillas de chía.',
  ],
  rdb_banana_alm: [
    'Pela el plátano.',
    'Sirve en un tazón o plato con la crema de almendras al lado.',
    'Come el plátano a mordidas untándolo en la crema o córtalo en rodajas.',
  ],

  // ── Cenas ─────────────────────────────────────────────────
  rdb_chicken_veg: [
    'Sazona la pechuga con sal, pimienta, ajo y hierbas (orégano, tomillo).',
    'Precalienta el horno a 190°C o calienta una sartén con aceite.',
    'Cocina la pechuga 6-7 min por lado en sartén o 20 min en horno.',
    'Lava y corta las verduras (brócoli, zanahoria, calabacín) en piezas similares.',
    'Cuece las verduras al vapor 6-8 min; sirve junto al pollo.',
  ],
  rdb_salmon_asparagus: [
    'Precalienta el horno a 200°C.',
    'Coloca el salmón en una bandeja; sazona con sal, pimienta, limón y eneldo.',
    'Limpia los espárragos, corta las puntas duras y coloca alrededor del salmón.',
    'Rocía aceite de oliva sobre todo y hornea 12-15 min.',
    'Sirve con rodajas de limón.',
  ],
  rdb_turkey_broccoli: [
    'Divide el brócoli en floretes medianos.',
    'Hierve o cocina al vapor el brócoli 5-6 min hasta que esté tierno pero firme.',
    'Cocina las lonchas de pavo en sartén sin aceite 1-2 min por lado.',
    'Mezcla el brócoli escurrido con aceite de oliva, sal y ajo.',
    'Sirve el pavo junto al brócoli.',
  ],
  rdb_beef_stir: [
    'Corta la carne en tiras finas y marina 10 min con salsa de soya, ajo y jengibre.',
    'Corta los pimientos, cebolla y zanahoria en juliana.',
    'Calienta el wok o sartén a fuego muy alto con aceite.',
    'Saltea la carne 2 min, retira. Saltea las verduras 3 min.',
    'Regresa la carne, mezcla todo 1 min más; sirve sobre arroz o con pan pita.',
  ],
  rdb_egg_spinach: [
    'Lava y escurre la espinaca.',
    'Calienta aceite en sartén y sofríe ajo picado 1 min.',
    'Añade la espinaca y cocina 2 min hasta marchitar.',
    'Haz un hueco en el centro y añade los huevos; cocina como tortilla o huevos rotos.',
    'Sazona con sal, pimienta y queso rallado opcional; sirve directo de la sartén.',
  ],
  rdb_chickpea_stew: [
    'Sofríe cebolla y ajo picados en aceite de oliva 3 min.',
    'Añade tomate triturado, comino, pimentón y pizca de cayena.',
    'Incorpora los garbanzos cocidos (o de lata, enjuagados) y 150 ml de caldo.',
    'Cocina a fuego medio 10-12 min removiendo ocasionalmente.',
    'Sirve con perejil fresco y pan integral.',
  ],
  rdb_chicken_mushroom: [
    'Corta la pechuga en trozos medianos y sazona con sal y pimienta.',
    'Lamina los champiñones; pica la cebolla en juliana.',
    'Calienta aceite en sartén y sella el pollo 4-5 min hasta dorar.',
    'Añade la cebolla y los champiñones; cocina 5 min más.',
    'Opcional: agrega un chorrito de vino blanco o caldo y deja reducir 2 min.',
  ],
  rdb_tuna_salad: [
    'Escurre el atún y desmenúzalo.',
    'Rebana el aguacate y la cebolla morada finamente.',
    'Corta el tomate en cubos y la lechuga en tiras.',
    'Mezcla todo en un tazón grande con el atún.',
    'Aliña con aceite de oliva, limón, sal y pimienta negra.',
  ],
  rdb_bean_soup: [
    'Sofríe cebolla, ajo y zanahoria picados en aceite 4 min.',
    'Añade los frijoles negros cocidos (o de lata), tomate, comino y orégano.',
    'Agrega 500 ml de caldo de pollo o agua; lleva a hervor.',
    'Reduce el fuego y cocina 15 min; tritura un tercio de la sopa con cuchara para espesar.',
    'Sirve con cilantro fresco, un chorrito de limón y arroz si deseas.',
  ],
  rdb_salmon_sweet_potato: [
    'Pela el camote, córtalo en cubos y rocía con aceite, sal y pimentón.',
    'Precalienta el horno a 200°C; hornea el camote 20 min.',
    'A los 20 min, coloca el salmón sazonado junto al camote.',
    'Hornea 12-14 min más hasta que el salmón esté cocido en el centro.',
    'Sirve con unas gotas de limón y hierbas frescas.',
  ],
  rdb_zucchini_chicken: [
    'Corta el calabacín en medias lunas y la pechuga en tiras.',
    'Sazona el pollo con sal, pimienta, ajo y orégano.',
    'Calienta aceite en sartén a fuego alto y sella el pollo 3-4 min.',
    'Añade el calabacín y la cebolla; saltea 4 min hasta que estén tiernos.',
    'Termina con un chorrito de limón; sirve solo o sobre arroz.',
  ],
  rdb_shrimp_rice: [
    'Cocina el arroz integral (requiere ~40 min o usa arroz cocido rápido).',
    'Pela y desveína los camarones; sazona con sal, pimienta y ajo.',
    'Saltea los camarones en sartén con aceite 2 min por lado hasta rosados.',
    'Añade verduras (pimiento, zanahoria) y saltea 3 min más.',
    'Sirve sobre el arroz con salsa de soya y limón.',
  ],
  rdb_tofu_stir_fry: [
    'Escurre el tofu firme y córtalo en cubos; presiona con papel de cocina para quitar humedad.',
    'Saltea el tofu en aceite caliente a fuego alto 5 min hasta dorar, sin mover demasiado.',
    'Retira el tofu; saltea las verduras (pimiento, brócoli, zanahoria) 4 min.',
    'Devuelve el tofu, añade salsa de soya, jengibre y ajo; cocina 1 min.',
    'Sirve sobre arroz o fideos con semillas de ajonjolí.',
  ],
  rdb_chicken_broth: [
    'Pon el pollo (huesos o pechuga) en una olla con agua fría, cebolla, ajo, zanahoria y apio.',
    'Lleva a hervor y elimina la espuma que sube.',
    'Reduce a fuego bajo, tapa parcialmente y cocina 45-60 min.',
    'Cuela el caldo; desmenuza el pollo y regrésa al caldo.',
    'Añade sal, pimienta y cilantro o perejil fresco al servir.',
  ],
};

const ACTIVITIES = [
  { name:'Correr',        icon:'🏃', met:9.8  },
  { name:'Caminar',       icon:'🚶', met:3.5  },
  { name:'Ciclismo',      icon:'🚴', met:6.8  },
  { name:'Natación',      icon:'🏊', met:6.0  },
  { name:'Pesas / Gym',   icon:'🏋️', met:3.5  },
  { name:'HIIT',          icon:'⚡', met:8.0  },
  { name:'Yoga',          icon:'🧘', met:2.5  },
  { name:'Fútbol',        icon:'⚽', met:7.0  },
  { name:'Otro',          icon:'💪', met:5.0  },
];

// Use local date (not UTC) so the date is correct in any timezone.
// toISOString() returns UTC — for Santiago (UTC-3/-4) that rolls over
// to the next day from ~21:00 local time, breaking all date-keyed data.
const _localDateStr = d => {
  const dt = d || new Date();
  const y  = dt.getFullYear();
  const m  = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const today   = () => _localDateStr();
const fmtDate = d  => _localDateStr(d);

