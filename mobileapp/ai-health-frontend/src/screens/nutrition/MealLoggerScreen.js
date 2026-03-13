import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Dimensions,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  getTodayLog, getMealHistory, deleteMealLog, getHealthProfile, getCurrentPlan,
} from "../../services/nutritionService";

const { width } = Dimensions.get("window");

const MEAL_META = {
  breakfast: { icon: "🌅", label: "Breakfast", color: "#FF8F00" },
  lunch:     { icon: "☀️", label: "Lunch",     color: "#43A047" },
  dinner:    { icon: "🌙", label: "Dinner",     color: "#1E88E5" },
  snacks:    { icon: "🍎", label: "Snacks",     color: "#8E24AA" },
};

// ── Calorie Ring ──────────────────────────────────────────────────────────────
function CalorieRing({ consumed, goal }) {
  const pct      = goal > 0 ? Math.min(consumed / goal, 1) : 0;
  const remaining = Math.max(goal - consumed, 0);
  const over      = consumed > goal;
  const ringColor = over ? "#e53935" : "#FF6F00";
  const SIZE      = 170;
  const BORDER    = 14;

  // Simulate arc via 4-border trick
  const deg = pct * 360;

  return (
    <View style={{ alignSelf: "center", width: SIZE, height: SIZE, justifyContent: "center", alignItems: "center", marginVertical: 16 }}>
      {/* Track */}
      <View style={{
        position: "absolute", width: SIZE, height: SIZE,
        borderRadius: SIZE / 2, borderWidth: BORDER, borderColor: "#f0f0f0",
      }} />
      {/* Fill — top-right quarter */}
      {pct > 0 && (
        <View style={{
          position: "absolute", width: SIZE, height: SIZE,
          borderRadius: SIZE / 2, borderWidth: BORDER,
          borderColor: "transparent",
          borderTopColor: ringColor,
          borderRightColor: pct >= 0.5 ? ringColor : "transparent",
          borderBottomColor: pct >= 0.75 ? ringColor : "transparent",
          borderLeftColor: pct >= 1 ? ringColor : "transparent",
          transform: [{ rotate: "-90deg" }],
        }} />
      )}
      {/* Center */}
      <View style={{ alignItems: "center" }}>
        <Text style={{ fontSize: 30, fontWeight: "800", color: over ? "#e53935" : "#1a1a1a" }}>
          {Math.round(consumed)}
        </Text>
        <Text style={{ fontSize: 11, color: "#aaa", fontWeight: "500" }}>kcal eaten</Text>
        <View style={{ width: 32, height: 1, backgroundColor: "#e0e0e0", marginVertical: 5 }} />
        <Text style={{ fontSize: 20, fontWeight: "700", color: over ? "#e53935" : "#FF6F00" }}>
          {over ? `+${Math.round(consumed - goal)}` : Math.round(remaining)}
        </Text>
        <Text style={{ fontSize: 10, color: "#aaa", fontWeight: "500" }}>
          {over ? "over goal" : "remaining"}
        </Text>
      </View>
    </View>
  );
}

