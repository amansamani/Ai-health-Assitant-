import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Modal
} from "react-native";
import { logMeal } from "../../services/nutritionService";
import { searchIndianFoods } from "../../data/indianFoodDB";
import { searchFoodsByFilter } from "../../services/nutritionService";

const USDA_API_KEY = "EEvdPZ0U1r3rWH9g5ElfGeYhassb8Y9XkJKFZlY2";

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snacks"];
const MEAL_ICONS = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snacks: "🍎" };
const INDIAN_QUICK_SUGGESTIONS = [
  "Dal Makhani", "Roti", "Biryani", "Paneer", "Idli",
  "Samosa", "Rajma", "Chole", "Poha", "Butter Chicken",
];

// ─── Piece-based overrides for common USDA foods ──────────────────────────────
const PIECE_OVERRIDES = {
  banana:      { unit: "piece", grams: 120 },
  apple:       { unit: "piece", grams: 180 },
  orange:      { unit: "piece", grams: 130 },
  egg:         { unit: "piece", grams: 50  },
  "egg white": { unit: "piece", grams: 33  },
  roti:        { unit: "piece", grams: 40  },
  chapati:     { unit: "piece", grams: 40  },
  idli:        { unit: "piece", grams: 40  },
  dosa:        { unit: "piece", grams: 80  },
  paratha:     { unit: "piece", grams: 80  },
  naan:        { unit: "piece", grams: 90  },
  bread:       { unit: "piece", grams: 30  },
  samosa:      { unit: "piece", grams: 60  },
  guava:       { unit: "piece", grams: 150 },
  date:        { unit: "piece", grams: 25  },
  kachori:     { unit: "piece", grams: 60  },
  vada:        { unit: "piece", grams: 50  },
  ladoo:       { unit: "piece", grams: 40  },
  rasgulla:    { unit: "piece", grams: 60  },
  "gulab jamun": { unit: "piece", grams: 50 },
};

const getServing = (foodName) => {
  const name = foodName.toLowerCase();
  for (const [key, serving] of Object.entries(PIECE_OVERRIDES)) {
    if (name.includes(key)) return serving;
  }
  return { unit: "g", grams: 100 };
};

// ─── USDA API ──────────────────────────────────────────────────────────────────
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
      carbs:    n(1005), fats:    n(1004),
      fiber:    n(1079), sugar:   n(2000), sodium: n(1093),
    };
    const foodName = food.description || "Unknown";
    return {
      id:       String(food.fdcId),
      name:     foodName,
      brand:    food.brandOwner || food.brandName || "USDA",
      category: food.foodCategory || "",
      isIndian: false,
      serving:  getServing(foodName),
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

// ─── Combined Search ───────────────────────────────────────────────────────────
const searchAllFoods = async (query) => {
  const indianResults = searchIndianFoods(query);
  let usdaResults = [];
  try {
    usdaResults = await searchUSDA(query);
  } catch (e) {
    console.warn("USDA search failed:", e.message);
  }
  const indianNames  = new Set(indianResults.map((f) => f.name.toLowerCase()));
  const filteredUSDA = usdaResults.filter((f) => !indianNames.has(f.name.toLowerCase()));
  return [...indianResults, ...filteredUSDA];
};

// ─── Nutrition calculator — always works in grams internally ──────────────────
const calcNutrients = (per100g, grams) => {
  const r = grams / 100;
  return {
    calories: Math.round(per100g.calories * r),
    protein:  (per100g.protein * r).toFixed(1),
    carbs:    (per100g.carbs   * r).toFixed(1),
    fats:     (per100g.fats    * r).toFixed(1),
    fiber:    (per100g.fiber   * r).toFixed(1),
    sugar:    (per100g.sugar   * r).toFixed(1),
    sodium:   Math.round(per100g.sodium * r),
  };
};

const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";

// ─── Piece Selector Component ─────────────────────────────────────────────────
function PieceSelector({ pieces, gramsPerPiece, onPiecesChange }) {
  const totalGrams = pieces * gramsPerPiece;
  return (
    <View>
      <Text style={styles.quantityHeading}>
        How many pieces?
        <Text style={{ color: "#888", fontWeight: "500" }}>
          {"  "}(1 piece = {gramsPerPiece}g)
        </Text>
      </Text>

      {/* +/- row */}
      <View style={styles.quantityRow}>
        <TouchableOpacity
          style={styles.qtyBtn}
          onPress={() => onPiecesChange(Math.max(1, pieces - 1))}
        >
          <Text style={styles.qtyBtnText}>−</Text>
        </TouchableOpacity>

        <View style={styles.pieceDisplay}>
          <Text style={styles.pieceCount}>{pieces}</Text>
          <Text style={styles.pieceLabel}>piece{pieces !== 1 ? "s" : ""}</Text>
        </View>

        <TouchableOpacity
          style={styles.qtyBtn}
          onPress={() => onPiecesChange(pieces + 1)}
        >
          <Text style={styles.qtyBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Quick presets */}
      <View style={styles.presets}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.presetBtn, pieces === n && styles.activePreset]}
            onPress={() => onPiecesChange(n)}
          >
            <Text style={[styles.presetText, pieces === n && styles.activePresetText]}>
              {n}pc
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Total grams indicator */}
      <View style={styles.gramsIndicator}>
        <Text style={styles.gramsIndicatorText}>
          {pieces} × {gramsPerPiece}g = <Text style={{ color: "#FF6F00", fontWeight: "800" }}>{totalGrams}g total</Text>
        </Text>
      </View>
    </View>
  );
}

