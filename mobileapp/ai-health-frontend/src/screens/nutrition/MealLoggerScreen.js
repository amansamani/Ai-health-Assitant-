import React, { useState, useCallback } from "react";
import { showToast } from "../../services/uiFeedback";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import {
  getTodayLog, getMealHistory, deleteMealLog, getHealthProfile, getCurrentPlan,
} from "../../services/nutritionService";
import { COLORS } from "../../constants/theme";
import { SunriseIcon, SunIcon, MoonStarIcon, AppleIcon } from "../../components/icons/MotionIcons";
import { useReplayOnFocus } from "../../hooks/useReplayOnFocus";

const MEAL_META = {
  breakfast: { Icon: SunriseIcon, label: "Breakfast", color: "#FF8F00" },
  lunch:     { Icon: SunIcon,     label: "Lunch",     color: "#43A047" },
  dinner:    { Icon: MoonStarIcon,label: "Dinner",     color: "#1E88E5" },
  snacks:    { Icon: AppleIcon,   label: "Snacks",     color: "#8E24AA" },
};

function CalorieRing({ consumed, goal }) {
  const pct       = goal > 0 ? Math.min(consumed / goal, 1) : 0;
  const remaining = Math.max(goal - consumed, 0);
  const over      = consumed > goal;
  const ringColor = over ? COLORS.error : COLORS.accent;
  const SIZE      = 170;
  const BORDER    = 14;

  return (
    <View style={{ alignSelf: "center", width: SIZE, height: SIZE, justifyContent: "center", alignItems: "center", marginVertical: 16 }}>
      <View style={{ position: "absolute", width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: BORDER, borderColor: COLORS.border }} />
      {pct > 0 && (
        <View style={{
          position: "absolute", width: SIZE, height: SIZE,
          borderRadius: SIZE / 2, borderWidth: BORDER,
          borderColor: "transparent",
          borderTopColor: ringColor,
          borderRightColor: pct >= 0.5  ? ringColor : "transparent",
          borderBottomColor: pct >= 0.75 ? ringColor : "transparent",
          borderLeftColor: pct >= 1     ? ringColor : "transparent",
          transform: [{ rotate: "-90deg" }],
        }} />
      )}
      <View style={{ alignItems: "center" }}>
        <Text style={{ fontSize: 30, fontWeight: "800", color: over ? COLORS.error : COLORS.textDark }}>
          {Math.round(consumed)}
        </Text>
        <Text style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: "500" }}>kcal eaten</Text>
        <View style={{ width: 32, height: 1, backgroundColor: COLORS.border, marginVertical: 5 }} />
        <Text style={{ fontSize: 20, fontWeight: "700", color: over ? COLORS.error : COLORS.accent }}>
          {over ? `+${Math.round(consumed - goal)}` : Math.round(remaining)}
        </Text>
        <Text style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: "500" }}>
          {over ? "over goal" : "remaining"}
        </Text>
      </View>
    </View>
  );
}

function MacroBar({ label, consumed, goal, color }) {
  const pct  = goal > 0 ? Math.min((consumed / goal) * 100, 100) : 0;
  const over = consumed > goal;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14, gap: 10 }}>
      <Text style={{ width: 92, fontSize: 13, fontWeight: "600", color: "#444" }}>{label}</Text>
      <View style={{ flex: 1, height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: "hidden" }}>
        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: over ? COLORS.error : color, borderRadius: 4 }} />
      </View>
      <Text style={{ width: 76, fontSize: 12, textAlign: "right" }}>
        <Text style={{ color: over ? COLORS.error : COLORS.textDark, fontWeight: "700" }}>
          {parseFloat(consumed.toFixed(1))}
        </Text>
        <Text style={{ color: COLORS.textMuted }}>/{goal}g</Text>
      </Text>
    </View>
  );
}

