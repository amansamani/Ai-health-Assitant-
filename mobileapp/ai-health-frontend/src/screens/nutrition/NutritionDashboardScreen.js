import React, { useEffect, useState } from "react";
import {
  View, Text, ActivityIndicator, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl, Modal, FlatList, Alert,
} from "react-native";
import API from "../../services/api";

const MEAL_META = {
  breakfast: { icon: "🌅", color: "#FF8F00", bg: "#FFF8E1", label: "Breakfast" },
  lunch:     { icon: "☀️", color: "#43A047", bg: "#E8F5E9", label: "Lunch"     },
  dinner:    { icon: "🌙", color: "#1E88E5", bg: "#E3F2FD", label: "Dinner"    },
  snack:     { icon: "🍎", color: "#8E24AA", bg: "#F3E5F5", label: "Snack"     },
};

// ── Helper: format quantity label ─────────────────────────────────────────────
const formatQty = (food) => {
  if (food.servingUnit === "piece" && food.pieces) {
    return `${food.pieces} piece${food.pieces !== 1 ? "s" : ""} (${food.grams}g)`;
  }
  return `${food.grams}g`;
};

// ── Swap Modal ────────────────────────────────────────────────────────────────
function SwapModal({ visible, meal, food, onClose, onSwapped }) {
  const [options, setOptions]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [swapping, setSwapping] = useState(null);

  useEffect(() => {
    if (!visible || !food) return;
    setLoading(true);
    API.get(`/nutrition/swap-options?meal=${meal}&foodId=${food.foodId || food._id}`)
      .then(res => setOptions(res.data?.data || []))
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [visible, food]);

  const handleSwap = async (newFood) => {
    setSwapping(newFood._id);
    try {
      await API.patch("/nutrition/swap-food", {
        meal,
        oldFoodId: food.foodId || food._id,
        newFoodId: newFood._id,
        grams:     food.grams || 100,
      });
      onSwapped();
      onClose();
    } catch {
      Alert.alert("Error", "Could not swap food. Try again.");
    } finally {
      setSwapping(null);
    }
  };

  const meta = MEAL_META[meal] || MEAL_META.lunch;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={sw.overlay}>
        <View style={sw.sheet}>
          <View style={sw.sheetHeader}>
            <View>
              <Text style={sw.sheetTitle}>Swap "{food?.name}"</Text>
              <Text style={sw.sheetSub}>Choose a replacement for {meta.label}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={sw.closeBtn}>
              <Text style={sw.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={meta.color} style={{ marginTop: 30 }} />
          ) : options.length === 0 ? (
            <Text style={sw.empty}>No alternatives found</Text>
          ) : (
            <FlatList
              data={options}
              keyExtractor={item => item._id}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => {
                const isSwapping    = swapping === item._id;
                const isPiece       = item.serving?.unit === "piece";
                const cal100        = Math.round(item.per100g?.calories || 0);
                const pro100        = (item.per100g?.protein || 0).toFixed(1);
                const servingLabel  = isPiece
                  ? `1 piece = ${item.serving.grams}g`
                  : "per 100g";

                return (
                  <TouchableOpacity
                    style={sw.optionRow}
                    onPress={() => handleSwap(item)}
                    disabled={!!swapping}
                    activeOpacity={0.7}
                  >
                    <View style={[sw.optionIcon, { backgroundColor: meta.bg }]}>
                      <Text style={{ fontSize: 18 }}>{meta.icon}</Text>
                    </View>
                    <View style={sw.optionInfo}>
                      <Text style={sw.optionName}>{item.name}</Text>
                      <Text style={sw.optionMacro}>
                        {cal100} kcal · {pro100}g protein · {servingLabel}
                      </Text>
                      {/* Piece badge */}
                      {isPiece && (
                        <View style={[sw.pieceBadge, { backgroundColor: "#e8f5e9" }]}>
                          <Text style={[sw.pieceBadgeText, { color: "#2e7d32" }]}>
                            🍽️ per piece ({item.serving.grams}g)
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={[sw.swapBtn, { backgroundColor: isSwapping ? "#eee" : meta.color }]}>
                      <Text style={sw.swapBtnText}>{isSwapping ? "..." : "Swap"}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function NutritionDashboardScreen({ navigation }) {
  const [plan, setPlan]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [swapModal, setSwapModal]   = useState({ visible: false, meal: null, food: null });

  const fetchPlan = async () => {
    try {
      const res = await API.get("/nutrition/current");
      if (!res.data || !res.data.meals) { setPlan(null); return; }
      setPlan(res.data);
    } catch (err) {
      console.log("Diet fetch error:", err.response?.data || err.message);
      setPlan(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchPlan(); }, []);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={s.loadingText}>Loading your plan...</Text>
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={s.center}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>🥗</Text>
        <Text style={s.emptyTitle}>No Diet Plan Found</Text>
        <Text style={s.emptySub}>Generate your personalized plan to get started</Text>
        <TouchableOpacity style={s.generateBtn} onPress={() => navigation.navigate("Progress")}>
          <Text style={s.generateBtnText}>Generate Plan</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalPlannedCals = Object.values(plan.meals).flat()
    .reduce((sum, f) => sum + (f.calories || 0), 0);

  return (
    <>
      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchPlan(); }}
            colors={["#4CAF50"]}
          />
        }
      >
        {/* ── Title ── */}
        <Text style={s.title}>Today's Diet Plan</Text>

        {/* ── Daily Targets ── */}
        <View style={s.card}>
          <Text style={s.cardHeading}>🎯 DAILY TARGETS</Text>
          <View style={s.macroRow}>
            <View style={[s.macroBox, { backgroundColor: "#FFF9C4" }]}>
              <Text style={[s.macroVal, { color: "#F9A825" }]}>{plan.targetCalories}</Text>
              <Text style={s.macroLbl}>Calories</Text>
            </View>
            <View style={[s.macroBox, { backgroundColor: "#BBDEFB" }]}>
              <Text style={[s.macroVal, { color: "#1565C0" }]}>{plan.macroSplit.protein}g</Text>
              <Text style={s.macroLbl}>Protein</Text>
            </View>
            <View style={[s.macroBox, { backgroundColor: "#E1BEE7" }]}>
              <Text style={[s.macroVal, { color: "#6A1B9A" }]}>{plan.macroSplit.carbs}g</Text>
              <Text style={s.macroLbl}>Carbs</Text>
            </View>
            <View style={[s.macroBox, { backgroundColor: "#FFE0B2" }]}>
              <Text style={[s.macroVal, { color: "#E65100" }]}>{plan.macroSplit.fats}g</Text>
              <Text style={s.macroLbl}>Fats</Text>
            </View>
          </View>

          {totalPlannedCals > 0 && (
            <View style={s.calProgressRow}>
              <Text style={s.calProgressText}>
                Plan covers ~{totalPlannedCals} kcal of your {plan.targetCalories} kcal goal
              </Text>
              <View style={s.calProgressBg}>
                <View style={[s.calProgressFill, {
                  width: `${Math.min((totalPlannedCals / plan.targetCalories) * 100, 100)}%`
                }]} />
              </View>
            </View>
          )}
        </View>

        {/* ── Meal Cards ── */}
        {["breakfast", "lunch", "dinner", "snack"].map((meal) => {
          const meta        = MEAL_META[meal];
          const foods       = plan.meals[meal] || [];
          const mealTotalCal = foods.reduce((sum, f) => sum + (f.calories || 0), 0);

          return (
            <View key={meal} style={[s.mealCard, { borderLeftColor: meta.color }]}>
              {/* Meal header */}
              <View style={s.mealHeader}>
                <View style={[s.mealIconBox, { backgroundColor: meta.bg }]}>
                  <Text style={{ fontSize: 20 }}>{meta.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.mealTitle}>{meta.label}</Text>
                  {mealTotalCal > 0 && (
                    <Text style={[s.mealCals, { color: meta.color }]}>
                      ~{mealTotalCal} kcal total
                    </Text>
                  )}
                </View>
                <View style={[s.mealBadge, { backgroundColor: meta.bg }]}>
                  <Text style={[s.mealBadgeText, { color: meta.color }]}>
                    {foods.length} item{foods.length !== 1 ? "s" : ""}
                  </Text>
                </View>
              </View>

              {/* Food items */}
              {foods.length > 0 ? (
                <View style={s.foodList}>
                  {foods.map((food, idx) => {
                    const isPiece  = food.servingUnit === "piece" && food.pieces;
                    const qtyLabel = formatQty(food);

                    return (
                      <View
                        key={idx}
                        style={[s.foodRow, idx < foods.length - 1 && s.foodBorder]}
                      >
                        <View style={[s.dot, { backgroundColor: meta.color }]} />

                        <View style={{ flex: 1 }}>
                          {/* Name row */}
                          <View style={s.foodTopRow}>
                            <Text style={s.foodName}>{food.name}</Text>
                            {/* Qty badge */}
                            <View style={[s.qtyBadge, {
                              backgroundColor: isPiece ? "#e8f5e9" : meta.bg
                            }]}>
                              <Text style={[s.qtyBadgeText, {
                                color: isPiece ? "#2e7d32" : meta.color
                              }]}>
                                {qtyLabel}
                              </Text>
                            </View>
                          </View>

                          {/* Calories + macros row */}
                          <View style={s.foodCalRow}>
                            <View style={[s.calBadge, { backgroundColor: meta.bg }]}>
                              <Text style={[s.calBadgeText, { color: meta.color }]}>
                                🔥 {food.calories} kcal
                              </Text>
                            </View>
                            <Text style={s.foodMacroText}>
                              P {food.protein}g · C {food.carbs}g · F {food.fats}g
                            </Text>
                          </View>
                        </View>

                        {/* Swap button */}
                        <TouchableOpacity
                          style={[s.swapChip, { borderColor: meta.color }]}
                          onPress={() => setSwapModal({ visible: true, meal, food })}
                          activeOpacity={0.7}
                        >
                          <Text style={[s.swapChipText, { color: meta.color }]}>⇄ Swap</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={s.emptyMealBox}>
                  <Text style={s.emptyMealText}>No foods planned for this meal</Text>
                  <TouchableOpacity
                    style={[s.regenerateSmall, { borderColor: meta.color }]}
                    onPress={async () => {
                      try {
                        await API.post("/nutrition/generate");
                        fetchPlan();
                      } catch {
                        Alert.alert("Error", "Could not regenerate plan.");
                      }
                    }}
                  >
                    <Text style={[s.regenerateSmallText, { color: meta.color }]}>
                      🔄 Regenerate Plan
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        {/* ── Buttons ── */}
        <TouchableOpacity
          style={[s.button, { backgroundColor: "#4CAF50" }]}
          onPress={() => navigation.navigate("MealLogger")}
          activeOpacity={0.85}
        >
          <Text style={s.buttonText}>🍛 Log Today's Meals</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.button, { backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e0e0e0" }]}
          onPress={() => {
            Alert.alert("Regenerate Plan", "This will create a new diet plan. Continue?", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Yes, Regenerate",
                onPress: async () => {
                  setLoading(true);
                  try {
                    await API.post("/nutrition/generate");
                    fetchPlan();
                  } catch {
                    Alert.alert("Error", "Could not regenerate plan.");
                    setLoading(false);
                  }
                },
              },
            ]);
          }}
          activeOpacity={0.85}
        >
          <Text style={[s.buttonText, { color: "#555" }]}>🔄 Regenerate Plan</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.button, { backgroundColor: "#1E88E5" }]}
          onPress={() => navigation.navigate("Progress")}
          activeOpacity={0.85}
        >
          <Text style={s.buttonText}>📊 View Progress</Text>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* ── Swap Modal ── */}
      {swapModal.visible && (
        <SwapModal
          visible={swapModal.visible}
          meal={swapModal.meal}
          food={swapModal.food}
          onClose={() => setSwapModal({ visible: false, meal: null, food: null })}
          onSwapped={fetchPlan}
        />
      )}
    </>
  );
}

// ── Swap Modal Styles ─────────────────────────────────────────────────────────
const sw = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:          { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "80%" },
  sheetHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  sheetTitle:     { fontSize: 18, fontWeight: "800", color: "#1a1a1a" },
  sheetSub:       { fontSize: 13, color: "#888", marginTop: 2 },
  closeBtn:       { width: 30, height: 30, borderRadius: 15, backgroundColor: "#f5f5f5", justifyContent: "center", alignItems: "center" },
  closeTxt:       { fontSize: 13, color: "#888" },
  empty:          { textAlign: "center", color: "#aaa", fontSize: 14, marginTop: 30 },
  optionRow:      { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f5f5f5", gap: 10 },
  optionIcon:     { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  optionInfo:     { flex: 1 },
  optionName:     { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  optionMacro:    { fontSize: 11, color: "#888", marginTop: 2 },
  pieceBadge:     { alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  pieceBadgeText: { fontSize: 10, fontWeight: "700" },
  swapBtn:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  swapBtnText:    { color: "#fff", fontWeight: "700", fontSize: 13 },
});

// ── Main Styles ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#F4F6F8" },
  content:     { padding: 16 },
  center:      { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F4F6F8", padding: 24 },
  loadingText: { marginTop: 12, color: "#888", fontSize: 14 },
  emptyTitle:  { fontSize: 20, fontWeight: "800", color: "#1a1a1a", marginBottom: 6 },
  emptySub:    { fontSize: 14, color: "#888", textAlign: "center", marginBottom: 24 },
  generateBtn: { backgroundColor: "#4CAF50", paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  generateBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  title: { fontSize: 22, fontWeight: "bold", color: "#1a1a1a", marginBottom: 16 },

  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 15, marginBottom: 14,
    elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6,
  },
  cardHeading:      { fontSize: 12, fontWeight: "700", color: "#888", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.8 },
  macroRow:         { flexDirection: "row", gap: 8 },
  macroBox:         { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  macroVal:         { fontSize: 16, fontWeight: "800" },
  macroLbl:         { fontSize: 10, color: "#666", marginTop: 3, fontWeight: "600" },
  calProgressRow:   { marginTop: 14 },
  calProgressText:  { fontSize: 11, color: "#888", marginBottom: 6 },
  calProgressBg:    { height: 6, backgroundColor: "#f0f0f0", borderRadius: 3, overflow: "hidden" },
  calProgressFill:  { height: "100%", backgroundColor: "#4CAF50", borderRadius: 3 },

  mealCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 12,
    borderLeftWidth: 4, elevation: 3, shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6,
  },
  mealHeader:    { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  mealIconBox:   { width: 42, height: 42, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  mealTitle:     { fontSize: 16, fontWeight: "700", color: "#1a1a1a" },
  mealCals:      { fontSize: 12, fontWeight: "600", marginTop: 1 },
  mealBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  mealBadgeText: { fontSize: 11, fontWeight: "700" },

  foodList:   { marginTop: 10, borderTopWidth: 1, borderTopColor: "#f5f5f5", paddingTop: 8 },
  foodRow:    { flexDirection: "row", alignItems: "flex-start", paddingVertical: 10, gap: 8 },
  foodBorder: { borderBottomWidth: 1, borderBottomColor: "#f9f9f9" },
  dot:        { width: 7, height: 7, borderRadius: 4, marginTop: 5 },

  foodTopRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 },
  foodName:      { fontSize: 14, fontWeight: "600", color: "#1a1a1a", flex: 1 },
  qtyBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  qtyBadgeText:  { fontSize: 12, fontWeight: "700" },
  foodCalRow:    { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 5 },
  calBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  calBadgeText:  { fontSize: 12, fontWeight: "700" },
  foodMacroText: { fontSize: 11, color: "#aaa" },

  swapChip:     { borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, marginLeft: 4 },
  swapChipText: { fontSize: 11, fontWeight: "700" },

  emptyMealBox:        { paddingVertical: 14, alignItems: "center" },
  emptyMealText:       { fontSize: 13, color: "#ccc", fontStyle: "italic", marginBottom: 8 },
  regenerateSmall:     { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  regenerateSmallText: { fontSize: 12, fontWeight: "700" },

  button: {
    padding: 15, borderRadius: 12, alignItems: "center", marginBottom: 12,
    elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4,
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
});