// ─── Gram Selector Component ──────────────────────────────────────────────────
function GramSelector({ quantity, onQuantityChange }) {
  return (
    <View>
      <Text style={styles.quantityHeading}>Adjust Quantity (grams)</Text>
      <View style={styles.quantityRow}>
        <TouchableOpacity
          style={styles.qtyBtn}
          onPress={() => onQuantityChange(String(Math.max(1, Number(quantity) - 10)))}
        >
          <Text style={styles.qtyBtnText}>−</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.quantityInput}
          keyboardType="numeric"
          value={quantity}
          onChangeText={(v) => onQuantityChange(v.replace(/[^0-9]/g, ""))}
        />
        <Text style={styles.quantityUnit}>g</Text>

        <TouchableOpacity
          style={styles.qtyBtn}
          onPress={() => onQuantityChange(String(Number(quantity) + 10))}
        >
          <Text style={styles.qtyBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.presets}>
        {["50", "100", "150", "200", "250"].map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.presetBtn, quantity === g && styles.activePreset]}
            onPress={() => onQuantityChange(g)}
          >
            <Text style={[styles.presetText, quantity === g && styles.activePresetText]}>
              {g}g
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function LogMealScreen({ route }) {
  const preSelectedMeal = route?.params?.mealType || "breakfast";

  const [mealType, setMealType]         = useState(preSelectedMeal);
  const [searchQuery, setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]       = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [logging, setLogging]           = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState({ dietType: null, tags: [] });
  const [filterResults, setFilterResults] = useState([]);
  const [filterLoading, setFilterLoading] = useState(false);



  const TAG_OPTIONS   = ["high-protein", "low-carb", "gym", "weight-loss", "vegan", "quick"];
const DIET_OPTIONS  = [{ label: "All",     value: null   },
                       { label: "Veg 🌿",  value: "veg"  },
                       { label: "Non-Veg 🍗", value: "non-veg" }];

  const applyFilters = async (filters) => {
  setActiveFilters(filters);
  setFilterVisible(false);
  if (!filters.tags.length && !filters.dietType) return;   // nothing active
  setFilterLoading(true);
  setSelectedFood(null);
  setSearchResults([]);
  try {
    const foods = await searchFoodsByFilter({
      tags:     filters.tags,
      dietType: filters.dietType,
      match:    "any",
    });
    setFilterResults(foods);
    if (foods.length === 0)
      Alert.alert("No Results", "No foods match these filters.");
  } catch {
    Alert.alert("Error", "Filter search failed.");
  } finally {
    setFilterLoading(false);
  }
};

const clearFilters = () => {
  setActiveFilters({ dietType: null, tags: [] });
  setFilterResults([]);
};

const hasActiveFilters = activeFilters.tags.length > 0 || activeFilters.dietType;
  // ── Quantity state — grams (string) for gram-based, number for piece-based ──
  const [gramQty, setGramQty]   = useState("100");
  const [pieceQty, setPieceQty] = useState(1);

  const debounceRef = useRef(null);

  // ── Derived: is this food piece-based? ──────────────────────────────────────
  const isPiece      = selectedFood?.serving?.unit === "piece";
  const gramsPerPiece = selectedFood?.serving?.grams || 100;

  // ── Total grams used for nutrition calculation ───────────────────────────────
  const totalGrams = isPiece
    ? pieceQty * gramsPerPiece
    : Number(gramQty) || 0;

  const nutrients = selectedFood
    ? calcNutrients(selectedFood.per100g, totalGrams)
    : null;

  // ── Search ───────────────────────────────────────────────────────────────────
  const runSearch = async (query) => {
    setSearching(true);
    setSelectedFood(null);
    setSearchResults([]);
    try {
      const results = await searchAllFoods(query);
      setSearchResults(results);
      if (results.length === 0) {
        Alert.alert("Not Found", `No results for "${query}". Try a different name.`);
      }
    } catch (e) {
      Alert.alert("Error", "Search failed. Check your connection.");
    } finally {
      setSearching(false);
    }
  };

  const handleQueryChange = (text) => {
    setSearchQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim() || text.length < 2) { setSearchResults([]); return; }
    const indianResults = searchIndianFoods(text.trim());
    if (indianResults.length > 0) setSearchResults(indianResults);
    debounceRef.current = setTimeout(() => runSearch(text.trim()), 700);
  };

  const handleSearch = useCallback(() => {
    if (searchQuery.trim()) runSearch(searchQuery.trim());
  }, [searchQuery]);

  const handleSelectFood = (food) => {
    setSelectedFood(food);
    setSearchResults([]);
    // Reset quantity based on serving type
    if (food.serving?.unit === "piece") {
      setPieceQty(1);
    } else {
      setGramQty("100");
    }
  };

  // ── Log meal ─────────────────────────────────────────────────────────────────
  const handleLogMeal = async () => {
    if (!selectedFood) { Alert.alert("No Food", "Please select a food first."); return; }
    if (totalGrams <= 0) { Alert.alert("Invalid", "Enter a valid quantity."); return; }

    setLogging(true);
    try {
      const quantityLabel = isPiece
        ? `${pieceQty} piece${pieceQty !== 1 ? "s" : ""} (${totalGrams}g)`
        : `${gramQty}g`;

      await logMeal({
        mealType,
        food: {
          name:     selectedFood.name,
          brand:    selectedFood.brand || "",
          quantity: totalGrams,          // always save in grams
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

      Alert.alert(
        "✅ Logged!",
        `${capitalize(selectedFood.name)} (${quantityLabel}) → ${nutrients.calories} kcal added to ${capitalize(mealType)}.`
      );

      // Reset form
      setSelectedFood(null);
      setSearchQuery("");
      setSearchResults([]);
      setGramQty("100");
      setPieceQty(1);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to log meal. Please try again.");
    } finally {
      setLogging(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Log Meal 🍛</Text>
          <Text style={styles.subtitle}>Indian DB + USDA · Full nutrition data</Text>
        </View>

        {/* Meal Type */}
        <Text style={styles.sectionLabel}>Meal Type</Text>
        <View style={styles.mealRow}>
          {MEAL_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.mealButton, mealType === type && styles.activeMeal]}
              onPress={() => setMealType(type)}
              activeOpacity={0.8}
            >
              <Text style={styles.mealIcon}>{MEAL_ICONS[type]}</Text>
              <Text style={[styles.mealText, mealType === type && styles.activeMealText]}>
                {capitalize(type)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

       
        {/* Search + Filter row */}
<Text style={styles.sectionLabel}>Search Food</Text>
<View style={styles.searchRow}>
  <TextInput
    style={styles.searchInput}
    placeholder='e.g. "paneer", "roti", "idli"'
    placeholderTextColor="#aaa"
    value={searchQuery}
    onChangeText={handleQueryChange}
    onSubmitEditing={handleSearch}
    returnKeyType="search"
    autoCapitalize="none"
  />
  <TouchableOpacity
    style={[styles.filterIconBtn, hasActiveFilters && styles.filterIconBtnActive]}
    onPress={() => setFilterVisible(true)}
    activeOpacity={0.8}
  >
    <Text style={{ fontSize: 18 }}>⚙️</Text>
    {hasActiveFilters && <View style={styles.filterDot} />}
  </TouchableOpacity>
  <TouchableOpacity
    style={styles.searchBtn}
    onPress={handleSearch}
    disabled={searching}
    activeOpacity={0.8}
  >
    {searching
      ? <ActivityIndicator color="#fff" size="small" />
      : <Text style={styles.searchBtnText}>Go</Text>
    }
  </TouchableOpacity>
</View>

{/* Active filter chips */}
{hasActiveFilters && (
  <View style={styles.activeFilterRow}>
    {activeFilters.dietType && (
      <View style={styles.activeChip}>
        <Text style={styles.activeChipText}>{activeFilters.dietType}</Text>
      </View>
    )}
    {activeFilters.tags.map(tag => (
      <View key={tag} style={styles.activeChip}>
        <Text style={styles.activeChipText}>#{tag}</Text>
      </View>
    ))}
    <TouchableOpacity onPress={clearFilters} style={styles.clearFiltersBtn}>
      <Text style={styles.clearFiltersText}>✕ Clear</Text>
    </TouchableOpacity>
  </View>
)}

{/* Filter loading */}
{filterLoading && (
  <View style={{ alignItems: "center", paddingVertical: 12 }}>
    <ActivityIndicator color="#FF6F00" />
    <Text style={{ color: "#888", fontSize: 12, marginTop: 6 }}>Filtering foods...</Text>
  </View>
)}

{/* Filter results */}
{!filterLoading && filterResults.length > 0 && searchResults.length === 0 && (
  <View style={styles.resultsContainer}>
    <Text style={styles.resultsLabel}>
      {filterResults.length} filtered results
    </Text>
    {filterResults.map((item) => {
      const isPieceItem = item.serving?.unit === "piece";
      return (
        <TouchableOpacity
          key={item._id || item.id}
          style={styles.resultItem}
          onPress={() => { handleSelectFood(item); setFilterResults([]); }}
          activeOpacity={0.7}
        >
          <View style={[styles.resultIconBox, { backgroundColor: "#f3e5f5" }]}>
            <Text style={{ fontSize: 20 }}>🗂️</Text>
          </View>
          <View style={styles.resultInfo}>
            <View style={styles.resultNameRow}>
              <Text style={styles.resultName} numberOfLines={1}>
                {item.name?.charAt(0).toUpperCase() + item.name?.slice(1).toLowerCase()}
              </Text>
              <View style={[styles.servingBadge, { backgroundColor: isPieceItem ? "#e8f5e9" : "#f3e5f5" }]}>
                <Text style={[styles.servingBadgeText, { color: isPieceItem ? "#2e7d32" : "#6a1b9a" }]}>
                  {isPieceItem ? `per piece (${item.serving.grams}g)` : "per 100g"}
                </Text>
              </View>
            </View>
            <Text style={[styles.resultBrand, { color: "#8E24AA" }]}>{item.category || "DB Food"}</Text>
            <View style={styles.resultMacroRow}>
              <Text style={styles.resultCalTag}>🔥 {Math.round(item.per100g?.calories || 0)} kcal</Text>
              <Text style={styles.resultMacroTag}>P {(item.per100g?.protein || 0).toFixed(1)}g</Text>
              <Text style={styles.resultMacroTag}>C {(item.per100g?.carbs || 0).toFixed(1)}g</Text>
              <Text style={styles.resultMacroTag}>F {(item.per100g?.fats || 0).toFixed(1)}g</Text>
            </View>
          </View>
          <Text style={styles.selectArrow}>›</Text>
        </TouchableOpacity>
      );
    })}
  </View>
)}

{/* Filter Bottom Sheet Modal */}
<Modal visible={filterVisible} animationType="slide" transparent onRequestClose={() => setFilterVisible(false)}>
  <View style={styles.filterOverlay}>
    <View style={styles.filterSheet}>
      <View style={styles.filterSheetHeader}>
        <Text style={styles.filterSheetTitle}>Filter Foods</Text>
        <TouchableOpacity onPress={() => setFilterVisible(false)} style={styles.filterCloseBtn}>
          <Text style={{ color: "#888", fontSize: 13 }}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Diet Type */}
      <Text style={styles.filterGroupLabel}>Diet Type</Text>
      <View style={styles.filterChipRow}>
        {DIET_OPTIONS.map(opt => (
          <TouchableOpacity
            key={String(opt.value)}
            style={[styles.filterChip, activeFilters.dietType === opt.value && styles.filterChipActive]}
            onPress={() => setActiveFilters(f => ({ ...f, dietType: opt.value }))}
          >
            <Text style={[styles.filterChipText, activeFilters.dietType === opt.value && styles.filterChipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tags */}
      <Text style={styles.filterGroupLabel}>Tags</Text>
      <View style={styles.filterChipRow}>
        {TAG_OPTIONS.map(tag => {
          const isOn = activeFilters.tags.includes(tag);
          return (
            <TouchableOpacity
              key={tag}
              style={[styles.filterChip, isOn && styles.filterChipActive]}
              onPress={() =>
                setActiveFilters(f => ({
                  ...f,
                  tags: isOn ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
                }))
              }
            >
              <Text style={[styles.filterChipText, isOn && styles.filterChipTextActive]}>
                #{tag}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={styles.filterApplyBtn}
        onPress={() => applyFilters(activeFilters)}
      >
        <Text style={styles.filterApplyText}>Apply Filters</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>

        {/* Legend */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#FF6F00" }]} />
            <Text style={styles.legendText}>🇮🇳 Indian DB (instant)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#1565c0" }]} />
            <Text style={styles.legendText}>🌍 USDA (global)</Text>
          </View>
        </View>

        {/* Quick Suggestions */}
        {!selectedFood && searchResults.length === 0 && (
          <>
            <Text style={styles.sectionLabel}>🇮🇳 Popular Indian Foods</Text>
            <View style={styles.suggestionsWrap}>
              {INDIAN_QUICK_SUGGESTIONS.map((name) => (
                <TouchableOpacity
                  key={name}
                  style={styles.suggestionChip}
                  onPress={() => { setSearchQuery(name); runSearch(name); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionText}>{name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsLabel}>{searchResults.length} results found</Text>
            {searchResults.map((item) => {
              const isPieceItem = item.serving?.unit === "piece";
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.resultItem}
                  onPress={() => handleSelectFood(item)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.resultIconBox, { backgroundColor: item.isIndian ? "#fff8e1" : "#e3f2fd" }]}>
                    <Text style={{ fontSize: 20 }}>{item.isIndian ? "🇮🇳" : "🌍"}</Text>
                  </View>
                  <View style={styles.resultInfo}>
                    <View style={styles.resultNameRow}>
                      <Text style={styles.resultName} numberOfLines={1}>
                        {capitalize(item.name)}
                      </Text>
                      {/* Serving unit badge */}
                      <View style={[styles.servingBadge, { backgroundColor: isPieceItem ? "#e8f5e9" : "#f3e5f5" }]}>
                        <Text style={[styles.servingBadgeText, { color: isPieceItem ? "#2e7d32" : "#6a1b9a" }]}>
                          {isPieceItem ? `per piece (${item.serving.grams}g)` : "per 100g"}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.resultBrand, { color: item.isIndian ? "#FF6F00" : "#1565c0" }]}>
                      {item.brand}
                    </Text>
                    <View style={styles.resultMacroRow}>
                      <Text style={styles.resultCalTag}>🔥 {item.raw.calories} kcal</Text>
                      <Text style={styles.resultMacroTag}>P {item.raw.protein}g</Text>
                      <Text style={styles.resultMacroTag}>C {item.raw.carbs}g</Text>
                      <Text style={styles.resultMacroTag}>F {item.raw.fats}g</Text>
                    </View>
                  </View>
                  <Text style={styles.selectArrow}>›</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Selected Food Card */}
        {selectedFood && (
          <View style={[styles.selectedCard, { borderColor: selectedFood.isIndian ? "#FF6F00" : "#1565c0" }]}>

            {/* Food info header */}
            <View style={styles.selectedHeader}>
              <View style={[styles.selectedIconBox, { backgroundColor: selectedFood.isIndian ? "#fff8e1" : "#e3f2fd" }]}>
                <Text style={{ fontSize: 28 }}>{selectedFood.isIndian ? "🇮🇳" : "🌍"}</Text>
              </View>
              <View style={styles.selectedInfo}>
                <Text style={styles.selectedName} numberOfLines={2}>
                  {capitalize(selectedFood.name)}
                </Text>
                <Text style={[styles.selectedBrand, { color: selectedFood.isIndian ? "#FF6F00" : "#1565c0" }]}>
                  {selectedFood.brand}
                </Text>
                <Text style={styles.selectedSub}>
                  {selectedFood.raw.calories} kcal · {selectedFood.raw.protein}g protein per 100g
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => { setSelectedFood(null); setSearchQuery(""); }}
                style={styles.clearBtn}
              >
                <Text style={styles.clearBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* ── PIECE vs GRAM selector ── */}
            {isPiece ? (
              <PieceSelector
                pieces={pieceQty}
                gramsPerPiece={gramsPerPiece}
                onPiecesChange={setPieceQty}
              />
            ) : (
              <GramSelector
                quantity={gramQty}
                onQuantityChange={setGramQty}
              />
            )}

            {/* Live Nutrition */}
            {nutrients && totalGrams > 0 && (
              <>
                <View style={styles.divider} />
                <Text style={styles.nutritionHeading}>
                  Nutrition for{" "}
                  {isPiece
                    ? `${pieceQty} piece${pieceQty !== 1 ? "s" : ""} (${totalGrams}g)`
                    : `${gramQty}g`
                  }
                </Text>
                <View style={styles.nutritionGrid}>
                  <View style={[styles.nutriBox, { backgroundColor: "#fff3e0" }]}>
                    <Text style={[styles.nutriValue, { color: "#e65100" }]}>{nutrients.calories}</Text>
                    <Text style={styles.nutriLabel}>🔥 Calories</Text>
                  </View>
                  <View style={[styles.nutriBox, { backgroundColor: "#e3f2fd" }]}>
                    <Text style={[styles.nutriValue, { color: "#1565c0" }]}>{nutrients.protein}g</Text>
                    <Text style={styles.nutriLabel}>💪 Protein</Text>
                  </View>
                  <View style={[styles.nutriBox, { backgroundColor: "#f3e5f5" }]}>
                    <Text style={[styles.nutriValue, { color: "#6a1b9a" }]}>{nutrients.carbs}g</Text>
                    <Text style={styles.nutriLabel}>🌾 Carbs</Text>
                  </View>
                  <View style={[styles.nutriBox, { backgroundColor: "#fce4ec" }]}>
                    <Text style={[styles.nutriValue, { color: "#880e4f" }]}>{nutrients.fats}g</Text>
                    <Text style={styles.nutriLabel}>🥑 Fats</Text>
                  </View>
                </View>
                <View style={styles.extraNutriRow}>
                  <View style={styles.extraNutriItem}>
                    <Text style={styles.extraNutriValue}>{nutrients.fiber}g</Text>
                    <Text style={styles.extraNutriLabel}>Fiber</Text>
                  </View>
                  <View style={styles.extraNutriDivider} />
                  <View style={styles.extraNutriItem}>
                    <Text style={styles.extraNutriValue}>{nutrients.sugar}g</Text>
                    <Text style={styles.extraNutriLabel}>Sugar</Text>
                  </View>
                  <View style={styles.extraNutriDivider} />
                  <View style={styles.extraNutriItem}>
                    <Text style={styles.extraNutriValue}>{nutrients.sodium}mg</Text>
                    <Text style={styles.extraNutriLabel}>Sodium</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        )}

        {/* Log Button */}
        {selectedFood && (
          <TouchableOpacity
            style={[styles.button, logging && styles.buttonDisabled]}
            onPress={handleLogMeal}
            disabled={logging}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>
              {logging
                ? "Logging..."
                : `Add to ${capitalize(mealType)}  ·  ${nutrients?.calories || 0} kcal`
              }
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex:          { flex: 1 },
  container:     { flex: 1, backgroundColor: "#f9fafb" },
  scrollContent: { padding: 20, paddingBottom: 60 },

  header:   { marginBottom: 24 },
  title:    { fontSize: 28, fontWeight: "800", color: "#1a1a1a" },
  subtitle: { fontSize: 13, color: "#888", marginTop: 3 },

  sectionLabel: { fontSize: 12, fontWeight: "700", color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, marginTop: 4 },

  mealRow:        { flexDirection: "row", gap: 8, marginBottom: 24 },
  mealButton:     { flex: 1, paddingVertical: 12, borderWidth: 1.5, borderRadius: 12, borderColor: "#e0e0e0", alignItems: "center", backgroundColor: "#fff" },
  activeMeal:     { backgroundColor: "#FF6F00", borderColor: "#FF6F00" },
  mealIcon:       { fontSize: 18, marginBottom: 4 },
  mealText:       { fontSize: 11, fontWeight: "600", color: "#555" },
  activeMealText: { color: "#fff" },

  searchRow:    { flexDirection: "row", gap: 8, marginBottom: 10 },
  searchInput:  { flex: 1, borderWidth: 1.5, borderColor: "#e0e0e0", backgroundColor: "#fff", padding: 13, borderRadius: 12, fontSize: 15, color: "#1a1a1a" },
  searchBtn:    { backgroundColor: "#FF6F00", width: 56, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  searchBtnText:{ color: "#fff", fontWeight: "800", fontSize: 16 },

  legendRow: { flexDirection: "row", gap: 16, marginBottom: 16 },
  legendItem:{ flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText:{ fontSize: 11, color: "#888", fontWeight: "500" },

  suggestionsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  suggestionChip:  { backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e0e0e0", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  suggestionText:  { fontSize: 13, fontWeight: "600", color: "#444" },

  resultsContainer: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1.5, borderColor: "#e0e0e0", marginBottom: 16, overflow: "hidden" },
  resultsLabel:     { fontSize: 12, color: "#888", fontWeight: "600", paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 },
  resultItem:       { flexDirection: "row", alignItems: "center", padding: 12, borderTopWidth: 1, borderTopColor: "#f5f5f5" },
  resultIconBox:    { width: 46, height: 46, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  resultInfo:       { flex: 1, marginLeft: 12 },
  resultNameRow:    { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  resultName:       { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  servingBadge:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  servingBadgeText: { fontSize: 10, fontWeight: "700" },
  resultBrand:      { fontSize: 11, marginTop: 1, fontWeight: "600" },
  resultMacroRow:   { flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" },
  resultCalTag:     { fontSize: 11, fontWeight: "700", color: "#FF6F00", backgroundColor: "#fff3e0", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  resultMacroTag:   { fontSize: 11, fontWeight: "600", color: "#555", backgroundColor: "#f5f5f5", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  selectArrow:      { fontSize: 22, color: "#ccc", marginLeft: 6 },

  selectedCard:   { backgroundColor: "#fff", borderRadius: 16, borderWidth: 2, padding: 16, marginBottom: 16 },
  selectedHeader: { flexDirection: "row", alignItems: "center" },
  selectedIconBox:{ width: 54, height: 54, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  selectedInfo:   { flex: 1, marginLeft: 12 },
  selectedName:   { fontSize: 15, fontWeight: "800", color: "#1a1a1a" },
  selectedBrand:  { fontSize: 11, marginTop: 1, fontWeight: "600" },
  selectedSub:    { fontSize: 12, color: "#666", marginTop: 3, fontWeight: "500" },
  clearBtn:       { width: 30, height: 30, borderRadius: 15, backgroundColor: "#f5f5f5", justifyContent: "center", alignItems: "center" },
  clearBtnText:   { fontSize: 13, color: "#999" },

  divider: { height: 1, backgroundColor: "#f0f0f0", marginVertical: 14 },

  // Shared quantity styles
  quantityHeading: { fontSize: 13, fontWeight: "700", color: "#444", marginBottom: 12 },
  quantityRow:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12 },
  qtyBtn:          { width: 40, height: 40, borderRadius: 12, backgroundColor: "#f0f0f0", justifyContent: "center", alignItems: "center" },
  qtyBtnText:      { fontSize: 22, color: "#333", fontWeight: "600" },

  // Gram input
  quantityInput: { width: 80, borderWidth: 2, borderColor: "#FF6F00", borderRadius: 12, padding: 8, textAlign: "center", fontSize: 20, fontWeight: "800", color: "#1a1a1a" },
  quantityUnit:  { fontSize: 16, fontWeight: "700", color: "#888" },

  // Piece display
  pieceDisplay: { alignItems: "center", minWidth: 80 },
  pieceCount:   { fontSize: 32, fontWeight: "800", color: "#1a1a1a", lineHeight: 36 },
  pieceLabel:   { fontSize: 12, color: "#888", fontWeight: "500" },

  // Grams indicator (shown below piece selector)
  gramsIndicator:     { backgroundColor: "#f5f5f5", borderRadius: 10, padding: 10, alignItems: "center", marginTop: 8 },
  gramsIndicatorText: { fontSize: 13, color: "#555", fontWeight: "500" },

  // Presets
  presets:          { flexDirection: "row", gap: 8, marginBottom: 4 },
  presetBtn:        { flex: 1, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, borderColor: "#e0e0e0", alignItems: "center", backgroundColor: "#f9f9f9" },
  activePreset:     { backgroundColor: "#fff3e0", borderColor: "#FF6F00" },
  presetText:       { fontSize: 12, fontWeight: "600", color: "#888" },
  activePresetText: { color: "#FF6F00" },

  // Nutrition
  nutritionHeading: { fontSize: 13, fontWeight: "700", color: "#444", marginBottom: 12 },
  nutritionGrid:    { flexDirection: "row", gap: 8, marginBottom: 10 },
  nutriBox:         { flex: 1, borderRadius: 12, padding: 10, alignItems: "center" },
  nutriValue:       { fontSize: 15, fontWeight: "800" },
  nutriLabel:       { fontSize: 10, color: "#666", marginTop: 3, fontWeight: "500" },
  extraNutriRow:    { flexDirection: "row", backgroundColor: "#f9f9f9", borderRadius: 12, padding: 12, justifyContent: "space-around" },
  extraNutriItem:   { alignItems: "center" },
  extraNutriValue:  { fontSize: 14, fontWeight: "700", color: "#333" },
  extraNutriLabel:  { fontSize: 11, color: "#999", marginTop: 2 },
  extraNutriDivider:{ width: 1, backgroundColor: "#e0e0e0" },

  // Log button
  button:         { backgroundColor: "#FF6F00", padding: 16, borderRadius: 14, alignItems: "center", marginTop: 4, shadowColor: "#FF6F00", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 5 },
  buttonDisabled: { backgroundColor: "#ffcc80", shadowOpacity: 0, elevation: 0 },
  buttonText:     { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.3 },


  // Filter UI
filterIconBtn:       { width: 46, height: 46, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e0e0e0", justifyContent: "center", alignItems: "center" },
filterIconBtnActive: { borderColor: "#FF6F00", backgroundColor: "#fff8f0" },
filterDot:           { position: "absolute", top: 8, right: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: "#FF6F00" },
activeFilterRow:     { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
activeChip:          { backgroundColor: "#fff3e0", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
activeChipText:      { fontSize: 11, fontWeight: "700", color: "#FF6F00" },
clearFiltersBtn:     { backgroundColor: "#fce4ec", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
clearFiltersText:    { fontSize: 11, fontWeight: "700", color: "#e53935" },

filterOverlay:       { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
filterSheet:         { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
filterSheetHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
filterSheetTitle:    { fontSize: 18, fontWeight: "800", color: "#1a1a1a" },
filterCloseBtn:      { width: 28, height: 28, borderRadius: 14, backgroundColor: "#f5f5f5", justifyContent: "center", alignItems: "center" },
filterGroupLabel:    { fontSize: 11, fontWeight: "700", color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginTop: 4 },
filterChipRow:       { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
filterChip:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: "#e0e0e0", backgroundColor: "#f9f9f9" },
filterChipActive:    { backgroundColor: "#fff3e0", borderColor: "#FF6F00" },
filterChipText:      { fontSize: 13, fontWeight: "600", color: "#888" },
filterChipTextActive:{ color: "#FF6F00" },
filterApplyBtn:      { backgroundColor: "#FF6F00", padding: 14, borderRadius: 14, alignItems: "center", marginTop: 6 },
filterApplyText:     { color: "#fff", fontWeight: "800", fontSize: 15 },
});