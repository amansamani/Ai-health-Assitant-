"use strict";
import React, { useState, useCallback, useContext } from "react";
import { View, Text, ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Alert } from "react-native";
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import API from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import { COLORS, SHADOWS, RADIUS, SPACING } from "../../constants/theme";

function MacroBar({ label, value, target, color, delay = 0 }) {
  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.macroRow}>
      <Text style={styles.macroLabel}>{label}</Text>
      <View style={styles.macroTrack}><View style={[styles.macroFill, { width: `${pct * 100}%`, backgroundColor: color }]} /></View>
      <Text style={styles.macroValue}>{Math.round(value)}<Text style={styles.macroTarget}>/{Math.round(target)}g</Text></Text>
    </Animated.View>
  );
}

function MealCard({ meal, planned, completed, onToggle, delay = 0 }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const META = {
    breakfast: { icon: '🌅', bg: 'rgba(255,143,0,0.12)' },
    lunch: { icon: '☀️', bg: 'rgba(67,160,71,0.12)' },
    dinner: { icon: '🌙', bg: 'rgba(30,136,229,0.12)' },
    snack: { icon: '🍎', bg: 'rgba(142,36,170,0.12)' },
  };
  const meta = META[meal] || META.snack;
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()}>
      <Animated.View style={[styles.mealCard, animatedStyle]}>
        <TouchableOpacity activeOpacity={0.85} onPress={onToggle}
          onPressIn={() => { scale.value = withSpring(0.97); }} onPressOut={() => { scale.value = withSpring(1); }}>
          <View style={styles.mealInner}>
            <View style={[styles.mealIcon, { backgroundColor: meta.bg }]}><Text style={{ fontSize: 20 }}>{meta.icon}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.mealName}>{meal.charAt(0).toUpperCase() + meal.slice(1)}</Text>
              <Text style={styles.mealCals}>{completed ? planned : 0} / {planned} kcal</Text>
            </View>
            <View style={[styles.toggle, { backgroundColor: completed ? COLORS.primary : COLORS.surfaceElevated }]}>
              <Ionicons name={completed ? 'checkmark' : 'add'} size={16} color={completed ? '#fff' : COLORS.textSecondary} />
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

