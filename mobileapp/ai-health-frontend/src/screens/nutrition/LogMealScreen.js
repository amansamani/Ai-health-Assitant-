import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { logMeal } from "../../services/nutritionService";

// ─── 🔑 CalorieNinja API Key ───────────────────────────────────────────────────
// Get your FREE key at: https://api-ninjas.com  (10,000 calls/month, no credit card)
const CALORIE_NINJA_API_KEY = "T3msJPE64qfJbjps8NcE4UM21zfxXp7oWeYBexZD";

// ─── Constants ─────────────────────────────────────────────────────────────────
const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snacks"];
const MEAL_ICONS = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snacks: "🍎" };

// Popular Indian food suggestions for quick access
const INDIAN_QUICK_SUGGESTIONS = [
  "Dal Makhani", "Roti", "Biryani", "Paneer", "Idli",
  "Samosa", "Rajma", "Chole", "Poha", "Upma",
];

// ─── CalorieNinja API ──────────────────────────────────────────────────────────
/**
 * Search food nutrition from CalorieNinja API
 * Supports natural language: "100g dal makhani", "2 roti", "1 bowl biryani"
 * Returns calories, protein, carbs, fat per serving
 */
const searchNutrition = async (query) => {
  const res = await fetch(
    `https://api.api-ninjas.com/v1/nutrition?query=${encodeURIComponent(query)}`,
    {
      headers: { "X-Api-Key": CALORIE_NINJA_API_KEY },
    }
  );
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return [];

  return data.map((item, index) => {
    // Safe number helper — returns 0 if value is null/undefined/NaN
    const n = (val) => (typeof val === "number" && !isNaN(val) ? val : 0);

    const servingG = n(item.serving_size_g) || 100;
    const ratio = 100 / servingG;

    return {
      id: `${item.name}_${index}`,
      name: item.name || "Unknown",
      servingGrams: servingG,
      per100g: {
        calories: n(item.calories) * ratio,
        protein: n(item.protein_g) * ratio,
        carbs: n(item.carbohydrates_total_g) * ratio,
        fats: n(item.fat_total_g) * ratio,
        fiber: n(item.fiber_g) * ratio,
        sugar: n(item.sugar_g) * ratio,
        sodium: n(item.sodium_mg) * ratio,
      },
      raw: {
        calories: Math.round(n(item.calories)),
        protein: parseFloat(n(item.protein_g).toFixed(1)),
        carbs: parseFloat(n(item.carbohydrates_total_g).toFixed(1)),
        fats: parseFloat(n(item.fat_total_g).toFixed(1)),
        fiber: parseFloat(n(item.fiber_g).toFixed(1)),
        sugar: parseFloat(n(item.sugar_g).toFixed(1)),
        sodium: Math.round(n(item.sodium_mg)),
        servingGrams: Math.round(servingG),
      },
    };
  });
};

/** Recalculate nutrients for custom gram input */
const calcNutrients = (per100g, grams) => {
  const r = grams / 100;
  return {
    calories: Math.round(per100g.calories * r),
    protein: (per100g.protein * r).toFixed(1),
    carbs: (per100g.carbs * r).toFixed(1),
    fats: (per100g.fats * r).toFixed(1),
    fiber: (per100g.fiber * r).toFixed(1),
    sugar: (per100g.sugar * r).toFixed(1),
    sodium: Math.round(per100g.sodium * r),
  };
};