export default function MealLoggerScreen({ navigation }) {
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayLog, setTodayLog]     = useState(null);
  const [history, setHistory]       = useState([]);
  const [goals, setGoals]           = useState({
    calories: 2000, protein: 120, carbs: 250, fats: 65,
  });
  const iconTrigger = useReplayOnFocus();

  const todayDate = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long",
  });

  const emptyLog = {
    grouped: { breakfast: [], lunch: [], dinner: [], snacks: [] },
    totals:  { calories: 0, protein: 0, carbs: 0, fats: 0 },
  };

  const loadData = async () => {
    try {
      const [logRes, histRes, profileRes, planRes] = await Promise.allSettled([
        getTodayLog(),
        getMealHistory(7),
        getHealthProfile(),
        getCurrentPlan(),
      ]);

      if (logRes.status === "fulfilled" && logRes.value) {
        const val = logRes.value;
        if (val?.totals && val?.data) {
          setTodayLog({
            grouped: val.data,
            totals:  val.totals,
          });
        } else if (val?.grouped && val?.totals) {
          setTodayLog(val);
        } else {
          setTodayLog(emptyLog);
        }
      } else {
        setTodayLog(emptyLog);
      }

      if (histRes.status === "fulfilled" && histRes.value) {
        const meals = histRes.value?.data ?? histRes.value ?? [];
        if (Array.isArray(meals)) {
          const grouped = {};
          const todayStr = new Date().toISOString().split("T")[0];
          for (const meal of meals) {
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
      }

      let goalsSet = false;

      if (planRes.status === "fulfilled" && planRes.value) {
        const p = planRes.value?.data ?? planRes.value;
        if (p?.targetCalories) {
          setGoals({
            calories: p.targetCalories                                         || 2000,
            protein:  p.summary?.macroTargets?.proteinG ?? p.macroSplit?.protein ?? 120,
            carbs:    p.summary?.macroTargets?.carbsG   ?? p.macroSplit?.carbs   ?? 250,
            fats:     p.summary?.macroTargets?.fatsG    ?? p.macroSplit?.fats    ??  65,
          });
          goalsSet = true;
        }
      }

      if (!goalsSet && profileRes.status === "fulfilled" && profileRes.value) {
        const p = profileRes.value?.data ?? profileRes.value;
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
      console.error("MealLogger loadData error:", e.message);
      setTodayLog(emptyLog);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadData();
  }, []));

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
            showToast("Could not delete meal.", { title: "Couldn't delete meal", type: "error" });
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

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={{ marginTop: 12, color: COLORS.textLight, fontSize: 14 }}>Loading...</Text>
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
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[COLORS.accent]} />
      }
    >
      <View style={s.header}>
        <Text style={s.title}>Log Meal 🍛</Text>
        <Text style={s.date}>{todayDate}</Text>
      </View>

      <View style={s.card}>
        <Text style={s.cardLabel}>CALORIES</Text>
        <CalorieRing consumed={Math.round(totals.calories)} goal={goals.calories} />
        <View style={s.statRow}>
          <View style={s.statBox}>
            <Text style={s.statVal}>{goals.calories}</Text>
            <Text style={s.statLbl}>Goal</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={[s.statVal, { color: COLORS.accent }]}>{Math.round(totals.calories)}</Text>
            <Text style={s.statLbl}>Eaten</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={[s.statVal, { color: Math.round(totals.calories) > goals.calories ? COLORS.error : "#43A047" }]}>
              {Math.max(goals.calories - Math.round(totals.calories), 0)}
            </Text>
            <Text style={s.statLbl}>Left</Text>
          </View>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.cardLabel}>MACROS</Text>
        <View style={{ marginTop: 12 }}>
          <MacroBar label="💪 Protein" consumed={totals.protein || 0} goal={goals.protein} color="#1E88E5" />
          <MacroBar label="🌾 Carbs"   consumed={totals.carbs   || 0} goal={goals.carbs}   color="#8E24AA" />
          <MacroBar label="🥑 Fats"    consumed={totals.fats    || 0} goal={goals.fats}    color="#FF8F00" />
        </View>
      </View>

      <TouchableOpacity
        style={s.photoEntryCard}
        onPress={() => navigation.navigate("LogMealPhoto")}
        activeOpacity={0.85}
      >
        <Ionicons name="camera-outline" size={22} color="#6E3482" />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.photoEntryTitle}>Snap a Photo</Text>
          <Text style={s.photoEntrySub}>Let AI estimate your meal's calories</Text>
        </View>
        <Ionicons name="arrow-forward" size={18} color="#6E3482" />
      </TouchableOpacity>

      <Text style={s.sectionTitle}>Today's Meals</Text>
      {Object.entries(MEAL_META).map(([key, meta]) => {
        const items   = grouped[key] || [];
        const mealCal = items.reduce((sum, m) => sum + (m.food?.calories || 0), 0);

        return (
          <View key={key} style={s.mealCard}>
            <View style={s.mealHeader}>
              <View style={s.mealLeft}>
                <View style={[s.mealIconBox, { backgroundColor: meta.color + "20" }]}>
                  <meta.Icon trigger={iconTrigger} size={22} color={meta.color} />
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
                        {item.food?.quantity}g{"  ·  "}
                        P {parseFloat(item.food?.protein || 0).toFixed(1)}g{"  ·  "}
                        C {parseFloat(item.food?.carbs   || 0).toFixed(1)}g{"  ·  "}
                        F {parseFloat(item.food?.fats    || 0).toFixed(1)}g
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={[s.foodCal, { color: meta.color }]}>
                        {Math.round(item.food?.calories || 0)} kcal
                      </Text>
                      <TouchableOpacity
                        style={s.delBtn}
                        onPress={() => handleDelete(item._id, item.food?.name)}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${item.food?.name ?? "item"}`}
                      >
                        <Ionicons name="trash-outline" size={13} color={COLORS.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}

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
                  style={[s.histRow, idx < history.length - 1 && { borderBottomWidth: 1, borderBottomColor: COLORS.border }]}
                >
                  <View>
                    <Text style={s.histDate}>{formatDate(day.date)}</Text>
                    <Text style={s.histCount}>{day.count} items logged</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 16 }}>
                    <View style={s.histBarBg}>
                      <View style={[s.histBarFill, { width: `${pct}%`, backgroundColor: over ? COLORS.error : COLORS.accent }]} />
                    </View>
                    <Text style={[s.histCal, { color: over ? COLORS.error : "#555" }]}>
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content:   { padding: 16, paddingBottom: 40 },
  center:    { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.background },

  header: { marginBottom: 20 },
  title:  { fontSize: 26, fontWeight: "800", color: COLORS.textDark },
  date:   { fontSize: 13, color: COLORS.textLight, marginTop: 3 },

  card: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, marginBottom: 14,
    elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8,
  },
  cardLabel:   { fontSize: 11, fontWeight: "700", color: COLORS.textMuted, letterSpacing: 1.2, textTransform: "uppercase" },
  statRow:     { flexDirection: "row", justifyContent: "space-around", marginTop: 4 },
  statBox:     { alignItems: "center" },
  statVal:     { fontSize: 20, fontWeight: "800", color: COLORS.textDark },
  statLbl:     { fontSize: 11, color: COLORS.textMuted, marginTop: 2, fontWeight: "500" },
  statDivider: { width: 1, backgroundColor: COLORS.border },

  sectionTitle: { fontSize: 12, fontWeight: "700", color: COLORS.textLight, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, marginTop: 4 },
  photoEntryCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#EDE9FE", borderRadius: 16,
    borderWidth: 1.5, borderColor: "#A56ABD",
    paddingVertical: 14, paddingHorizontal: 16,
    marginBottom: 20,
  },
  photoEntryTitle: { fontSize: 14, fontWeight: "800", color: "#1B1730" },
  photoEntrySub: { fontSize: 12, color: "#6B667D", marginTop: 1 },
  photoEntryArrow: { fontSize: 18, color: "#6E3482", fontWeight: "700" },

  mealCard: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 14, marginBottom: 12,
    elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8,
  },
  mealHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  mealLeft:    { flexDirection: "row", alignItems: "center", gap: 10 },
  mealIconBox: { width: 42, height: 42, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  mealLabel:   { fontSize: 15, fontWeight: "700", color: COLORS.textDark },
  mealCal:     { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  addBtn:      { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addBtnText:  { color: COLORS.surface, fontWeight: "700", fontSize: 13 },

  foodList:   { marginTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, gap: 10 },
  foodRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  foodName:   { fontSize: 14, fontWeight: "600", color: COLORS.textDark },
  foodMeta:   { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  foodCal:    { fontSize: 13, fontWeight: "700" },
  delBtn:     { width: 24, height: 24, borderRadius: 12, backgroundColor: "#fce4ec", justifyContent: "center", alignItems: "center" },
  delBtnText: { fontSize: 10, color: COLORS.error, fontWeight: "700" },

  histCard:    { backgroundColor: COLORS.surface, borderRadius: 16, padding: 4, marginBottom: 14, elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  histRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12 },
  histDate:    { fontSize: 14, fontWeight: "700", color: COLORS.textDark },
  histCount:   { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  histBarBg:   { height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: "hidden", marginBottom: 4 },
  histBarFill: { height: "100%", borderRadius: 3 },
  histCal:     { fontSize: 12, fontWeight: "700", textAlign: "right" },
});
