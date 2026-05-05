import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Modal, StatusBar, Animated,
} from "react-native";
import { logMeal, searchFoodsFromMongo, searchFoodsByFilter } from "../../services/nutritionService";

// ─── Constants ─────────────────────────────────────────────────────────────────
const USDA_API_KEY = "EEvdPZ0U1r3rWH9g5ElfGeYhassb8Y9XkJKFZlY2";

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_ICONS = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍎" };

const INDIAN_QUICK_SUGGESTIONS = [
  "Dal Makhani", "Roti", "Biryani", "Paneer", "Idli",
  "Samosa", "Rajma", "Chole", "Poha", "Butter Chicken",
];

const PIECE_OVERRIDES = {
  banana:        { unit: "piece", grams: 120 },
  apple:         { unit: "piece", grams: 180 },
  orange:        { unit: "piece", grams: 130 },
  egg:           { unit: "piece", grams: 50  },
  "egg white":   { unit: "piece", grams: 33  },
  roti:          { unit: "piece", grams: 40  },
  chapati:       { unit: "piece", grams: 40  },
  idli:          { unit: "piece", grams: 40  },
  dosa:          { unit: "piece", grams: 80  },
  paratha:       { unit: "piece", grams: 80  },
  naan:          { unit: "piece", grams: 90  },
  bread:         { unit: "piece", grams: 30  },
  samosa:        { unit: "piece", grams: 60  },
  guava:         { unit: "piece", grams: 150 },
  date:          { unit: "piece", grams: 25  },
  kachori:       { unit: "piece", grams: 60  },
  vada:          { unit: "piece", grams: 50  },
  ladoo:         { unit: "piece", grams: 40  },
  rasgulla:      { unit: "piece", grams: 60  },
  "gulab jamun": { unit: "piece", grams: 50  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const getServing = (foodName) => {
  const name = foodName.toLowerCase();
  for (const [key, serving] of Object.entries(PIECE_OVERRIDES)) {
    if (name.includes(key)) return serving;
  }
  return { unit: "g", grams: 100 };
};

function getMacroTagsFrontend(food) {
  const src = food.per100g || {};
  const tags = [];
  if ((src.protein ?? 0) >= 12) tags.push("high-protein");
  if ((src.carbs   ?? 0) >= 45) tags.push("high-carb");
  if ((src.fats    ?? 0) >= 15) tags.push("high-fat");
  if (
    tags.length === 0 &&
    (src.protein ?? 0) >= 6 &&
    (src.carbs   ?? 0) >= 20 &&
    (src.fats    ?? 0) >= 5
  ) tags.push("balanced");
  return tags;
}

const calcNutrients = (per100g, grams) => {
  const r = grams / 100;
  return {
    calories: Math.round(per100g.calories * r),
    protein:  (per100g.protein * r).toFixed(1),
    carbs:    (per100g.carbs   * r).toFixed(1),
    fats:     (per100g.fats    * r).toFixed(1),
    fiber:    ((per100g.fiber || 0) * r).toFixed(1),
    sugar:    ((per100g.sugar || 0) * r).toFixed(1),
    sodium:   Math.round((per100g.sodium || 0) * r),
  };
};

const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";

// ─── USDA Search ───────────────────────────────────────────────────────────────
const searchUSDA = async (query) => {
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=10&api_key=${USDA_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`USDA error: ${res.status}`);
  const data = await res.json();
  return (data.foods || []).map((food) => {
    const n = (id) => {
      const found = food.foodNutrients?.find((fn) => fn.nutrientId === id);
      return found ? parseFloat(found.value ?? 0) : 0;
    };
    const per100g = {
      calories: n(1008), protein: n(1003),
      carbs: n(1005), fats: n(1004),
      fiber: n(1079), sugar: n(2000), sodium: n(1093),
    };
    const foodName = food.description || "Unknown";
    return {
      id: String(food.fdcId),
      name: foodName,
      brand: food.brandOwner || food.brandName || "USDA",
      category: food.foodCategory || "",
      isIndian: false,
      serving: getServing(foodName),
      per100g,
      raw: {
        calories: Math.round(per100g.calories),
        protein:  parseFloat(per100g.protein.toFixed(1)),
        carbs:    parseFloat(per100g.carbs.toFixed(1)),
        fats:     parseFloat(per100g.fats.toFixed(1)),
        fiber:    parseFloat(per100g.fiber.toFixed(1)),
        sugar:    parseFloat(per100g.sugar.toFixed(1)),
        sodium:   Math.round(per100g.sodium),
      },
    };
  }).filter((f) => f.per100g.calories > 0);
};

// ─── Combined Search (MongoDB + USDA) ─────────────────────────────────────────
const searchAllFoods = async (query) => {
  let mongoResults = [];
  let usdaResults  = [];

  try {
    const raw = await searchFoodsFromMongo(query);
    mongoResults = (raw || []).map((f) => ({
      _id:      f._id,
      id:       String(f._id),
      name:     f.name,
      brand:    f.brand || f.category || "Indian DB",
      category: f.category || "",
      isIndian: true,
      serving:  f.serving || getServing(f.name),
      per100g:  f.per100g,
      tags:     f.tags || getMacroTagsFrontend(f),
      raw: {
        calories: Math.round(f.per100g?.calories || 0),
        protein:  parseFloat((f.per100g?.protein || 0).toFixed(1)),
        carbs:    parseFloat((f.per100g?.carbs   || 0).toFixed(1)),
        fats:     parseFloat((f.per100g?.fats    || 0).toFixed(1)),
        fiber:    parseFloat((f.per100g?.fiber   || 0).toFixed(1)),
        sugar:    parseFloat((f.per100g?.sugar   || 0).toFixed(1)),
        sodium:   Math.round(f.per100g?.sodium   || 0),
      },
    }));
  } catch (e) {
    console.warn("MongoDB search failed:", e.message);
  }

  try {
    usdaResults = await searchUSDA(query);
  } catch (e) {
    console.warn("USDA search failed:", e.message);
  }

  return [...mongoResults, ...usdaResults];
};

// ─── Toast Config ──────────────────────────────────────────────────────────────
const TOAST_CONFIGS = {
  success: {
    icon: "✅",
    accent: "#22C55E",
    bg: "#0D1F14",
    border: "rgba(34,197,94,0.35)",
    glow: "rgba(34,197,94,0.12)",
  },
  error: {
    icon: "❌",
    accent: "#EF4444",
    bg: "#1F0D0D",
    border: "rgba(239,68,68,0.35)",
    glow: "rgba(239,68,68,0.12)",
  },
  notfound: {
    icon: "🔍",
    accent: "#F59E0B",
    bg: "#1F1A0D",
    border: "rgba(245,158,11,0.35)",
    glow: "rgba(245,158,11,0.12)",
  },
  warning: {
    icon: "⚠️",
    accent: "#FF6F00",
    bg: "#1F1408",
    border: "rgba(255,111,0,0.35)",
    glow: "rgba(255,111,0,0.12)",
  },
};

// ─── Single Toast ──────────────────────────────────────────────────────────────
function Toast({ toast, onDismiss }) {
  const slideY   = useRef(new Animated.Value(-130)).current;
  const opacity  = useRef(new Animated.Value(0)).current;
  const scale    = useRef(new Animated.Value(0.9)).current;
  const progress = useRef(new Animated.Value(1)).current;
  const duration = toast.duration || 3500;
  const cfg      = TOAST_CONFIGS[toast.type] || TOAST_CONFIGS.error;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideY,  { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 220 }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(scale,   { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 200 }),
    ]).start();

    Animated.timing(progress, { toValue: 0, duration, useNativeDriver: false }).start();

    const timer = setTimeout(dismiss, duration);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(slideY,  { toValue: -140, duration: 260, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0,    duration: 200, useNativeDriver: true }),
      Animated.spring(scale,   { toValue: 0.88, useNativeDriver: true, damping: 20 }),
    ]).start(() => onDismiss(toast.id));
  };

  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <Animated.View
      style={[
        ts.toast,
        {
          backgroundColor: cfg.bg,
          borderColor: cfg.border,
          shadowColor: cfg.accent,
          transform: [{ translateY: slideY }, { scale }],
          opacity,
        },
      ]}
    >
      <View style={[ts.toastTopGlow, { backgroundColor: cfg.glow }]} />
      <View style={[ts.toastStripe, { backgroundColor: cfg.accent }]} />
      <View style={[ts.toastIconWrap, { backgroundColor: cfg.glow, borderColor: cfg.border }]}>
        <Text style={ts.toastIconTxt}>{cfg.icon}</Text>
      </View>
      <View style={ts.toastBody}>
        <Text style={[ts.toastTitle, { color: cfg.accent }]}>{toast.title}</Text>
        <Text style={ts.toastMsg} numberOfLines={2}>{toast.message}</Text>
      </View>
      <TouchableOpacity onPress={dismiss} style={ts.toastX} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={ts.toastXTxt}>✕</Text>
      </TouchableOpacity>
      <Animated.View style={[ts.toastBar, { width: barWidth, backgroundColor: cfg.accent }]} />
    </Animated.View>
  );
}