// ─── Component ─────────────────────────────────────────────────────────────────
export default function LogMealScreen() {
  const [mealType, setMealType] = useState("breakfast");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [quantity, setQuantity] = useState("100");
  const [logging, setLogging] = useState(false);
  const debounceRef = useRef(null);

  // ── Debounced auto-search as user types ──
  const handleQueryChange = (text) => {
    setSearchQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim() || text.length < 3) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(text.trim()), 600);
  };

  const runSearch = async (query) => {
    setSearching(true);
    setSelectedFood(null);
    setSearchResults([]);
    try {
      const results = await searchNutrition(query);
      setSearchResults(results);
      if (results.length === 0) {
        Alert.alert(
          "Not Found",
          `"${query}" not found.\n\nTry adding quantity:\n• "100g paneer"\n• "1 cup dal"\n• "2 roti"`
        );
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Search failed. Check your API key and internet connection.");
    } finally {
      setSearching(false);
    }
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
    setQuantity(String(food.raw.servingGrams));
  };

  // Live nutrients based on quantity slider
  const nutrients = selectedFood
    ? calcNutrients(selectedFood.per100g, Number(quantity) || 0)
    : null;

  const handleLogMeal = async () => {
    if (!selectedFood) {
      Alert.alert("No Food", "Please search and select a food first.");
      return;
    }
    if (!quantity || Number(quantity) <= 0) {
      Alert.alert("Invalid Quantity", "Please enter a valid quantity in grams.");
      return;
    }
    setLogging(true);
    try {
      await logMeal({
        mealType,
        food: {
          name: selectedFood.name,
          quantity: Number(quantity),
          unit: "g",
          calories: nutrients.calories,
          protein: Number(nutrients.protein),
          carbs: Number(nutrients.carbs),
          fats: Number(nutrients.fats),
          fiber: Number(nutrients.fiber),
          sugar: Number(nutrients.sugar),
          sodium: nutrients.sodium,
        },
      });
      Alert.alert(
        "✅ Logged!",
        `${capitalize(selectedFood.name)} (${quantity}g) → ${nutrients.calories} kcal added to ${capitalize(mealType)}.`
      );
      // Reset
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

  const capitalize = (s) =>
    s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

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
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.title}>Log Meal 🍛</Text>
          <Text style={styles.subtitle}>
            Search any Indian or global food
          </Text>
        </View>

        {/* ── Meal Type Selector ── */}
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

        {/* ── Search Bar ── */}
        <Text style={styles.sectionLabel}>Search Food</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder='e.g. "100g dal", "2 roti", "biryani"'
            placeholderTextColor="#aaa"
            value={searchQuery}
            onChangeText={handleQueryChange}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.searchBtn}
            onPress={handleSearch}
            disabled={searching}
            activeOpacity={0.8}
          >
            {searching ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.searchBtnText}>Go</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Hint Box ── */}
        <View style={styles.hintBox}>
          <Text style={styles.hintTitle}>💡 Search Tips</Text>
          <Text style={styles.hintText}>
            • Add quantity for accuracy: "150g paneer"{"\n"}
            • Use cups/bowls: "1 cup rajma", "1 bowl biryani"{"\n"}
            • Multiple items: "2 idli with sambar"
          </Text>
        </View>

        {/* ── Quick Indian Suggestions ── */}
        {!selectedFood && searchResults.length === 0 && (
          <>
            <Text style={styles.sectionLabel}>🇮🇳 Popular Indian Foods</Text>
            <View style={styles.suggestionsWrap}>
              {INDIAN_QUICK_SUGGESTIONS.map((name) => (
                <TouchableOpacity
                  key={name}
                  style={styles.suggestionChip}
                  onPress={() => handleQuickSuggest(name)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionText}>{name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* ── Search Results ── */}
        {searchResults.length > 0 && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsLabel}>
              {searchResults.length} item{searchResults.length > 1 ? "s" : ""} found
            </Text>
            {searchResults.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.resultItem}
                onPress={() => handleSelectFood(item)}
                activeOpacity={0.7}
              >
                <View style={styles.resultIconBox}>
                  <Text style={styles.resultIconText}>🍽️</Text>
                </View>
                <View style={styles.resultInfo}>
                  <Text style={styles.resultName}>{capitalize(item.name)}</Text>
                  <Text style={styles.resultMeta}>
                    Per {item.raw.servingGrams}g serving
                  </Text>
                  <View style={styles.resultMacroRow}>
                    <Text style={styles.resultCalTag}>
                      🔥 {item.raw.calories} kcal
                    </Text>
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

        {/* ── Selected Food Card ── */}
        {selectedFood && (
          <View style={styles.selectedCard}>
            {/* Food Header */}
            <View style={styles.selectedHeader}>
              <View style={styles.selectedIconBox}>
                <Text style={{ fontSize: 30 }}>🍽️</Text>
              </View>
              <View style={styles.selectedInfo}>
                <Text style={styles.selectedName}>
                  {capitalize(selectedFood.name)}
                </Text>
                <Text style={styles.selectedSub}>
                  {selectedFood.raw.calories} kcal per {selectedFood.raw.servingGrams}g
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setSelectedFood(null);
                  setSearchQuery("");
                }}
                style={styles.clearBtn}
              >
                <Text style={styles.clearBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Quantity */}
            <Text style={styles.quantityHeading}>Adjust Quantity (grams)</Text>
            <View style={styles.quantityRow}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() =>
                  setQuantity((q) => String(Math.max(1, Number(q) - 10)))
                }
              >
                <Text style={styles.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.quantityInput}
                keyboardType="numeric"
                value={quantity}
                onChangeText={(v) => setQuantity(v.replace(/[^0-9]/g, ""))}
              />
              <Text style={styles.quantityUnit}>g</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() =>
                  setQuantity((q) => String(Number(q) + 10))
                }
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            {/* Gram Presets */}
            <View style={styles.presets}>
              {["50", "100", "150", "200", "250"].map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.presetBtn, quantity === g && styles.activePreset]}
                  onPress={() => setQuantity(g)}
                >
                  <Text
                    style={[styles.presetText, quantity === g && styles.activePresetText]}
                  >
                    {g}g
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Live Nutrition Card */}
            {nutrients && Number(quantity) > 0 && (
              <>
                <View style={styles.divider} />
                <Text style={styles.nutritionHeading}>
                  Nutrition for {quantity}g
                </Text>

                {/* Main 4 macros */}
                <View style={styles.nutritionGrid}>
                  <View style={[styles.nutriBox, { backgroundColor: "#fff3e0" }]}>
                    <Text style={[styles.nutriValue, { color: "#e65100" }]}>
                      {nutrients.calories}
                    </Text>
                    <Text style={styles.nutriLabel}>🔥 Calories</Text>
                  </View>
                  <View style={[styles.nutriBox, { backgroundColor: "#e3f2fd" }]}>
                    <Text style={[styles.nutriValue, { color: "#1565c0" }]}>
                      {nutrients.protein}g
                    </Text>
                    <Text style={styles.nutriLabel}>💪 Protein</Text>
                  </View>
                  <View style={[styles.nutriBox, { backgroundColor: "#f3e5f5" }]}>
                    <Text style={[styles.nutriValue, { color: "#6a1b9a" }]}>
                      {nutrients.carbs}g
                    </Text>
                    <Text style={styles.nutriLabel}>🌾 Carbs</Text>
                  </View>
                  <View style={[styles.nutriBox, { backgroundColor: "#fce4ec" }]}>
                    <Text style={[styles.nutriValue, { color: "#880e4f" }]}>
                      {nutrients.fats}g
                    </Text>
                    <Text style={styles.nutriLabel}>🥑 Fats</Text>
                  </View>
                </View>

                {/* Extra nutrients row */}
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

        {/* ── Log Button ── */}
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
                : `Add to ${capitalize(mealType)}  ·  ${nutrients?.calories || 0} kcal`}
            </Text>
          </TouchableOpacity>
        )}

        {/* ── API Key Notice ── */}
        {CALORIE_NINJA_API_KEY === "YOUR_API_KEY_HERE" && (
          <View style={styles.apiNotice}>
            <Text style={styles.apiNoticeTitle}>⚠️ API Key Missing</Text>
            <Text style={styles.apiNoticeText}>
              1. Go to api-ninjas.com{"\n"}
              2. Sign up free (no credit card){"\n"}
              3. Copy your API key{"\n"}
              4. Replace YOUR_API_KEY_HERE at the top of this file
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: "#f9fafb" },
  scrollContent: { padding: 20, paddingBottom: 60 },

  // Header
  header: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: "800", color: "#1a1a1a" },
  subtitle: { fontSize: 13, color: "#888", marginTop: 3 },

  sectionLabel: {
    fontSize: 12, fontWeight: "700", color: "#888",
    textTransform: "uppercase", letterSpacing: 1,
    marginBottom: 10, marginTop: 4,
  },

  // Meal Type
  mealRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
  mealButton: {
    flex: 1, paddingVertical: 12, borderWidth: 1.5,
    borderRadius: 12, borderColor: "#e0e0e0",
    alignItems: "center", backgroundColor: "#fff",
  },
  activeMeal: { backgroundColor: "#FF6F00", borderColor: "#FF6F00" },
  mealIcon: { fontSize: 18, marginBottom: 4 },
  mealText: { fontSize: 11, fontWeight: "600", color: "#555" },
  activeMealText: { color: "#fff" },

  // Search
  searchRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  searchInput: {
    flex: 1, borderWidth: 1.5, borderColor: "#e0e0e0",
    backgroundColor: "#fff", padding: 13,
    borderRadius: 12, fontSize: 15, color: "#1a1a1a",
  },
  searchBtn: {
    backgroundColor: "#FF6F00", width: 56,
    borderRadius: 12, justifyContent: "center", alignItems: "center",
  },
  searchBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },

  // Hint
  hintBox: {
    backgroundColor: "#fff8e1", borderRadius: 12,
    padding: 12, marginBottom: 20,
    borderLeftWidth: 3, borderLeftColor: "#FF6F00",
  },
  hintTitle: { fontSize: 12, fontWeight: "700", color: "#FF6F00", marginBottom: 4 },
  hintText: { fontSize: 12, color: "#795548", lineHeight: 20 },

  // Quick Suggestions
  suggestionsWrap: {
    flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20,
  },
  suggestionChip: {
    backgroundColor: "#fff", borderWidth: 1.5,
    borderColor: "#e0e0e0", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  suggestionText: { fontSize: 13, fontWeight: "600", color: "#444" },

  // Results
  resultsContainer: {
    backgroundColor: "#fff", borderRadius: 14,
    borderWidth: 1.5, borderColor: "#e0e0e0",
    marginBottom: 16, overflow: "hidden",
  },
  resultsLabel: {
    fontSize: 12, color: "#888", fontWeight: "600",
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6,
  },
  resultItem: {
    flexDirection: "row", alignItems: "center",
    padding: 12, borderTopWidth: 1, borderTopColor: "#f5f5f5",
  },
  resultIconBox: {
    width: 46, height: 46, borderRadius: 10,
    backgroundColor: "#fff8e1", justifyContent: "center", alignItems: "center",
  },
  resultIconText: { fontSize: 22 },
  resultInfo: { flex: 1, marginLeft: 12 },
  resultName: { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  resultMeta: { fontSize: 11, color: "#aaa", marginTop: 1 },
  resultMacroRow: { flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" },
  resultCalTag: {
    fontSize: 11, fontWeight: "700", color: "#FF6F00",
    backgroundColor: "#fff3e0", paddingHorizontal: 7,
    paddingVertical: 2, borderRadius: 6,
  },
  resultMacroTag: {
    fontSize: 11, fontWeight: "600", color: "#555",
    backgroundColor: "#f5f5f5", paddingHorizontal: 7,
    paddingVertical: 2, borderRadius: 6,
  },
  selectArrow: { fontSize: 22, color: "#ccc", marginLeft: 6 },

  // Selected Card
  selectedCard: {
    backgroundColor: "#fff", borderRadius: 16,
    borderWidth: 2, borderColor: "#FF6F00",
    padding: 16, marginBottom: 16,
  },
  selectedHeader: { flexDirection: "row", alignItems: "center" },
  selectedIconBox: {
    width: 54, height: 54, borderRadius: 12,
    backgroundColor: "#fff8e1", justifyContent: "center", alignItems: "center",
  },
  selectedInfo: { flex: 1, marginLeft: 12 },
  selectedName: { fontSize: 16, fontWeight: "800", color: "#1a1a1a" },
  selectedSub: { fontSize: 12, color: "#FF6F00", marginTop: 3, fontWeight: "600" },
  clearBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "#f5f5f5", justifyContent: "center", alignItems: "center",
  },
  clearBtnText: { fontSize: 13, color: "#999" },

  divider: { height: 1, backgroundColor: "#f0f0f0", marginVertical: 14 },

  // Quantity
  quantityHeading: { fontSize: 13, fontWeight: "700", color: "#444", marginBottom: 12 },
  quantityRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 10, marginBottom: 12,
  },
  qtyBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#f0f0f0", justifyContent: "center", alignItems: "center",
  },
  qtyBtnText: { fontSize: 22, color: "#333", fontWeight: "600" },
  quantityInput: {
    width: 80, borderWidth: 2, borderColor: "#FF6F00",
    borderRadius: 12, padding: 8, textAlign: "center",
    fontSize: 20, fontWeight: "800", color: "#1a1a1a",
  },
  quantityUnit: { fontSize: 16, fontWeight: "700", color: "#888" },

  // Presets
  presets: { flexDirection: "row", gap: 8, marginBottom: 4 },
  presetBtn: {
    flex: 1, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1.5, borderColor: "#e0e0e0",
    alignItems: "center", backgroundColor: "#f9f9f9",
  },
  activePreset: { backgroundColor: "#fff3e0", borderColor: "#FF6F00" },
  presetText: { fontSize: 12, fontWeight: "600", color: "#888" },
  activePresetText: { color: "#FF6F00" },

  // Nutrition
  nutritionHeading: {
    fontSize: 13, fontWeight: "700", color: "#444", marginBottom: 12,
  },
  nutritionGrid: { flexDirection: "row", gap: 8, marginBottom: 10 },
  nutriBox: { flex: 1, borderRadius: 12, padding: 10, alignItems: "center" },
  nutriValue: { fontSize: 15, fontWeight: "800" },
  nutriLabel: { fontSize: 10, color: "#666", marginTop: 3, fontWeight: "500" },

  // Extra Nutrients
  extraNutriRow: {
    flexDirection: "row", backgroundColor: "#f9f9f9",
    borderRadius: 12, padding: 12, justifyContent: "space-around",
  },
  extraNutriItem: { alignItems: "center" },
  extraNutriValue: { fontSize: 14, fontWeight: "700", color: "#333" },
  extraNutriLabel: { fontSize: 11, color: "#999", marginTop: 2 },
  extraNutriDivider: { width: 1, backgroundColor: "#e0e0e0" },

  // Log Button
  button: {
    backgroundColor: "#FF6F00", padding: 16, borderRadius: 14,
    alignItems: "center", marginTop: 4,
    shadowColor: "#FF6F00", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  buttonDisabled: { backgroundColor: "#ffcc80", shadowOpacity: 0, elevation: 0 },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.3 },

  // API Notice
  apiNotice: {
    marginTop: 20, backgroundColor: "#fce4ec", borderRadius: 12,
    padding: 14, borderLeftWidth: 4, borderLeftColor: "#e53935",
  },
  apiNoticeTitle: { fontSize: 13, fontWeight: "800", color: "#c62828", marginBottom: 6 },
  apiNoticeText: { fontSize: 12, color: "#b71c1c", lineHeight: 20 },
});