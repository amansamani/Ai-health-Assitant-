import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { logMeal } from "../../services/nutritionService";
import { searchIndianFoods } from "../../data/indianFoodDB"; // ← your local DB

// ─── 🔑 USDA FoodData Central API Key (100% Free) ─────────────────────────────
// Get key at: https://fdc.nal.usda.gov/api-guide.html
const USDA_API_KEY = "EEvdPZ0U1r3rWH9g5ElfGeYhassb8Y9XkJKFZlY2";

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snacks"];
const MEAL_ICONS = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snacks: "🍎" };
const INDIAN_QUICK_SUGGESTIONS = [
  "Dal Makhani", "Roti", "Biryani", "Paneer", "Idli",
  "Samosa", "Rajma", "Chole", "Poha", "Butter Chicken",
];

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
    return {
      id: String(food.fdcId),
      name: food.description || "Unknown",
      brand: food.brandOwner || food.brandName || "USDA",
      category: food.foodCategory || "",
      isIndian: false,
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

// ─── Combined Search: Indian DB first, then USDA ──────────────────────────────
const searchAllFoods = async (query) => {
  // 1. Search local Indian DB (instant, no API call)
  const indianResults = searchIndianFoods(query);

  // 2. Search USDA in parallel
  let usdaResults = [];
  try {
    usdaResults = await searchUSDA(query);
  } catch (e) {
    console.warn("USDA search failed, using Indian DB only:", e.message);
  }

  // 3. Combine: Indian results first, then USDA
  // Remove USDA duplicates that already exist in Indian DB
  const indianNames = new Set(indianResults.map((f) => f.name.toLowerCase()));
  const filteredUSDA = usdaResults.filter(
    (f) => !indianNames.has(f.name.toLowerCase())
  );

  return [...indianResults, ...filteredUSDA];
};

/** Recalculate nutrients for any gram quantity */
const calcNutrients = (per100g, grams) => {
  const r = grams / 100;
  return {
    calories: Math.round(per100g.calories * r),
    protein:  (per100g.protein * r).toFixed(1),
    carbs:    (per100g.carbs * r).toFixed(1),
    fats:     (per100g.fats * r).toFixed(1),
    fiber:    (per100g.fiber * r).toFixed(1),
    sugar:    (per100g.sugar * r).toFixed(1),
    sodium:   Math.round(per100g.sodium * r),
  };
};

// ─── Component ─────────────────────────────────────────────────────────────────
export default function LogMealScreen({ route }) {
  // Pre-select mealType if navigated from dashboard + Add button
  const preSelectedMeal = route?.params?.mealType || "breakfast";
  const [mealType, setMealType]           = useState(preSelectedMeal);
  const [searchQuery, setSearchQuery]     = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]         = useState(false);
  const [selectedFood, setSelectedFood]   = useState(null);
  const [quantity, setQuantity]           = useState("100");
  const [logging, setLogging]             = useState(false);
  const debounceRef = useRef(null);

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
      console.error(e);
      Alert.alert("Error", "Search failed. Check your internet connection.");
    } finally {
      setSearching(false);
    }
  };

  const handleQueryChange = (text) => {
    setSearchQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim() || text.length < 2) { setSearchResults([]); return; }
    // Indian DB results show instantly (no debounce needed)
    const indianResults = searchIndianFoods(text.trim());
    if (indianResults.length > 0) setSearchResults(indianResults);
    // Then debounce USDA search
    debounceRef.current = setTimeout(() => runSearch(text.trim()), 700);
  };

  const handleSearch = useCallback(() => {
    if (searchQuery.trim()) runSearch(searchQuery.trim());
  }, [searchQuery]);

  const handleQuickSuggest = (name) => {
    setSearchQuery(name);
    runSearch(name);
  };

  const handleSelectFood = (food) => {
    setSelectedFood(food);
    setSearchResults([]);
    setQuantity("100");
  };

  const nutrients = selectedFood
    ? calcNutrients(selectedFood.per100g, Number(quantity) || 0)
    : null;

  const handleLogMeal = async () => {
    if (!selectedFood) { Alert.alert("No Food", "Please select a food first."); return; }
    if (!quantity || Number(quantity) <= 0) { Alert.alert("Invalid", "Enter a valid quantity."); return; }
    setLogging(true);
    try {
      await logMeal({
        mealType,
        food: {
          name:     selectedFood.name,
          brand:    selectedFood.brand,
          quantity: Number(quantity),
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
      Alert.alert("✅ Logged!", `${capitalize(selectedFood.name)} (${quantity}g) → ${nutrients.calories} kcal added to ${capitalize(mealType)}.`);
      setSelectedFood(null);
      setSearchQuery("");
      setQuantity("100");
      setSearchResults([]);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to log meal. Please try again.");
    } finally {
      setLogging(false);
    }
  };

  const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Log Meal 🍛</Text>
          <Text style={styles.subtitle}>Indian DB + USDA · Full nutrition data</Text>
        </View>

        {/* Meal Type */}
        <Text style={styles.sectionLabel}>Meal Type</Text>
        <View style={styles.mealRow}>
          {MEAL_TYPES.map((type) => (
            <TouchableOpacity key={type} style={[styles.mealButton, mealType === type && styles.activeMeal]} onPress={() => setMealType(type)} activeOpacity={0.8}>
              <Text style={styles.mealIcon}>{MEAL_ICONS[type]}</Text>
              <Text style={[styles.mealText, mealType === type && styles.activeMealText]}>{capitalize(type)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search */}
        <Text style={styles.sectionLabel}>Search Food</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder='e.g. "paneer", "roti", "biryani"'
            placeholderTextColor="#aaa"
            value={searchQuery}
            onChangeText={handleQueryChange}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching} activeOpacity={0.8}>
            {searching ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.searchBtnText}>Go</Text>}
          </TouchableOpacity>
        </View>

        {/* Source Legend */}
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
                <TouchableOpacity key={name} style={styles.suggestionChip} onPress={() => handleQuickSuggest(name)} activeOpacity={0.7}>
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
            {searchResults.map((item) => (
              <TouchableOpacity key={item.id} style={styles.resultItem} onPress={() => handleSelectFood(item)} activeOpacity={0.7}>
                <View style={[styles.resultIconBox, { backgroundColor: item.isIndian ? "#fff8e1" : "#e3f2fd" }]}>
                  <Text style={{ fontSize: 20 }}>{item.isIndian ? "🇮🇳" : "🌍"}</Text>
                </View>
                <View style={styles.resultInfo}>
                  <Text style={styles.resultName} numberOfLines={1}>{capitalize(item.name)}</Text>
                  <Text style={[styles.resultBrand, { color: item.isIndian ? "#FF6F00" : "#1565c0" }]}>{item.brand}</Text>
                  <View style={styles.resultMacroRow}>
                    <Text style={styles.resultCalTag}>🔥 {item.raw.calories} kcal</Text>
                    <Text style={styles.resultMacroTag}>P {item.raw.protein}g</Text>
                    <Text style={styles.resultMacroTag}>C {item.raw.carbs}g</Text>
                    <Text style={styles.resultMacroTag}>F {item.raw.fats}g</Text>
                  </View>
                </View>
                <Text style={styles.selectArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Selected Food Card */}
        {selectedFood && (
          <View style={[styles.selectedCard, { borderColor: selectedFood.isIndian ? "#FF6F00" : "#1565c0" }]}>
            <View style={styles.selectedHeader}>
              <View style={[styles.selectedIconBox, { backgroundColor: selectedFood.isIndian ? "#fff8e1" : "#e3f2fd" }]}>
                <Text style={{ fontSize: 28 }}>{selectedFood.isIndian ? "🇮🇳" : "🌍"}</Text>
              </View>
              <View style={styles.selectedInfo}>
                <Text style={styles.selectedName} numberOfLines={2}>{capitalize(selectedFood.name)}</Text>
                <Text style={[styles.selectedBrand, { color: selectedFood.isIndian ? "#FF6F00" : "#1565c0" }]}>{selectedFood.brand}</Text>
                <Text style={styles.selectedSub}>{selectedFood.raw.calories} kcal · {selectedFood.raw.protein}g protein per 100g</Text>
              </View>
              <TouchableOpacity onPress={() => { setSelectedFood(null); setSearchQuery(""); }} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* Quantity */}
            <Text style={styles.quantityHeading}>Adjust Quantity (grams)</Text>
            <View style={styles.quantityRow}>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity((q) => String(Math.max(1, Number(q) - 10)))}>
                <Text style={styles.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.quantityInput}
                keyboardType="numeric"
                value={quantity}
                onChangeText={(v) => setQuantity(v.replace(/[^0-9]/g, ""))}
              />
              <Text style={styles.quantityUnit}>g</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity((q) => String(Number(q) + 10))}>
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.presets}>
              {["50", "100", "150", "200", "250"].map((g) => (
                <TouchableOpacity key={g} style={[styles.presetBtn, quantity === g && styles.activePreset]} onPress={() => setQuantity(g)}>
                  <Text style={[styles.presetText, quantity === g && styles.activePresetText]}>{g}g</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Live Nutrition */}
            {nutrients && Number(quantity) > 0 && (
              <>
                <View style={styles.divider} />
                <Text style={styles.nutritionHeading}>Nutrition for {quantity}g</Text>
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
          <TouchableOpacity style={[styles.button, logging && styles.buttonDisabled]} onPress={handleLogMeal} disabled={logging} activeOpacity={0.85}>
            <Text style={styles.buttonText}>
              {logging ? "Logging..." : `Add to ${capitalize(mealType)}  ·  ${nutrients?.calories || 0} kcal`}
            </Text>
          </TouchableOpacity>
        )}

        {/* USDA Key Notice */}
        {USDA_API_KEY === "YOUR_USDA_API_KEY_HERE" && (
          <View style={styles.apiNotice}>
            <Text style={styles.apiNoticeTitle}>⚠️ USDA API Key Missing</Text>
            <Text style={styles.apiNoticeText}>
              Indian DB works without a key!{"\n"}
              For global foods, get free USDA key at:{"\n"}
              fdc.nal.usda.gov/api-guide.html
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: "#f9fafb" },
  scrollContent: { padding: 20, paddingBottom: 60 },
  header: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: "800", color: "#1a1a1a" },
  subtitle: { fontSize: 13, color: "#888", marginTop: 3 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, marginTop: 4 },
  mealRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
  mealButton: { flex: 1, paddingVertical: 12, borderWidth: 1.5, borderRadius: 12, borderColor: "#e0e0e0", alignItems: "center", backgroundColor: "#fff" },
  activeMeal: { backgroundColor: "#FF6F00", borderColor: "#FF6F00" },
  mealIcon: { fontSize: 18, marginBottom: 4 },
  mealText: { fontSize: 11, fontWeight: "600", color: "#555" },
  activeMealText: { color: "#fff" },
  searchRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  searchInput: { flex: 1, borderWidth: 1.5, borderColor: "#e0e0e0", backgroundColor: "#fff", padding: 13, borderRadius: 12, fontSize: 15, color: "#1a1a1a" },
  searchBtn: { backgroundColor: "#FF6F00", width: 56, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  searchBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  legendRow: { flexDirection: "row", gap: 16, marginBottom: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: "#888", fontWeight: "500" },
  suggestionsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  suggestionChip: { backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e0e0e0", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  suggestionText: { fontSize: 13, fontWeight: "600", color: "#444" },
  resultsContainer: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1.5, borderColor: "#e0e0e0", marginBottom: 16, overflow: "hidden" },
  resultsLabel: { fontSize: 12, color: "#888", fontWeight: "600", paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 },
  resultItem: { flexDirection: "row", alignItems: "center", padding: 12, borderTopWidth: 1, borderTopColor: "#f5f5f5" },
  resultIconBox: { width: 46, height: 46, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  resultInfo: { flex: 1, marginLeft: 12 },
  resultName: { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  resultBrand: { fontSize: 11, marginTop: 1, fontWeight: "600" },
  resultMacroRow: { flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" },
  resultCalTag: { fontSize: 11, fontWeight: "700", color: "#FF6F00", backgroundColor: "#fff3e0", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  resultMacroTag: { fontSize: 11, fontWeight: "600", color: "#555", backgroundColor: "#f5f5f5", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  selectArrow: { fontSize: 22, color: "#ccc", marginLeft: 6 },
  selectedCard: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 2, padding: 16, marginBottom: 16 },
  selectedHeader: { flexDirection: "row", alignItems: "center" },
  selectedIconBox: { width: 54, height: 54, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  selectedInfo: { flex: 1, marginLeft: 12 },
  selectedName: { fontSize: 15, fontWeight: "800", color: "#1a1a1a" },
  selectedBrand: { fontSize: 11, marginTop: 1, fontWeight: "600" },
  selectedSub: { fontSize: 12, color: "#666", marginTop: 3, fontWeight: "500" },
  clearBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#f5f5f5", justifyContent: "center", alignItems: "center" },
  clearBtnText: { fontSize: 13, color: "#999" },
  divider: { height: 1, backgroundColor: "#f0f0f0", marginVertical: 14 },
  quantityHeading: { fontSize: 13, fontWeight: "700", color: "#444", marginBottom: 12 },
  quantityRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12 },
  qtyBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#f0f0f0", justifyContent: "center", alignItems: "center" },
  qtyBtnText: { fontSize: 22, color: "#333", fontWeight: "600" },
  quantityInput: { width: 80, borderWidth: 2, borderColor: "#FF6F00", borderRadius: 12, padding: 8, textAlign: "center", fontSize: 20, fontWeight: "800", color: "#1a1a1a" },
  quantityUnit: { fontSize: 16, fontWeight: "700", color: "#888" },
  presets: { flexDirection: "row", gap: 8, marginBottom: 4 },
  presetBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5, borderColor: "#e0e0e0", alignItems: "center", backgroundColor: "#f9f9f9" },
  activePreset: { backgroundColor: "#fff3e0", borderColor: "#FF6F00" },
  presetText: { fontSize: 12, fontWeight: "600", color: "#888" },
  activePresetText: { color: "#FF6F00" },
  nutritionHeading: { fontSize: 13, fontWeight: "700", color: "#444", marginBottom: 12 },
  nutritionGrid: { flexDirection: "row", gap: 8, marginBottom: 10 },
  nutriBox: { flex: 1, borderRadius: 12, padding: 10, alignItems: "center" },
  nutriValue: { fontSize: 15, fontWeight: "800" },
  nutriLabel: { fontSize: 10, color: "#666", marginTop: 3, fontWeight: "500" },
  extraNutriRow: { flexDirection: "row", backgroundColor: "#f9f9f9", borderRadius: 12, padding: 12, justifyContent: "space-around" },
  extraNutriItem: { alignItems: "center" },
  extraNutriValue: { fontSize: 14, fontWeight: "700", color: "#333" },
  extraNutriLabel: { fontSize: 11, color: "#999", marginTop: 2 },
  extraNutriDivider: { width: 1, backgroundColor: "#e0e0e0" },
  button: { backgroundColor: "#FF6F00", padding: 16, borderRadius: 14, alignItems: "center", marginTop: 4, shadowColor: "#FF6F00", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 5 },
  buttonDisabled: { backgroundColor: "#ffcc80", shadowOpacity: 0, elevation: 0 },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.3 },
  apiNotice: { marginTop: 20, backgroundColor: "#fff3e0", borderRadius: 12, padding: 14, borderLeftWidth: 4, borderLeftColor: "#FF6F00" },
  apiNoticeTitle: { fontSize: 13, fontWeight: "800", color: "#e65100", marginBottom: 6 },
  apiNoticeText: { fontSize: 12, color: "#bf360c", lineHeight: 20 },
});