import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ActivityIndicator, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl, Modal, FlatList, Alert,
  Animated,
} from "react-native";
import API from "../../services/api";

// ─── Constants ────────────────────────────────────────────────────────────────

const MEAL_META = {
  breakfast: { icon: "🌅", color: "#FF8F00", bg: "#FFF8E1", label: "Breakfast" },
  lunch:     { icon: "☀️",  color: "#43A047", bg: "#E8F5E9", label: "Lunch"     },
  dinner:    { icon: "🌙",  color: "#1E88E5", bg: "#E3F2FD", label: "Dinner"    },
  snack:     { icon: "🍎",  color: "#8E24AA", bg: "#F3E5F5", label: "Snack"     },
};

const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatQty = (food) => {
  if (food.servingUnit === "piece" && food.pieces) {
    return `${food.pieces} pc${food.pieces !== 1 ? "s" : ""} (${food.grams}g)`;
  }
  return `${food.grams}g`;
};

/** Safe accessor — backend returns proteinG / carbsG / fatsG */
const getMacro = (macros, key) => {
  // handle both "protein" and "proteinG" shapes
  return macros?.[key] ?? macros?.[`${key}G`] ?? macros?.[key.replace("G", "")] ?? 0;
};

const pct = (val, total) =>
  total > 0 ? Math.min(Math.round((val / total) * 100), 100) : 0;

// ─── MacroBar ─────────────────────────────────────────────────────────────────

