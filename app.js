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

// ================================================================
// STORAGE
// ================================================================
const DB = {
  _g(k, d = null) { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } },
  _s(k, v)        { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) { console.warn(e); } },

  tasks()         { return this._g('lt_tasks', []); },
  saveTasks(v)    { this._s('lt_tasks', v); },

  settings()      { return this._g('lt_settings', { name:'Usuario', calorieGoal:2000, waterGoal:2500, weightGoal:null, height:null, age:null, gender:'male', activityLevel:'moderate', mcpUrl:'', cuttingStyle:'custom' }); },
  saveSettings(v) { this._s('lt_settings', v); },

  foodLog()       { return this._g('lt_food', {}); },
  saveFoodLog(v)  { this._s('lt_food', v); },
  todayFood()     { return (this.foodLog())[today()] || []; },
  addFood(entry)  { const l=this.foodLog(); if(!l[today()])l[today()]=[]; l[today()].push(entry); this.saveFoodLog(l); },
  removeFood(idx) { const l=this.foodLog(); if(l[today()]){l[today()].splice(idx,1); this.saveFoodLog(l);} },

  waterLog()      { return this._g('lt_water', {}); },
  saveWaterLog(v) { this._s('lt_water', v); },
  todayWater()    { return (this.waterLog())[today()] || 0; },
  addWater(ml)    { const l=this.waterLog(); l[today()]=(l[today()]||0)+ml; this.saveWaterLog(l); return l[today()]; },

  weightLog()     { return this._g('lt_weight', []); },
  saveWeightLog(v){ this._s('lt_weight', v); },
  logWeight(kg, note='') {
    const l = this.weightLog().filter(w => w.date !== today());
    l.push({ date:today(), kg, note }); l.sort((a,b)=>a.date.localeCompare(b.date));
    this.saveWeightLog(l);
  },

  completions()   { return this._g('lt_done', {}); },
  saveCompletions(v){ this._s('lt_done', v); },
  todayDone()     { return (this.completions())[today()] || {}; },
  toggleDone(id)  {
    const all=this.completions(); if(!all[today()])all[today()]={};
    all[today()][id]=!all[today()][id]; this.saveCompletions(all); return all[today()][id];
  },

  recipes()          { return this._g('lt_recipes', []); },
  saveRecipes(v)     { this._s('lt_recipes', v); },

  foodPrefs()        { return this._g('lt_food_prefs', null); },
  saveFoodPrefs(v)   { this._s('lt_food_prefs', v); },

  exerciseLog()      { return this._g('lt_exercise', {}); },
  saveExerciseLog(v) { this._s('lt_exercise', v); },
  todayExercise()    { return (this.exerciseLog())[today()] || []; },
  addExercise(entry) { const l=this.exerciseLog(); if(!l[today()])l[today()]=[]; l[today()].push(entry); this.saveExerciseLog(l); },
  removeExercise(idx){ const l=this.exerciseLog(); if(l[today()]){l[today()].splice(idx,1); this.saveExerciseLog(l);} },

  wellness()             { return this._g('lt_wellness', {}); },
  saveWellness(v)        { this._s('lt_wellness', v); },
  todayWellness()        { return (this.wellness())[today()] || null; },
  logWellness(entry)     { const w=this.wellness(); w[today()]={...entry, ts:new Date().toISOString()}; this.saveWellness(w); },

  mealPlan()               { return this._g('lt_meal_plan', {}); },
  saveMealPlan(v)          { this._s('lt_meal_plan', v); },
  planForDate(date)        { return (this.mealPlan())[date] || []; },
  addPlanEntry(date, entry){ const mp=this.mealPlan(); if(!mp[date])mp[date]=[]; mp[date].push(entry); this.saveMealPlan(mp); },
  removePlanEntry(date, id){ const mp=this.mealPlan(); if(mp[date]){mp[date]=mp[date].filter(e=>String(e.id)!==String(id)); this.saveMealPlan(mp);} },
};

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
// FOOD API (Open Food Facts + micronutrients)
// ================================================================
const FoodAPI = {
  cache: {},
  MICRO_FIELDS: MICRO_KEYS.map(k => MICROS[k].apiKey).join(','),

  async search(q) {
    if (this.cache[q]) return this.cache[q];
    const url = `https://world.openfoodfacts.org/cgi/search.pl?` +
      `search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20` +
      `&fields=product_name,nutriments,brands`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error('API error');
    const data = await res.json();

    const list = (data.products || [])
      .filter(p => p.product_name && (p.nutriments?.['energy-kcal_100g'] ?? -1) >= 0)
      .slice(0, 15)
      .map(p => {
        const n = p.nutriments || {};
        const item = {
          name:   (p.product_name||'').slice(0,55),
          brand:  (p.brands||'').split(',')[0].trim(),
          kcal:   Math.round(n['energy-kcal_100g'] || 0),
          prot:   +((n.proteins_100g||0).toFixed(1)),
          carbs:  +((n.carbohydrates_100g||0).toFixed(1)),
          fat:    +((n.fat_100g||0).toFixed(1)),
        };
        // Micros per 100g
        MICRO_KEYS.forEach(k => {
          item[k] = n[MICROS[k].apiKey] != null ? n[MICROS[k].apiKey] : null;
        });
        return item;
      });

    this.cache[q] = list;
    return list;
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

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ================================================================
// MCP SYNC
// ================================================================
const MCPSync = {
  async push() {
    const url = DB.settings().mcpUrl;
    if (!url) return;
    try {
      const payload = {
        settings: DB.settings(), tasks: DB.tasks(),
        completions: DB.completions(), foodLog: DB.foodLog(),
        waterLog: DB.waterLog(), weightLog: DB.weightLog(),
        recipes: DB.recipes(), exerciseLog: DB.exerciseLog(),
        mealPlan: DB.mealPlan(), wellness: DB.wellness()
      };
      const res = await fetch(`${url}/api/sync`, {
        method:'POST', headers:{'Content-Type':'application/json'},
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
      if (data.weightLog)   DB.saveWeightLog(data.weightLog);
      if (data.recipes)     DB.saveRecipes(data.recipes);
      if (data.exerciseLog) DB.saveExerciseLog(data.exerciseLog);
      if (data.mealPlan)    DB.saveMealPlan(data.mealPlan);
      if (data.wellness)    DB.saveWellness(data.wellness);
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
function mergeClientServer(server, client) {
  const s = server || {}, c = client || {};

  const settings = { ...s.settings, ...c.settings };

  const foodLog = { ...s.foodLog };
  Object.entries(c.foodLog || {}).forEach(([d, e]) => {
    if (!foodLog[d] || e.length > foodLog[d].length) foodLog[d] = e;
  });

  const waterLog = { ...s.waterLog };
  Object.entries(c.waterLog || {}).forEach(([d, ml]) => {
    waterLog[d] = Math.max(waterLog[d] || 0, ml);
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

  const exerciseLog = { ...s.exerciseLog };
  Object.entries(c.exerciseLog || {}).forEach(([d, e]) => {
    if (!exerciseLog[d] || e.length > exerciseLog[d].length) exerciseLog[d] = e;
  });

  const mealPlan = { ...s.mealPlan };
  Object.entries(c.mealPlan || {}).forEach(([d, e]) => {
    if (!mealPlan[d] || e.length > mealPlan[d].length) mealPlan[d] = e;
  });

  const wellness = { ...s.wellness };
  Object.entries(c.wellness || {}).forEach(([d, entry]) => {
    const cur = wellness[d];
    if (!cur || (entry.ts && (!cur.ts || entry.ts > cur.ts))) wellness[d] = entry;
  });

  return { settings, tasks, completions, foodLog, waterLog, weightLog, recipes, exerciseLog, mealPlan, wellness };
}

// ================================================================
// CLOUD SYNC  (Supabase — replaces MCPSync when configured)
// ================================================================
const CloudSync = {
  sb:       null,   // Supabase client instance
  userId:   null,
  user:     null,   // { id, email, name, avatar }
  _pushTimer: null,

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
    this.sb = createClient(cfg.url, cfg.anonKey);
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

  /** Push local data to Supabase (fire-and-forget OK) */
  async push() {
    if (!this.sb || !this.userId) return false;
    const payload = {
      settings: DB.settings(), tasks: DB.tasks(),
      completions: DB.completions(), foodLog: DB.foodLog(),
      waterLog: DB.waterLog(), weightLog: DB.weightLog(),
      recipes: DB.recipes(), exerciseLog: DB.exerciseLog(),
      mealPlan: DB.mealPlan(), wellness: DB.wellness()
    };
    const { error } = await this.sb
      .from('user_data')
      .upsert({ user_id: this.userId, data: payload }, { onConflict: 'user_id' });
    return !error;
  },

  /** Pull from Supabase */
  async pull() {
    if (!this.sb || !this.userId) return null;
    const { data, error } = await this.sb
      .from('user_data')
      .select('data')
      .eq('user_id', this.userId)
      .maybeSingle();
    if (error) { console.warn('CloudSync pull:', error); return null; }
    return data?.data ?? null;
  },

  /** Full bidirectional sync: pull → merge → save local → push merged */
  async syncFull() {
    if (!this.sb || !this.userId) return false;
    try {
      const serverData = await this.pull();
      const localData  = {
        settings: DB.settings(), tasks: DB.tasks(),
        completions: DB.completions(), foodLog: DB.foodLog(),
        waterLog: DB.waterLog(), weightLog: DB.weightLog(),
        recipes: DB.recipes(), exerciseLog: DB.exerciseLog(),
        mealPlan: DB.mealPlan(), wellness: DB.wellness()
      };
      const merged = serverData ? mergeClientServer(serverData, localData) : localData;
      DB.saveSettings(merged.settings);
      DB.saveTasks(merged.tasks);
      DB.saveCompletions(merged.completions);
      DB.saveFoodLog(merged.foodLog);
      DB.saveWaterLog(merged.waterLog);
      DB.saveWeightLog(merged.weightLog);
      DB.saveRecipes(merged.recipes);
      DB.saveExerciseLog(merged.exerciseLog);
      DB.saveMealPlan(merged.mealPlan);
      DB.saveWellness(merged.wellness);
      await this.push();
      return true;
    } catch(e) { console.warn('CloudSync.syncFull:', e); return false; }
  },

  /** Debounced push — call after any data mutation */
  schedulePush() {
    clearTimeout(this._pushTimer);
    this._pushTimer = setTimeout(() => this.push().catch(() => {}), 8000);
  }
};

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
// WEIGHT PREDICTION
// ================================================================
function calcPrediction() {
  const s = DB.settings();
  const weights = DB.weightLog();
  if (!weights.length) return null;
  const currentKg = weights[weights.length-1].kg;

  // Average intake last 14 days
  const food = DB.foodLog();
  const days14 = Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(13-i));return fmtDate(d);});
  const daysWithData = days14.filter(d=>(food[d]||[]).length>0);
  if (daysWithData.length < 2) return null;
  const avgKcal = daysWithData.reduce((a,d)=>a+(food[d]||[]).reduce((s,f)=>s+f.kcal,0),0)/daysWithData.length;

  // TDEE (Mifflin-St Jeor)
  let tdee = s.calorieGoal || 2000;
  if (s.height && s.age) {
    const bmr = s.gender==='female'
      ? 10*currentKg + 6.25*s.height - 5*s.age - 161
      : 10*currentKg + 6.25*s.height - 5*s.age + 5;
    const mult = {sedentary:1.2,light:1.375,moderate:1.55,active:1.725,very_active:1.9};
    tdee = Math.round(bmr * (mult[s.activityLevel]||1.55));
  }

  const dailyDeficit = tdee - avgKcal;
  const kgPerWeek    = (dailyDeficit * 7) / 7700;
  const goalKg       = s.weightGoal;
  let weeksToGoal    = null;
  if (goalKg && Math.abs(kgPerWeek) > 0.01) {
    weeksToGoal = Math.ceil((currentKg - goalKg) / kgPerWeek);
  }

  return { currentKg, avgKcal: Math.round(avgKcal), tdee, dailyDeficit: Math.round(dailyDeficit), kgPerWeek: +kgPerWeek.toFixed(2), goalKg, weeksToGoal };
}

// ================================================================
// APP
// ================================================================
const App = {
  view: 'dashboard',
  searchTimer: null,
  editTaskId: null,
  pendingFood: null,
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
    this.bindNav();
    this.bindInstall();
    this.bindSettings();
    this.bindTaskModal();
    this.bindFoodModal();
    this.bindRecipeModal();
    this.bindWeightModal();
    this.bindWater();
    this.bindMicroDays();
    this.bindExerciseModal();
    this.bindPlanModal();
    this.bindWellnessModal();
    this.bindPrepModal();

    await Notif.init();

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
        if (e.data?.type === 'NAVIGATE') this.navigate(e.data.view || 'dashboard');
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
    this.updateHeaderUser(null);
    document.getElementById('settings-account-section').style.display = 'none';
    document.getElementById('btn-sync').style.display = 'none';
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
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  },

  bindNav() {
    document.querySelectorAll('.nav-item').forEach(btn=>{
      btn.addEventListener('click',()=>this.navigate(btn.dataset.view));
    });
  },

  navigate(viewId) {
    const valid=['dashboard','tasks','food','progress','history'];
    if(!valid.includes(viewId)) viewId='dashboard';
    this.view=viewId;
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
    document.getElementById(`view-${viewId}`)?.classList.add('active');
    document.querySelector(`.nav-item[data-view="${viewId}"]`)?.classList.add('active');
    const titles={dashboard:'Inicio',tasks:'Mis Tareas',food:'Comidas',progress:'Progreso',history:'Historial'};
    document.getElementById('view-title').textContent=titles[viewId];
    this.renderView();
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
    const acctSec = document.getElementById('settings-account-section');
    if (u && acctSec) {
      acctSec.style.display = '';
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
    this.updateNotifBadge();
    this.openModal('modal-settings');
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
      cuttingStyle: style,
      // Body measurements
      neck: _f('setting-neck'), waist: _f('setting-waist'), hip: _f('setting-hip'),
      chest: _f('setting-chest'), arm: _f('setting-arm'), thigh: _f('setting-thigh'), calf: _f('setting-calf'),
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
      btn.onclick=()=>{ const ml=parseInt(btn.dataset.ml); DB.addWater(ml); toast(`+${ml}ml agua 💧`,'info'); this.renderDashboard(); };
    });
    document.getElementById('btn-dash-water-custom')?.addEventListener('click',()=>this.navigate('progress'));

    this.renderStreaks();
    this.renderWellnessDash();
    this._renderSetupCard();
    this.checkOnboarding();
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
    list.innerHTML=tasks.map(task=>{
      const isDone=!!done[task.id];
      const dayL=task.days?.length?task.days.map(d=>DAYS_SHORT[d]).join(' · '):'Cada día';
      return `<div class="task-item ${isDone?'done':''}" data-id="${task.id}">
        <button class="task-check ${isDone?'checked':''}" data-toggle="${task.id}">${isDone?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>':''}</button>
        <div class="task-info">
          <div class="task-name">${esc(task.title)}</div>
          <div class="task-meta">
            ${task.notifTime?`<span class="task-time"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${task.notifTime}</span>`:''}
            <span class="task-days">${dayL}</span>
            ${task.notifEnabled&&task.notifTime?'<span class="task-notif">🔔</span>':''}
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
  },

  deleteTask(id) {
    if(!confirm('¿Eliminar esta tarea?')) return;
    DB.saveTasks(DB.tasks().filter(t=>t.id!==id));
    Notif.cancel(id); toast('Tarea eliminada','info'); this.renderTasks();
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
      if(q.length<2){document.getElementById('food-results').innerHTML='';return;}
      this.searchTimer=setTimeout(()=>this.searchFood(q),600);
    });
    document.getElementById('modal-food-detail').addEventListener('click',e=>{if(e.target===e.currentTarget)this.closeFoodModal();});
    document.getElementById('btn-close-food').addEventListener('click',()=>this.closeFoodModal());
    document.getElementById('btn-add-food').addEventListener('click',()=>this.addFood());
    document.querySelectorAll('.qty-preset').forEach(btn=>btn.addEventListener('click',()=>{
      document.querySelectorAll('.qty-preset').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('food-qty').value=btn.dataset.qty;
      this.updateFoodPreview();
    }));
    document.getElementById('food-qty').addEventListener('input',()=>{
      document.querySelectorAll('.qty-preset').forEach(b=>b.classList.remove('selected'));
      this.updateFoodPreview();
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
  },

  renderFood() {
    this.renderFoodLog();
    this.updateFoodBar();
    if(this.recipesOpen) this.renderRecipes();
    this.updatePlanBadge();
  },

  async searchFood(q) {
    const spinner=document.getElementById('search-spinner');
    const results=document.getElementById('food-results');
    spinner.classList.add('visible'); results.innerHTML='';
    try {
      const items=await FoodAPI.search(q);
      if(!items.length){ results.innerHTML=`<p class="text-muted text-center" style="padding:16px">Sin resultados para "${esc(q)}"</p>`; return; }
      results.innerHTML=items.map((item,i)=>`
        <div class="food-result-item" data-idx="${i}">
          <div class="food-kcal-badge"><span class="food-kcal-value">${item.kcal}</span><span class="food-kcal-unit">kcal</span></div>
          <div style="flex:1;min-width:0">
            <div class="food-name">${esc(item.name)}</div>
            ${item.brand?`<div class="food-brand">${esc(item.brand)}</div>`:''}
            <div class="food-macros">
              <span>P:${item.prot}g</span><span>C:${item.carbs}g</span><span>G:${item.fat}g</span>
            </div>
          </div>
          <button class="food-add-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
        </div>`).join('');
      results.querySelectorAll('.food-result-item').forEach((el,i)=>el.addEventListener('click',()=>this.openFoodModal(items[i])));
    } catch(e) {
      results.innerHTML=`<p class="text-muted text-center" style="padding:16px">Error al buscar. Comprueba tu conexión.</p>`;
    } finally { spinner.classList.remove('visible'); }
  },

  openFoodModal(food) {
    this.pendingFood=food;
    document.getElementById('food-modal-name').textContent=food.name;
    document.getElementById('food-modal-brand').textContent=food.brand||'';
    document.getElementById('food-modal-per100').textContent=`${food.kcal} kcal · P:${food.prot}g · C:${food.carbs}g · G:${food.fat}g por 100g`;
    document.getElementById('food-qty').value='100';
    document.querySelectorAll('.qty-preset').forEach(b=>b.classList.remove('selected'));
    document.querySelector('.qty-preset[data-qty="100"]')?.classList.add('selected');
    this.updateFoodPreview();
    this.openModal('modal-food-detail');
  },

  closeFoodModal() { this.closeModal('modal-food-detail'); this.pendingFood=null; },

  updateFoodPreview() {
    const food=this.pendingFood; if(!food) return;
    const qty=parseFloat(document.getElementById('food-qty').value)||100;
    const e=FoodAPI.scale(food,qty);
    document.getElementById('food-modal-preview').textContent=
      `${e.kcal} kcal · Prot:${e.prot}g · Carbs:${e.carbs}g · Grasa:${e.fat}g`;
  },

  addFood() {
    const food=this.pendingFood; if(!food) return;
    const qty=parseFloat(document.getElementById('food-qty').value)||100;
    const entry=FoodAPI.scale(food,qty);
    entry.id=`f_${Date.now()}`;
    DB.addFood(entry);
    toast(`${food.name.split(' ').slice(0,3).join(' ')} añadido ✓`,'success');
    this.closeFoodModal();
    this.renderFoodLog(); this.updateFoodBar();
    if(this.view==='dashboard') this.renderDashboard();
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
    document.getElementById('macro-prot').textContent  = prot.toFixed(1)+'g';
    document.getElementById('macro-carbs').textContent = carbs.toFixed(1)+'g';
    document.getElementById('macro-fat').textContent   = fat.toFixed(1)+'g';
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
          <div class="log-item-detail">${f.qty}g · P:${f.prot||0}g C:${f.carbs||0}g G:${f.fat||0}g${f.isRecipe?' 📖':''}</div>
        </div>
        <span class="log-item-kcal">${f.kcal}</span>
        <button class="btn-remove" data-remove="${i}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>`).join('');
    list.querySelectorAll('[data-remove]').forEach(btn=>btn.addEventListener('click',()=>{
      DB.removeFood(parseInt(btn.dataset.remove));
      this.renderFoodLog(); this.updateFoodBar();
      if(this.view==='dashboard') this.renderDashboard();
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

    const mealType = this._getMealTypeByHour();
    const rec = this._getRecommendations(mealType);

    if (!rec || !rec.recommendations.length) {
      panel.innerHTML = `<p class="text-muted text-center" style="padding:16px 0;font-size:13px">¡Meta del día casi cubierta! 🎉<br>No quedan muchas calorías disponibles.</p>`;
      return;
    }

    const likedSet = new Set(prefs.liked);
    const remText = rec.remaining > 0 ? `${rec.remaining} kcal disponibles` : '¡Meta alcanzada!';
    const maxScore = rec.recommendations[0].score;

    panel.innerHTML = `
      <div class="rec-header">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="rec-meal-badge">${MEAL_LABELS[rec.mealType]}</span>
          <span style="font-size:11px;color:var(--text-muted)">${remText}</span>
        </div>
        <button class="btn-text-sm" id="btn-edit-prefs">✏️ Prefs</button>
      </div>
      <div class="rec-list">
        ${rec.recommendations.map(r => {
          const matchCount = r.ingredients.filter(i => likedSet.has(i)).length;
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
              <span class="rec-match-label">${matchCount} ingredientes favoritos</span>
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
        const total=DB.addWater(ml);
        toast(`+${ml}ml 💧`,'info');
        this.renderWater();
        if(this.view==='dashboard') this.renderDashboard();
      });
    });
    document.getElementById('btn-water-custom').addEventListener('click',()=>{
      const wrap=document.getElementById('water-custom-wrap');
      wrap.style.display=wrap.style.display==='none'?'block':'none';
    });
    document.getElementById('btn-water-add-custom').addEventListener('click',()=>{
      const ml=parseInt(document.getElementById('water-custom-input').value)||0;
      if(ml<10||ml>3000){toast('Cantidad inválida','error');return;}
      DB.addWater(ml); toast(`+${ml}ml 💧`,'info');
      document.getElementById('water-custom-input').value='';
      document.getElementById('water-custom-wrap').style.display='none';
      this.renderWater();
      if(this.view==='dashboard') this.renderDashboard();
    });
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

  renderProgress() {
    this.renderWellnessCard();
    this.renderExercise();
    this.renderWater();
    this.renderWeight();
    this.renderMicros();
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

    // Prediction
    const pred=calcPrediction();
    const predDiv=document.getElementById('weight-prediction');
    const predText=document.getElementById('weight-pred-text');
    if(pred){
      predDiv.style.display='block';
      const sign=pred.dailyDeficit>0?'déficit':'superávit';
      const kgDir=pred.kgPerWeek>0?'perder':'ganar';
      predText.innerHTML=`${sign} de <strong>${Math.abs(pred.dailyDeficit)}</strong> kcal/día → <strong>${Math.abs(pred.kgPerWeek)}</strong> kg/semana estimado` +
        (pred.weeksToGoal&&pred.weeksToGoal>0?`<br>Meta de <strong>${pred.goalKg}kg</strong> en aprox. <strong>${pred.weeksToGoal} semanas</strong>`:'');
    } else predDiv.style.display='none';
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
        <button class="btn-remove" data-ex-remove="${i}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`).join('');
    logEl.querySelectorAll('[data-ex-remove]').forEach(btn => btn.addEventListener('click', () => {
      DB.removeExercise(parseInt(btn.dataset.exRemove));
      this.renderExercise();
      this.renderDashboard();
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
      const itemsHtml   = slotEntries.map(e => `
        <div class="plan-item">
          <div class="plan-item-name">${esc(e.recipeName)}</div>
          <div class="plan-item-kcal">${e.kcal} kcal</div>
          <button class="btn-remove" data-plan-remove="${e.id}" style="margin-left:4px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>`).join('');
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
      btn.addEventListener('click', () => {
        DB.removePlanEntry(date, btn.dataset.planRemove);
        this.buildPlanDayTabs();
        this.renderWeekPlan();
        this.updatePlanBadge();
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
      const items = slotEntries.map(e => `
        <div class="prep-entry">
          <span class="prep-entry-name">${esc(e.recipeName)}</span>
          <span class="prep-entry-kcal">${e.kcal}</span>
          <button class="btn-remove" data-prep-del="${e.id}" data-prep-date="${date}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>`).join('');
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
      btn.addEventListener('click', () => {
        DB.removePlanEntry(btn.dataset.prepDate, btn.dataset.prepDel);
        CloudSync.schedulePush();
        this.renderPrepOverview();
        this.renderPrepDaySlots();
        this.updatePlanBadge();
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
      DB.addPlanEntry(date, { id: Date.now() + Math.random(), slot, recipeName: food.name, kcal: food.kcal, prot: food.prot, carbs: food.carbs, fat: food.fat, qty: food.qty, isRecipe: food.isRecipe||false });
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