// ── Macro Bar ─────────────────────────────────────────────────────────────────
function MacroBar({ label, consumed, goal, color }) {
  const pct  = goal > 0 ? Math.min((consumed / goal) * 100, 100) : 0;
  const over = consumed > goal;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14, gap: 10 }}>
      <Text style={{ width: 92, fontSize: 13, fontWeight: "600", color: "#444" }}>{label}</Text>
      <View style={{ flex: 1, height: 8, backgroundColor: "#f0f0f0", borderRadius: 4, overflow: "hidden" }}>
        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: over ? "#e53935" : color, borderRadius: 4 }} />
      </View>
      <Text style={{ width: 76, fontSize: 12, textAlign: "right" }}>
        <Text style={{ color: over ? "#e53935" : "#1a1a1a", fontWeight: "700" }}>
          {parseFloat(consumed.toFixed(1))}
        </Text>
        <Text style={{ color: "#aaa" }}>/{goal}g</Text>
      </Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function MealLoggerScreen({ navigation }) {
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayLog, setTodayLog]     = useState(null);
  const [history, setHistory]       = useState([]);
  const [goals, setGoals]           = useState({
    calories: 2000, protein: 120, carbs: 250, fats: 65,
  });

  const todayDate = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long",
  });

  const loadData = async () => {
    try {
      const [logRes, histRes, profileRes, planRes] = await Promise.allSettled([
        getTodayLog(),
        getMealHistory(7),
        getHealthProfile(),
        getCurrentPlan(),
      ]);

      // ── Today's log ──
      if (logRes.status === "fulfilled" && logRes.value?.data) {
        setTodayLog(logRes.value.data);
      } else {
        setTodayLog({
          grouped: { breakfast: [], lunch: [], dinner: [], snacks: [] },
          totals:  { calories: 0, protein: 0, carbs: 0, fats: 0 },
        });
      }

      // ── Past history ──
      if (histRes.status === "fulfilled" && histRes.value?.data) {
        const grouped = {};
        const todayStr = new Date().toISOString().split("T")[0];
        for (const meal of histRes.value.data) {
          const date = new Date(meal.loggedAt).toISOString().split("T")[0];
          if (date === todayStr) continue;
          if (!grouped[date]) grouped[date] = { calories: 0, protein: 0, carbs: 0, fats: 0, count: 0 };
          grouped[date].calories += meal.food?.calories || 0;
          grouped[date].protein  += meal.food?.protein  || 0;
          grouped[date].carbs    += meal.food?.carbs    || 0;
          grouped[date].fats     += meal.food?.fats     || 0;
          grouped[date].count    += 1;
        }
        setHistory(Object.entries(grouped).slice(0, 6).map(([date, d]) => ({ date, ...d })));
      }

      // ── Goals: try diet plan first, then health profile ──
      if (planRes.status === "fulfilled" && planRes.value?.targetCalories) {
        const p = planRes.value;
        setGoals({
          calories: p.targetCalories          || 2000,
          protein:  p.macroSplit?.protein      || 120,
          carbs:    p.macroSplit?.carbs        || 250,
          fats:     p.macroSplit?.fats         || 65,
        });
      } else if (profileRes.status === "fulfilled") {
        const p = profileRes.value?.data || profileRes.value;
        if (p?.targetCalories) {
          setGoals({
            calories: p.targetCalories || 2000,
            protein:  p.proteinTarget  || 120,
            carbs:    p.carbTarget     || 250,
            fats:     p.fatTarget      || 65,
          });
        }
      }
    } catch (e) {
      console.error("MealLogger loadData error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Reload every time screen is focused (after adding a meal)
  useFocusEffect(useCallback(() => { loadData(); }, []));

  const handleRefresh = () => { setRefreshing(true); loadData(); };

  const handleDelete = (mealId, mealName) => {
    Alert.alert("Delete?", `Remove "${mealName}" from today's log?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await deleteMealLog(mealId);
            loadData();
          } catch {
            Alert.alert("Error", "Could not delete meal.");
          }
        },
      },
    ]);
  };

  const formatDate = (dateStr) => {
    const d    = new Date(dateStr);
    const diff = Math.floor((new Date() - d) / 86400000);
    if (diff === 1) return "Yesterday";
    if (diff <= 6)  return d.toLocaleDateString("en-IN", { weekday: "long" });
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  // ── Loading ──
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#FF6F00" />
        <Text style={{ marginTop: 12, color: "#888", fontSize: 14 }}>Loading...</Text>
      </View>
    );
  }

  const totals  = todayLog?.totals  || { calories: 0, protein: 0, carbs: 0, fats: 0 };
  const grouped = todayLog?.grouped || { breakfast: [], lunch: [], dinner: [], snacks: [] };

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={["#FF6F00"]} />
      }
    >
      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Log Meal 🍛</Text>
          <Text style={s.date}>{todayDate}</Text>
        </View>
      </View>

      {/* ── Calorie Ring Card ── */}
      <View style={s.card}>
        <Text style={s.cardLabel}>CALORIES</Text>
        <CalorieRing consumed={Math.round(totals.calories)} goal={goals.calories} />

        {/* 3 stat boxes */}
        <View style={s.statRow}>
          <View style={s.statBox}>
            <Text style={s.statVal}>{goals.calories}</Text>
            <Text style={s.statLbl}>Goal</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={[s.statVal, { color: "#FF6F00" }]}>{Math.round(totals.calories)}</Text>
            <Text style={s.statLbl}>Eaten</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={[s.statVal, {
              color: Math.round(totals.calories) > goals.calories ? "#e53935" : "#43A047"
            }]}>
              {Math.max(goals.calories - Math.round(totals.calories), 0)}
            </Text>
            <Text style={s.statLbl}>Left</Text>
          </View>
        </View>
      </View>

      {/* ── Macro Bars ── */}
      <View style={s.card}>
        <Text style={s.cardLabel}>MACROS</Text>
        <View style={{ marginTop: 12 }}>
          <MacroBar label="💪 Protein" consumed={totals.protein || 0} goal={goals.protein} color="#1E88E5" />
          <MacroBar label="🌾 Carbs"   consumed={totals.carbs   || 0} goal={goals.carbs}   color="#8E24AA" />
          <MacroBar label="🥑 Fats"    consumed={totals.fats    || 0} goal={goals.fats}    color="#FF8F00" />
        </View>
      </View>

      {/* ── Meal Sections ── */}
      <Text style={s.sectionTitle}>Today's Meals</Text>
      {Object.entries(MEAL_META).map(([key, meta]) => {
        const items       = grouped[key] || [];
        const mealCal     = items.reduce((sum, m) => sum + (m.food?.calories || 0), 0);

        return (
          <View key={key} style={s.mealCard}>
            {/* Header row */}
            <View style={s.mealHeader}>
              <View style={s.mealLeft}>
                <View style={[s.mealIconBox, { backgroundColor: meta.color + "20" }]}>
                  <Text style={{ fontSize: 20 }}>{meta.icon}</Text>
                </View>
                <View>
                  <Text style={s.mealLabel}>{meta.label}</Text>
                  <Text style={s.mealCal}>
                    {mealCal > 0 ? `${Math.round(mealCal)} kcal` : "Nothing logged yet"}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[s.addBtn, { backgroundColor: meta.color }]}
                onPress={() => navigation.navigate("LogMeal", { mealType: key })}
                activeOpacity={0.8}
              >
                <Text style={s.addBtnText}>+ Add</Text>
              </TouchableOpacity>
            </View>

            {/* Food items */}
            {items.length > 0 && (
              <View style={s.foodList}>
                {items.map((item, idx) => (
                  <View key={item._id || idx} style={s.foodRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.foodName} numberOfLines={1}>
                        {item.food?.name
                          ? item.food.name.charAt(0).toUpperCase() + item.food.name.slice(1).toLowerCase()
                          : "Unknown"}
                      </Text>
                      <Text style={s.foodMeta}>
                        {item.food?.quantity}g
                        {"  ·  "}P {parseFloat(item.food?.protein || 0).toFixed(1)}g
                        {"  ·  "}C {parseFloat(item.food?.carbs   || 0).toFixed(1)}g
                        {"  ·  "}F {parseFloat(item.food?.fats    || 0).toFixed(1)}g
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={[s.foodCal, { color: meta.color }]}>
                        {Math.round(item.food?.calories || 0)} kcal
                      </Text>
                      <TouchableOpacity
                        style={s.delBtn}
                        onPress={() => handleDelete(item._id, item.food?.name)}
                      >
                        <Text style={s.delBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}

      {/* ── Past Days History ── */}
      {history.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Past Days</Text>
          <View style={s.histCard}>
            {history.map((day, idx) => {
              const pct  = goals.calories > 0 ? Math.min((day.calories / goals.calories) * 100, 100) : 0;
              const over = day.calories > goals.calories;
              return (
                <View
                  key={day.date}
                  style={[s.histRow, idx < history.length - 1 && { borderBottomWidth: 1, borderBottomColor: "#f5f5f5" }]}
                >
                  <View>
                    <Text style={s.histDate}>{formatDate(day.date)}</Text>
                    <Text style={s.histCount}>{day.count} items logged</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 16 }}>
                    <View style={s.histBarBg}>
                      <View style={[s.histBarFill, {
                        width: `${pct}%`,
                        backgroundColor: over ? "#e53935" : "#FF6F00",
                      }]} />
                    </View>
                    <Text style={[s.histCal, { color: over ? "#e53935" : "#555" }]}>
                      {Math.round(day.calories)} kcal
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content:   { padding: 16, paddingBottom: 40 },
  center:    { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f9fafb" },

  header: { marginBottom: 20 },
  title:  { fontSize: 26, fontWeight: "800", color: "#1a1a1a" },
  date:   { fontSize: 13, color: "#888", marginTop: 3 },

  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    marginBottom: 14, elevation: 2,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8,
  },
  cardLabel: {
    fontSize: 11, fontWeight: "700", color: "#aaa",
    letterSpacing: 1.2, textTransform: "uppercase",
  },

  statRow:    { flexDirection: "row", justifyContent: "space-around", marginTop: 4 },
  statBox:    { alignItems: "center" },
  statVal:    { fontSize: 20, fontWeight: "800", color: "#1a1a1a" },
  statLbl:    { fontSize: 11, color: "#aaa", marginTop: 2, fontWeight: "500" },
  statDivider:{ width: 1, backgroundColor: "#f0f0f0" },

  sectionTitle: {
    fontSize: 12, fontWeight: "700", color: "#888",
    textTransform: "uppercase", letterSpacing: 1,
    marginBottom: 10, marginTop: 4,
  },

  mealCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 14,
    marginBottom: 12, elevation: 2,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8,
  },
  mealHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  mealLeft:   { flexDirection: "row", alignItems: "center", gap: 10 },
  mealIconBox:{ width: 42, height: 42, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  mealLabel:  { fontSize: 15, fontWeight: "700", color: "#1a1a1a" },
  mealCal:    { fontSize: 12, color: "#aaa", marginTop: 1 },
  addBtn:     { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  foodList: {
    marginTop: 12, borderTopWidth: 1, borderTopColor: "#f5f5f5",
    paddingTop: 10, gap: 10,
  },
  foodRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  foodName: { fontSize: 14, fontWeight: "600", color: "#1a1a1a" },
  foodMeta: { fontSize: 11, color: "#aaa", marginTop: 2 },
  foodCal:  { fontSize: 13, fontWeight: "700" },
  delBtn:   { width: 24, height: 24, borderRadius: 12, backgroundColor: "#fce4ec", justifyContent: "center", alignItems: "center" },
  delBtnText: { fontSize: 10, color: "#e53935", fontWeight: "700" },

  histCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 4,
    marginBottom: 14, elevation: 2,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8,
  },
  histRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12 },
  histDate:   { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  histCount:  { fontSize: 11, color: "#aaa", marginTop: 1 },
  histBarBg:  { height: 6, backgroundColor: "#f0f0f0", borderRadius: 3, overflow: "hidden", marginBottom: 4 },
  histBarFill:{ height: "100%", borderRadius: 3 },
  histCal:    { fontSize: 12, fontWeight: "700", textAlign: "right" },
});