function MacroBar({ label, actual, target, color }) {
  const ratio = pct(actual, target);
  const over  = actual > target;
  return (
    <View style={mb.row}>
      <View style={mb.labelRow}>
        <Text style={mb.label}>{label}</Text>
        <Text style={[mb.value, over && { color: "#e53935" }]}>
          {actual}g <Text style={mb.target}>/ {target}g</Text>
        </Text>
      </View>
      <View style={mb.track}>
        <View style={[mb.fill, { width: `${ratio}%`, backgroundColor: over ? "#e53935" : color }]} />
      </View>
    </View>
  );
}
const mb = StyleSheet.create({
  row:      { marginBottom: 10 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label:    { fontSize: 12, fontWeight: "700", color: "#555" },
  value:    { fontSize: 12, fontWeight: "700", color: "#1a1a1a" },
  target:   { fontWeight: "400", color: "#aaa" },
  track:    { height: 8, backgroundColor: "#f0f0f0", borderRadius: 4, overflow: "hidden" },
  fill:     { height: "100%", borderRadius: 4 },
});

// ─── SwapModal ────────────────────────────────────────────────────────────────

function SwapModal({ visible, meal, food, onClose, onSwapped }) {
  const [options, setOptions]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [swapping, setSwapping] = useState(null);
  const meta = MEAL_META[meal] || MEAL_META.lunch;

  useEffect(() => {
    if (!visible || !food) return;
    setOptions([]);
    setLoading(true);
    // foodId is the backend _id field stored in meal entry
    const id = food.foodId || food._id;
    API.get(`/nutrition/swap-options?meal=${meal}&foodId=${id}`)
      .then(res => setOptions(res.data?.data || []))
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [visible, food, meal]);

  const handleSwap = async (newFood) => {
    setSwapping(newFood._id);
    try {
      await API.patch("/nutrition/swap-food", {
        meal,
        oldFoodId: food.foodId || food._id,
        newFoodId: newFood._id,
        grams:     food.grams ?? 100,
      });
      onSwapped();
      onClose();
    } catch {
      Alert.alert("Swap Failed", "Could not swap food. Please try again.");
    } finally {
      setSwapping(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={sw.overlay}>
        <View style={sw.sheet}>

          {/* Header */}
          <View style={sw.header}>
            <View>
              <Text style={sw.title}>Swap "{food?.name}"</Text>
              <Text style={sw.sub}>{meta.label} alternatives</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={sw.closeBtn}>
              <Text style={sw.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={meta.color} style={{ marginTop: 32 }} />
          ) : options.length === 0 ? (
            <Text style={sw.empty}>No alternatives found for this category.</Text>
          ) : (
            <FlatList
              data={options}
              keyExtractor={item => item._id}
              contentContainerStyle={{ paddingBottom: 24 }}
              renderItem={({ item }) => {
                const busy       = swapping === item._id;
                const isPiece    = item.serving?.unit === "piece";
                const cal100     = Math.round(item.per100g?.calories ?? 0);
                const pro100     = (item.per100g?.protein ?? 0).toFixed(1);
                const carb100    = (item.per100g?.carbs ?? 0).toFixed(1);
                const fat100     = (item.per100g?.fats ?? 0).toFixed(1);
                const servingLbl = isPiece
                  ? `1 piece = ${item.serving.grams}g`
                  : "per 100g";

                return (
                  <TouchableOpacity
                    style={sw.row}
                    onPress={() => handleSwap(item)}
                    disabled={!!swapping}
                    activeOpacity={0.7}
                  >
                    <View style={[sw.iconBox, { backgroundColor: meta.bg }]}>
                      <Text style={{ fontSize: 20 }}>{meta.icon}</Text>
                    </View>

                    <View style={sw.info}>
                      <Text style={sw.name}>{item.name}</Text>
                      <Text style={sw.macroLine}>
                        {cal100} kcal · P {pro100}g · C {carb100}g · F {fat100}g
                      </Text>
                      <Text style={sw.servingLine}>{servingLbl}</Text>

                      {/* Diet type badge */}
                      {item.dietType && (
                        <View style={[sw.badge, { backgroundColor: item.dietType === "veg" ? "#e8f5e9" : "#fce4ec" }]}>
                          <Text style={[sw.badgeText, { color: item.dietType === "veg" ? "#2e7d32" : "#c62828" }]}>
                            {item.dietType === "veg" ? "🌱 Veg" : item.dietType === "vegan" ? "🌿 Vegan" : "🍗 Non-veg"}
                          </Text>
                        </View>
                      )}
                    </View>

                    <TouchableOpacity
                      style={[sw.swapBtn, { backgroundColor: busy ? "#eee" : meta.color }]}
                      onPress={() => handleSwap(item)}
                      disabled={!!swapping}
                    >
                      <Text style={[sw.swapBtnTxt, { color: busy ? "#999" : "#fff" }]}>
                        {busy ? "..." : "Swap"}
                      </Text>
                    </TouchableOpacity>
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

// ─── MealCard ─────────────────────────────────────────────────────────────────

function MealCard({ meal, foods, meta, onSwap, onRegenerate }) {
  const totalCal     = foods.reduce((s, f) => s + (f.calories ?? 0), 0);
  const totalProtein = foods.reduce((s, f) => s + (f.protein ?? 0), 0);

  return (
    <View style={[s.mealCard, { borderLeftColor: meta.color }]}>
      {/* Header */}
      <View style={s.mealHeader}>
        <View style={[s.mealIconBox, { backgroundColor: meta.bg }]}>
          <Text style={{ fontSize: 22 }}>{meta.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.mealTitle}>{meta.label}</Text>
          {totalCal > 0 && (
            <Text style={[s.mealSub, { color: meta.color }]}>
              {totalCal} kcal · {totalProtein.toFixed(1)}g protein
            </Text>
          )}
        </View>
        <View style={[s.badge, { backgroundColor: meta.bg }]}>
          <Text style={[s.badgeTxt, { color: meta.color }]}>
            {foods.length} item{foods.length !== 1 ? "s" : ""}
          </Text>
        </View>
      </View>

      {/* Food rows */}
      {foods.length > 0 ? (
        <View style={s.foodList}>
          {foods.map((food, idx) => {
            const isPiece = food.servingUnit === "piece" && food.pieces;
            return (
              <View key={idx} style={[s.foodRow, idx < foods.length - 1 && s.foodDivider]}>
                <View style={[s.dot, { backgroundColor: meta.color }]} />

                <View style={{ flex: 1 }}>
                  {/* Name + qty */}
                  <View style={s.foodTop}>
                    <Text style={s.foodName} numberOfLines={1}>{food.name}</Text>
                    <View style={[s.qtyBadge, { backgroundColor: isPiece ? "#e8f5e9" : meta.bg }]}>
                      <Text style={[s.qtyTxt, { color: isPiece ? "#2e7d32" : meta.color }]}>
                        {formatQty(food)}
                      </Text>
                    </View>
                  </View>

                  {/* Calories + macros */}
                  <View style={s.foodMacroRow}>
                    <View style={[s.calChip, { backgroundColor: meta.bg }]}>
                      <Text style={[s.calChipTxt, { color: meta.color }]}>🔥 {food.calories} kcal</Text>
                    </View>
                    <Text style={s.macroTxt}>
                      P {food.protein}g · C {food.carbs}g · F {food.fats}g
                      {food.fiber ? ` · Fiber ${food.fiber}g` : ""}
                    </Text>
                  </View>
                </View>

                {/* Swap */}
                <TouchableOpacity
                  style={[s.swapChip, { borderColor: meta.color }]}
                  onPress={() => onSwap(meal, food)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.swapChipTxt, { color: meta.color }]}>⇄ Swap</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={s.emptyMeal}>
          <Text style={s.emptyMealTxt}>No foods planned for this meal</Text>
          <TouchableOpacity style={[s.regenSmall, { borderColor: meta.color }]} onPress={onRegenerate}>
            <Text style={[s.regenSmallTxt, { color: meta.color }]}>🔄 Regenerate Plan</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function NutritionDashboardScreen({ navigation }) {
  const [plan, setPlan]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [swapState, setSwapState]   = useState({ visible: false, meal: null, food: null });

  const fetchPlan = useCallback(async () => {
    try {
      const res = await API.get("/nutrition/current");
      // Backend returns { meals, summary } — guard both
      if (res.data?.meals && res.data?.summary) {
        setPlan(res.data);
      } else {
        setPlan(null);
      }
    } catch (err) {
      console.warn("Diet fetch error:", err.response?.data || err.message);
      setPlan(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  const handleRegenerate = () => {
    Alert.alert(
      "Regenerate Plan",
      "This will create a new diet plan for today. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Regenerate",
          onPress: async () => {
            setLoading(true);
            try {
              await API.post("/nutrition/generate");
              await fetchPlan();
            } catch {
              Alert.alert("Error", "Could not regenerate plan. Try again.");
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // ── Loading ──
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={s.loadingTxt}>Loading your plan…</Text>
      </View>
    );
  }

  // ── Empty state ──
  if (!plan) {
    return (
      <View style={s.center}>
        <Text style={{ fontSize: 52, marginBottom: 14 }}>🥗</Text>
        <Text style={s.emptyTitle}>No Diet Plan Found</Text>
        <Text style={s.emptySub}>Generate your personalised plan to get started</Text>
        <TouchableOpacity style={s.genBtn} onPress={() => navigation.navigate("Progress")}>
          <Text style={s.genBtnTxt}>Generate My Plan</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Data from backend (summary shape) ──
  const { meals, summary } = plan;
  const {
    targetCalories,
    plannedCalories,
    macroTargets,    // { proteinG, carbsG, fatsG }
    actualMacros,    // { proteinG, carbsG, fatsG, fiberG, sugarG }
    macroAchievement,// { protein, carbs, fats } — % vs target
    profileSnapshot,
  } = summary;

  // Normalise keys (backend uses proteinG/carbsG/fatsG)
  const targets = {
    protein: macroTargets?.proteinG ?? macroTargets?.protein ?? 0,
    carbs:   macroTargets?.carbsG   ?? macroTargets?.carbs   ?? 0,
    fats:    macroTargets?.fatsG    ?? macroTargets?.fats    ?? 0,
  };
  const actual = {
    protein: actualMacros?.proteinG ?? actualMacros?.protein ?? 0,
    carbs:   actualMacros?.carbsG   ?? actualMacros?.carbs   ?? 0,
    fats:    actualMacros?.fatsG    ?? actualMacros?.fats    ?? 0,
    fiber:   actualMacros?.fiberG   ?? actualMacros?.fiber   ?? 0,
    sugar:   actualMacros?.sugarG   ?? actualMacros?.sugar   ?? 0,
  };

  const calPct        = pct(plannedCalories, targetCalories);
  const calDiff       = plannedCalories - targetCalories;
  const calDiffLabel  = calDiff > 0 ? `+${calDiff}` : `${calDiff}`;
  const calDiffColor  = Math.abs(calDiff) < 100 ? "#4CAF50" : calDiff > 0 ? "#FF8F00" : "#1E88E5";

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
        {/* ── Title row ── */}
        <View style={s.titleRow}>
          <View>
            <Text style={s.title}>Today's Plan</Text>
            {profileSnapshot && (
              <Text style={s.titleSub}>
                {profileSnapshot.goal?.toUpperCase()} · {profileSnapshot.dietType?.toUpperCase()}
              </Text>
            )}
          </View>
          <TouchableOpacity style={s.regenBtn} onPress={handleRegenerate}>
            <Text style={s.regenBtnTxt}>🔄</Text>
          </TouchableOpacity>
        </View>

        {/* ── Calorie summary card ── */}
        <View style={s.card}>
          <Text style={s.cardHeading}>🎯 CALORIE BUDGET</Text>
          <View style={s.calRow}>
            <View style={s.calBlock}>
              <Text style={s.calBig}>{plannedCalories}</Text>
              <Text style={s.calLbl}>planned</Text>
            </View>
            <View style={s.calDivider} />
            <View style={s.calBlock}>
              <Text style={[s.calBig, { color: "#4CAF50" }]}>{targetCalories}</Text>
              <Text style={s.calLbl}>target</Text>
            </View>
            <View style={s.calDivider} />
            <View style={s.calBlock}>
              <Text style={[s.calBig, { color: calDiffColor }]}>{calDiffLabel}</Text>
              <Text style={s.calLbl}>difference</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={s.calBar}>
            <View style={[s.calBarFill, {
              width: `${calPct}%`,
              backgroundColor: calPct > 105 ? "#e53935" : calPct > 95 ? "#4CAF50" : "#FF8F00",
            }]} />
          </View>
          <Text style={s.calPctTxt}>{calPct}% of daily goal</Text>
        </View>

        {/* ── Macro breakdown card ── */}
        <View style={s.card}>
          <Text style={s.cardHeading}>💪 MACRO BREAKDOWN</Text>

          <MacroBar
            label="Protein"
            actual={actual.protein}
            target={targets.protein}
            color="#1E88E5"
          />
          <MacroBar
            label="Carbohydrates"
            actual={actual.carbs}
            target={targets.carbs}
            color="#43A047"
          />
          <MacroBar
            label="Fats"
            actual={actual.fats}
            target={targets.fats}
            color="#FF8F00"
          />

          {/* Achievement row */}
          {macroAchievement && (
            <View style={s.achRow}>
              {["protein", "carbs", "fats"].map((k) => {
                const val = macroAchievement[k];
                if (val == null) return null;
                const ok  = val >= 80 && val <= 115;
                const color = ok ? "#4CAF50" : val > 115 ? "#e53935" : "#FF8F00";
                return (
                  <View key={k} style={[s.achChip, { backgroundColor: ok ? "#e8f5e9" : "#fff3e0" }]}>
                    <Text style={[s.achVal, { color }]}>{val}%</Text>
                    <Text style={s.achLbl}>{k}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Fiber / Sugar extras */}
          {(actual.fiber > 0 || actual.sugar > 0) && (
            <View style={s.extraRow}>
              {actual.fiber > 0 && (
                <Text style={s.extraTxt}>🌾 Fiber: {actual.fiber}g</Text>
              )}
              {actual.sugar > 0 && (
                <Text style={s.extraTxt}>🍬 Sugar: {actual.sugar}g</Text>
              )}
            </View>
          )}
        </View>

        {/* ── Meal Cards ── */}
        {MEAL_ORDER.map((meal) => (
          <MealCard
            key={meal}
            meal={meal}
            foods={meals[meal] ?? []}
            meta={MEAL_META[meal]}
            onSwap={(m, f) => setSwapState({ visible: true, meal: m, food: f })}
            onRegenerate={handleRegenerate}
          />
        ))}

        {/* ── Progress button ── */}
        <TouchableOpacity
          style={[s.btn, { backgroundColor: "#1E88E5" }]}
          onPress={() => navigation.navigate("Progress")}
          activeOpacity={0.85}
        >
          <Text style={s.btnTxt}>📊 View Weekly Progress</Text>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* ── Swap Modal ── */}
      <SwapModal
        visible={swapState.visible}
        meal={swapState.meal}
        food={swapState.food}
        onClose={() => setSwapState({ visible: false, meal: null, food: null })}
        onSwapped={fetchPlan}
      />
    </>
  );
}

// ─── Swap Modal Styles ────────────────────────────────────────────────────────

const sw = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet:       { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "80%" },
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  title:       { fontSize: 18, fontWeight: "800", color: "#1a1a1a" },
  sub:         { fontSize: 13, color: "#999", marginTop: 2 },
  closeBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: "#f5f5f5", justifyContent: "center", alignItems: "center" },
  closeX:      { fontSize: 14, color: "#777" },
  empty:       { textAlign: "center", color: "#aaa", fontSize: 14, marginTop: 32 },
  row:         { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f5f5f5", gap: 10 },
  iconBox:     { width: 42, height: 42, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  info:        { flex: 1 },
  name:        { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  macroLine:   { fontSize: 11, color: "#888", marginTop: 2 },
  servingLine: { fontSize: 11, color: "#aaa", marginTop: 1 },
  badge:       { alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  badgeText:   { fontSize: 10, fontWeight: "700" },
  swapBtn:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  swapBtnTxt:  { fontWeight: "700", fontSize: 13 },
});

// ─── Main Styles ──────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#F4F6F8" },
  content:     { padding: 16 },
  center:      { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F4F6F8", padding: 24 },
  loadingTxt:  { marginTop: 12, color: "#888", fontSize: 14 },
  emptyTitle:  { fontSize: 22, fontWeight: "800", color: "#1a1a1a", marginBottom: 6 },
  emptySub:    { fontSize: 14, color: "#888", textAlign: "center", marginBottom: 24 },
  genBtn:      { backgroundColor: "#4CAF50", paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  genBtnTxt:   { color: "#fff", fontWeight: "800", fontSize: 15 },

  titleRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title:       { fontSize: 24, fontWeight: "900", color: "#1a1a1a" },
  titleSub:    { fontSize: 12, color: "#aaa", fontWeight: "600", marginTop: 2, letterSpacing: 0.6 },
  regenBtn:    { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
  regenBtnTxt: { fontSize: 18 },

  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 14,
    elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6,
  },
  cardHeading: { fontSize: 11, fontWeight: "800", color: "#aaa", marginBottom: 14, textTransform: "uppercase", letterSpacing: 1 },

  // Calorie card
  calRow:     { flexDirection: "row", justifyContent: "space-around", alignItems: "center", marginBottom: 14 },
  calBlock:   { alignItems: "center" },
  calBig:     { fontSize: 26, fontWeight: "900", color: "#1a1a1a" },
  calLbl:     { fontSize: 11, color: "#aaa", marginTop: 2, fontWeight: "600" },
  calDivider: { width: 1, height: 36, backgroundColor: "#f0f0f0" },
  calBar:     { height: 8, backgroundColor: "#f0f0f0", borderRadius: 4, overflow: "hidden", marginBottom: 6 },
  calBarFill: { height: "100%", borderRadius: 4 },
  calPctTxt:  { fontSize: 11, color: "#aaa", textAlign: "right", fontWeight: "600" },

  // Achievement chips
  achRow:     { flexDirection: "row", gap: 8, marginTop: 12 },
  achChip:    { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: "center" },
  achVal:     { fontSize: 16, fontWeight: "800" },
  achLbl:     { fontSize: 10, color: "#888", marginTop: 2, fontWeight: "600" },

  // Extras
  extraRow:   { flexDirection: "row", gap: 12, marginTop: 10, borderTopWidth: 1, borderTopColor: "#f5f5f5", paddingTop: 10 },
  extraTxt:   { fontSize: 12, color: "#888", fontWeight: "600" },

  // Meal card
  mealCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 12,
    borderLeftWidth: 4, elevation: 3, shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6,
  },
  mealHeader:  { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  mealIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  mealTitle:   { fontSize: 16, fontWeight: "800", color: "#1a1a1a" },
  mealSub:     { fontSize: 12, fontWeight: "600", marginTop: 1 },
  badge:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeTxt:    { fontSize: 11, fontWeight: "700" },

  foodList:    { marginTop: 10, borderTopWidth: 1, borderTopColor: "#f5f5f5", paddingTop: 8 },
  foodRow:     { flexDirection: "row", alignItems: "flex-start", paddingVertical: 10, gap: 8 },
  foodDivider: { borderBottomWidth: 1, borderBottomColor: "#f9f9f9" },
  dot:         { width: 7, height: 7, borderRadius: 4, marginTop: 5 },

  foodTop:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 },
  foodName:    { fontSize: 14, fontWeight: "600", color: "#1a1a1a", flex: 1 },
  qtyBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  qtyTxt:      { fontSize: 12, fontWeight: "700" },

  foodMacroRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 5, flexWrap: "wrap" },
  calChip:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  calChipTxt:   { fontSize: 12, fontWeight: "700" },
  macroTxt:     { fontSize: 11, color: "#aaa" },

  swapChip:    { borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, marginLeft: 4 },
  swapChipTxt: { fontSize: 11, fontWeight: "700" },

  emptyMeal:    { paddingVertical: 16, alignItems: "center" },
  emptyMealTxt: { fontSize: 13, color: "#ccc", fontStyle: "italic", marginBottom: 8 },
  regenSmall:   { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  regenSmallTxt:{ fontSize: 12, fontWeight: "700" },

  btn: {
    padding: 15, borderRadius: 12, alignItems: "center", marginBottom: 12,
    elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4,
  },
  btnTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
});