// ─── Toast Container ───────────────────────────────────────────────────────────
function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <View style={ts.container} pointerEvents="box-none">
      {toasts.map((t) => <Toast key={t.id} toast={t} onDismiss={onDismiss} />)}
    </View>
  );
}

// ─── useToast hook ─────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const show = useCallback(({ type = "success", title, message, duration = 3500 }) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev.slice(-1), { id, type, title, message, duration }]);
  }, []);
  const dismiss = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);
  return { toasts, show, dismiss };
}

// ─── Tag Pills ─────────────────────────────────────────────────────────────────
function TagPills({ tags }) {
  if (!tags || tags.length === 0) return null;
  const cfg = (tag) => {
    switch (tag) {
      case "high-protein": return { bg: "#E3F2FD", color: "#1565C0" };
      case "high-carb":    return { bg: "#F3E5F5", color: "#6A1B9A" };
      case "high-fat":     return { bg: "#FCE4EC", color: "#880E4F" };
      case "balanced":     return { bg: "#E8F5E9", color: "#2E7D32" };
      default:             return { bg: "#F5F5F5", color: "#666"    };
    }
  };
  return (
    <View style={s.tagRow}>
      {tags.map((tag) => {
        const c = cfg(tag);
        return (
          <View key={tag} style={[s.tagPill, { backgroundColor: c.bg }]}>
            <Text style={[s.tagPillTxt, { color: c.color }]}>
              {tag.replace("-", " ").toUpperCase()}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Food Card ─────────────────────────────────────────────────────────────────
function FoodCard({ item, onSelect }) {
  const isPieceItem = item.serving?.unit === "piece";
  const tags        = item.tags?.length > 0 ? item.tags : getMacroTagsFrontend(item);
  const accentColor = item.isIndian ? "#FF6F00" : item._id ? "#8E24AA" : "#1565C0";
  const iconBg      = item.isIndian ? "#FFF8E1" : item._id ? "#F3E5F5" : "#E3F2FD";
  const icon        = item.isIndian ? "🇮🇳" : item._id ? "🗂️" : "🌍";
  const cal  = Math.round(item.per100g?.calories || item.raw?.calories || 0);
  const prot = parseFloat((item.per100g?.protein || item.raw?.protein || 0)).toFixed(1);
  const carb = parseFloat((item.per100g?.carbs   || item.raw?.carbs   || 0)).toFixed(1);
  const fat  = parseFloat((item.per100g?.fats    || item.raw?.fats    || 0)).toFixed(1);

  return (
    <TouchableOpacity
      style={[s.foodCard, { borderLeftColor: accentColor }]}
      onPress={() => onSelect(item)}
      activeOpacity={0.75}
    >
      <View style={[s.foodIconBox, { backgroundColor: iconBg }]}>
        <Text style={s.foodIconTxt}>{icon}</Text>
      </View>
      <View style={s.foodInfo}>
        <View style={s.foodNameRow}>
          <Text style={s.foodName} numberOfLines={1}>{capitalize(item.name)}</Text>
          <View style={[s.servingBadge, { backgroundColor: isPieceItem ? "#E8F5E9" : "#F5F0FF" }]}>
            <Text style={[s.servingBadgeTxt, { color: isPieceItem ? "#2E7D32" : "#6A1B9A" }]}>
              {isPieceItem ? `${item.serving.grams}g/pc` : "per 100g"}
            </Text>
          </View>
        </View>
        <Text style={[s.foodBrand, { color: accentColor }]}>{item.brand || item.category || "DB"}</Text>
        <View style={s.macroRow}>
          <Text style={s.calPill}>🔥 {cal} kcal</Text>
          <Text style={s.macroPill}>P {prot}g</Text>
          <Text style={s.macroPill}>C {carb}g</Text>
          <Text style={s.macroPill}>F {fat}g</Text>
        </View>
        <TagPills tags={tags} />
      </View>
      <View style={s.addBtn}>
        <Text style={s.addBtnTxt}>+</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Piece Selector ────────────────────────────────────────────────────────────
function PieceSelector({ pieces, gramsPerPiece, onPiecesChange }) {
  const total = pieces * gramsPerPiece;
  return (
    <View>
      <Text style={s.qtyLabel}>
        Pieces{"  "}
        <Text style={s.qtyLabelSub}>1 piece = {gramsPerPiece}g</Text>
      </Text>
      <View style={s.qtyRow}>
        <TouchableOpacity style={s.qtyBtn} onPress={() => onPiecesChange(Math.max(1, pieces - 1))}>
          <Text style={s.qtyBtnTxt}>−</Text>
        </TouchableOpacity>
        <View style={s.qtyCenter}>
          <Text style={s.qtyNum}>{pieces}</Text>
          <Text style={s.qtyUnitTxt}>piece{pieces !== 1 ? "s" : ""}</Text>
        </View>
        <TouchableOpacity style={s.qtyBtn} onPress={() => onPiecesChange(pieces + 1)}>
          <Text style={s.qtyBtnTxt}>+</Text>
        </TouchableOpacity>
      </View>
      <View style={s.presetRow}>
        {[1,2,3,4,5].map((n) => (
          <TouchableOpacity
            key={n}
            style={[s.preset, pieces === n && s.presetOn]}
            onPress={() => onPiecesChange(n)}
          >
            <Text style={[s.presetTxt, pieces === n && s.presetTxtOn]}>{n}pc</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={s.totalRow}>
        <Text style={s.totalTxt}>{pieces} × {gramsPerPiece}g = </Text>
        <Text style={s.totalVal}>{total}g total</Text>
      </View>
    </View>
  );
}

// ─── Gram Selector ─────────────────────────────────────────────────────────────
function GramSelector({ quantity, onQuantityChange }) {
  return (
    <View>
      <Text style={s.qtyLabel}>Quantity</Text>
      <View style={s.qtyRow}>
        <TouchableOpacity
          style={s.qtyBtn}
          onPress={() => onQuantityChange(String(Math.max(1, Number(quantity) - 10)))}
        >
          <Text style={s.qtyBtnTxt}>−</Text>
        </TouchableOpacity>
        <View style={s.qtyCenter}>
          <TextInput
            style={s.qtyInput}
            keyboardType="numeric"
            value={quantity}
            onChangeText={(v) => onQuantityChange(v.replace(/[^0-9]/g, ""))}
          />
          <Text style={s.qtyUnitTxt}>grams</Text>
        </View>
        <TouchableOpacity
          style={s.qtyBtn}
          onPress={() => onQuantityChange(String(Number(quantity) + 10))}
        >
          <Text style={s.qtyBtnTxt}>+</Text>
        </TouchableOpacity>
      </View>
      <View style={s.presetRow}>
        {["50","100","150","200","250"].map((g) => (
          <TouchableOpacity
            key={g}
            style={[s.preset, quantity === g && s.presetOn]}
            onPress={() => onQuantityChange(g)}
          >
            <Text style={[s.presetTxt, quantity === g && s.presetTxtOn]}>{g}g</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function LogMealScreen({ route, navigation }) {
  const preSelectedMeal = route?.params?.mealType || "breakfast";

  // ✅ FIX 1: useToast is now actually called inside the component
  const { toasts, show: showToast, dismiss: dismissToast } = useToast();

  const [mealType,       setMealType]       = useState(preSelectedMeal);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [searchResults,  setSearchResults]  = useState([]);
  const [searching,      setSearching]      = useState(false);
  const [selectedFood,   setSelectedFood]   = useState(null);
  const [logging,        setLogging]        = useState(false);
  const [filterVisible,  setFilterVisible]  = useState(false);
  const [activeFilters,  setActiveFilters]  = useState({ dietType: null, tags: [] });
  const [filterResults,  setFilterResults]  = useState([]);
  const [filterLoading,  setFilterLoading]  = useState(false);
  const [gramQty,        setGramQty]        = useState("100");
  const [pieceQty,       setPieceQty]       = useState(1);

  const debounceRef = useRef(null);

  const TAG_OPTIONS  = ["high-protein", "high-carb", "high-fat", "balanced"];
  const DIET_OPTIONS = [
    { label: "All",        value: null       },
    { label: "Veg 🌿",    value: "veg"      },
    { label: "Non-Veg 🍗", value: "non-veg" },
  ];

  const isPiece       = selectedFood?.serving?.unit === "piece";
  const gramsPerPiece = selectedFood?.serving?.grams || 100;
  const totalGrams    = isPiece ? pieceQty * gramsPerPiece : Number(gramQty) || 0;
  const nutrients     = selectedFood ? calcNutrients(selectedFood.per100g, totalGrams) : null;
  const hasActiveFilters = activeFilters.tags.length > 0 || activeFilters.dietType;
  const displayList   = searchResults.length > 0 ? searchResults : filterResults;

  // ── Filter ──────────────────────────────────────────────────────────────────
  const applyFilters = async (filters) => {
    setActiveFilters(filters);
    setFilterVisible(false);
    if (!filters.tags.length && !filters.dietType) return;
    setFilterLoading(true);
    setSelectedFood(null);
    setSearchResults([]);
    try {
      const foods = await searchFoodsByFilter({
        tags: filters.tags,
        dietType: filters.dietType,
        match: "any",
      });
      setFilterResults(foods);
      // ✅ FIX 2: replaced Alert with toast
      if (foods.length === 0) {
        showToast({ type: "notfound", title: "No Results", message: "No foods match these filters." });
      }
    } catch {
      // ✅ FIX 3: replaced Alert with toast
      showToast({ type: "error", title: "Filter Error", message: "Filter search failed. Try again." });
    } finally {
      setFilterLoading(false);
    }
  };

  const clearFilters = () => {
    setActiveFilters({ dietType: null, tags: [] });
    setFilterResults([]);
  };

  // ── Search ──────────────────────────────────────────────────────────────────
  const runSearch = async (query) => {
    setSearching(true);
    setSelectedFood(null);
    setSearchResults([]);
    setFilterResults([]);
    try {
      const results = await searchAllFoods(query);
      setSearchResults(results);
      // ✅ FIX 4: replaced Alert with toast
      if (results.length === 0) {
        showToast({ type: "notfound", title: "Not Found", message: `No results for "${query}".` });
      }
    } catch {
      // ✅ FIX 5: replaced Alert with toast
      showToast({ type: "error", title: "Search Error", message: "Search failed. Check your connection." });
    } finally {
      setSearching(false);
    }
  };

  const handleQueryChange = (text) => {
    setSearchQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim() || text.length < 2) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(() => runSearch(text.trim()), 700);
  };

  const handleSearch = useCallback(() => {
    if (searchQuery.trim()) runSearch(searchQuery.trim());
  }, [searchQuery]);

  const handleSelectFood = (food) => {
    setSelectedFood(food);
    setSearchResults([]);
    setFilterResults([]);
    food.serving?.unit === "piece" ? setPieceQty(1) : setGramQty("100");
  };

  // ── Log Meal ────────────────────────────────────────────────────────────────
  const handleLogMeal = async () => {
    if (!selectedFood) {
      // ✅ FIX 6: replaced Alert with toast
      showToast({ type: "warning", title: "No Food Selected", message: "Please select a food first." });
      return;
    }
    if (totalGrams <= 0) {
      // ✅ FIX 7: replaced Alert with toast
      showToast({ type: "warning", title: "Invalid Quantity", message: "Enter a valid quantity to log." });
      return;
    }

    setLogging(true);
    try {
      const label = isPiece
        ? `${pieceQty} piece${pieceQty !== 1 ? "s" : ""} (${totalGrams}g)`
        : `${gramQty}g`;

      await logMeal({
        mealType,
        food: {
          name:     selectedFood.name,
          brand:    selectedFood.brand || "",
          quantity: totalGrams,
          unit:     "g",
          calories: nutrients.calories,
          protein:  Number(nutrients.protein),
          carbs:    Number(nutrients.carbs),
          fats:     Number(nutrients.fats),
          fiber:    Number(nutrients.fiber),
          sugar:    Number(nutrients.sugar),
          sodium:   nutrients.sodium,
        },
      });

      // ✅ FIX 8: replaced Alert with toast, then navigate back after short delay
      showToast({
        type: "success",
        title: "Logged! 🎉",
        message: `${capitalize(selectedFood.name)} (${label}) → ${nutrients.calories} kcal added to ${capitalize(mealType)}.`,
        duration: 2500,
      });

      // Reset state
      setSelectedFood(null);
      setSearchQuery("");
      setSearchResults([]);
      setGramQty("100");
      setPieceQty(1);

      // Navigate back after toast is visible
      setTimeout(() => navigation?.goBack?.(), 2600);
    } catch (e) {
      console.error(e);
      // ✅ FIX 9: replaced Alert with toast
      showToast({ type: "error", title: "Log Failed", message: "Failed to log meal. Please try again." });
    } finally {
      setLogging(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    // ✅ FIX 10: Wrapped in a View so ToastContainer can be rendered as a sibling overlay
    <View style={s.flex}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <StatusBar barStyle="light-content" backgroundColor="#1C1917" />

        <ScrollView
          style={s.flex}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero Header ── */}
          <View style={s.hero}>
            <View style={s.heroBgCircle} />
            <View style={s.heroBgCircle2} />

            <View style={s.topBar}>
              <TouchableOpacity style={s.backBtn} onPress={() => navigation?.goBack?.()}>
                <Text style={s.backArrow}>←</Text>
              </TouchableOpacity>
              <View style={s.mealBadge}>
                <Text style={s.mealBadgeIcon}>{MEAL_ICONS[mealType]}</Text>
                <Text style={s.mealBadgeTxt}>{capitalize(mealType)}</Text>
              </View>
            </View>

            <Text style={s.heroTitle}>Add Food</Text>
            <Text style={s.heroSub}>Indian DB · USDA · Full nutrition data</Text>

            <View style={s.searchBox}>
              <Text style={s.searchIconTxt}>🔍</Text>
              <TextInput
                style={s.searchInput}
                placeholder='Search "paneer", "roti", "egg"…'
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={handleQueryChange}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[s.filterBtn, hasActiveFilters && s.filterBtnActive]}
                onPress={() => setFilterVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 14 }}>⚙️</Text>
                {hasActiveFilters && <View style={s.filterDot} />}
              </TouchableOpacity>
              <TouchableOpacity
                style={s.goBtn}
                onPress={handleSearch}
                disabled={searching}
                activeOpacity={0.85}
              >
                {searching
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.goBtnTxt}>Go</Text>
                }
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Meal Type Tabs ── */}
          <View style={s.tabsWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.tabsContent}
            >
              {MEAL_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[s.tab, mealType === type && s.tabActive]}
                  onPress={() => setMealType(type)}
                  activeOpacity={0.8}
                >
                  <Text style={s.tabIcon}>{MEAL_ICONS[type]}</Text>
                  <Text style={[s.tabTxt, mealType === type && s.tabTxtActive]}>
                    {capitalize(type)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* ── Active Filter Chips ── */}
          {hasActiveFilters && (
            <View style={s.activeFilterRow}>
              {activeFilters.dietType && (
                <View style={s.activeChip}>
                  <Text style={s.activeChipTxt}>{activeFilters.dietType}</Text>
                </View>
              )}
              {activeFilters.tags.map((tag) => (
                <View key={tag} style={s.activeChip}>
                  <Text style={s.activeChipTxt}>#{tag}</Text>
                </View>
              ))}
              <TouchableOpacity onPress={clearFilters} style={s.clearChip}>
                <Text style={s.clearChipTxt}>✕ Clear</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Filter Loading ── */}
          {filterLoading && (
            <View style={s.loadingRow}>
              <ActivityIndicator color="#FF6F00" />
              <Text style={s.loadingTxt}>Filtering foods…</Text>
            </View>
          )}

          {/* ── Quick Suggestions ── */}
          {!selectedFood && displayList.length === 0 && !filterLoading && (
            <>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>🇮🇳 Popular Indian</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.chipsContent}
              >
                {INDIAN_QUICK_SUGGESTIONS.map((name) => (
                  <TouchableOpacity
                    key={name}
                    style={s.suggestionChip}
                    onPress={() => { setSearchQuery(name); runSearch(name); }}
                    activeOpacity={0.7}
                  >
                    <Text style={s.suggestionChipTxt}>{name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* ── Search Results ── */}
          {displayList.length > 0 && !selectedFood && (
            <>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>
                  {filterResults.length > 0 && searchResults.length === 0 ? "Filtered" : "Results"}
                </Text>
                <Text style={s.sectionCount}>{displayList.length} found</Text>
              </View>
              <View style={s.resultsList}>
                {displayList.map((item) => (
                  <FoodCard
                    key={item._id || item.id}
                    item={item}
                    onSelect={handleSelectFood}
                  />
                ))}
              </View>
            </>
          )}

          {/* ── Selected Food Card ── */}
          {selectedFood && (
            <View style={s.selectedCard}>
              <View style={s.selGlow} />

              <View style={s.selHeader}>
                <View style={[s.selIconBox, {
                  backgroundColor: selectedFood.isIndian
                    ? "rgba(255,248,225,0.1)"
                    : "rgba(227,242,253,0.1)",
                }]}>
                  <Text style={s.selIconTxt}>{selectedFood.isIndian ? "🇮🇳" : "🌍"}</Text>
                </View>
                <View style={s.selInfo}>
                  <Text style={s.selName} numberOfLines={2}>
                    {capitalize(selectedFood.name)}
                  </Text>
                  <Text style={s.selSub}>
                    {selectedFood.brand}{"  ·  "}{selectedFood.raw?.calories} kcal / 100g
                  </Text>
                </View>
                <TouchableOpacity
                  style={s.selClose}
                  onPress={() => { setSelectedFood(null); setSearchQuery(""); }}
                >
                  <Text style={s.selCloseTxt}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={s.selDivider} />

              {isPiece ? (
                <PieceSelector
                  pieces={pieceQty}
                  gramsPerPiece={gramsPerPiece}
                  onPiecesChange={setPieceQty}
                />
              ) : (
                <GramSelector quantity={gramQty} onQuantityChange={setGramQty} />
              )}

              {nutrients && totalGrams > 0 && (
                <>
                  <View style={s.selDivider} />
                  <Text style={s.nutriHeading}>
                    Nutrition for {isPiece
                      ? `${pieceQty} piece${pieceQty !== 1 ? "s" : ""} (${totalGrams}g)`
                      : `${gramQty}g`}
                  </Text>
                  <View style={s.nutriGrid}>
                    <View style={s.nutriBox}>
                      <Text style={[s.nutriVal, { color: "#FF9A3C" }]}>{nutrients.calories}</Text>
                      <Text style={s.nutriLabel}>🔥 kcal</Text>
                    </View>
                    <View style={s.nutriBox}>
                      <Text style={s.nutriVal}>{nutrients.protein}g</Text>
                      <Text style={s.nutriLabel}>💪 protein</Text>
                    </View>
                    <View style={s.nutriBox}>
                      <Text style={s.nutriVal}>{nutrients.carbs}g</Text>
                      <Text style={s.nutriLabel}>🌾 carbs</Text>
                    </View>
                    <View style={s.nutriBox}>
                      <Text style={s.nutriVal}>{nutrients.fats}g</Text>
                      <Text style={s.nutriLabel}>🥑 fats</Text>
                    </View>
                  </View>
                  <View style={s.extraRow}>
                    <View style={s.extraItem}>
                      <Text style={s.extraVal}>{nutrients.fiber}g</Text>
                      <Text style={s.extraLabel}>Fiber</Text>
                    </View>
                    <View style={s.extraDiv} />
                    <View style={s.extraItem}>
                      <Text style={s.extraVal}>{nutrients.sugar}g</Text>
                      <Text style={s.extraLabel}>Sugar</Text>
                    </View>
                    <View style={s.extraDiv} />
                    <View style={s.extraItem}>
                      <Text style={s.extraVal}>{nutrients.sodium}mg</Text>
                      <Text style={s.extraLabel}>Sodium</Text>
                    </View>
                  </View>
                </>
              )}

              <TouchableOpacity
                style={[s.logBtn, logging && s.logBtnDisabled]}
                onPress={handleLogMeal}
                disabled={logging}
                activeOpacity={0.85}
              >
                <Text style={s.logBtnTxt}>
                  {logging
                    ? "Logging…"
                    : `Add to ${capitalize(mealType)}  ·  ${nutrients?.calories || 0} kcal`}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Filter Modal ── */}
          <Modal
            visible={filterVisible}
            animationType="slide"
            transparent
            onRequestClose={() => setFilterVisible(false)}
          >
            <View style={s.filterOverlay}>
              <View style={s.filterSheet}>
                <View style={s.filterSheetBar} />
                <View style={s.filterSheetHeader}>
                  <Text style={s.filterSheetTitle}>Filter Foods</Text>
                  <TouchableOpacity
                    onPress={() => setFilterVisible(false)}
                    style={s.filterCloseBtn}
                  >
                    <Text style={s.filterCloseTxt}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={s.filterGroup}>Diet Type</Text>
                <View style={s.filterChipRow}>
                  {DIET_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={String(opt.value)}
                      style={[s.filterChip, activeFilters.dietType === opt.value && s.filterChipOn]}
                      onPress={() => setActiveFilters((f) => ({ ...f, dietType: opt.value }))}
                    >
                      <Text style={[s.filterChipTxt, activeFilters.dietType === opt.value && s.filterChipTxtOn]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={s.filterGroup}>Tags</Text>
                <View style={s.filterChipRow}>
                  {TAG_OPTIONS.map((tag) => {
                    const on = activeFilters.tags.includes(tag);
                    return (
                      <TouchableOpacity
                        key={tag}
                        style={[s.filterChip, on && s.filterChipOn]}
                        onPress={() => setActiveFilters((f) => ({
                          ...f,
                          tags: on ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
                        }))}
                      >
                        <Text style={[s.filterChipTxt, on && s.filterChipTxtOn]}>#{tag}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={s.filterApply}
                  onPress={() => applyFilters(activeFilters)}
                >
                  <Text style={s.filterApplyTxt}>Apply Filters</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ✅ FIX 11: ToastContainer is now actually rendered as an overlay */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </View>
  );
}

// ─── Toast Styles ──────────────────────────────────────────────────────────────
const ts = StyleSheet.create({
  container: {
    position: "absolute",
    top: Platform.OS === "ios" ? 58 : 18,
    left: 14, right: 14,
    zIndex: 9999,
    gap: 8,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 14,
  },
  toastTopGlow: {
    position: "absolute", top: 0, left: 0, right: 0, height: 52, opacity: 0.55,
  },
  toastStripe: {
    position: "absolute", left: 0, top: 0, bottom: 0, width: 3, borderRadius: 3,
  },
  toastIconWrap: {
    width: 42, height: 42, borderRadius: 13,
    alignItems: "center", justifyContent: "center", borderWidth: 1,
  },
  toastIconTxt: { fontSize: 19 },
  toastBody:    { flex: 1 },
  toastTitle:   { fontSize: 13, fontWeight: "800", letterSpacing: 0.15, marginBottom: 3 },
  toastMsg:     { fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 16 },
  toastX: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center", justifyContent: "center",
  },
  toastXTxt: { fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: "700" },
  toastBar: {
    position: "absolute", bottom: 0, left: 0, height: 2, borderRadius: 2, opacity: 0.55,
  },
});

// ─── Screen Styles ─────────────────────────────────────────────────────────────
const ORANGE = "#FF6F00";
const DARK   = "#1C1917";
const BG     = "#F5F3EF";

const s = StyleSheet.create({
  flex:   { flex: 1 },
  scroll: { backgroundColor: BG },

  hero: {
    backgroundColor: DARK,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 56 : 20,
    paddingBottom: 24,
    overflow: "hidden",
  },
  heroBgCircle: {
    position: "absolute", width: 220, height: 220, borderRadius: 110,
    backgroundColor: "rgba(255,111,0,0.1)", top: -60, right: -60,
  },
  heroBgCircle2: {
    position: "absolute", width: 110, height: 110, borderRadius: 55,
    backgroundColor: "rgba(255,111,0,0.06)", bottom: -30, left: 30,
  },
  topBar: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 20,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 0.5, borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center", justifyContent: "center",
  },
  backArrow:     { fontSize: 17, color: "#fff" },
  mealBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,111,0,0.18)",
    borderWidth: 0.5, borderColor: "rgba(255,111,0,0.4)",
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  mealBadgeIcon: { fontSize: 13 },
  mealBadgeTxt:  { fontSize: 12, fontWeight: "600", color: "#FF9A3C", letterSpacing: 0.3 },
  heroTitle:     { fontSize: 28, fontWeight: "700", color: "#fff", marginBottom: 4 },
  heroSub:       { fontSize: 13, color: "rgba(255,255,255,0.38)", marginBottom: 16 },
  searchBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 14,
    paddingHorizontal: 14, gap: 8, height: 52,
    borderWidth: 0.5, borderColor: "rgba(0,0,0,0.06)",
  },
  searchIconTxt: { fontSize: 16, color: "#bbb" },
  searchInput:   { flex: 1, fontSize: 14, color: "#1a1a1a" },
  filterBtn: {
    width: 34, height: 34, borderRadius: 9,
    backgroundColor: "#F5F3EF",
    alignItems: "center", justifyContent: "center",
  },
  filterBtnActive: { backgroundColor: "#FFF3E0" },
  filterDot: {
    position: "absolute", top: 6, right: 6,
    width: 6, height: 6, borderRadius: 3, backgroundColor: ORANGE,
  },
  goBtn: {
    backgroundColor: ORANGE, width: 50, height: 40,
    borderRadius: 10, alignItems: "center", justifyContent: "center",
  },
  goBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },

  tabsWrapper:  { backgroundColor: DARK, paddingBottom: 16 },
  tabsContent:  { paddingHorizontal: 20, gap: 8, flexDirection: "row" },
  tab: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  tabActive:    { backgroundColor: ORANGE, borderColor: ORANGE },
  tabIcon:      { fontSize: 14 },
  tabTxt:       { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.45)" },
  tabTxtActive: { color: "#fff" },

  activeFilterRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 6,
    paddingHorizontal: 20, paddingTop: 16,
  },
  activeChip:    { backgroundColor: "#FFF3E0", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  activeChipTxt: { fontSize: 11, fontWeight: "700", color: ORANGE },
  clearChip:     { backgroundColor: "#FCE4EC", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  clearChipTxt:  { fontSize: 11, fontWeight: "700", color: "#E53935" },

  loadingRow: { alignItems: "center", flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingTop: 16 },
  loadingTxt: { fontSize: 12, color: "#999" },

  sectionHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10,
  },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: "#888", textTransform: "uppercase", letterSpacing: 0.8 },
  sectionCount: { fontSize: 12, color: "#aaa" },

  chipsContent:      { paddingHorizontal: 20, gap: 8, flexDirection: "row", paddingBottom: 4 },
  suggestionChip: {
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#fff",
    borderRadius: 20, borderWidth: 1.5, borderColor: "#E5E2DC",
  },
  suggestionChipTxt: { fontSize: 13, fontWeight: "600", color: "#444" },

  resultsList: { paddingHorizontal: 20, gap: 10, paddingBottom: 4 },
  foodCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 16,
    borderWidth: 0.5, borderColor: "#E8E5DF",
    padding: 14, gap: 12, borderLeftWidth: 3,
  },
  foodIconBox:     { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  foodIconTxt:     { fontSize: 22 },
  foodInfo:        { flex: 1, minWidth: 0 },
  foodNameRow:     { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 },
  foodName:        { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  servingBadge:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  servingBadgeTxt: { fontSize: 9, fontWeight: "700" },
  foodBrand:       { fontSize: 11, fontWeight: "600", marginBottom: 5 },
  macroRow:        { flexDirection: "row", gap: 5, flexWrap: "wrap" },
  calPill:         { fontSize: 10, fontWeight: "700", color: ORANGE, backgroundColor: "#FFF3E0", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  macroPill:       { fontSize: 10, fontWeight: "600", color: "#666", backgroundColor: "#F5F5F5", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  tagRow:          { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 5 },
  tagPill:         { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  tagPillTxt:      { fontSize: 9, fontWeight: "700" },
  addBtn:          { width: 34, height: 34, borderRadius: 10, backgroundColor: ORANGE, alignItems: "center", justifyContent: "center" },
  addBtnTxt:       { fontSize: 20, color: "#fff", fontWeight: "300", lineHeight: 24 },

  selectedCard: {
    margin: 20, backgroundColor: DARK,
    borderRadius: 22, padding: 18, overflow: "hidden",
  },
  selGlow: {
    position: "absolute", top: -50, right: -50,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: "rgba(255,111,0,0.14)",
  },
  selHeader:   { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  selIconBox:  { width: 50, height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  selIconTxt:  { fontSize: 26 },
  selInfo:     { flex: 1 },
  selName:     { fontSize: 15, fontWeight: "700", color: "#fff", marginBottom: 3 },
  selSub:      { fontSize: 11, color: "rgba(255,255,255,0.38)" },
  selClose:    { width: 30, height: 30, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  selCloseTxt: { fontSize: 12, color: "rgba(255,255,255,0.5)" },
  selDivider:  { height: 0.5, backgroundColor: "rgba(255,255,255,0.1)", marginVertical: 14 },

  qtyLabel:    { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.4)", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 12 },
  qtyLabelSub: { fontWeight: "400", color: "rgba(255,255,255,0.25)", textTransform: "none" },
  qtyRow:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 12 },
  qtyBtn:      { width: 42, height: 42, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  qtyBtnTxt:   { fontSize: 22, color: "#fff", fontWeight: "300" },
  qtyCenter:   { alignItems: "center", minWidth: 90 },
  qtyNum:      { fontSize: 36, fontWeight: "700", color: "#FF9A3C", lineHeight: 40 },
  qtyInput:    { fontSize: 36, fontWeight: "700", color: "#FF9A3C", textAlign: "center", minWidth: 90 },
  qtyUnitTxt:  { fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 },
  presetRow:   { flexDirection: "row", gap: 6, marginBottom: 6 },
  preset:      { flex: 1, paddingVertical: 7, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.07)", alignItems: "center" },
  presetOn:    { backgroundColor: "rgba(255,111,0,0.22)" },
  presetTxt:   { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.38)" },
  presetTxtOn: { color: "#FF9A3C" },
  totalRow:    { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 6 },
  totalTxt:    { fontSize: 12, color: "rgba(255,255,255,0.35)" },
  totalVal:    { fontSize: 12, fontWeight: "700", color: ORANGE },

  nutriHeading: { fontSize: 10, fontWeight: "600", color: "rgba(255,255,255,0.3)", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 10 },
  nutriGrid:    { flexDirection: "row", gap: 6, marginBottom: 10 },
  nutriBox:     { flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 11, padding: 10, alignItems: "center" },
  nutriVal:     { fontSize: 15, fontWeight: "700", color: "#fff" },
  nutriLabel:   { fontSize: 9, color: "rgba(255,255,255,0.32)", marginTop: 3 },
  extraRow:     { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 11, padding: 12, justifyContent: "space-around", marginBottom: 16 },
  extraItem:    { alignItems: "center" },
  extraVal:     { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.7)" },
  extraLabel:   { fontSize: 10, color: "rgba(255,255,255,0.28)", marginTop: 2 },
  extraDiv:     { width: 0.5, backgroundColor: "rgba(255,255,255,0.1)" },

  logBtn: {
    backgroundColor: ORANGE, padding: 15, borderRadius: 14, alignItems: "center",
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
  },
  logBtnDisabled: { backgroundColor: "#CC5800", shadowOpacity: 0 },
  logBtnTxt:      { color: "#fff", fontWeight: "700", fontSize: 16, letterSpacing: 0.2 },

  filterOverlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  filterSheet:       { backgroundColor: "#fff", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 36 },
  filterSheetBar:    { width: 36, height: 4, borderRadius: 2, backgroundColor: "#E0E0E0", alignSelf: "center", marginBottom: 16 },
  filterSheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  filterSheetTitle:  { fontSize: 18, fontWeight: "700", color: "#1a1a1a" },
  filterCloseBtn:    { width: 28, height: 28, borderRadius: 14, backgroundColor: "#F5F5F5", alignItems: "center", justifyContent: "center" },
  filterCloseTxt:    { fontSize: 13, color: "#999" },
  filterGroup:       { fontSize: 11, fontWeight: "700", color: "#999", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },
  filterChipRow:     { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  filterChip:        { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: "#E0E0E0", backgroundColor: "#F9F9F9" },
  filterChipOn:      { backgroundColor: "#FFF3E0", borderColor: ORANGE },
  filterChipTxt:     { fontSize: 13, fontWeight: "600", color: "#888" },
  filterChipTxtOn:   { color: ORANGE },
  filterApply:       { backgroundColor: ORANGE, padding: 14, borderRadius: 14, alignItems: "center", marginTop: 4 },
  filterApplyTxt:    { color: "#fff", fontWeight: "700", fontSize: 15 },
});