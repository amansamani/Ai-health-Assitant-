// src/screens/nutrition/ProgressScreen.js
"use strict";
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import API from '../../services/api';
import { COLORS, SHADOWS, RADIUS, SPACING } from '../../constants/theme';

// ─── Insight History Card ────────────────────────────────────────────────────
function InsightCard({ item, index }) {
  const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
  const improved = item.calorieChange > 0;
  return (
    <Animated.View entering={FadeInDown.delay(index * 80).springify()} style={styles.insightCard}>
      <View style={styles.insightHeader}>
        <Text style={styles.insightDate}>{date}</Text>
        <View style={[styles.insightBadge, { backgroundColor: improved ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)' }]}>
          <Ionicons name={improved ? 'trending-up' : 'trending-down'} size={12} color={improved ? COLORS.primary : COLORS.warning} />
          <Text style={[styles.insightBadgeText, { color: improved ? COLORS.primary : COLORS.warning }]}>
            {item.calorieChange > 0 ? '+' : ''}{item.calorieChange || 0} kcal
          </Text>
        </View>
      </View>
      <Text style={styles.insightMessage} numberOfLines={3}>{item.message || 'Weekly adjustment applied.'}</Text>
      {item.newTargetCalories && (
        <Text style={styles.insightTarget}>New target: {item.newTargetCalories} kcal/day</Text>
      )}
    </Animated.View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function ProgressScreen() {
  const router = useRouter();
  const [insights, setInsights] = useState([]);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [insightRes, planRes] = await Promise.all([
        API.get('/nutrition/weekly-insight-log?limit=10'),
        API.get('/nutrition/current'),
      ]);
      setInsights(insightRes.data?.insights || insightRes.data || []);
      setCurrentPlan(planRes.data);
    } catch (e) { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const target = currentPlan?.summary?.targetCalories || currentPlan?.targetCalories || 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View entering={FadeInDown.delay(0)} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Diet Progress</Text>
        <View style={{ width: 40 }} />
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Current target card */}
        <Animated.View entering={FadeInDown.delay(80)} style={styles.targetCard}>
          <LinearGradient colors={[COLORS.surface, COLORS.surfaceElevated]} style={styles.gradientFill}>
            <View style={{ padding: SPACING.lg }}>
              <Text style={styles.targetLabel}>Current Calorie Target</Text>
              <Text style={styles.targetValue}>{target.toLocaleString()} <Text style={styles.targetUnit}>kcal/day</Text></Text>
              {currentPlan?.summary?.proteinTarget > 0 && (
                <View style={styles.macroRow}>
                  <View style={styles.macroChip}>
                    <Text style={styles.macroChipLabel}>P</Text>
                    <Text style={styles.macroChipValue}>{currentPlan.summary.proteinTarget}g</Text>
                  </View>
                  <View style={styles.macroChip}>
                    <Text style={styles.macroChipLabel}>C</Text>
                    <Text style={styles.macroChipValue}>{currentPlan.summary.carbTarget}g</Text>
                  </View>
                  <View style={styles.macroChip}>
                    <Text style={styles.macroChipLabel}>F</Text>
                    <Text style={styles.macroChipValue}>{currentPlan.summary.fatTarget}g</Text>
                  </View>
                </View>
              )}
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Adjustment history */}
        <Text style={styles.sectionTitle}>Weekly Adjustments</Text>
        {insights.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="trending-up-outline" size={48} color={COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>No adjustments yet</Text>
            <Text style={styles.emptySub}>Complete your first week to see AI-powered calorie adjustments.</Text>
          </View>
        ) : (
          insights.map((item, i) => <InsightCard key={item._id || i} item={item} index={i} />)
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingTop: 8, paddingBottom: SPACING.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: 120 },

  targetCard: { borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  gradientFill: { flex: 1 },
  targetLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  targetValue: { fontSize: 38, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -1, marginTop: SPACING.xs },
  targetUnit: { fontSize: 16, fontWeight: '500', color: COLORS.textSecondary },
  macroRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  macroChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F1F2F8',
    borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs,
  },
  macroChipLabel: { fontSize: 11, fontWeight: '800', color: COLORS.primary },
  macroChipValue: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },

  insightCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  insightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  insightDate: { fontSize: 12, color: COLORS.textTertiary, fontWeight: '600' },
  insightBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  insightBadgeText: { fontSize: 11, fontWeight: '700' },
  insightMessage: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
  insightTarget: { fontSize: 12, color: COLORS.primary, fontWeight: '600', marginTop: SPACING.sm },

  empty: { alignItems: 'center', paddingTop: 60, gap: SPACING.sm },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  emptySub: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: SPACING.xl },
});
