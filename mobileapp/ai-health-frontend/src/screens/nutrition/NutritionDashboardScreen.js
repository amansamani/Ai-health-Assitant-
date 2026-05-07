"use strict";
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ActivityIndicator, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl, Modal, FlatList, Alert,
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

/**
 * FIX: Backend returns items as { name, amount, unit } — not grams/pieces/servingUnit.
 * Format amount+unit from template item shape.
 */
const formatQty = (item) => {
  if (!item.amount && !item.unit) return "";
  return item.unit ? `${item.amount} ${item.unit}` : `${item.amount}`;
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
/**
 * FIX: API params renamed to match backend:
 *   GET  /nutrition/swap-options?mealType=lunch&excludeId=xxx   (was meal= & foodId=)
 *   POST /nutrition/swap  { mealType, newMealId }               (was PATCH /swap-food)
 */
function SwapModal({ visible, mealType, combo, onClose, onSwapped }) {
  const [options, setOptions]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [swapping, setSwapping] = useState(null);
  const meta = MEAL_META[mealType] || MEAL_META.lunch;

  useEffect(() => {
    if (!visible || !combo) return;
    setOptions([]);
    setLoading(true);
    // FIX: correct query params — mealType + excludeId (templateId from backend)
    API.get(`/nutrition/swap-options?mealType=${mealType}&excludeId=${combo.templateId || ""}`)
      .then(res => setOptions(res.data?.data || []))
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [visible, combo, mealType]);

  const handleSwap = async (newMeal) => {
    setSwapping(newMeal.id);
    try {
      // FIX: correct endpoint POST /nutrition/swap with { mealType, newMealId }
      await API.post("/nutrition/swap", {
        mealType,
        newMealId: newMeal.id,
      });
      onSwapped();
      onClose();
    } catch {
      Alert.alert("Swap Failed", "Could not swap meal. Please try again.");
    } finally {
      setSwapping(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={sw.overlay}>
        <View style={sw.sheet}>

          <View style={sw.header}>
            <View>
              <Text style={sw.title}>Swap "{combo?.mealName}"</Text>
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
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingBottom: 24 }}
              renderItem={({ item }) => {
                const busy = swapping === item.id;
                const [minCal, maxCal] = item.macroRange?.calories || [0, 0];
                const [minPro, maxPro] = item.macroRange?.protein  || [0, 0];
                const [minCarb, maxCarb] = item.macroRange?.carbs  || [0, 0];
                const [minFat, maxFat]  = item.macroRange?.fats    || [0, 0];
                const midCal  = Math.round((minCal + maxCal) / 2);
                const midPro  = ((minPro + maxPro) / 2).toFixed(1);
                const midCarb = ((minCarb + maxCarb) / 2).toFixed(1);
                const midFat  = ((minFat + maxFat) / 2).toFixed(1);

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
                        ~{midCal} kcal · P {midPro}g · C {midCarb}g · F {midFat}g
                      </Text>
                      {item.cuisine && (
                        <Text style={sw.servingLine}>{item.cuisine} · {item.difficulty}</Text>
                      )}
                      {item.dietType && (
                        <View style={[sw.badge, { backgroundColor: item.dietType === "veg" ? "#e8f5e9" : "#fce4ec" }]}>
                          <Text style={[sw.badgeText, { color: item.dietType === "veg" ? "#2e7d32" : "#c62828" }]}>
                            {item.dietType === "veg" ? "🌱 Veg" : item.dietType === "eggetarian" ? "🥚 Eggetarian" : "🍗 Non-veg"}
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
/**
 * FIX: Backend shape per meal slot is an ARRAY of combo objects:
 *   meals.lunch = [{
 *     templateId, mealName, cuisine, difficulty, prepTime, budget, tags,
 *     items: [{ name, amount, unit }],
 *     calories, protein, carbs, fats, fiber
 *   }]
 *
 * Previously frontend treated each combo as a flat food row — wrong.
 * Now we:
 *   - Show combo.mealName as the meal combo name
 *   - Map combo.items for individual ingredient rows
 *   - Use combo.calories/protein/carbs/fats for macros
 */
function MealCard({ mealType, combos, meta, onSwap, onRegenerate }) {
  const totalCal     = combos.reduce((s, c) => s + (c.calories ?? 0), 0);
  const totalProtein = combos.reduce((s, c) => s + (c.protein  ?? 0), 0);

  return (
    <View style={[s.mealCard, { borderLeftColor: meta.color }]}>
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
            {combos.length} combo{combos.length !== 1 ? "s" : ""}
          </Text>
        </View>
      </View>

      {combos.length > 0 ? (
        <View style={s.foodList}>
          {combos.map((combo, ci) => (
            <View key={ci} style={[s.comboBlock, ci < combos.length - 1 && s.foodDivider]}>

              {/* Combo name row */}
              <View style={s.comboNameRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.comboName}>{combo.mealName}</Text>
                  {(combo.cuisine || combo.prepTime) && (
                    <Text style={s.comboMeta}>
                      {[combo.cuisine, combo.prepTime ? `${combo.prepTime} min` : null]
                        .filter(Boolean).join(" · ")}
                    </Text>
                  )}
                </View>

                {/* Macro chips */}
                <View style={s.macroPill}>
                  <View style={[s.calChip, { backgroundColor: meta.bg }]}>
                    <Text style={[s.calChipTxt, { color: meta.color }]}>🔥 {combo.calories} kcal</Text>
                  </View>
                </View>

                {/* Swap button — swaps the whole combo */}
                <TouchableOpacity
                  style={[s.swapChip, { borderColor: meta.color }]}
                  onPress={() => onSwap(mealType, combo)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.swapChipTxt, { color: meta.color }]}>⇄ Swap</Text>
                </TouchableOpacity>
              </View>

              {/* Macro summary row */}
              <Text style={s.macroTxt}>
                P {combo.protein ?? 0}g · C {combo.carbs ?? 0}g · F {combo.fats ?? 0}g
                {combo.fiber ? ` · Fiber ${combo.fiber}g` : ""}
              </Text>

              {/* Ingredient items */}
              {combo.items?.length > 0 && (
                <View style={s.itemsList}>
                  {combo.items.map((item, ii) => (
                    <View key={ii} style={s.itemRow}>
                      <View style={[s.dot, { backgroundColor: meta.color }]} />
                      <Text style={s.itemName}>{item.name}</Text>
                      <View style={[s.qtyBadge, { backgroundColor: meta.bg }]}>
                        <Text style={[s.qtyTxt, { color: meta.color }]}>
                          {formatQty(item)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
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
  // FIX: swap state now tracks mealType + combo (not meal + food)
  const [swapState, setSwapState]   = useState({ visible: false, mealType: null, combo: null });

  const fetchPlan = useCallback(async () => {
    try {
      const res = await API.get("/nutrition/current");
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

  const handleGenerate = async () => {
    setLoading(true);
    try {
      await API.post("/nutrition/generate");
      await fetchPlan();
    } catch (err) {
      console.error("Generate plan error:", err.response?.data || err.message);
      Alert.alert("Error", "Could not generate plan. Please try again.");
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={s.loadingTxt}>Loading your plan…</Text>
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={s.center}>
        <Text style={{ fontSize: 52, marginBottom: 14 }}>🥗</Text>
        <Text style={s.emptyTitle}>No Diet Plan Found</Text>
        <Text style={s.emptySub}>Generate your personalised plan to get started</Text>
        <TouchableOpacity style={s.genBtn} onPress={handleGenerate}>
          <Text style={s.genBtnTxt}>Generate My Plan</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { meals, summary } = plan;
  const {
    targetCalories,
    plannedCalories,
    macroTargets,
    actualMacros,
    macroAchievement,
    profileSnapshot,
  } = summary;

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

  const calPct       = pct(plannedCalories, targetCalories);
  const calDiff      = plannedCalories - targetCalories;
  const calDiffLabel = calDiff > 0 ? `+${calDiff}` : `${calDiff}`;
  const calDiffColor = Math.abs(calDiff) < 100 ? "#4CAF50" : calDiff > 0 ? "#FF8F00" : "#1E88E5";

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

          <MacroBar label="Protein"       actual={actual.protein} target={targets.protein} color="#1E88E5" />
          <MacroBar label="Carbohydrates" actual={actual.carbs}   target={targets.carbs}   color="#43A047" />
          <MacroBar label="Fats"          actual={actual.fats}    target={targets.fats}    color="#FF8F00" />

          {macroAchievement && (
            <View style={s.achRow}>
              {["protein", "carbs", "fats"].map((k) => {
                const val = macroAchievement[k];
                if (val == null) return null;
                const ok    = val >= 80 && val <= 115;
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

          {(actual.fiber > 0 || actual.sugar > 0) && (
            <View style={s.extraRow}>
              {actual.fiber > 0 && <Text style={s.extraTxt}>🌾 Fiber: {actual.fiber}g</Text>}
              {actual.sugar > 0 && <Text style={s.extraTxt}>🍬 Sugar: {actual.sugar}g</Text>}
            </View>
          )}
        </View>

        {/* ── Meal Cards ── */}
        {MEAL_ORDER.map((mealType) => (
          <MealCard
            key={mealType}
            mealType={mealType}
            combos={meals[mealType] ?? []}
            meta={MEAL_META[mealType]}
            onSwap={(mt, combo) => setSwapState({ visible: true, mealType: mt, combo })}
            onRegenerate={handleRegenerate}
          />
        ))}

        {/* ── Weekly Progress button ── */}
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
        mealType={swapState.mealType}
        combo={swapState.combo}
        onClose={() => setSwapState({ visible: false, mealType: null, combo: null })}
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

  calRow:     { flexDirection: "row", justifyContent: "space-around", alignItems: "center", marginBottom: 14 },
  calBlock:   { alignItems: "center" },
  calBig:     { fontSize: 26, fontWeight: "900", color: "#1a1a1a" },
  calLbl:     { fontSize: 11, color: "#aaa", marginTop: 2, fontWeight: "600" },
  calDivider: { width: 1, height: 36, backgroundColor: "#f0f0f0" },
  calBar:     { height: 8, backgroundColor: "#f0f0f0", borderRadius: 4, overflow: "hidden", marginBottom: 6 },
  calBarFill: { height: "100%", borderRadius: 4 },
  calPctTxt:  { fontSize: 11, color: "#aaa", textAlign: "right", fontWeight: "600" },

  achRow:     { flexDirection: "row", gap: 8, marginTop: 12 },
  achChip:    { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: "center" },
  achVal:     { fontSize: 16, fontWeight: "800" },
  achLbl:     { fontSize: 10, color: "#888", marginTop: 2, fontWeight: "600" },

  extraRow:   { flexDirection: "row", gap: 12, marginTop: 10, borderTopWidth: 1, borderTopColor: "#f5f5f5", paddingTop: 10 },
  extraTxt:   { fontSize: 12, color: "#888", fontWeight: "600" },

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

  // FIX: new combo-level styles
  comboBlock:   { paddingVertical: 10 },
  comboNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  comboName:    { fontSize: 14, fontWeight: "700", color: "#1a1a1a", flex: 1 },
  comboMeta:    { fontSize: 11, color: "#aaa", marginTop: 1 },
  macroPill:    { flexDirection: "row", gap: 4 },

  foodDivider: { borderBottomWidth: 1, borderBottomColor: "#f9f9f9" },
  dot:         { width: 7, height: 7, borderRadius: 4, marginTop: 5 },

  // FIX: ingredient item row styles
  itemsList:  { marginTop: 8, gap: 4 },
  itemRow:    { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3 },
  itemName:   { fontSize: 13, color: "#333", flex: 1 },

  foodTop:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 },
  foodName:    { fontSize: 14, fontWeight: "600", color: "#1a1a1a", flex: 1 },
  qtyBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  qtyTxt:      { fontSize: 12, fontWeight: "700" },

  foodMacroRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 5, flexWrap: "wrap" },
  calChip:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  calChipTxt:   { fontSize: 12, fontWeight: "700" },
  macroTxt:     { fontSize: 11, color: "#aaa", marginBottom: 6 },

  swapChip:    { borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
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