// ─── Indian Food Database ──────────────────────────────────────────────────────
// All values are per 100g
// serving: { unit: "g"|"piece", grams: number }

const INDIAN_FOOD_DB = [
  // ── Breads & Rice ─────────────────────────────────────────────────────────────
  { id: "in_001", name: "Roti / Chapati",       serving: { unit: "piece", grams: 40  }, keywords: ["roti", "chapati", "chapatti", "phulka"],         calories: 297, protein: 8.9,  carbs: 55.0, fats: 3.7,  fiber: 3.9, sugar: 0.5, sodium: 3   },
  { id: "in_002", name: "Paratha (Plain)",       serving: { unit: "piece", grams: 80  }, keywords: ["paratha", "parantha"],                           calories: 326, protein: 8.0,  carbs: 48.0, fats: 11.0, fiber: 3.2, sugar: 0.8, sodium: 320 },
  { id: "in_003", name: "Paratha (Aloo)",        serving: { unit: "piece", grams: 120 }, keywords: ["aloo paratha", "potato paratha"],                calories: 280, protein: 6.5,  carbs: 42.0, fats: 9.0,  fiber: 2.8, sugar: 1.0, sodium: 280 },
  { id: "in_004", name: "Naan",                  serving: { unit: "piece", grams: 90  }, keywords: ["naan", "nan"],                                   calories: 317, protein: 9.0,  carbs: 55.0, fats: 7.0,  fiber: 2.0, sugar: 2.0, sodium: 520 },
  { id: "in_005", name: "Puri",                  serving: { unit: "piece", grams: 30  }, keywords: ["puri", "poori"],                                 calories: 340, protein: 7.5,  carbs: 46.0, fats: 14.0, fiber: 2.5, sugar: 0.5, sodium: 180 },
  { id: "in_006", name: "Basmati Rice (Cooked)", serving: { unit: "g",     grams: 100 }, keywords: ["basmati rice", "basmati", "cooked rice"],        calories: 130, protein: 2.7,  carbs: 28.0, fats: 0.3,  fiber: 0.4, sugar: 0.0, sodium: 1   },
  { id: "in_007", name: "White Rice (Cooked)",   serving: { unit: "g",     grams: 100 }, keywords: ["white rice", "rice", "chawal", "plain rice"],    calories: 130, protein: 2.4,  carbs: 28.0, fats: 0.2,  fiber: 0.3, sugar: 0.0, sodium: 1   },
  { id: "in_008", name: "Jeera Rice",            serving: { unit: "g",     grams: 100 }, keywords: ["jeera rice", "cumin rice"],                      calories: 148, protein: 2.8,  carbs: 29.0, fats: 2.5,  fiber: 0.5, sugar: 0.0, sodium: 180 },
  { id: "in_009", name: "Idli",                  serving: { unit: "piece", grams: 40  }, keywords: ["idli", "idly"],                                  calories: 58,  protein: 2.0,  carbs: 12.0, fats: 0.4,  fiber: 0.5, sugar: 0.5, sodium: 160 },
  { id: "in_010", name: "Dosa (Plain)",          serving: { unit: "piece", grams: 80  }, keywords: ["dosa", "dose", "plain dosa"],                    calories: 168, protein: 3.8,  carbs: 25.0, fats: 5.5,  fiber: 1.0, sugar: 0.5, sodium: 180 },
  { id: "in_011", name: "Masala Dosa",           serving: { unit: "piece", grams: 120 }, keywords: ["masala dosa"],                                   calories: 195, protein: 4.2,  carbs: 28.0, fats: 7.0,  fiber: 1.5, sugar: 1.0, sodium: 220 },
  { id: "in_012", name: "Uttapam",               serving: { unit: "piece", grams: 100 }, keywords: ["uttapam", "uttappa"],                            calories: 145, protein: 4.0,  carbs: 22.0, fats: 4.5,  fiber: 1.2, sugar: 1.0, sodium: 200 },
  { id: "in_013", name: "Upma",                  serving: { unit: "g",     grams: 100 }, keywords: ["upma"],                                          calories: 120, protein: 3.5,  carbs: 20.0, fats: 3.5,  fiber: 1.5, sugar: 0.5, sodium: 220 },
  { id: "in_014", name: "Poha",                  serving: { unit: "g",     grams: 100 }, keywords: ["poha", "pohe", "flattened rice"],                calories: 130, protein: 2.5,  carbs: 26.0, fats: 2.5,  fiber: 1.0, sugar: 1.0, sodium: 180 },

  // ── Dals & Legumes ────────────────────────────────────────────────────────────
  { id: "in_020", name: "Dal Makhani",           serving: { unit: "g",     grams: 100 }, keywords: ["dal makhani", "daal makhani"],                   calories: 135, protein: 6.5,  carbs: 14.0, fats: 6.0,  fiber: 3.5, sugar: 1.5, sodium: 380 },
  { id: "in_021", name: "Dal Tadka",             serving: { unit: "g",     grams: 100 }, keywords: ["dal tadka", "daal tadka", "tadka dal"],          calories: 95,  protein: 5.5,  carbs: 12.5, fats: 3.0,  fiber: 3.0, sugar: 1.0, sodium: 320 },
  { id: "in_022", name: "Dal Fry",               serving: { unit: "g",     grams: 100 }, keywords: ["dal fry", "daal fry"],                           calories: 102, protein: 6.0,  carbs: 13.0, fats: 3.5,  fiber: 3.2, sugar: 1.2, sodium: 340 },
  { id: "in_023", name: "Moong Dal",             serving: { unit: "g",     grams: 100 }, keywords: ["moong dal", "mung dal", "yellow dal"],           calories: 105, protein: 7.0,  carbs: 15.0, fats: 1.0,  fiber: 4.0, sugar: 1.5, sodium: 180 },
  { id: "in_024", name: "Chana Dal",             serving: { unit: "g",     grams: 100 }, keywords: ["chana dal", "split chickpea"],                   calories: 180, protein: 10.0, carbs: 30.0, fats: 2.5,  fiber: 8.0, sugar: 2.0, sodium: 12  },
  { id: "in_025", name: "Rajma Curry",           serving: { unit: "g",     grams: 100 }, keywords: ["rajma", "rajma curry", "kidney beans curry"],    calories: 120, protein: 6.5,  carbs: 16.0, fats: 3.5,  fiber: 5.5, sugar: 1.5, sodium: 320 },
  { id: "in_026", name: "Chole / Chana Masala",  serving: { unit: "g",     grams: 100 }, keywords: ["chole", "chana masala", "chickpea curry"],       calories: 140, protein: 7.0,  carbs: 18.0, fats: 4.5,  fiber: 6.0, sugar: 2.0, sodium: 380 },
  { id: "in_027", name: "Sambar",                serving: { unit: "g",     grams: 100 }, keywords: ["sambar"],                                        calories: 55,  protein: 2.5,  carbs: 8.5,  fats: 1.5,  fiber: 2.0, sugar: 2.5, sodium: 280 },
  { id: "in_028", name: "Masoor Dal",            serving: { unit: "g",     grams: 100 }, keywords: ["masoor dal", "red lentil dal"],                  calories: 100, protein: 6.5,  carbs: 14.0, fats: 1.5,  fiber: 3.5, sugar: 1.0, sodium: 200 },

  // ── Paneer & Dairy ────────────────────────────────────────────────────────────
  { id: "in_030", name: "Paneer (Raw)",          serving: { unit: "g",     grams: 100 }, keywords: ["paneer", "cottage cheese indian"],               calories: 265, protein: 18.3, carbs: 3.0,  fats: 20.8, fiber: 0.0, sugar: 2.5, sodium: 30  },
  { id: "in_031", name: "Paneer Butter Masala",  serving: { unit: "g",     grams: 100 }, keywords: ["paneer butter masala", "butter paneer"],         calories: 198, protein: 9.0,  carbs: 8.5,  fats: 15.0, fiber: 1.5, sugar: 4.0, sodium: 480 },
  { id: "in_032", name: "Palak Paneer",          serving: { unit: "g",     grams: 100 }, keywords: ["palak paneer", "spinach paneer"],                calories: 165, protein: 8.5,  carbs: 6.0,  fats: 12.0, fiber: 2.0, sugar: 2.0, sodium: 380 },
  { id: "in_033", name: "Paneer Tikka",          serving: { unit: "g",     grams: 100 }, keywords: ["paneer tikka"],                                  calories: 210, protein: 12.0, carbs: 5.0,  fats: 15.5, fiber: 1.0, sugar: 2.5, sodium: 420 },
  { id: "in_034", name: "Shahi Paneer",          serving: { unit: "g",     grams: 100 }, keywords: ["shahi paneer"],                                  calories: 230, protein: 10.0, carbs: 9.0,  fats: 18.0, fiber: 1.0, sugar: 4.5, sodium: 450 },
  { id: "in_035", name: "Dahi / Curd",           serving: { unit: "g",     grams: 100 }, keywords: ["dahi", "curd", "yogurt indian"],                 calories: 60,  protein: 3.5,  carbs: 4.5,  fats: 3.0,  fiber: 0.0, sugar: 4.0, sodium: 46  },
  { id: "in_036", name: "Lassi (Sweet)",         serving: { unit: "g",     grams: 100 }, keywords: ["lassi", "sweet lassi"],                          calories: 98,  protein: 3.8,  carbs: 15.0, fats: 3.0,  fiber: 0.0, sugar: 14.0,sodium: 52  },
  { id: "in_037", name: "Raita",                 serving: { unit: "g",     grams: 100 }, keywords: ["raita"],                                         calories: 52,  protein: 2.8,  carbs: 5.5,  fats: 2.0,  fiber: 0.5, sugar: 4.5, sodium: 180 },

  // ── Chicken & Meat ────────────────────────────────────────────────────────────
  { id: "in_040", name: "Chicken Curry",         serving: { unit: "g",     grams: 100 }, keywords: ["chicken curry"],                                 calories: 175, protein: 18.0, carbs: 5.0,  fats: 9.5,  fiber: 1.0, sugar: 2.0, sodium: 450 },
  { id: "in_041", name: "Butter Chicken",        serving: { unit: "g",     grams: 100 }, keywords: ["butter chicken", "murgh makhani"],               calories: 190, protein: 16.0, carbs: 7.0,  fats: 11.5, fiber: 1.5, sugar: 4.5, sodium: 480 },
  { id: "in_042", name: "Chicken Tikka Masala",  serving: { unit: "g",     grams: 100 }, keywords: ["chicken tikka masala", "chicken tikka"],         calories: 185, protein: 17.5, carbs: 8.0,  fats: 10.0, fiber: 1.5, sugar: 4.0, sodium: 500 },
  { id: "in_043", name: "Tandoori Chicken",      serving: { unit: "g",     grams: 100 }, keywords: ["tandoori chicken"],                              calories: 168, protein: 22.0, carbs: 3.5,  fats: 7.5,  fiber: 0.5, sugar: 1.5, sodium: 520 },
  { id: "in_044", name: "Chicken Biryani",       serving: { unit: "g",     grams: 100 }, keywords: ["chicken biryani"],                               calories: 200, protein: 12.0, carbs: 25.0, fats: 6.0,  fiber: 1.5, sugar: 1.0, sodium: 480 },
  { id: "in_045", name: "Mutton Curry",          serving: { unit: "g",     grams: 100 }, keywords: ["mutton curry", "lamb curry"],                    calories: 218, protein: 20.0, carbs: 5.0,  fats: 13.0, fiber: 1.0, sugar: 2.0, sodium: 520 },
  { id: "in_046", name: "Egg Curry",             serving: { unit: "g",     grams: 100 }, keywords: ["egg curry", "anda curry"],                       calories: 148, protein: 10.0, carbs: 5.5,  fats: 10.0, fiber: 1.0, sugar: 2.5, sodium: 420 },
  { id: "in_047", name: "Keema (Minced Meat)",   serving: { unit: "g",     grams: 100 }, keywords: ["keema", "kheema", "minced meat"],                calories: 220, protein: 22.0, carbs: 4.0,  fats: 13.0, fiber: 1.0, sugar: 2.0, sodium: 480 },

  // ── Biryani & Rice Dishes ─────────────────────────────────────────────────────
  { id: "in_050", name: "Veg Biryani",           serving: { unit: "g",     grams: 100 }, keywords: ["veg biryani", "vegetable biryani"],              calories: 165, protein: 4.5,  carbs: 28.0, fats: 4.5,  fiber: 2.5, sugar: 1.5, sodium: 420 },
  { id: "in_051", name: "Mutton Biryani",        serving: { unit: "g",     grams: 100 }, keywords: ["mutton biryani"],                                calories: 220, protein: 14.0, carbs: 25.0, fats: 8.0,  fiber: 1.5, sugar: 1.0, sodium: 500 },
  { id: "in_052", name: "Egg Biryani",           serving: { unit: "g",     grams: 100 }, keywords: ["egg biryani"],                                   calories: 185, protein: 8.0,  carbs: 26.0, fats: 6.0,  fiber: 1.5, sugar: 1.0, sodium: 460 },
  { id: "in_053", name: "Pulao",                 serving: { unit: "g",     grams: 100 }, keywords: ["pulao", "pilaf"],                                calories: 155, protein: 3.5,  carbs: 28.0, fats: 3.5,  fiber: 1.5, sugar: 1.0, sodium: 380 },
  { id: "in_054", name: "Khichdi",               serving: { unit: "g",     grams: 100 }, keywords: ["khichdi", "khichri"],                            calories: 118, protein: 4.5,  carbs: 20.0, fats: 2.5,  fiber: 2.0, sugar: 0.5, sodium: 220 },

  // ── Snacks & Street Food ──────────────────────────────────────────────────────
  { id: "in_060", name: "Samosa",                serving: { unit: "piece", grams: 60  }, keywords: ["samosa"],                                        calories: 262, protein: 5.0,  carbs: 32.0, fats: 13.0, fiber: 3.0, sugar: 1.5, sodium: 420 },
  { id: "in_061", name: "Pakora / Bhajiya",      serving: { unit: "g",     grams: 100 }, keywords: ["pakora", "bhajiya", "pakoda"],                   calories: 285, protein: 6.5,  carbs: 30.0, fats: 15.5, fiber: 2.5, sugar: 1.0, sodium: 380 },
  { id: "in_062", name: "Vada Pav",              serving: { unit: "piece", grams: 150 }, keywords: ["vada pav", "vada pao"],                          calories: 290, protein: 7.0,  carbs: 42.0, fats: 10.5, fiber: 2.5, sugar: 2.0, sodium: 480 },
  { id: "in_063", name: "Pav Bhaji",             serving: { unit: "g",     grams: 100 }, keywords: ["pav bhaji"],                                     calories: 195, protein: 5.5,  carbs: 30.0, fats: 6.5,  fiber: 4.0, sugar: 3.5, sodium: 520 },
  { id: "in_064", name: "Dhokla",                serving: { unit: "piece", grams: 50  }, keywords: ["dhokla"],                                        calories: 160, protein: 5.5,  carbs: 25.0, fats: 4.5,  fiber: 1.5, sugar: 3.0, sodium: 380 },
  { id: "in_065", name: "Chaat",                 serving: { unit: "g",     grams: 100 }, keywords: ["chaat", "bhel puri", "pani puri", "golgappa"],   calories: 185, protein: 4.5,  carbs: 30.0, fats: 5.5,  fiber: 3.5, sugar: 5.0, sodium: 480 },
  { id: "in_066", name: "Kachori",               serving: { unit: "piece", grams: 60  }, keywords: ["kachori"],                                       calories: 310, protein: 6.0,  carbs: 38.0, fats: 15.0, fiber: 3.0, sugar: 1.0, sodium: 350 },
  { id: "in_067", name: "Medu Vada",             serving: { unit: "piece", grams: 50  }, keywords: ["medu vada", "vada", "wada"],                     calories: 215, protein: 7.5,  carbs: 25.0, fats: 10.0, fiber: 2.5, sugar: 0.5, sodium: 320 },

  // ── Vegetables & Sabzi ────────────────────────────────────────────────────────
  { id: "in_070", name: "Aloo Gobi",             serving: { unit: "g",     grams: 100 }, keywords: ["aloo gobi", "potato cauliflower"],               calories: 95,  protein: 3.0,  carbs: 14.0, fats: 3.5,  fiber: 3.5, sugar: 3.0, sodium: 280 },
  { id: "in_071", name: "Aloo Matar",            serving: { unit: "g",     grams: 100 }, keywords: ["aloo matar", "potato peas"],                     calories: 105, protein: 3.5,  carbs: 16.5, fats: 3.5,  fiber: 3.0, sugar: 2.5, sodium: 300 },
  { id: "in_072", name: "Bhindi Masala",         serving: { unit: "g",     grams: 100 }, keywords: ["bhindi", "okra masala", "bhindi masala"],        calories: 90,  protein: 2.5,  carbs: 10.5, fats: 4.5,  fiber: 3.5, sugar: 2.5, sodium: 280 },
  { id: "in_073", name: "Baingan Bharta",        serving: { unit: "g",     grams: 100 }, keywords: ["baingan bharta", "brinjal", "eggplant"],         calories: 85,  protein: 2.5,  carbs: 9.0,  fats: 4.5,  fiber: 3.0, sugar: 4.5, sodium: 320 },
  { id: "in_074", name: "Matar Paneer",          serving: { unit: "g",     grams: 100 }, keywords: ["matar paneer", "peas paneer"],                   calories: 175, protein: 9.0,  carbs: 10.0, fats: 11.5, fiber: 2.5, sugar: 3.0, sodium: 380 },
  { id: "in_075", name: "Saag / Palak",          serving: { unit: "g",     grams: 100 }, keywords: ["saag", "palak", "spinach sabzi"],                calories: 65,  protein: 3.5,  carbs: 6.5,  fats: 3.0,  fiber: 3.0, sugar: 1.5, sodium: 260 },
  { id: "in_076", name: "Mixed Veg Curry",       serving: { unit: "g",     grams: 100 }, keywords: ["mixed veg", "mixed vegetable curry"],            calories: 88,  protein: 2.5,  carbs: 11.0, fats: 4.0,  fiber: 3.0, sugar: 3.5, sodium: 300 },

  // ── Sweets & Desserts ─────────────────────────────────────────────────────────
  { id: "in_080", name: "Kheer",                 serving: { unit: "g",     grams: 100 }, keywords: ["kheer", "rice pudding"],                         calories: 150, protein: 4.0,  carbs: 25.0, fats: 4.5,  fiber: 0.2, sugar: 18.0,sodium: 52  },
  { id: "in_081", name: "Gulab Jamun",           serving: { unit: "piece", grams: 50  }, keywords: ["gulab jamun"],                                   calories: 380, protein: 5.5,  carbs: 55.0, fats: 15.0, fiber: 0.5, sugar: 40.0,sodium: 80  },
  { id: "in_082", name: "Jalebi",                serving: { unit: "g",     grams: 100 }, keywords: ["jalebi"],                                        calories: 380, protein: 2.5,  carbs: 68.0, fats: 11.0, fiber: 0.3, sugar: 50.0,sodium: 10  },
  { id: "in_083", name: "Halwa (Suji)",          serving: { unit: "g",     grams: 100 }, keywords: ["halwa", "suji halwa", "semolina halwa"],         calories: 220, protein: 3.5,  carbs: 35.0, fats: 8.0,  fiber: 0.8, sugar: 20.0,sodium: 80  },
  { id: "in_084", name: "Rasgulla",              serving: { unit: "piece", grams: 60  }, keywords: ["rasgulla", "rossogolla"],                        calories: 186, protein: 5.0,  carbs: 37.0, fats: 2.5,  fiber: 0.0, sugar: 30.0,sodium: 30  },
  { id: "in_085", name: "Ladoo (Besan)",         serving: { unit: "piece", grams: 40  }, keywords: ["ladoo", "laddoo", "besan ladoo"],                calories: 456, protein: 9.0,  carbs: 60.0, fats: 22.0, fiber: 2.5, sugar: 35.0,sodium: 60  },

  // ── Breakfast ─────────────────────────────────────────────────────────────────
  { id: "in_090", name: "Aloo Paratha",          serving: { unit: "piece", grams: 120 }, keywords: ["aloo paratha"],                                  calories: 280, protein: 6.5,  carbs: 42.0, fats: 9.0,  fiber: 2.8, sugar: 1.0, sodium: 280 },
  { id: "in_091", name: "Besan Chilla",          serving: { unit: "piece", grams: 80  }, keywords: ["besan chilla", "chilla"],                        calories: 180, protein: 9.0,  carbs: 22.0, fats: 6.0,  fiber: 4.0, sugar: 2.0, sodium: 280 },
  { id: "in_092", name: "Pesarattu",             serving: { unit: "piece", grams: 80  }, keywords: ["pesarattu", "green moong dosa"],                 calories: 155, protein: 8.5,  carbs: 22.0, fats: 4.0,  fiber: 3.5, sugar: 1.0, sodium: 200 },
  { id: "in_093", name: "Rava Idli",             serving: { unit: "piece", grams: 40  }, keywords: ["rava idli"],                                     calories: 102, protein: 3.5,  carbs: 17.0, fats: 2.5,  fiber: 1.0, sugar: 1.0, sodium: 220 },

  // ── Soups & Drinks ────────────────────────────────────────────────────────────
  { id: "in_095", name: "Masala Chai",           serving: { unit: "g",     grams: 200 }, keywords: ["chai", "masala chai", "tea"],                    calories: 45,  protein: 1.5,  carbs: 6.5,  fats: 1.5,  fiber: 0.0, sugar: 5.5, sodium: 20  },
  { id: "in_096", name: "Nimbu Pani",            serving: { unit: "g",     grams: 250 }, keywords: ["nimbu pani", "lemonade", "lemon water"],         calories: 25,  protein: 0.2,  carbs: 6.5,  fats: 0.0,  fiber: 0.0, sugar: 5.5, sodium: 5   },
  { id: "in_097", name: "Buttermilk / Chaas",    serving: { unit: "g",     grams: 200 }, keywords: ["chaas", "buttermilk", "chhas"],                  calories: 35,  protein: 1.8,  carbs: 3.5,  fats: 1.5,  fiber: 0.0, sugar: 3.0, sodium: 80  },
  { id: "in_098", name: "Mango Lassi",           serving: { unit: "g",     grams: 250 }, keywords: ["mango lassi"],                                   calories: 120, protein: 3.5,  carbs: 20.0, fats: 3.0,  fiber: 0.5, sugar: 18.0,sodium: 48  },
];