export default function NutritionDashboardScreen() {
  const router = useRouter();
  const [plan, setPlan] = useState(null);
  const [todayLog, setTodayLog] = useState(null);
  const [hasPlan, setHasPlan] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [planRes, logRes] = await Promise.all([
        API.get('/nutrition/current'),
        API.get('/nutrition/log'),
      ]);
      if (!planRes.data || !planRes.data.meals) setHasPlan(false);
      else { setHasPlan(true); setPlan(planRes.data); }
      setTodayLog(logRes.data);
    } catch (e) { setHasPlan(false); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); fetchData(); }, [fetchData]));

  const generatePlan = async () => {
    setGenerating(true);
    try {
      await API.post('/nutrition/generate');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await fetchData();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not generate plan.');
    } finally { setGenerating(false); }
  };

  const toggleMeal = async (mealType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const current = todayLog?.log?.mealsCompleted || {};
    const updated = { ...current, [mealType]: !current[mealType] };
    try { await API.post('/nutrition/log', { mealsCompleted: updated }); fetchData(); }
    catch (e) { Alert.alert('Error', 'Could not update meal log.'); }
  };

  if (loading) return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  const target = plan?.summary?.targetCalories || plan?.targetCalories || 2000;
  const consumed = todayLog?.log?.caloriesConsumed || 0;
  const caloriesPct = Math.min(consumed / target, 1);
  const mealsCompleted = todayLog?.log?.mealsCompleted || {};
  const mealContext = todayLog?.plan?.mealContext || {};

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.delay(0)} style={styles.header}>
        <Text style={styles.title}>Nutrition</Text>
        <TouchableOpacity style={styles.addMealBtn} onPress={() => router.push('/(app)/nutrition/meal-logger')}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await fetchData(); setRefreshing(false); }} tintColor={COLORS.primary} />}>

        {!hasPlan ? (
          <Animated.View entering={FadeInDown.delay(80)} style={styles.ctaCard}>
            <LinearGradient colors={[COLORS.heroFrom, COLORS.heroTo]} style={styles.ctaGradient}>
              <Ionicons name="nutrition" size={28} color="#fff" />
              <Text style={styles.ctaTitle}>No Diet Plan Yet</Text>
              <Text style={styles.ctaSub}>Let AI build a personalized meal plan from your health profile.</Text>
              <TouchableOpacity style={styles.ctaBtn} onPress={generatePlan} disabled={generating}>
                {generating ? <ActivityIndicator color={COLORS.primary} size="small" /> : (
                  <><Ionicons name="sparkles" size={18} color={COLORS.primary} /><Text style={styles.ctaBtnText}>Generate My Plan</Text></>
                )}
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        ) : (
          <>
            <Animated.View entering={FadeInDown.delay(80)} style={styles.calorieCard}>
              <View style={{ padding: SPACING.lg }}>
                <Text style={styles.calorieLabel}>Today's Calories</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm, marginTop: SPACING.sm }}>
                  <Text style={styles.calorieBig}>{consumed.toLocaleString()}</Text>
                  <Text style={styles.calorieOf}>/ {target.toLocaleString()} kcal</Text>
                </View>
                <View style={styles.calorieTrack}><View style={[styles.calorieFill, { width: `${caloriesPct * 100}%` }]} /></View>
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(160)} style={styles.macrosCard}>
              <Text style={styles.sectionTitle}>Macros</Text>
              <MacroBar label="Protein" value={0} target={plan?.summary?.proteinTarget || 120} color={COLORS.primary} delay={200} />
              <MacroBar label="Carbs" value={0} target={plan?.summary?.carbTarget || 200} color={COLORS.warning} delay={260} />
              <MacroBar label="Fats" value={0} target={plan?.summary?.fatTarget || 60} color={COLORS.danger} delay={320} />
            </Animated.View>

            <Text style={[styles.sectionTitle, { marginTop: SPACING.lg, marginBottom: SPACING.md }]}>Today's Meals</Text>
            {['breakfast', 'lunch', 'dinner', 'snack'].map((meal, i) => (
              <MealCard key={meal} meal={meal} planned={mealContext[meal]?.plannedCalories || 0}
                completed={!!mealsCompleted[meal]} onToggle={() => toggleMeal(meal)} delay={400 + i * 80} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingTop: 8, paddingBottom: SPACING.md },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.5 },
  addMealBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', ...SHADOWS.sm },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: 120 },
  ctaCard: { borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: SPACING.lg, ...SHADOWS.md },
  ctaGradient: { padding: SPACING.lg, alignItems: 'center' },
  ctaTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginTop: SPACING.sm },
  ctaSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 4, lineHeight: 19 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: '#fff', borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: 12, marginTop: SPACING.md },
  ctaBtnText: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  calorieCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm },
  calorieLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  calorieBig: { fontSize: 42, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -2 },
  calorieOf: { fontSize: 16, color: COLORS.textSecondary, marginBottom: 4 },
  calorieTrack: { height: 8, backgroundColor: COLORS.track, borderRadius: 4, marginTop: SPACING.md },
  calorieFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 4 },
  macrosCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOWS.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  macroRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  macroLabel: { width: 56, fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  macroTrack: { flex: 1, height: 6, backgroundColor: COLORS.track, borderRadius: 3 },
  macroFill: { height: '100%', borderRadius: 3 },
  macroValue: { width: 72, fontSize: 12, color: COLORS.textPrimary, fontWeight: '600', textAlign: 'right' },
  macroTarget: { color: COLORS.textTertiary },
  mealCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm, overflow: 'hidden', ...SHADOWS.sm },
  mealInner: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: SPACING.md },
  mealIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mealName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  mealCals: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  toggle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