// ─── Piece-based foods lookup (for O(1) access) ───────────────────────────────
const PIECE_FOODS = new Set([
  "in_001","in_002","in_003","in_004","in_005",  // breads
  "in_009","in_010","in_011","in_012",            // idli/dosa
  "in_060","in_062","in_064","in_066","in_067",  // snacks
  "in_081","in_084","in_085",                    // sweets
  "in_090","in_091","in_092","in_093",            // breakfast
]);

export const searchIndianFoods = (query) => {
  const q = query.toLowerCase().trim();
  const results = [];

  for (const food of INDIAN_FOOD_DB) {
    let score = 0;

    if (food.name.toLowerCase() === q)               score += 100;
    else if (food.name.toLowerCase().startsWith(q))  score += 80;
    else if (food.name.toLowerCase().includes(q))    score += 60;

    for (const kw of food.keywords) {
      if (kw === q)             score += 90;
      else if (kw.startsWith(q)) score += 70;
      else if (kw.includes(q))   score += 50;
      else if (q.includes(kw))   score += 40;
    }

    if (score > 0) results.push({ ...food, score });
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ score, ...food }) => ({
      id:       food.id,
      name:     food.name,
      brand:    "🇮🇳 Indian Food DB",
      category: "Indian",
      isIndian: true,
      serving:  food.serving,           // ← pass through serving info
      per100g: {
        calories: food.calories,
        protein:  food.protein,
        carbs:    food.carbs,
        fats:     food.fats,
        fiber:    food.fiber,
        sugar:    food.sugar,
        sodium:   food.sodium,
      },
      raw: {
        calories: food.calories,
        protein:  food.protein,
        carbs:    food.carbs,
        fats:     food.fats,
        fiber:    food.fiber,
        sugar:    food.sugar,
        sodium:   food.sodium,
      },
    }));
};

export default INDIAN_FOOD_DB;